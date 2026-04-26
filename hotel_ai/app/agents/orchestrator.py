"""
Orchestrator — the advisor brain.

Responsibilities
----------------
1. Classify a HotelEvent into one or more DepartmentActions using the LLM,
   with the guest's memory hydrated into the prompt.
2. Apply deterministic policy to the classification result so safety
   doesn't depend on the model:
     - emergency keywords (life-safety)
     - accessibility-aware fan-out (incl. non-emergency cases)
     - VIP fan-out
     - repeat-issue escalation (Option C)
     - abuse / threat handling (Option C)
     - quiet-hours deferral for routine work (Option C)
3. Ask each relevant department agent to produce a PlanFragment
   (already localized into the guest's preferred language).
4. Merge fragments into a single `Plan` for Node to execute.
5. Update Python-side guest memory with intent-tagged request summaries.

Localization model
------------------
Department agents render their guest_reply directly in the guest's
preferred language. The orchestrator no longer makes a second LLM
round trip to translate replies.

Memory hygiene
--------------
- Every recorded request is intent-tagged AND timestamped (UTC).
- The fallback path uses "unclassified" so future reads can see the
  entry was triaged by fallback rules, not the LLM.
- Stored summaries are truncated to 120 chars.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Iterable

try:
    # Python 3.9+ stdlib
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
except ImportError:  # pragma: no cover - older Pythons
    ZoneInfo = None  # type: ignore[assignment]
    ZoneInfoNotFoundError = Exception  # type: ignore[assignment,misc]

from app.agents.accessibility import AccessibilityAgent
from app.agents.base import BaseAgent, PlanFragment
from app.agents.concierge import ConciergeAgent
from app.agents.fnb import FoodBeverageAgent
from app.agents.front_desk import FrontDeskAgent
from app.agents.guest_relations import GuestRelationsAgent
from app.agents.housekeeping import HousekeepingAgent
from app.agents.maintenance import MaintenanceAgent
from app.agents.reservations import ReservationsAgent
from app.agents.revenue import RevenueAgent
from app.agents.security import ABUSE_MARKER, SecurityAgent
from app.agents.spa import SpaAgent
from app.config import get_settings
from app.llm.client import LLMClient
from app.memory.guest_memory import GuestMemory
from app.models import (
    ALLOWED_LLM_DEPARTMENTS,
    AgentEvent,
    AgentEventType,
    Department,
    DepartmentAction,
    HotelEvent,
    MemoryUpdate,
    Plan,
    Priority,
    StayContext,
)
from app.models.guest import GuestProfile
from app.utils.logging import get_logger

log = get_logger(__name__)


# --- LLM classification prompt -------------------------------------------------

_CLASSIFY_SYSTEM = """\
You are the triage brain of a hotel operations AI. Given a guest message or
system event — together with a "Guest context" block describing what we know
about this guest — decide which hotel department(s) must act, and with what
priority.

Respond with STRICT JSON of the form:
{
  "actions": [
    {
      "department": "<one of: front_desk, housekeeping, concierge, maintenance, food_beverage, guest_relations, revenue, security, reservations, accessibility, spa, laundry, valet>",
      "summary": "<short imperative sentence>",
      "details": "<1-3 sentences of context for staff>",
      "priority": "<low|normal|high|urgent|emergency>",
      "requires_coordination_with": ["<other department codes>"]
    }
  ],
  "intent": "<short label like 'amenity_request', 'maintenance_issue', 'emergency'>",
  "sentiment": "<neutral|positive|frustrated|distressed>"
}

Rules:
- Default to 'normal' priority when unsure.
- `requires_coordination_with` must always be an array (use [] if none), never null.
- Output ONLY the JSON. No prose.

Routing rules (apply before anything else):
- Routine amenity items (towels, pillows, toiletries, robes, blankets, slippers, hangers) -> housekeeping, never front_desk.
- Stay-management requests (check-in/out timing, room change, key card, billing) -> front_desk OR reservations if it's a reservation/room change.
- Anything broken / not working in the room (AC, TV, lights, plumbing, water leak) -> maintenance.
- Food and drink orders, AND complaints about food (cold, wrong, missing, late) -> food_beverage.
- Spa, gym, pool, treatment bookings -> spa.
- Disturbances (noise, intoxication, harassment, suspicious activity) -> security and/or front_desk. NEVER route a disturbance to concierge.
- Upgrades, late checkout (paid), in-room champagne, dinner reservations the guest hasn't asked us to book yet -> revenue.

Priority calibration (apply LAST):
- 'emergency' / 'urgent' is reserved for life-safety risk ONLY: smoke, fire, medical distress, active flooding, violence, threats. NEVER use these levels for service complaints, even if the guest is upset.
- 'high' = guest is meaningfully inconvenienced and a fix needs to happen soon.
- 'normal' = routine requests and minor service complaints. This is the default.
- 'low' = informational or non-time-sensitive ("just letting you know").
- If the guest sounds angry or the issue repeats, include guest_relations — but DO NOT bump priority to 'emergency'/'urgent' on emotion alone.

Use the Guest context block to reason:
- If the guest has reported the SAME problem before during this stay or in
  recent history, bump priority one step (normal->high, high->urgent) and
  add guest_relations to the coordination list.
- If the guest is VIP or has accessibility needs, lean toward higher priority.
- If preferences are known, reflect them in the action `details` so staff can act on them.
- A first-time guest with a novel request is a 'normal' unless the text itself signals urgency.
"""


# --- Deterministic safety signals ---------------------------------------------

# Emergency keyword regex. The orchestrator forces priority to EMERGENCY
# (and fans out to security/front_desk) whenever any of these match,
# regardless of what the LLM decided.
#
# Notes on shape:
# - We use `\b` boundaries on independent tokens but allow filler words
#   between "stuck in" and "elevator|lift" so natural phrasing matches
#   ("stuck in the elevator", "stuck in my lift").
# - Verbs that inflect (overdose -> overdosed -> overdosing) are spelled
#   out instead of relying on stemming.
_EMERGENCY_PATTERNS = re.compile(
    r"("
    r"\b(?:help(?:\s*me)?|emergency|panic|sos)\b"
    r"|\b(?:fire|smoke|burning)\b"
    r"|\b(?:bleeding|chest\s*pain|can'?t\s*breathe|choking|overdos(?:e|ed|ing))\b"
    r"|\b(?:allergic\s*reaction|anaphylactic|unconscious|fallen|can'?t\s*move)\b"
    r"|\b(?:gas\s*leak|flooding|flood\s+in)\b"
    r"|\bstuck\s+in(?:\s+\w+){0,2}\s+(?:lift|elevator)\b"
    r"|\b(?:intruder|attacked|assault(?:ed)?|threat(?:ened)?)\b"
    r")",
    re.IGNORECASE,
)


def looks_like_emergency(text: str) -> bool:
    return bool(_EMERGENCY_PATTERNS.search(text or ""))


# Heuristic for "physical access matters" events — used to pull the
# Accessibility agent in for guests with registered needs even when
# the event isn't a hard emergency.
_ACCESS_RELEVANT_PATTERNS = re.compile(
    r"\b("
    r"elevator|lift|stairs?|stairwell"
    r"|evacuat(?:e|ion|ing)|drill|alarm"
    r"|move\s+rooms?|change\s+rooms?|relocate"
    r"|wheelchair|cane|walker|service\s*animal"
    r"|can'?t\s*reach|can'?t\s*get\s*to"
    r")\b",
    re.IGNORECASE,
)


def looks_access_relevant(text: str) -> bool:
    return bool(_ACCESS_RELEVANT_PATTERNS.search(text or ""))


# --- Abuse / threat keywords (Option C) -------------------------------
#
# We deliberately keep this list short, conservative, and obvious-only.
# Goals:
#   1. Catch direct slurs/threats aimed at staff.
#   2. Route these events to Security with a calm, de-escalating reply
#      instead of letting the LLM generate something that might escalate.
#
# We do NOT try to detect generic "frustrated" speech — that's
# `sentiment=frustrated` from the classifier and goes through the
# normal Guest Relations path. The list below is for things that
# meaningfully change routing (security needs to be in the loop).
#
# This is a starter set; replace with a vendor list (Perspective API,
# OpenAI Moderation) when you wire one up. Keep this file as the
# single deterministic backstop so even an unavailable vendor doesn't
# regress safety.
_ABUSE_PATTERNS = re.compile(
    r"("
    # f-bomb in all common inflections (fuck, fucking, fucker, fucked, fucks).
    # Tolerates separators between letters (e.g. "f*ck", "f.u.c.k").
    r"\bf[\W_]*u[\W_]*c[\W_]*k(?:ing|er|ed|s)?\b"
    r"|\bkill\s+(?:you|yourself|myself)\b"
    r"|\bi\s*will\s*(?:hurt|kill|hit)\b"
    r"|\bpiece\s+of\s+(?:shit|trash)\b"
    r"|\bshut\s+up\b"
    # "you (...up to 3 filler words...) idiot|moron|stupid|asshole"
    # — catches "you idiot", "you fucking idiot", "you absolute moron".
    r"|\byou(?:\s+\w+){0,3}\s+(?:idiot|moron|stupid|asshole)\b"
    r")",
    re.IGNORECASE,
)


def looks_abusive(text: str) -> bool:
    return bool(_ABUSE_PATTERNS.search(text or ""))


# --- Quiet-hours helper (Option C) -----------------------------------
#
# Returns True iff the wall-clock hour at the hotel is within the
# configured quiet window. The window is a half-open interval that
# crosses midnight when start > end (the common case: 22:00 → 07:00).


def in_quiet_hours(now: datetime, tz_name: str, start_hour: int, end_hour: int) -> bool:
    """Is `now` within [start_hour, end_hour) in the hotel's local time?

    `now` should be timezone-aware (UTC). `tz_name` is an IANA TZ name
    like "Europe/London". Falls back to treating `now` as already-local
    if the TZ isn't installed (rare on minimal containers).
    """
    # Fast path for UTC — avoids needing the IANA tzdata package to be
    # installed (a real concern on Windows, which doesn't ship it).
    if tz_name in ("UTC", "Etc/UTC", ""):
        local = now
    elif ZoneInfo is None:
        local = now.replace(tzinfo=None)
    else:
        try:
            local = now.astimezone(ZoneInfo(tz_name))
        except ZoneInfoNotFoundError:
            log.warning("unknown_hotel_timezone", extra={"tz": tz_name})
            local = now
    h = local.hour
    if start_hour == end_hour:
        return False  # zero-length window = disabled
    if start_hour < end_hour:
        return start_hour <= h < end_hour
    # Wraps midnight (e.g. 22 → 7): inside if h >= start OR h < end.
    return h >= start_hour or h < end_hour


# Departments whose work is OK to defer when it's the middle of the
# night and nothing is urgent. Emergencies and security/maintenance are
# never deferred — guests don't care that it's 2am if their AC is dead.
_QUIET_DEFERRABLE: frozenset[Department] = frozenset({
    Department.HOUSEKEEPING,
    Department.LAUNDRY,
    Department.SPA,
    Department.REVENUE,
})


# -------------------------------------------------------------------------------


class Orchestrator:
    def __init__(self, llm: LLMClient, memory: GuestMemory) -> None:
        self.llm = llm
        self.memory = memory

        housekeeping = HousekeepingAgent(llm)
        concierge = ConciergeAgent(llm)

        # Every Department exposed in the LLM prompt has a real handler.
        # LAUNDRY and VALET piggyback on Housekeeping/Concierge for now.
        self._agents: dict[Department, BaseAgent] = {
            Department.FRONT_DESK: FrontDeskAgent(llm),
            Department.HOUSEKEEPING: housekeeping,
            Department.CONCIERGE: concierge,
            Department.MAINTENANCE: MaintenanceAgent(llm),
            Department.FOOD_BEVERAGE: FoodBeverageAgent(llm),
            Department.GUEST_RELATIONS: GuestRelationsAgent(llm),
            Department.SECURITY: SecurityAgent(llm),
            Department.ACCESSIBILITY: AccessibilityAgent(llm),
            Department.SPA: SpaAgent(llm),
            Department.RESERVATIONS: ReservationsAgent(llm),
            Department.REVENUE: RevenueAgent(llm),
            Department.LAUNDRY: housekeeping,
            Department.VALET: concierge,
        }

    # --------------------------------------------------------------- public --

    def build_plan(self, event: HotelEvent, stay: StayContext) -> Plan:
        log.info(
            "event_received",
            extra={
                "event_id": event.id,
                "guest": stay.guest.redacted(),
                "channel": event.channel.value,
            },
        )

        # 0. Ensure a profile exists so memory updates can write.
        self.memory.upsert_from_reservation(stay.guest)

        # 1. LLM triage — hydrated with guest memory.
        llm_result = self._classify(event, stay)
        actions = [DepartmentAction.model_validate(a) for a in llm_result["actions"]]
        intent = llm_result.get("intent", "")
        sentiment = llm_result.get("sentiment", "neutral")

        # 2. Policy passes (deterministic safety / business rules).
        actions = list(self._apply_policy(actions, event, stay, intent))

        # 3. Opening orchestrator events.
        plan_events: list[AgentEvent] = [
            AgentEvent(
                agent="Orchestrator",
                type=AgentEventType.THOUGHT,
                message=f"Event received via {event.channel.value}: \"{event.text[:140]}\"",
                details=f"guest_id={stay.guest.guest_id} room={stay.room_number}",
            ),
            AgentEvent(
                agent="Orchestrator",
                type=AgentEventType.DECISION,
                message=self._routing_summary(actions),
                details=f"intent={intent} sentiment={sentiment}",
            ),
        ]

        # 4. Fan out to agents, collect fragments.
        plan = Plan(
            intent=intent,
            sentiment=sentiment,
            priority=self._top_priority(actions).value,
            emergency=any(a.priority == Priority.EMERGENCY for a in actions),
            trace_id=event.trace_id,
        )
        plan.events.extend(plan_events)

        per_action_fragments: list[tuple[DepartmentAction, PlanFragment]] = []
        for action in actions:
            agent = self._agents.get(action.department)
            if not agent:
                log.warning(
                    "no_agent_for_department",
                    extra={"department": action.department.value},
                )
                continue
            fragment: PlanFragment = agent.handle(action, stay)
            plan.events.extend(fragment.events)
            plan.tool_calls.extend(fragment.tool_calls)
            plan.memory_updates.extend(fragment.memory_updates)
            per_action_fragments.append((action, fragment))

        plan.guest_reply = self._pick_guest_reply(per_action_fragments)

        # 5. Memory write — intent-tagged + timestamped.
        recorded_intent = intent or "unclassified"
        recorded_summary = event.text
        self.memory.record_request(
            stay.guest.guest_id,
            recorded_summary,
            intent=recorded_intent,
        )
        plan.memory_updates.append(
            MemoryUpdate(
                op="record_request",
                guest_id=stay.guest.guest_id,
                summary=f"{recorded_intent}: {recorded_summary[:120]}",
            )
        )

        return plan

    # --------------------------------------------------------------- steps --

    def _classify(self, event: HotelEvent, stay: StayContext) -> dict:
        profile = self.memory.get_profile(stay.guest.guest_id)
        context_block = self._build_context_block(stay, profile)
        user_message = (
            f"Guest context:\n{context_block}\n\n"
            f"Current event (channel={event.channel.value}):\n{event.text}"
        )

        try:
            raw = self.llm.classify_json(system=_CLASSIFY_SYSTEM, user=user_message)
            if not raw.get("actions"):
                raise ValueError("empty actions")
            kept = []
            for a in raw["actions"]:
                try:
                    parsed = DepartmentAction.model_validate(a)
                    if parsed.department not in ALLOWED_LLM_DEPARTMENTS:
                        log.warning(
                            "invalid_llm_department",
                            extra={"department": str(parsed.department)},
                        )
                        continue
                    kept.append(parsed.model_dump(mode="json"))
                except Exception as e:  # noqa: BLE001
                    log.warning(
                        "invalid_llm_action",
                        extra={"action": a, "error": str(e)},
                    )
            if not kept:
                raise ValueError("no valid actions")
            raw["actions"] = kept
            return raw
        except Exception as e:  # noqa: BLE001
            log.error(
                "llm_classify_failed",
                extra={"event_id": event.id, "error": str(e)},
            )
            return {
                "actions": [{
                    "department": Department.FRONT_DESK.value,
                    "summary": "Guest request needs triage",
                    "details": event.text,
                    "priority": Priority.NORMAL.value,
                    "requires_coordination_with": [],
                }],
                "intent": "unclassified",
                "sentiment": "neutral",
            }

    # --------------------------------------------------- memory hydration --

    @staticmethod
    def _build_context_block(stay: StayContext, profile: GuestProfile | None) -> str:
        """Render compact human-readable guest context for the LLM."""
        from app.memory.guest_memory import decode_request

        lines: list[str] = []
        lines.append(f"Guest: {stay.guest.full_name or stay.guest.guest_id}")
        lines.append(f"Room: {stay.room_number}")
        lines.append(
            f"Stay: check-in {stay.check_in.isoformat()} → check-out {stay.check_out.isoformat()}"
        )

        flags: list[str] = []
        if stay.guest.vip:
            flags.append("VIP")
        access = getattr(stay.guest, "accessibility", None)
        if access and getattr(access, "registered_disability", False):
            flags.append("accessibility needs")
            if getattr(access, "requires_evacuation_assistance", False):
                flags.append("evacuation assistance required")
            mobility = getattr(access, "mobility_aid", None)
            if mobility is not None and getattr(mobility, "value", "none") not in (
                "none", None, ""
            ):
                flags.append(f"mobility aid: {mobility.value}")
        if flags:
            lines.append("Flags: " + ", ".join(flags))

        language = getattr(stay.guest, "language", None)
        if language:
            lines.append(f"Preferred language: {language}")

        if profile and profile.past_requests:
            lines.append(
                f"Returning guest: yes ({len(profile.past_requests)} prior requests on file)"
            )
        else:
            lines.append("Returning guest: no / first request this stay")

        preferences = getattr(profile, "preferences", None) if profile else None
        if preferences:
            pref_lines = [f"  - {k}: {v}" for k, v in list(preferences.items())[:8]]
            lines.append("Known preferences:")
            lines.extend(pref_lines)

        if profile and profile.past_requests:
            recent = profile.past_requests[-5:]
            lines.append("Recent requests (oldest → newest):")
            for r in recent:
                _i, _ts, summary = decode_request(r)
                lines.append(f"  - {summary[:160]}")

        return "\n".join(lines)

    # ---------------------------------------------------------------- policy --

    def _apply_policy(
        self,
        actions: list[DepartmentAction],
        event: HotelEvent,
        stay: StayContext,
        intent: str,
    ) -> Iterable[DepartmentAction]:
        """Apply non-LLM safety/escalation rules."""
        settings = get_settings()

        emergency = looks_like_emergency(event.text)
        access_relevant = looks_access_relevant(event.text)
        abusive = looks_abusive(event.text)
        has_access_needs = stay.guest.accessibility.registered_disability
        vip = stay.guest.vip

        # Repeat-issue detection: count similar prior intents in window.
        repeat_count = 0
        if intent and intent != "unclassified":
            repeat_count = self.memory.count_recent_intents(
                stay.guest.guest_id,
                intent,
                within=timedelta(hours=settings.repeat_issue_window_hours),
            )

        is_repeat = repeat_count >= settings.repeat_issue_threshold

        # Quiet hours check (uses _now_utc so tests can swap the clock).
        now_utc = self._now_utc()
        is_quiet = in_quiet_hours(
            now_utc,
            stay.hotel_timezone,
            settings.quiet_hours_start,
            settings.quiet_hours_end,
        )

        # Pass 1: rewrite priorities and tag abuse/repeat in details.
        upgraded: list[DepartmentAction] = []
        for a in actions:
            new_priority = a.priority
            new_details = a.details

            if emergency:
                new_priority = Priority.EMERGENCY
            elif is_repeat:
                # Bump one step. emergency/urgent already maxed.
                new_priority = self._bump(new_priority)
                new_details = (
                    f"{new_details} [repeat issue: guest has reported "
                    f"'{intent}' {repeat_count + 1} times in the last "
                    f"{settings.repeat_issue_window_hours}h]"
                )
            elif vip and new_priority == Priority.NORMAL:
                new_priority = Priority.HIGH

            # Quiet-hours deferral for non-urgent deferrable departments.
            if (
                is_quiet
                and not emergency
                and a.department in _QUIET_DEFERRABLE
                and new_priority in (Priority.LOW, Priority.NORMAL)
            ):
                new_priority = Priority.LOW
                new_details = (
                    f"{new_details} [quiet hours: defer to morning queue "
                    f"unless guest insists]"
                )

            # Revenue priority cap: a soft offer must NEVER preempt a real
            # service request, no matter how excited the LLM gets. We cap
            # here (in the orchestrator) rather than only in the agent so
            # that `plan.priority` and `plan.emergency` correctly reflect
            # the capped value across the whole plan.
            if a.department == Department.REVENUE and new_priority not in (
                Priority.LOW, Priority.NORMAL,
            ):
                new_priority = Priority.NORMAL
                new_details = f"{new_details} [revenue priority capped at normal]"

            upgraded.append(
                a.model_copy(update={"priority": new_priority, "details": new_details})
            )

        yield from upgraded

        departments_present = {a.department for a in upgraded}
        max_priority = self._top_priority(upgraded)

        # Hard-emergency fan-out
        if emergency:
            if Department.FRONT_DESK not in departments_present:
                yield DepartmentAction(
                    department=Department.FRONT_DESK,
                    summary="Emergency in guest room — check on guest",
                    details=f"Room {stay.room_number}. Source: {event.text}",
                    priority=Priority.EMERGENCY,
                )
                departments_present.add(Department.FRONT_DESK)
            if Department.SECURITY not in departments_present:
                yield DepartmentAction(
                    department=Department.SECURITY,
                    summary="Emergency wellness check",
                    details=f"Room {stay.room_number}. Source: {event.text}",
                    priority=Priority.EMERGENCY,
                )
                departments_present.add(Department.SECURITY)
            if has_access_needs and Department.ACCESSIBILITY not in departments_present:
                yield DepartmentAction(
                    department=Department.ACCESSIBILITY,
                    summary="Guest requires mobility / evacuation assistance",
                    details=(
                        f"Registered accessibility needs. "
                        f"Mobility aid: {stay.guest.accessibility.mobility_aid.value}."
                    ),
                    priority=Priority.EMERGENCY,
                )
                departments_present.add(Department.ACCESSIBILITY)

        # Abuse handling: route to Security with calm acknowledgment.
        # Skip when already an emergency (security is already there) or
        # when the LLM already routed to security.
        if abusive and not emergency:
            if Department.SECURITY not in departments_present:
                yield DepartmentAction(
                    department=Department.SECURITY,
                    summary="Verbal abuse / threat reported in guest channel",
                    details=(
                        f"{ABUSE_MARKER} Guest text contained abuse/threat keywords. "
                        f"Original: {event.text[:200]}"
                    ),
                    priority=Priority.HIGH,
                )
                departments_present.add(Department.SECURITY)
            # Always loop in guest_relations on abuse so a manager calls.
            if Department.GUEST_RELATIONS not in departments_present:
                yield DepartmentAction(
                    department=Department.GUEST_RELATIONS,
                    summary="De-escalation needed — manager call",
                    details=(
                        f"Guest message flagged as abusive. "
                        f"Room {stay.room_number}. Manager should phone the room."
                    ),
                    priority=Priority.HIGH,
                )
                departments_present.add(Department.GUEST_RELATIONS)

        # VIP soft fan-out (no emergency required)
        if vip and Department.GUEST_RELATIONS not in departments_present:
            yield DepartmentAction(
                department=Department.GUEST_RELATIONS,
                summary="VIP guest has an active request — check in",
                details=f"Guest: {stay.guest.full_name}. Event: {event.text[:160]}",
                priority=Priority.HIGH,
            )
            departments_present.add(Department.GUEST_RELATIONS)

        # Repeat-issue: pull in Guest Relations even if not VIP. The bump
        # handled priority; this ensures someone follows up beyond the
        # ticket fix.
        if is_repeat and Department.GUEST_RELATIONS not in departments_present:
            yield DepartmentAction(
                department=Department.GUEST_RELATIONS,
                summary="Repeat issue — proactive check-in",
                details=(
                    f"Guest has reported '{intent}' {repeat_count + 1} times in "
                    f"the last {settings.repeat_issue_window_hours}h. "
                    "Manager should reach out."
                ),
                priority=Priority.HIGH,
            )
            departments_present.add(Department.GUEST_RELATIONS)

        # Non-emergency accessibility fan-out: when the event involves
        # physical access for a guest with registered needs.
        if (
            has_access_needs
            and not emergency
            and access_relevant
            and max_priority in (Priority.HIGH, Priority.URGENT)
            and Department.ACCESSIBILITY not in departments_present
        ):
            yield DepartmentAction(
                department=Department.ACCESSIBILITY,
                summary="Guest may need physical-access support for this request",
                details=(
                    f"Registered accessibility needs (mobility aid: "
                    f"{stay.guest.accessibility.mobility_aid.value}). "
                    f"Event: {event.text[:160]}"
                ),
                priority=max_priority,
            )

    # --------------------------------------------------------------- utils --

    @staticmethod
    def _top_priority(actions: list[DepartmentAction]) -> Priority:
        order = [
            Priority.EMERGENCY,
            Priority.URGENT,
            Priority.HIGH,
            Priority.NORMAL,
            Priority.LOW,
        ]
        present = {a.priority for a in actions}
        for p in order:
            if p in present:
                return p
        return Priority.NORMAL

    @staticmethod
    def _bump(p: Priority) -> Priority:
        """One-step priority bump. EMERGENCY/URGENT stay capped."""
        bump = {
            Priority.LOW: Priority.NORMAL,
            Priority.NORMAL: Priority.HIGH,
            Priority.HIGH: Priority.URGENT,
            Priority.URGENT: Priority.URGENT,
            Priority.EMERGENCY: Priority.EMERGENCY,
        }
        return bump[p]

    @staticmethod
    def _routing_summary(actions: list[DepartmentAction]) -> str:
        depts = ", ".join(a.department.value for a in actions)
        return f"Routing to: {depts}"

    @staticmethod
    def _pick_guest_reply(pairs):
        """Choose the single guest_reply to send back over the chat.

        When abuse is flagged, Security/Guest Relations replies beat any
        earlier agent's reply. Otherwise, first non-empty reply wins.
        """
        from app.agents.security import ABUSE_MARKER
        from app.models import Department

        any_abuse = any(ABUSE_MARKER in (a.details or "") for a, _ in pairs)
        if any_abuse:
            for dept in (Department.SECURITY, Department.GUEST_RELATIONS):
                for action, frag in pairs:
                    if action.department == dept and frag.guest_reply:
                        return frag.guest_reply
        for _action, frag in pairs:
            if frag.guest_reply:
                return frag.guest_reply
        return None

    @staticmethod
    def _now_utc() -> "datetime":
        """The orchestrator's clock. Wrapped as a method so tests can
        override it on an instance without monkey-patching modules.
        """
        from datetime import datetime, timezone
        return datetime.now(timezone.utc)

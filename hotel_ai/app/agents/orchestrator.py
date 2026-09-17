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
     - sentiment-driven Guest Relations fan-out (Phase 2)
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
from typing import TYPE_CHECKING, Iterable

if TYPE_CHECKING:
    from app.services.outcome_recorder import OutcomeRecorder

try:
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore[assignment]
    ZoneInfoNotFoundError = Exception  # type: ignore[assignment,misc]

from app.agents.accessibility import AccessibilityAgent
from app.agents.base import BaseAgent, PlanFragment
from app.agents.classify_prompt import CLASSIFY_SYSTEM
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


# Classification prompt lives in app.agents.classify_prompt (Phase 2).
# Imported as CLASSIFY_SYSTEM above.


# --- Deterministic safety signals ---------------------------------------------

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


_ABUSE_PATTERNS = re.compile(
    r"("
    r"\bf[\W_]*u[\W_]*c[\W_]*k(?:ing|er|ed|s)?\b"
    r"|\bkill\s+(?:you|yourself|myself)\b"
    r"|\bi\s*will\s*(?:hurt|kill|hit)\b"
    r"|\bpiece\s+of\s+(?:shit|trash)\b"
    r"|\bshut\s+up\b"
    r"|\byou(?:\s+\w+){0,3}\s+(?:idiot|moron|stupid|asshole)\b"
    r")",
    re.IGNORECASE,
)


def looks_abusive(text: str) -> bool:
    return bool(_ABUSE_PATTERNS.search(text or ""))


def in_quiet_hours(now: datetime, tz_name: str, start_hour: int, end_hour: int) -> bool:
    """Is `now` within [start_hour, end_hour) in the hotel's local time?"""
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
        return False
    if start_hour < end_hour:
        return start_hour <= h < end_hour
    return h >= start_hour or h < end_hour


_QUIET_DEFERRABLE: frozenset[Department] = frozenset({
    Department.HOUSEKEEPING,
    Department.LAUNDRY,
    Department.SPA,
    Department.REVENUE,
})


class Orchestrator:
    def __init__(
        self,
        llm: LLMClient,
        memory: GuestMemory,
        outcome_recorder: "OutcomeRecorder | None" = None,
        property_id: str = "default",
    ) -> None:
        self.llm = llm
        self.memory = memory
        self._outcome_recorder = outcome_recorder
        self._property_id = property_id

        housekeeping = HousekeepingAgent(llm)
        concierge = ConciergeAgent(llm)

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

    def build_plan(self, event: HotelEvent, stay: StayContext) -> Plan:
        log.info(
            "event_received",
            extra={
                "event_id": event.id,
                "guest": stay.guest.redacted(),
                "channel": event.channel.value,
            },
        )

        self.memory.upsert_from_reservation(stay.guest)

        llm_result = self._classify(event, stay)
        actions = [DepartmentAction.model_validate(a) for a in llm_result["actions"]]
        intent = llm_result.get("intent", "")
        sentiment = llm_result.get("sentiment", "neutral")

        actions = list(self._apply_policy(actions, event, stay, intent, sentiment))

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
                details=(
                    f"intent={intent} sentiment={sentiment} "
                    f"confidence={llm_result.get('confidence', 'n/a')}"
                ),
            ),
        ]

        confidence = llm_result.get("confidence")
        try:
            confidence = float(confidence) if confidence is not None else None
            if confidence is not None:
                confidence = max(0.0, min(1.0, confidence))
        except (TypeError, ValueError):
            confidence = None

        TRIAGE_THRESHOLD = 0.55
        needs_triage = confidence is not None and confidence < TRIAGE_THRESHOLD

        plan = Plan(
            intent=intent,
            sentiment=sentiment,
            priority=self._top_priority(actions).value,
            emergency=any(a.priority == Priority.EMERGENCY for a in actions),
            confidence=confidence,
            needs_human_triage=needs_triage,
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

        if self._outcome_recorder is not None:
            try:
                self._outcome_recorder.record_plan(
                    plan=plan,
                    event=event,
                    stay=stay,
                    actions=actions,
                    property_id=self._property_id,
                )
            except Exception as exc:  # noqa: BLE001
                log.error(
                    "outcome_record_call_failed",
                    extra={"event_id": event.id, "error": str(exc)},
                )

        return plan

    def _classify(self, event: HotelEvent, stay: StayContext) -> dict:
        profile = self.memory.get_profile(stay.guest.guest_id)
        context_block = self._build_context_block(stay, profile)
        user_message = (
            f"Guest context:\n{context_block}\n\n"
            f"Current event (channel={event.channel.value}):\n{event.text}"
        )

        try:
            raw = self.llm.classify_json(system=CLASSIFY_SYSTEM, user=user_message)
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
                "confidence": 0.3,
            }

    @staticmethod
    def _build_context_block(stay: StayContext, profile: GuestProfile | None) -> str:
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

    def _apply_policy(
        self,
        actions: list[DepartmentAction],
        event: HotelEvent,
        stay: StayContext,
        intent: str,
        sentiment: str = "neutral",
    ) -> Iterable[DepartmentAction]:
        """Apply non-LLM safety/escalation rules."""
        settings = get_settings()

        emergency = looks_like_emergency(event.text)
        access_relevant = looks_access_relevant(event.text)
        abusive = looks_abusive(event.text)
        has_access_needs = stay.guest.accessibility.registered_disability
        vip = stay.guest.vip
        frustrated = (sentiment or "").lower() in ("frustrated", "distressed")

        repeat_count = 0
        if intent and intent != "unclassified":
            repeat_count = self.memory.count_recent_intents(
                stay.guest.guest_id,
                intent,
                within=timedelta(hours=settings.repeat_issue_window_hours),
            )

        is_repeat = repeat_count >= settings.repeat_issue_threshold

        now_utc = self._now_utc()
        is_quiet = in_quiet_hours(
            now_utc,
            stay.hotel_timezone,
            settings.quiet_hours_start,
            settings.quiet_hours_end,
        )

        upgraded: list[DepartmentAction] = []
        for a in actions:
            new_priority = a.priority
            new_details = a.details

            if emergency:
                new_priority = Priority.EMERGENCY
            elif is_repeat:
                new_priority = self._bump(new_priority)
                new_details = (
                    f"{new_details} [repeat issue: guest has reported "
                    f"'{intent}' {repeat_count + 1} times in the last "
                    f"{settings.repeat_issue_window_hours}h]"
                )
            elif vip and new_priority == Priority.NORMAL:
                new_priority = Priority.HIGH

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

            if a.department == Department.REVENUE and new_priority not in (
                Priority.LOW, Priority.NORMAL,
            ):
                new_priority = Priority.NORMAL
                new_details = f"{new_details} [revenue priority capped at normal]"

            if abusive and ABUSE_MARKER not in (new_details or ""):
                new_details = f"{new_details} {ABUSE_MARKER}".strip()

            upgraded.append(
                a.model_copy(update={"priority": new_priority, "details": new_details})
            )

        yield from upgraded

        departments_present = {a.department for a in upgraded}

        # Sentiment-driven Guest Relations fan-out (Phase 2).
        if frustrated and not emergency and Department.GUEST_RELATIONS not in departments_present:
            yield DepartmentAction(
                department=Department.GUEST_RELATIONS,
                summary="Guest recovery follow-up",
                details=(
                    f"Guest sentiment classified as '{sentiment}'. "
                    "Proactive recovery contact recommended."
                ),
                priority=self._top_priority(upgraded),
                requires_coordination_with=[],
            )
            departments_present.add(Department.GUEST_RELATIONS)

        max_priority = self._top_priority(upgraded)

        if emergency:
            if Department.FRONT_DESK not in departments_present:
                yield DepartmentAction(
                    department=Department.FRONT_DESK,
                    summary="Emergency in guest room — check on guest",
                    details=event.text,
                    priority=Priority.EMERGENCY,
                    requires_coordination_with=[],
                )
                departments_present.add(Department.FRONT_DESK)
            if Department.SECURITY not in departments_present:
                yield DepartmentAction(
                    department=Department.SECURITY,
                    summary="Emergency response",
                    details=event.text,
                    priority=Priority.EMERGENCY,
                    requires_coordination_with=[],
                )
                departments_present.add(Department.SECURITY)
            if has_access_needs and Department.ACCESSIBILITY not in departments_present:
                yield DepartmentAction(
                    department=Department.ACCESSIBILITY,
                    summary="Accessibility support during emergency",
                    details="Guest has registered accessibility needs.",
                    priority=Priority.EMERGENCY,
                    requires_coordination_with=[],
                )

        if abusive and Department.SECURITY not in departments_present:
            yield DepartmentAction(
                department=Department.SECURITY,
                summary="Review potentially abusive guest interaction",
                details=f"{event.text} {ABUSE_MARKER}",
                priority=Priority.HIGH,
                requires_coordination_with=[Department.GUEST_RELATIONS.value],
            )
            departments_present.add(Department.SECURITY)

        if (
            has_access_needs
            and access_relevant
            and not emergency
            and max_priority in (Priority.HIGH, Priority.URGENT)
            and Department.ACCESSIBILITY not in departments_present
        ):
            yield DepartmentAction(
                department=Department.ACCESSIBILITY,
                summary="Accessibility-aware support",
                details="Access-relevant event for guest with registered needs.",
                priority=max_priority,
                requires_coordination_with=[],
            )

        if is_repeat and Department.GUEST_RELATIONS not in departments_present:
            yield DepartmentAction(
                department=Department.GUEST_RELATIONS,
                summary="Repeat-issue recovery",
                details=(
                    f"Guest has reported '{intent}' {repeat_count + 1} times "
                    f"in the last {settings.repeat_issue_window_hours}h."
                ),
                priority=self._bump(Priority.NORMAL),
                requires_coordination_with=[],
            )

        if vip and Department.GUEST_RELATIONS not in departments_present and not emergency:
            # Light-touch VIP awareness — only if nothing else already routed GR
            pass  # VIP priority bump already applied above; avoid noise fan-out

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
    def _pick_guest_reply(
        pairs: list[tuple[DepartmentAction, "PlanFragment"]],
    ) -> "GuestReply | None":
        from app.agents.security import ABUSE_MARKER
        from app.models import Department, GuestReply  # noqa: F401

        any_abuse = any(ABUSE_MARKER in (a.details or "") for a, _ in pairs)

        if any_abuse:
            preferred = (Department.SECURITY, Department.GUEST_RELATIONS)
            for dept in preferred:
                for action, frag in pairs:
                    if action.department == dept and frag.guest_reply:
                        return frag.guest_reply

        for _action, frag in pairs:
            if frag.guest_reply:
                return frag.guest_reply
        return None

    @staticmethod
    def _now_utc() -> "datetime":
        from datetime import datetime, timezone
        return datetime.now(timezone.utc)

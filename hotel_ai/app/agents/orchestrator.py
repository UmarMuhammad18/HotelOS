"""
Orchestrator — the advisor brain.

Responsibilities
----------------
1. Classify a HotelEvent into one or more DepartmentActions using the LLM.
2. Apply deterministic policy (emergency, accessibility, VIP).
3. Ask each relevant department agent to produce a PlanFragment.
4. Merge fragments into a single `Plan` for Node to execute.
5. Update Python-side guest memory (we own memory in Option C).

Node is responsible for actually broadcasting the events, calling the
tools, and sending the guest_reply over WebSocket. This service never
touches the DB or the WebSocket directly.

Phase 2b — memory hydration
---------------------------
Before classification, we fetch the guest's profile from memory and
render a compact "Guest context" block into the LLM user prompt. This
lets the model reason over returning-guest status, repeat issues,
preferences, VIP/accessibility flags, and recent requests. Memory
writes still happen at the end of build_plan (single source of
mutation, auditable).
"""

from __future__ import annotations

import re
from typing import Iterable

from app.agents.accessibility import AccessibilityAgent
from app.agents.base import BaseAgent, PlanFragment
from app.agents.concierge import ConciergeAgent
from app.agents.fnb import FoodBeverageAgent
from app.agents.front_desk import FrontDeskAgent
from app.agents.guest_relations import GuestRelationsAgent
from app.agents.housekeeping import HousekeepingAgent
from app.agents.maintenance import MaintenanceAgent
from app.agents.security import SecurityAgent
from app.llm.client import LLMClient
from app.memory.guest_memory import GuestMemory
from app.models import (
    AgentEvent,
    AgentEventType,
    Department,
    DepartmentAction,
    GuestReply,
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
- Never mark a request 'emergency' unless there is clear life-safety risk.
- If the guest sounds angry or the issue repeats, include guest_relations.
- Default to 'normal' priority when unsure.
- `requires_coordination_with` must always be an array (use [] if none), never null.
- Output ONLY the JSON. No prose.

Use the Guest context block to reason:
- If the guest has reported the SAME problem before during this stay or in
  recent history, bump priority one step (normal->high, high->urgent) and
  add guest_relations to the coordination list.
- If the guest is VIP or has accessibility needs, lean toward higher priority
  and fan out to guest_relations / accessibility as appropriate.
- If preferences are known (e.g. foam pillows, quiet rooms, dietary
  restrictions), reflect them in the action `details` so staff can act on
  them without asking again.
- A first-time guest with a novel request is a 'normal' unless the text
  itself signals urgency.
"""


# --- Guest-reply localization -------------------------------------------------

# Maps ISO-ish language codes to the human-readable name we give the LLM.
# This is deliberately tiny — any code not listed here is still passed to
# the LLM verbatim ("please translate into <whatever the PMS stored>"), which
# Groq/llama handles gracefully for most major languages.
_LANGUAGE_NAMES = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "nl": "Dutch",
    "pl": "Polish",
    "tr": "Turkish",
    "ru": "Russian",
    "ar": "Arabic",
    "zh": "Chinese (Simplified)",
    "ja": "Japanese",
    "ko": "Korean",
    "hi": "Hindi",
}

# Any of these codes (case-insensitive) means "no translation needed".
_ENGLISH_ALIASES = {"en", "en-us", "en-gb", "en-au", "eng", ""}

_TRANSLATE_SYSTEM = """\
You are a translation layer for short guest-facing hotel replies.

Rules:
- Translate ONLY into the requested target language.
- Preserve room numbers, times, and named services exactly.
- Keep the tone polite and professional.
- Keep it to 1-3 sentences — never add a greeting, signature, or explanation.
- Output ONLY the translated text. No quotes, no prefaces, no language tags.
"""


# --- Deterministic safety signals ---------------------------------------------

_EMERGENCY_PATTERNS = re.compile(
    r"\b(help(?:\s*me)?|emergency|fire|smoke|bleeding|chest\s*pain|"
    r"can'?t\s*breathe|fallen|unconscious|gas\s*leak|panic|intruder|"
    r"stuck\s*in\s*(?:lift|elevator))\b",
    re.IGNORECASE,
)


def looks_like_emergency(text: str) -> bool:
    return bool(_EMERGENCY_PATTERNS.search(text or ""))


# -------------------------------------------------------------------------------


class Orchestrator:
    def __init__(self, llm: LLMClient, memory: GuestMemory) -> None:
        self.llm = llm
        self.memory = memory

        self._agents: dict[Department, BaseAgent] = {
            Department.FRONT_DESK: FrontDeskAgent(llm),
            Department.HOUSEKEEPING: HousekeepingAgent(llm),
            Department.CONCIERGE: ConciergeAgent(llm),
            Department.MAINTENANCE: MaintenanceAgent(llm),
            Department.FOOD_BEVERAGE: FoodBeverageAgent(llm),
            Department.GUEST_RELATIONS: GuestRelationsAgent(llm),
            Department.SECURITY: SecurityAgent(llm),
            Department.ACCESSIBILITY: AccessibilityAgent(llm),
        }

    # --------------------------------------------------------------- public --

    def build_plan(self, event: HotelEvent, stay: StayContext) -> Plan:
        log.info(
            "event_received",
            extra={"event_id": event.id, "guest": stay.guest.redacted(), "channel": event.channel},
        )

        # 0. Ensure a profile exists so record_request / record_preference can
        #    actually write. upsert_from_reservation is idempotent and preserves
        #    any learned preferences/past_requests already on file.
        self.memory.upsert_from_reservation(stay.guest)

        # 1. LLM triage — now hydrated with guest memory.
        llm_result = self._classify(event, stay)
        actions = [DepartmentAction.model_validate(a) for a in llm_result["actions"]]

        # 2. Policy (emergency, accessibility fan-out, VIP)
        actions = list(self._apply_policy(actions, event, stay))

        # 3. Opening orchestrator thought (always first on the feed)
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
                details=f"intent={llm_result.get('intent', '')} sentiment={llm_result.get('sentiment', '')}",
            ),
        ]

        # 4. Fan out to agents, collect fragments
        plan = Plan(
            intent=llm_result.get("intent", ""),
            sentiment=llm_result.get("sentiment", "neutral"),
            priority=self._top_priority(actions).value,
            emergency=any(a.priority == Priority.EMERGENCY for a in actions),
            trace_id=event.trace_id,
        )
        plan.events.extend(plan_events)

        first_guest_reply = None
        for action in actions:
            agent = self._agents.get(action.department)
            if not agent:
                log.warning("no_agent_for_department", extra={"department": action.department})
                continue
            fragment: PlanFragment = agent.handle(action, stay)
            plan.events.extend(fragment.events)
            plan.tool_calls.extend(fragment.tool_calls)
            if fragment.guest_reply and first_guest_reply is None:
                first_guest_reply = fragment.guest_reply
            plan.memory_updates.extend(fragment.memory_updates)

        # 4b. Localize the reply into the guest's preferred language, if known.
        plan.guest_reply = self._localize_reply(
            first_guest_reply,
            getattr(stay.guest, "language", None),
        )

        # 5. Update memory (Python owns this side of the stack).
        self.memory.record_request(stay.guest.guest_id, event.text)
        plan.memory_updates.append(
            MemoryUpdate(
                op="record_request",
                guest_id=stay.guest.guest_id,
                summary=event.text[:200],
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
            # Best-effort validation; let invalid ones drop out silently.
            kept = []
            for a in raw["actions"]:
                try:
                    kept.append(DepartmentAction.model_validate(a).model_dump(mode="json"))
                except Exception as e:  # noqa: BLE001
                    log.warning("invalid_llm_action", extra={"action": a, "error": str(e)})
            if not kept:
                raise ValueError("no valid actions")
            raw["actions"] = kept
            return raw
        except Exception as e:  # noqa: BLE001
            log.error("llm_classify_failed", extra={"event_id": event.id, "error": str(e)})
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

    # --------------------------------------------------- reply localization --

    def _localize_reply(
        self,
        reply: GuestReply | None,
        target_language: str | None,
    ) -> GuestReply | None:
        """Translate a guest-facing reply into the guest's preferred language.

        Contract:
          - reply is None                          -> return None (no reply to send)
          - target_language missing / English-ish  -> return reply unchanged
          - translation succeeds                   -> new GuestReply with
            translated message AND locale=<target code>
          - translation fails / returns empty      -> return the ORIGINAL English
            reply so the guest still hears back. Locale stays 'en' so the UI
            doesn't claim to be sending a language it isn't.

        We intentionally intercept at the orchestrator layer (rather than
        inside each department agent) so agents stay focused on their domain
        and every reply is localized consistently.
        """
        if reply is None:
            return None
        if not target_language:
            return reply

        target = target_language.strip().lower()
        if target in _ENGLISH_ALIASES:
            return reply

        language_name = _LANGUAGE_NAMES.get(target, target_language)

        try:
            translated = self.llm.reply_text(
                system=_TRANSLATE_SYSTEM,
                user=(
                    f"Target language: {language_name}\n\n"
                    f"Reply to translate:\n{reply.message}"
                ),
            )
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "translate_failed",
                extra={"target": target, "error": str(exc)},
            )
            # Fall back to the English original. Force locale="en" so the UI
            # doesn't claim a language we couldn't actually deliver (the
            # agent may have optimistically set locale from the guest's
            # preference when building the reply).
            return GuestReply(message=reply.message, locale="en")

        translated = (translated or "").strip()
        if not translated:
            log.warning("translate_empty", extra={"target": target})
            return GuestReply(message=reply.message, locale="en")

        return GuestReply(message=translated, locale=target)

    # --------------------------------------------------- memory hydration --

    @staticmethod
    def _build_context_block(stay: StayContext, profile: GuestProfile | None) -> str:
        """Render a compact human-readable guest context for the LLM.

        Includes: returning-guest flag, VIP/accessibility status, language,
        recent past_requests (most recent last so the model reads them in
        chronological order), and known preferences.

        Everything here is short — we are paying per token.
        """
        lines: list[str] = []

        # Identity & stay
        lines.append(f"Guest: {stay.guest.full_name or stay.guest.guest_id}")
        lines.append(f"Room: {stay.room_number}")
        lines.append(
            f"Stay: check-in {stay.check_in.isoformat()} → check-out {stay.check_out.isoformat()}"
        )

        # Status flags
        flags: list[str] = []
        if stay.guest.vip:
            flags.append("VIP")
        access = getattr(stay.guest, "accessibility", None)
        if access and getattr(access, "registered_disability", False):
            flags.append("accessibility needs")
            if getattr(access, "requires_evacuation_assistance", False):
                flags.append("evacuation assistance required")
            mobility = getattr(access, "mobility_aid", None)
            if mobility is not None and getattr(mobility, "value", "none") not in ("none", None, ""):
                flags.append(f"mobility aid: {mobility.value}")
        if flags:
            lines.append("Flags: " + ", ".join(flags))

        language = getattr(stay.guest, "language", None)
        if language:
            lines.append(f"Preferred language: {language}")

        # Returning-guest signal
        if profile and profile.past_requests:
            lines.append(f"Returning guest: yes ({len(profile.past_requests)} prior requests on file)")
        else:
            lines.append("Returning guest: no / first request this stay")

        # Preferences
        preferences = getattr(profile, "preferences", None) if profile else None
        if preferences:
            pref_lines = [f"  - {k}: {v}" for k, v in list(preferences.items())[:8]]
            lines.append("Known preferences:")
            lines.extend(pref_lines)

        # Recent requests (last 5, chronological)
        if profile and profile.past_requests:
            recent = profile.past_requests[-5:]
            lines.append("Recent requests (oldest → newest):")
            for r in recent:
                lines.append(f"  - {r[:160]}")

        return "\n".join(lines)

    # ---------------------------------------------------------------- policy --

    def _apply_policy(
        self,
        actions: list[DepartmentAction],
        event: HotelEvent,
        stay: StayContext,
    ) -> Iterable[DepartmentAction]:
        emergency = looks_like_emergency(event.text)
        has_access_needs = stay.guest.accessibility.registered_disability
        vip = stay.guest.vip

        upgraded: list[DepartmentAction] = []
        for a in actions:
            new_priority = a.priority
            if emergency:
                new_priority = Priority.EMERGENCY
            elif vip and new_priority == Priority.NORMAL:
                new_priority = Priority.HIGH
            upgraded.append(a.model_copy(update={"priority": new_priority}))

        yield from upgraded

        departments_present = {a.department for a in upgraded}

        if emergency:
            if Department.FRONT_DESK not in departments_present:
                yield DepartmentAction(
                    department=Department.FRONT_DESK,
                    summary="Emergency in guest room — check on guest",
                    details=f"Room {stay.room_number}. Source: {event.text}",
                    priority=Priority.EMERGENCY,
                )
            if Department.SECURITY not in departments_present:
                yield DepartmentAction(
                    department=Department.SECURITY,
                    summary="Emergency wellness check",
                    details=f"Room {stay.room_number}. Source: {event.text}",
                    priority=Priority.EMERGENCY,
                )
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

        if vip and Department.GUEST_RELATIONS not in departments_present:
            yield DepartmentAction(
                department=Department.GUEST_RELATIONS,
                summary="VIP guest has an active request — check in",
                details=f"Guest: {stay.guest.full_name}. Event: {event.text}",
                priority=Priority.HIGH,
            )

    # --------------------------------------------------------------- utils --

    @staticmethod
    def _top_priority(actions: list[DepartmentAction]) -> Priority:
        order = [Priority.EMERGENCY, Priority.URGENT, Priority.HIGH, Priority.NORMAL, Priority.LOW]
        present = {a.priority for a in actions}
        for p in order:
            if p in present:
                return p
        return Priority.NORMAL

    @staticmethod
    def _routing_summary(actions: list[DepartmentAction]) -> str:
        depts = ", ".join(a.department.value for a in actions)
        return f"Routing to: {depts}"

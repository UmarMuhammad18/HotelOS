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
    HotelEvent,
    MemoryUpdate,
    Plan,
    Priority,
    StayContext,
)
from app.utils.logging import get_logger

log = get_logger(__name__)


# --- LLM classification prompt -------------------------------------------------

_CLASSIFY_SYSTEM = """\
You are the triage brain of a hotel operations AI. Given a guest message or
system event, decide which hotel department(s) must act, and with what priority.

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
- `requires_coordination_with` must always be an array (use [] if none),
  never null.
- Output ONLY the JSON. No prose.
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

        # 1. LLM triage
        llm_result = self._classify(event)
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

        plan.guest_reply = first_guest_reply

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

    def _classify(self, event: HotelEvent) -> dict:
        try:
            raw = self.llm.classify_json(system=_CLASSIFY_SYSTEM, user=event.text)
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

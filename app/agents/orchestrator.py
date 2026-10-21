"""
HotelOS AI Orchestrator
Routes hotel events to the right department agents using LLM intent classification.
Replaces the old if/else keyword matching with real Claude API classification.
"""

import json
import uuid
from datetime import datetime

from app.learning import get_guest_memory, update_memory
from app.llm.client import classify_json
from app.models import (
    Department,
    DepartmentAction,
    OrchestratorResult,
    TaskPriority,
    Task,
)

# In-memory task store (replace with DB in production)
_task_store: list[dict] = []


CLASSIFICATION_PROMPT = """
You are the AI orchestrator for a hotel operations system.

Analyse the following hotel event and decide:
1. Which departments need to act
2. What each department should do
3. The overall priority
4. Whether this is an emergency

EVENT:
{event_json}

GUEST MEMORY (past stays and preferences):
{guest_memory_json}

Respond with ONLY this JSON (no markdown):
{{
  "priority": "low|normal|high|urgent|emergency",
  "is_emergency": false,
  "reasoning": "one sentence explaining the priority and routing decision",
  "actions": [
    {{
      "department": "housekeeping|maintenance|concierge|fnb|guest_relations|front_desk|security|spa|valet|revenue|laundry|accessibility",
      "action": "short action label",
      "details": "specific instruction for this department",
      "eta_minutes": 15
    }}
  ],
  "learning_notes": ["any patterns worth remembering about this guest"]
}}

RULES:
- emergency = fire, flood, medical, immediate safety threat → add security + front_desk always
- vip/premium guests with any issue → priority at least "high", add guest_relations
- multiple departments only when genuinely needed, not for every request
- eta_minutes should be realistic: towels=10, taxi=20, maintenance=30-60, emergency=5
"""


def run_hotel_ai(event: dict) -> list[str]:
    """
    Main entry point — accepts an event dict, returns list of action strings.
    Kept backwards-compatible with the old server.py interface.
    Also stores a Task in _task_store for each action.
    """
    result = classify_event(event)
    _persist_tasks(result, event)
    update_memory(event)

    # Format output as human-readable strings (backwards compat)
    lines = [f"[Priority: {result.priority.value.upper()}] {result.reasoning}"]
    for action in result.actions:
        lines.append(
            f"[{action.department.value.title()}] {action.action}"
            + (f" — {action.details}" if action.details else "")
            + (f" (ETA {action.eta_minutes}m)" if action.eta_minutes else "")
        )
    if result.is_emergency:
        lines.insert(1, "🚨 EMERGENCY — Security and Front Desk alerted immediately")
    for note in result.learning_notes:
        lines.append(f"[Learning] {note}")
    return lines


def classify_event(event: dict) -> OrchestratorResult:
    """
    Core classification — returns structured OrchestratorResult.
    Used by both the legacy endpoint and new predictive/handover features.
    """
    room = event.get("room", "unknown")
    guest_memory = get_guest_memory(room)

    prompt = CLASSIFICATION_PROMPT.format(
        event_json=json.dumps(event, indent=2),
        guest_memory_json=json.dumps(guest_memory, indent=2),
    )

    raw = classify_json(prompt)

    # Parse actions
    actions = []
    for a in raw.get("actions", []):
        try:
            dept = Department(a["department"])
        except ValueError:
            dept = Department.FRONT_DESK  # fallback
        actions.append(
            DepartmentAction(
                department=dept,
                action=a.get("action", "Handle request"),
                details=a.get("details", ""),
                priority=TaskPriority(raw.get("priority", "normal")),
                eta_minutes=a.get("eta_minutes"),
            )
        )

    # Emergency fast-path: always include security + front_desk
    is_emergency = raw.get("is_emergency", False)
    if is_emergency:
        existing_depts = {a.department for a in actions}
        if Department.SECURITY not in existing_depts:
            actions.insert(
                0,
                DepartmentAction(
                    department=Department.SECURITY,
                    action="Emergency response",
                    details="Immediate emergency response required",
                    priority=TaskPriority.EMERGENCY,
                    eta_minutes=3,
                ),
            )
        if Department.FRONT_DESK not in existing_depts:
            actions.insert(
                1,
                DepartmentAction(
                    department=Department.FRONT_DESK,
                    action="Emergency coordination",
                    details="Coordinate emergency response and notify management",
                    priority=TaskPriority.EMERGENCY,
                    eta_minutes=3,
                ),
            )

    return OrchestratorResult(
        room=room,
        priority=TaskPriority(raw.get("priority", "normal")),
        actions=actions,
        reasoning=raw.get("reasoning", ""),
        is_emergency=is_emergency,
        learning_notes=raw.get("learning_notes", []),
    )


def _persist_tasks(result: OrchestratorResult, event: dict) -> None:
    """Store classified actions as tasks in the in-memory task store."""
    now = datetime.utcnow().isoformat()
    for action in result.actions:
        task = Task(
            task_id=str(uuid.uuid4())[:8],
            room=result.room,
            guest_name=event.get("guest_name", ""),
            department=action.department,
            description=f"{action.action}: {action.details}",
            priority=action.priority,
            status="open",
            created_at=now,
            source="ai_classified",
        )
        _task_store.append(task.model_dump())


def get_open_tasks() -> list[dict]:
    """Return all open tasks — used by shift handover."""
    return [t for t in _task_store if t["status"] == "open"]


def get_all_tasks() -> list[dict]:
    return list(_task_store)


def update_task_status(task_id: str, status: str) -> bool:
    for task in _task_store:
        if task["task_id"] == task_id:
            task["status"] = status
            return True
    return False

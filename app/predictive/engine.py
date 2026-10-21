"""
HotelOS Predictive Operations Engine
Anticipates guest needs before they ask.

At check-in (or triggered manually), this engine:
1. Loads the guest's full history and preferences
2. Asks Claude to predict what the guest will likely want this stay
3. Pre-creates tasks for the relevant departments
4. Returns a list of proactive actions for staff to act on immediately

This is what makes HotelOS a product, not just a feature layer.
"""

import json
import uuid
from datetime import datetime

from app.learning import get_guest_memory
from app.llm.client import classify_json
from app.models import Department, DepartmentAction, Task, TaskPriority

# Shared task store imported from orchestrator
# (in production this would be a DB layer)
from app.agents.orchestrator import _task_store


PREDICTION_PROMPT = """
You are the predictive AI for a hotel operations system.

A guest is checking in. Based on their stay history and past preferences,
predict what they will likely need or want during this stay — BEFORE they ask.

GUEST PROFILE:
{profile_json}

CURRENT STAY CONTEXT:
- Room: {room}
- Check-in date: {checkin_date}
- Guest type: {guest_type}
- Stay number: {stay_count} (times they've stayed with us)

Based on patterns in their history, respond with ONLY this JSON (no markdown):
{{
  "confidence": 0.0,
  "predicted_needs": [
    {{
      "department": "housekeeping|maintenance|concierge|fnb|guest_relations|front_desk|security|spa|valet|revenue|laundry|accessibility",
      "prediction": "what we predict they'll want",
      "rationale": "why we think this based on their history",
      "action": "what to do proactively right now",
      "priority": "low|normal|high",
      "timing": "immediate|within_1_hour|within_4_hours|tonight|tomorrow_morning"
    }}
  ],
  "vip_notes": "any special handling notes for this guest (empty string if none)",
  "sentiment_risk": "none|low|medium|high",
  "sentiment_risk_reason": ""
}}

RULES:
- Only predict things with clear evidence in their history (confidence >= 0.6)
- Don't predict obvious things every guest gets (welcome amenities, etc.)
- Focus on personalised predictions that make the guest feel known
- If stay_count < 2, you have limited data — keep confidence low and predictions conservative
- vip_notes should flag anything front desk or management needs to know proactively
"""


def predict_guest_needs(
    room: str,
    guest_name: str = "",
    guest_type: str = "standard",
    checkin_date: str | None = None,
) -> dict:
    """
    Main entry point for predictive ops.
    Call this at check-in for any returning guest.

    Returns:
        dict with predicted_tasks (list of Task dicts) and full LLM reasoning
    """
    if checkin_date is None:
        checkin_date = datetime.utcnow().date().isoformat()

    memory = get_guest_memory(room)
    stay_count = len(memory.get("history", []))

    if stay_count == 0:
        # First-time guest — nothing to predict yet
        return {
            "room": room,
            "guest_name": guest_name,
            "stay_count": 0,
            "predicted_tasks": [],
            "confidence": 0.0,
            "vip_notes": "",
            "sentiment_risk": "none",
            "message": "First-time guest — no prediction data yet. History will be built during this stay.",
        }

    prompt = PREDICTION_PROMPT.format(
        profile_json=json.dumps(memory, indent=2),
        room=room,
        checkin_date=checkin_date,
        guest_type=guest_type,
        stay_count=stay_count,
    )

    raw = classify_json(prompt)
    predicted_needs = raw.get("predicted_needs", [])

    # Convert predictions into pre-created tasks
    tasks = []
    now = datetime.utcnow().isoformat()
    for need in predicted_needs:
        try:
            dept = Department(need["department"])
        except (ValueError, KeyError):
            dept = Department.CONCIERGE

        try:
            priority = TaskPriority(need.get("priority", "normal"))
        except ValueError:
            priority = TaskPriority.NORMAL

        task = Task(
            task_id=str(uuid.uuid4())[:8],
            room=room,
            guest_name=guest_name,
            department=dept,
            description=(
                f"[PREDICTED] {need.get('action', need.get('prediction', ''))}"
                f" — {need.get('rationale', '')}"
            ),
            priority=priority,
            status="open",
            created_at=now,
            source="ai_predicted",
        )
        task_dict = task.model_dump()
        task_dict["timing"] = need.get("timing", "immediate")
        task_dict["prediction_rationale"] = need.get("rationale", "")
        tasks.append(task_dict)
        _task_store.append(task_dict)

    return {
        "room": room,
        "guest_name": guest_name,
        "stay_count": stay_count,
        "confidence": raw.get("confidence", 0.0),
        "predicted_tasks": tasks,
        "vip_notes": raw.get("vip_notes", ""),
        "sentiment_risk": raw.get("sentiment_risk", "none"),
        "sentiment_risk_reason": raw.get("sentiment_risk_reason", ""),
        "generated_at": now,
    }


def get_predictions_for_shift(upcoming_checkins: list[dict]) -> list[dict]:
    """
    Batch predictions for all guests checking in during the next shift.
    Pass a list of {room, guest_name, guest_type} dicts.
    Returns all predictions combined.
    """
    all_predictions = []
    for guest in upcoming_checkins:
        result = predict_guest_needs(
            room=guest.get("room", ""),
            guest_name=guest.get("guest_name", ""),
            guest_type=guest.get("guest_type", "standard"),
        )
        if result.get("predicted_tasks"):
            all_predictions.append(result)
    return all_predictions

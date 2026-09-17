"""
Post-process and validate LLM classification JSON.

Models occasionally return:
  - department aliases ("hk", "F&B", "front desk")
  - priority typos ("Emergency", "NORMAL")
  - missing arrays, null coordination lists
  - confidence as a string
  - sentiment outside the allowed set

This module normalises those into the shape the orchestrator and
DepartmentAction model expect, and drops actions that still cannot be
mapped. Pure functions — no I/O — so they are trivial to unit-test.
"""

from __future__ import annotations

from typing import Any

# Canonical department codes (must match Department enum values).
_DEPARTMENTS = {
    "front_desk",
    "housekeeping",
    "concierge",
    "maintenance",
    "food_beverage",
    "guest_relations",
    "revenue",
    "security",
    "reservations",
    "accessibility",
    "spa",
    "laundry",
    "valet",
}

# Common LLM aliases → canonical code.
_DEPT_ALIASES: dict[str, str] = {
    "front desk": "front_desk",
    "frontdesk": "front_desk",
    "reception": "front_desk",
    "hk": "housekeeping",
    "house keeping": "housekeeping",
    "f&b": "food_beverage",
    "fnb": "food_beverage",
    "food and beverage": "food_beverage",
    "food & beverage": "food_beverage",
    "room service": "food_beverage",
    "guest experience": "guest_relations",
    "guest relations": "guest_relations",
    "gr": "guest_relations",
    "eng": "maintenance",
    "engineering": "maintenance",
    "security team": "security",
    "res": "reservations",
    "reservations team": "reservations",
}

_PRIORITIES = {"low", "normal", "high", "urgent", "emergency"}
_SENTIMENTS = {"neutral", "positive", "frustrated", "distressed"}


def _norm_dept(raw: Any) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip().lower().replace("-", "_")
    if s in _DEPARTMENTS:
        return s
    # try spaces version for alias lookup
    spaced = s.replace("_", " ")
    if spaced in _DEPT_ALIASES:
        return _DEPT_ALIASES[spaced]
    if s in _DEPT_ALIASES:
        return _DEPT_ALIASES[s]
    return None


def _norm_priority(raw: Any) -> str:
    if raw is None:
        return "normal"
    s = str(raw).strip().lower()
    if s in _PRIORITIES:
        return s
    return "normal"


def _norm_sentiment(raw: Any) -> str:
    if raw is None:
        return "neutral"
    s = str(raw).strip().lower()
    if s in _SENTIMENTS:
        return s
    # soft mapping
    if s in ("angry", "upset", "annoyed"):
        return "frustrated"
    if s in ("scared", "panic", "afraid", "worried"):
        return "distressed"
    if s in ("happy", "grateful", "thankful"):
        return "positive"
    return "neutral"


def _norm_confidence(raw: Any) -> float | None:
    if raw is None:
        return None
    try:
        c = float(raw)
    except (TypeError, ValueError):
        return None
    return max(0.0, min(1.0, c))


def _norm_action(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    dept = _norm_dept(raw.get("department"))
    if not dept:
        return None

    summary = str(raw.get("summary") or "Guest request").strip() or "Guest request"
    details = str(raw.get("details") or "").strip()
    priority = _norm_priority(raw.get("priority"))

    coord_raw = raw.get("requires_coordination_with") or []
    if not isinstance(coord_raw, list):
        coord_raw = []
    coordination: list[str] = []
    for item in coord_raw:
        d = _norm_dept(item)
        if d and d not in coordination and d != dept:
            coordination.append(d)

    return {
        "department": dept,
        "summary": summary[:200],
        "details": details[:500],
        "priority": priority,
        "requires_coordination_with": coordination,
    }


def normalize_classify_result(raw: Any) -> dict[str, Any]:
    """Return a clean classify dict, or raise ValueError if unusable.

    Raises
    ------
    ValueError
        If `raw` is not a dict or yields zero valid actions after
        normalisation. The orchestrator / RetryingLLMClient treat this
        as a content-level failure and may retry or fall back.
    """
    if not isinstance(raw, dict):
        raise ValueError(f"classify result is not a dict: {type(raw).__name__}")

    actions_in = raw.get("actions") or []
    if not isinstance(actions_in, list):
        raise ValueError("classify 'actions' is not a list")

    actions: list[dict[str, Any]] = []
    for item in actions_in:
        normalised = _norm_action(item)
        if normalised:
            actions.append(normalised)

    if not actions:
        raise ValueError("no valid actions after normalisation")

    intent = str(raw.get("intent") or "unclassified").strip()[:80] or "unclassified"
    sentiment = _norm_sentiment(raw.get("sentiment"))
    confidence = _norm_confidence(raw.get("confidence"))

    return {
        "actions": actions,
        "intent": intent,
        "sentiment": sentiment,
        "confidence": confidence,
    }

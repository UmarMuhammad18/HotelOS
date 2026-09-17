"""
Deterministic preference learning from past guest requests.

We deliberately avoid an LLM here: learning must be cheap, auditable, and
safe to run in a nightly cron or on every check-in. Rules map recurring
intents + summary keywords onto stable preference keys that the
orchestrator and proactive check-in hooks can consume.

Output is a dict suitable for merging into GuestProfile.preferences.
Keys are snake_case strings; values are simple JSON-serialisable types.
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Any

# Intent → preference key when the guest asks for the same thing often.
_INTENT_PREFERENCE: dict[str, str] = {
    "amenity_request": "frequent_amenity_requests",
    "maintenance_issue": "had_maintenance_issues",
    "housekeeping_request": "prefers_housekeeping_attention",
    "spa_booking": "spa_guest",
    "laundry_request": "uses_laundry",
    "fnb_request": "orders_in_room_dining",
    "complaint": "had_complaints",
}

# Keyword patterns inside request summaries → concrete preferences.
# More specific rules must come before generic ones (first match wins).
_KEYWORD_RULES: list[tuple[re.Pattern[str], str, Any]] = [
    (re.compile(r"\b(?:extra\s+)?towels?\b", re.I), "extra_towels", True),
    (re.compile(r"\bfoam\s+pillow", re.I), "pillow", "foam"),
    (re.compile(r"\bsoft\s+pillow", re.I), "pillow", "soft"),
    (re.compile(r"\bfirm\s+pillow", re.I), "pillow", "firm"),
    (re.compile(r"\bpillow", re.I), "pillow", "noted"),
    (re.compile(r"\bquiet\s+room\b", re.I), "quiet_room", True),
    (re.compile(r"\bhigh\s+floor\b", re.I), "high_floor", True),
    (re.compile(r"\blow\s+floor\b", re.I), "low_floor", True),
    (re.compile(r"\bfeather[- ]free\b|\ballerg", re.I), "allergy_aware", True),
    (re.compile(r"\bextra\s+blankets?\b", re.I), "extra_blankets", True),
    (re.compile(r"\bcrib\b|\bbaby\s+cot\b", re.I), "needs_crib", True),
    (re.compile(r"\blate\s+checkout\b", re.I), "late_checkout", True),
    (re.compile(r"\bearly\s+check[- ]?in\b", re.I), "early_checkin", True),
    (re.compile(r"\bnewspaper\b", re.I), "newspaper", True),
    (re.compile(r"\b(?:non[- ]?)?smoking\b", re.I), "non_smoking", True),
    (re.compile(r"\bconnecting\s+rooms?\b", re.I), "connecting_rooms", True),
    (re.compile(r"\b(?:ac|a/c|air\s*con(?:ditioning)?)\b", re.I), "sensitive_to_ac", True),
]

# Minimum times an intent must appear before we materialise a preference.
_INTENT_THRESHOLD = 2


def learn_preferences_from_requests(
    past_requests: list[str],
    existing: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Derive preference updates from encoded past_requests lines.

    Returns only *new or changed* keys relative to `existing` so callers
    can compute a memory diff for the frontend ("we remembered: X").
    Never deletes existing preferences.
    """
    # Local import avoids circular import with guest_memory.
    from app.memory.guest_memory import decode_request

    existing = existing or {}
    proposed: dict[str, Any] = {}

    intent_counts: Counter[str] = Counter()
    summaries: list[str] = []

    for line in past_requests:
        intent, _ts, summary = decode_request(line)
        if intent:
            intent_counts[intent] += 1
        if summary:
            summaries.append(summary)

    for intent, count in intent_counts.items():
        if count < _INTENT_THRESHOLD:
            continue
        key = _INTENT_PREFERENCE.get(intent)
        if key:
            proposed[key] = True

    # Keyword rules — first match wins per key (more specific rules listed first).
    for summary in summaries:
        for pattern, key, value in _KEYWORD_RULES:
            if key in proposed:
                continue
            if pattern.search(summary):
                proposed[key] = value

    # Diff against existing — only surface genuinely new/changed keys.
    learned: dict[str, Any] = {}
    for key, value in proposed.items():
        if existing.get(key) != value:
            learned[key] = value
    return learned


def merge_preferences(
    existing: dict[str, Any],
    learned: dict[str, Any],
) -> dict[str, Any]:
    """Return a new preferences dict with learned keys applied."""
    merged = dict(existing)
    merged.update(learned)
    return merged


# Map preference keys → proactive task suggestions at check-in.
_PROACTIVE_TASKS: dict[str, dict[str, str]] = {
    "extra_towels": {
        "department": "housekeeping",
        "summary": "Pre-stock extra towels",
        "details": "Guest preference: extra towels on arrival.",
    },
    "extra_blankets": {
        "department": "housekeeping",
        "summary": "Pre-stock extra blankets",
        "details": "Guest preference: extra blankets on arrival.",
    },
    "pillow": {
        "department": "housekeeping",
        "summary": "Prepare preferred pillow type",
        "details": "Guest has a recorded pillow preference.",
    },
    "quiet_room": {
        "department": "front_desk",
        "summary": "Confirm quiet room assignment",
        "details": "Guest preference: quiet room.",
    },
    "high_floor": {
        "department": "front_desk",
        "summary": "Confirm high-floor room",
        "details": "Guest preference: high floor.",
    },
    "late_checkout": {
        "department": "front_desk",
        "summary": "Note late checkout preference",
        "details": "Guest has requested late checkout before.",
    },
    "early_checkin": {
        "department": "front_desk",
        "summary": "Note early check-in preference",
        "details": "Guest has requested early check-in before.",
    },
    "spa_guest": {
        "department": "spa",
        "summary": "Offer spa welcome amenity",
        "details": "Returning spa guest — consider a complimentary gesture.",
    },
    "allergy_aware": {
        "department": "housekeeping",
        "summary": "Allergy-aware room prep",
        "details": "Guest has allergy-related preferences on file.",
    },
    "needs_crib": {
        "department": "housekeeping",
        "summary": "Prepare crib / baby cot",
        "details": "Guest previously requested a crib.",
    },
}


def proactive_tasks_from_preferences(
    preferences: dict[str, Any],
) -> list[dict[str, str]]:
    """Turn known preferences into concrete check-in task suggestions.

    Each item is a plain dict (department, summary, details) so the
    backend can create tasks without depending on PlanFragment models.
    """
    tasks: list[dict[str, str]] = []
    for key, value in preferences.items():
        if not value:
            continue
        template = _PROACTIVE_TASKS.get(key)
        if not template:
            continue
        task = dict(template)
        if key == "pillow" and isinstance(value, str) and value not in ("noted", True):
            task["details"] = f"Guest prefers {value} pillow."
        tasks.append(task)
    return tasks

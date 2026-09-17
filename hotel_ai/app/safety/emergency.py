"""Expanded emergency detection — regex union + optional severity tiers.

Deterministic: never depends on the LLM. Used by the orchestrator and
the hard `/v1/emergency` entry point.
"""

from __future__ import annotations

import re
from enum import Enum


class EmergencySeverity(str, Enum):
    CRITICAL = "critical"  # life safety — immediate security + front desk
    HIGH = "high"  # property / medical escalation
    STANDARD = "standard"  # generic emergency keyword


# Order matters for severity scoring: check critical first.
_CRITICAL = re.compile(
    r"("
    r"\b(?:bleeding|chest\s*pain|can'?t\s*breathe|choking|overdos(?:e|ed|ing))\b"
    r"|\b(?:allergic\s*reaction|anaphylactic|unconscious|not\s*breathing)\b"
    r"|\b(?:heart\s*attack|stroke|seizure)\b"
    r"|\b(?:fire|smoke|burning|explosion)\b"
    r"|\b(?:active\s*shooter|gunshot|stabbing)\b"
    r")",
    re.I,
)

_HIGH = re.compile(
    r"("
    r"\b(?:gas\s*leak|flooding|flood\s+in|carbon\s*monoxide)\b"
    r"|\bstuck\s+in(?:\s+\w+){0,2}\s+(?:lift|elevator)\b"
    r"|\b(?:intruder|attacked|assault(?:ed)?|threat(?:ened)?|kidnap)\b"
    r"|\b(?:fallen|can'?t\s*move|broken\s*(?:bone|leg|arm))\b"
    r"|\b(?:panic\s*button|sos|mayday)\b"
    r")",
    re.I,
)

_STANDARD = re.compile(
    r"("
    r"\b(?:help(?:\s*me)?|emergency|panic|sos)\b"
    r"|\b(?:evacuat(?:e|ion)|alarm\s*going\s*off)\b"
    r")",
    re.I,
)

# Combined for fast boolean checks (union of all tiers).
_ANY = re.compile(
    f"(?:{_CRITICAL.pattern})|(?:{_HIGH.pattern})|(?:{_STANDARD.pattern})",
    re.I,
)


def looks_like_emergency(text: str) -> bool:
    return bool(_ANY.search(text or ""))


def emergency_severity(text: str) -> EmergencySeverity | None:
    t = text or ""
    if _CRITICAL.search(t):
        return EmergencySeverity.CRITICAL
    if _HIGH.search(t):
        return EmergencySeverity.HIGH
    if _STANDARD.search(t):
        return EmergencySeverity.STANDARD
    return None

"""Multi-step planning for coordinated multi-department requests.

When a guest asks for something that inherently spans departments
(e.g. "move me to a quiet room and send extra towels + late checkout"),
expand the action list so every required department is represented
before agents run.
"""

from __future__ import annotations

import re

from app.models.task import Department, DepartmentAction, Priority

_COORDINATION_RULES: list[tuple[re.Pattern[str], Department, str, Priority]] = [
    (
        re.compile(r"\b(?:move|transfer|change)\s+(?:me\s+)?(?:to\s+)?(?:a\s+)?rooms?\b", re.I),
        Department.FRONT_DESK,
        "Room change / transfer",
        Priority.HIGH,
    ),
    (
        re.compile(r"\b(?:extra\s+)?towels?\b", re.I),
        Department.HOUSEKEEPING,
        "Deliver towels",
        Priority.NORMAL,
    ),
    (
        re.compile(r"\b(?:extra\s+)?blankets?\b", re.I),
        Department.HOUSEKEEPING,
        "Deliver blankets",
        Priority.NORMAL,
    ),
    (
        re.compile(r"\blate\s+checkout\b", re.I),
        Department.FRONT_DESK,
        "Late checkout request",
        Priority.NORMAL,
    ),
    (
        re.compile(r"\bearly\s+check[- ]?in\b", re.I),
        Department.FRONT_DESK,
        "Early check-in request",
        Priority.NORMAL,
    ),
    (
        re.compile(r"\b(?:room\s+service|in[- ]?room\s+dining|order\s+food)\b", re.I),
        Department.FOOD_BEVERAGE,
        "In-room dining order",
        Priority.NORMAL,
    ),
    (
        re.compile(r"\b(?:spa|massage|treatment)\b", re.I),
        Department.SPA,
        "Spa booking request",
        Priority.NORMAL,
    ),
    (
        re.compile(r"\b(?:laundry|dry\s*clean|press(?:ing)?)\b", re.I),
        Department.LAUNDRY,
        "Laundry / pressing",
        Priority.NORMAL,
    ),
    (
        re.compile(r"\b(?:ac|a/c|air\s*con|heating|thermostat)\b", re.I),
        Department.MAINTENANCE,
        "Climate control issue",
        Priority.HIGH,
    ),
    (
        re.compile(r"\b(?:quiet\s+room|noise|noisy)\b", re.I),
        Department.FRONT_DESK,
        "Quiet room / noise concern",
        Priority.HIGH,
    ),
    (
        re.compile(r"\b(?:wheelchair|accessible|accessibility)\b", re.I),
        Department.ACCESSIBILITY,
        "Accessibility support",
        Priority.HIGH,
    ),
]


def expand_multi_step_actions(
    text: str,
    actions: list[DepartmentAction],
) -> list[DepartmentAction]:
    """Append coordinated department actions not already present.

    Only expands when ≥2 coordination signals match the text, so
    simple single-intent requests stay single-step.
    """
    text = text or ""
    existing = {a.department for a in actions}
    additions: list[DepartmentAction] = []
    matched = 0

    for pattern, dept, summary, priority in _COORDINATION_RULES:
        if not pattern.search(text):
            continue
        matched += 1
        if dept in existing:
            continue
        additions.append(
            DepartmentAction(
                department=dept,
                summary=summary,
                details=text[:300],
                priority=priority,
            )
        )
        existing.add(dept)

    if matched < 2:
        return actions
    if not additions:
        return actions
    return list(actions) + additions

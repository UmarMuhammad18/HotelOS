"""
HotelOS Autonomous Shift Handover Generator
AI-generated end-of-shift briefings. Staff just read them — no manual effort.

Generates a complete shift brief covering:
- All open tasks (with priority and room)
- VIP guests arriving next shift
- Unresolved maintenance issues
- Guest sentiment flags (rooms that need special attention)
- AI narrative written for the incoming shift team

This replaces the manual shift handover process entirely.
"""

import json
from datetime import datetime

from app.agents.orchestrator import get_open_tasks
from app.learning import get_guest_memory
from app.llm.client import complete
from app.models import ShiftHandoverBrief


HANDOVER_SYSTEM_PROMPT = """You are the shift handover AI for a professional hotel.
You write clear, concise, professional shift briefings for incoming hotel staff.
Your briefings are friendly but precise — the incoming team should be able to read
this in under 2 minutes and know exactly what needs attention.
Do not use bullet-heavy formats. Write in short paragraphs like a real handover note.
"""

HANDOVER_PROMPT = """
Write a shift handover briefing for the incoming {shift} team.

CURRENT DATE/TIME: {now}

OPEN TASKS ({open_count} total):
{open_tasks_summary}

VIP/PREMIUM GUESTS ARRIVING OR IN-HOUSE:
{vip_summary}

UNRESOLVED MAINTENANCE:
{maintenance_summary}

SENTIMENT FLAGS (rooms that had complaints or low satisfaction signals):
{sentiment_summary}

Write a professional, warm shift handover note of 3-5 paragraphs.
- Start with the most urgent items
- Give the incoming team clear context on anything sensitive
- End with any proactive opportunities (upsells, VIP moments, etc.)
- Sign off as "HotelOS AI"
"""


def _determine_shift(now: datetime) -> str:
    hour = now.hour
    if 6 <= hour < 14:
        return "morning"
    elif 14 <= hour < 22:
        return "afternoon"
    else:
        return "night"


def _summarize_tasks(tasks: list[dict]) -> tuple[str, list[str]]:
    """Returns (text summary, list of maintenance task descriptions)."""
    if not tasks:
        return "No open tasks.", []

    by_priority = {"emergency": [], "urgent": [], "high": [], "normal": [], "low": []}
    maintenance = []

    for t in tasks:
        p = t.get("priority", "normal")
        by_priority.setdefault(p, []).append(t)
        if t.get("department") == "maintenance":
            maintenance.append(t.get("description", "Maintenance task"))

    lines = []
    for level in ["emergency", "urgent", "high", "normal", "low"]:
        bucket = by_priority[level]
        if bucket:
            lines.append(f"\n{level.upper()} ({len(bucket)}):")
            for t in bucket[:8]:  # cap per level to avoid giant prompts
                lines.append(
                    f"  Room {t.get('room', '?')} — {t.get('description', '')[:80]}"
                    f" [{t.get('department', '')}]"
                )

    return "\n".join(lines), maintenance


def _summarize_vips(rooms_in_house: list[str]) -> str:
    """Load guest memory for each room, flag VIPs."""
    vip_lines = []
    for room in rooms_in_house:
        memory = get_guest_memory(room)
        prefs = memory.get("preferences", [])
        history = memory.get("history", [])
        guest_type = "standard"
        for h in history:
            if h.get("guest_type") in ("premium", "vip"):
                guest_type = h["guest_type"]
                break
        if guest_type in ("premium", "vip") or len(history) >= 3:
            pref_summary = ", ".join(str(p) for p in prefs[:5]) if prefs else "none on file"
            vip_lines.append(
                f"Room {room} — {guest_type.upper()}, {len(history)} stays. "
                f"Known preferences: {pref_summary}"
            )
    return "\n".join(vip_lines) if vip_lines else "No VIP guests flagged."


def generate_shift_handover(
    rooms_in_house: list[str] | None = None,
    upcoming_vip_arrivals: list[dict] | None = None,
    sentiment_flags: list[dict] | None = None,
    shift: str | None = None,
) -> ShiftHandoverBrief:
    """
    Generate a complete shift handover brief.

    Args:
        rooms_in_house: list of room numbers currently occupied
        upcoming_vip_arrivals: list of {room, guest_name, guest_type} for next shift
        sentiment_flags: list of {room, reason} for rooms with known complaints
        shift: "morning"|"afternoon"|"night" (auto-detected if None)

    Returns:
        ShiftHandoverBrief with AI-generated narrative
    """
    now = datetime.utcnow()
    current_shift = shift or _determine_shift(now)
    rooms_in_house = rooms_in_house or []
    upcoming_vip_arrivals = upcoming_vip_arrivals or []
    sentiment_flags = sentiment_flags or []

    # Gather open tasks
    open_tasks = get_open_tasks()
    tasks_summary, maintenance_issues = _summarize_tasks(open_tasks)

    # VIP summary
    vip_summary = _summarize_vips(rooms_in_house)
    if upcoming_vip_arrivals:
        vip_summary += "\n\nARRIVING NEXT SHIFT:\n"
        for v in upcoming_vip_arrivals:
            vip_summary += (
                f"  Room {v.get('room')} — {v.get('guest_name', 'Guest')} "
                f"({v.get('guest_type', 'standard').upper()})\n"
            )

    # Sentiment summary
    if sentiment_flags:
        sentiment_summary = "\n".join(
            f"  Room {s.get('room')} — {s.get('reason', 'Complaint on file')}"
            for s in sentiment_flags
        )
    else:
        sentiment_summary = "No sentiment flags."

    # Maintenance summary
    maintenance_summary = (
        "\n".join(f"  {m}" for m in maintenance_issues)
        if maintenance_issues
        else "No open maintenance issues."
    )

    # Build prompt and call LLM for narrative
    prompt = HANDOVER_PROMPT.format(
        shift=current_shift,
        now=now.strftime("%Y-%m-%d %H:%M UTC"),
        open_count=len(open_tasks),
        open_tasks_summary=tasks_summary,
        vip_summary=vip_summary,
        maintenance_summary=maintenance_summary,
        sentiment_summary=sentiment_summary,
    )

    narrative = complete(prompt, system=HANDOVER_SYSTEM_PROMPT)

    # Build structured brief
    brief = ShiftHandoverBrief(
        shift=current_shift,
        generated_at=now.isoformat(),
        open_tasks=open_tasks,
        vip_arrivals=upcoming_vip_arrivals,
        maintenance_flags=maintenance_issues,
        sentiment_flags=sentiment_flags,
        summary=(
            f"{len(open_tasks)} open tasks | "
            f"{len(maintenance_issues)} maintenance issues | "
            f"{len(sentiment_flags)} sentiment flags"
        ),
        handover_notes=narrative,
    )

    return brief


def brief_to_dict(brief: ShiftHandoverBrief) -> dict:
    """Serialize brief to a clean dict for the API response."""
    return {
        "shift": brief.shift,
        "generated_at": brief.generated_at,
        "summary": brief.summary,
        "handover_notes": brief.handover_notes,
        "open_tasks_count": len(brief.open_tasks),
        "maintenance_flags": brief.maintenance_flags,
        "sentiment_flags": brief.sentiment_flags,
        "vip_arrivals": brief.vip_arrivals,
        "open_tasks": brief.open_tasks,
    }

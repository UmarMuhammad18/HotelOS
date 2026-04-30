"""
Metrics — turn a list of OutcomeRecords into the answers a GM cares about.

Pure functions of `list[OutcomeRecord]`. No I/O, no globals. The routes
layer fetches a record set from `OutcomeStore.list_in_range` and feeds
it in here.

Why pure functions and not a class
-----------------------------------
- Every metric is just a roll-up of timestamps and tags. Easy to test
  in isolation with hand-crafted records.
- Aggregation logic lives outside the storage layer, so swapping
  JSON for Postgres doesn't change a line here.
- We deliberately don't cache. Period queries scale fine over a year
  of data on Postgres; for JSON we cap by date range anyway.

What we measure
---------------
- Volume: total tasks, by department, by intent
- Latency: median and p95 acknowledgement and resolution times,
  per department
- Safety: emergency count + median emergency response time
- Outcomes prevented: repeat-issue catches, accessibility fan-outs
- Staffing impact: estimated staff-hours saved (a transparent heuristic
  the GM can audit)
- Coverage: languages handled, abuse incidents
- Open work: tasks still open at end of period

Estimated staff-hours saved
---------------------------
Heuristic, intentionally conservative and explicit:

    saved = (number_of_completed_tasks_with_no_followup) * (3 minutes)
          + (number_of_repeat_issue_catches)            * (15 minutes)

The first bucket assumes the AI-generated guest reply replaced what would
otherwise have been a 3-minute staff phone call. The second assumes
catching a repeat issue early prevents a 15-minute escalation handling.
We surface the heuristic explicitly in the metric so hoteliers can
calibrate it themselves rather than treating it as a black box.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from statistics import median
from typing import Iterable

from app.models import Department, Priority
from app.models.outcome import OutcomeRecord, OutcomeStatus


# Heuristic minutes saved per outcome class. Surfaced in the response
# so it's visible, not hidden.
_MINUTES_SAVED_PER_NO_FOLLOWUP = 3.0
_MINUTES_SAVED_PER_REPEAT_CATCH = 15.0


@dataclass(frozen=True)
class LatencyStats:
    """Latency summary in seconds. `None` for empty samples."""
    count: int
    median_seconds: float | None
    p95_seconds: float | None

    @staticmethod
    def from_samples(samples: list[float]) -> "LatencyStats":
        if not samples:
            return LatencyStats(count=0, median_seconds=None, p95_seconds=None)
        s = sorted(samples)
        med = float(median(s))
        # Simple percentile (no interpolation) — fine at this scale.
        p95_idx = max(0, int(round(0.95 * (len(s) - 1))))
        return LatencyStats(
            count=len(s),
            median_seconds=med,
            p95_seconds=float(s[p95_idx]),
        )


@dataclass
class DepartmentStats:
    department: str
    total: int = 0
    completed: int = 0
    cancelled: int = 0
    open: int = 0
    acknowledgement: LatencyStats = field(
        default_factory=lambda: LatencyStats(0, None, None)
    )
    resolution: LatencyStats = field(
        default_factory=lambda: LatencyStats(0, None, None)
    )


@dataclass
class PeriodMetrics:
    """Top-level metrics for a [start, end) window."""

    start: datetime
    end: datetime
    property_id: str | None

    total_tasks: int = 0
    completed_tasks: int = 0
    cancelled_tasks: int = 0
    open_tasks: int = 0

    emergencies: int = 0
    emergency_acknowledgement: LatencyStats = field(
        default_factory=lambda: LatencyStats(0, None, None)
    )
    emergency_resolution: LatencyStats = field(
        default_factory=lambda: LatencyStats(0, None, None)
    )

    repeat_issue_catches: int = 0
    accessibility_handled: int = 0
    abuse_incidents: int = 0

    no_followup_completions: int = 0       # AI-only resolutions
    quiet_hours_deferrals: int = 0

    by_department: dict[str, DepartmentStats] = field(default_factory=dict)
    by_intent: dict[str, int] = field(default_factory=dict)
    by_language: dict[str, int] = field(default_factory=dict)

    estimated_staff_minutes_saved: float = 0.0
    saved_minutes_breakdown: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict:
        """JSON-friendly dump for the API response."""
        return {
            "period": {
                "start": self.start.isoformat(),
                "end": self.end.isoformat(),
                "property_id": self.property_id,
            },
            "totals": {
                "tasks": self.total_tasks,
                "completed": self.completed_tasks,
                "cancelled": self.cancelled_tasks,
                "open": self.open_tasks,
            },
            "safety": {
                "emergencies": self.emergencies,
                "emergency_acknowledgement_median_seconds":
                    self.emergency_acknowledgement.median_seconds,
                "emergency_resolution_median_seconds":
                    self.emergency_resolution.median_seconds,
                "abuse_incidents": self.abuse_incidents,
                "accessibility_cases_handled": self.accessibility_handled,
            },
            "operations": {
                "repeat_issue_catches": self.repeat_issue_catches,
                "no_followup_completions": self.no_followup_completions,
                "quiet_hours_deferrals": self.quiet_hours_deferrals,
            },
            "by_department": {
                dept: {
                    "total": s.total,
                    "completed": s.completed,
                    "cancelled": s.cancelled,
                    "open": s.open,
                    "acknowledgement_median_seconds": s.acknowledgement.median_seconds,
                    "acknowledgement_p95_seconds": s.acknowledgement.p95_seconds,
                    "resolution_median_seconds": s.resolution.median_seconds,
                    "resolution_p95_seconds": s.resolution.p95_seconds,
                }
                for dept, s in self.by_department.items()
            },
            "by_intent": dict(self.by_intent),
            "by_language": dict(self.by_language),
            "staff_impact": {
                "estimated_minutes_saved": round(self.estimated_staff_minutes_saved, 1),
                "estimated_hours_saved": round(self.estimated_staff_minutes_saved / 60.0, 1),
                "breakdown": dict(self.saved_minutes_breakdown),
                "assumptions_minutes": {
                    "per_no_followup_completion": _MINUTES_SAVED_PER_NO_FOLLOWUP,
                    "per_repeat_issue_catch": _MINUTES_SAVED_PER_REPEAT_CATCH,
                },
            },
        }


def compute_period_metrics(
    records: list[OutcomeRecord],
    start: datetime,
    end: datetime,
    property_id: str | None,
) -> PeriodMetrics:
    """Aggregate `records` into a `PeriodMetrics` summary.

    Records are assumed to already be filtered by date and property —
    this function makes no further filtering. It's pure and
    deterministic.
    """
    m = PeriodMetrics(start=start, end=end, property_id=property_id)

    # Per-department samples, gathered in one pass to avoid re-scanning.
    ack_samples: dict[str, list[float]] = {}
    res_samples: dict[str, list[float]] = {}
    emerg_ack: list[float] = []
    emerg_res: list[float] = []

    for r in records:
        m.total_tasks += 1

        # Status counts
        if r.status == OutcomeStatus.COMPLETED:
            m.completed_tasks += 1
        elif r.status == OutcomeStatus.CANCELLED:
            m.cancelled_tasks += 1
        else:
            m.open_tasks += 1

        # Safety / classification flags
        if r.emergency:
            m.emergencies += 1
            if r.acknowledgement_seconds is not None:
                emerg_ack.append(r.acknowledgement_seconds)
            if r.resolution_seconds is not None:
                emerg_res.append(r.resolution_seconds)
        if r.repeat_count > 0:
            m.repeat_issue_catches += 1
        if r.accessibility_flagged:
            m.accessibility_handled += 1
        if r.abuse_flagged:
            m.abuse_incidents += 1
        if r.quiet_hours_deferred:
            m.quiet_hours_deferrals += 1

        # No-followup counter — only counts on completed tasks where the
        # field was explicitly set to False. Unknown (None) doesn't count.
        if (
            r.status == OutcomeStatus.COMPLETED
            and r.needed_staff_followup is False
        ):
            m.no_followup_completions += 1

        # Per-intent / per-language tallies
        if r.intent:
            m.by_intent[r.intent] = m.by_intent.get(r.intent, 0) + 1
        if r.language:
            m.by_language[r.language] = m.by_language.get(r.language, 0) + 1

        # Per-department
        dept_key = r.department.value
        ds = m.by_department.setdefault(
            dept_key, DepartmentStats(department=dept_key)
        )
        ds.total += 1
        if r.status == OutcomeStatus.COMPLETED:
            ds.completed += 1
        elif r.status == OutcomeStatus.CANCELLED:
            ds.cancelled += 1
        else:
            ds.open += 1
        if r.acknowledgement_seconds is not None:
            ack_samples.setdefault(dept_key, []).append(r.acknowledgement_seconds)
        if r.resolution_seconds is not None:
            res_samples.setdefault(dept_key, []).append(r.resolution_seconds)

    # Latency stats — computed once at the end to keep the per-record
    # loop simple and fast.
    for dept_key, ds in m.by_department.items():
        ds.acknowledgement = LatencyStats.from_samples(
            ack_samples.get(dept_key, [])
        )
        ds.resolution = LatencyStats.from_samples(
            res_samples.get(dept_key, [])
        )
    m.emergency_acknowledgement = LatencyStats.from_samples(emerg_ack)
    m.emergency_resolution = LatencyStats.from_samples(emerg_res)

    # Estimated staff time saved — transparent heuristic.
    no_followup_minutes = (
        m.no_followup_completions * _MINUTES_SAVED_PER_NO_FOLLOWUP
    )
    repeat_minutes = m.repeat_issue_catches * _MINUTES_SAVED_PER_REPEAT_CATCH
    m.estimated_staff_minutes_saved = no_followup_minutes + repeat_minutes
    m.saved_minutes_breakdown = {
        "no_followup_completions": round(no_followup_minutes, 1),
        "repeat_issue_catches": round(repeat_minutes, 1),
    }

    return m


def render_digest(metrics: PeriodMetrics) -> str:
    """Render a short human-readable digest, like the GM's weekly email.

    Deterministic — no LLM call. We keep this here (next to the
    aggregation it summarises) instead of in the API layer because the
    text formatting is a property of the metrics, not the HTTP contract.
    """
    days = max(1, (metrics.end - metrics.start).days)
    period_label = f"the last {days} day{'s' if days != 1 else ''}"

    lines: list[str] = []
    lines.append(
        f"Over {period_label}, your AI handled {metrics.total_tasks} "
        f"requests across {len(metrics.by_department)} departments."
    )

    if metrics.estimated_staff_minutes_saved > 0:
        hours = metrics.estimated_staff_minutes_saved / 60.0
        lines.append(
            f"Estimated staff time saved: ~{hours:.1f} hours "
            f"(see breakdown for assumptions)."
        )

    if metrics.emergencies > 0:
        ack = metrics.emergency_acknowledgement.median_seconds
        ack_str = f" with a median {ack:.0f}s acknowledgement" if ack else ""
        lines.append(
            f"Safety: {metrics.emergencies} emergency event"
            f"{'s' if metrics.emergencies != 1 else ''}{ack_str}."
        )

    if metrics.repeat_issue_catches > 0:
        lines.append(
            f"Caught {metrics.repeat_issue_catches} repeat issue"
            f"{'s' if metrics.repeat_issue_catches != 1 else ''} early — "
            "guest relations was looped in proactively."
        )

    if metrics.no_followup_completions > 0:
        share = (
            metrics.no_followup_completions / max(1, metrics.completed_tasks)
        ) * 100.0
        lines.append(
            f"{metrics.no_followup_completions} request"
            f"{'s' if metrics.no_followup_completions != 1 else ''} "
            f"resolved without staff follow-up "
            f"({share:.0f}% of completed)."
        )

    if metrics.accessibility_handled > 0:
        lines.append(
            f"Routed {metrics.accessibility_handled} request"
            f"{'s' if metrics.accessibility_handled != 1 else ''} with "
            "accessibility-aware handling."
        )

    langs = sorted(metrics.by_language.items(), key=lambda x: -x[1])
    if len(langs) > 1:
        top3 = ", ".join(f"{lang} ({n})" for lang, n in langs[:3])
        lines.append(f"Languages handled: {top3}.")

    if metrics.open_tasks > 0:
        lines.append(
            f"Open at end of period: {metrics.open_tasks} task"
            f"{'s' if metrics.open_tasks != 1 else ''}."
        )

    return "\n".join(lines)


def default_period(now: datetime, days: int = 7) -> tuple[datetime, datetime]:
    """Convenience: rolling N-day window ending at `now` (UTC).

    Used by `/v1/metrics/digest` when no explicit window is given.
    """
    if days <= 0:
        raise ValueError("days must be positive")
    end = now
    start = end - timedelta(days=days)
    return start, end

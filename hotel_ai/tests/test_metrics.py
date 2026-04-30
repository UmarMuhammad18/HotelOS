"""Tests for metrics aggregation — pure functions over OutcomeRecord lists."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models import Department, Priority
from app.models.outcome import OutcomeRecord, OutcomeStatus
from app.services.metrics import (
    LatencyStats,
    compute_period_metrics,
    default_period,
    render_digest,
)


def _rec(
    *,
    task_id: str = "t",
    department: Department = Department.HOUSEKEEPING,
    priority: Priority = Priority.NORMAL,
    status: OutcomeStatus = OutcomeStatus.CREATED,
    created_at: datetime | None = None,
    in_progress_at: datetime | None = None,
    completed_at: datetime | None = None,
    cancelled_at: datetime | None = None,
    intent: str = "amenity_request",
    language: str = "en",
    emergency: bool = False,
    repeat_count: int = 0,
    abuse: bool = False,
    accessibility: bool = False,
    quiet: bool = False,
    needed_followup: bool | None = None,
    property_id: str = "default",
) -> OutcomeRecord:
    base = created_at or datetime(2026, 4, 26, 12, 0, tzinfo=timezone.utc)
    return OutcomeRecord(
        task_id=task_id,
        reservation_id="r",
        guest_id="g",
        room_number="412",
        property_id=property_id,
        department=department,
        intent=intent,
        priority=priority,
        emergency=emergency,
        repeat_count=repeat_count,
        abuse_flagged=abuse,
        accessibility_flagged=accessibility,
        quiet_hours_deferred=quiet,
        language=language,
        created_at=base,
        in_progress_at=in_progress_at,
        completed_at=completed_at,
        cancelled_at=cancelled_at,
        status=status,
        needed_staff_followup=needed_followup,
    )


# --- Latency stats ----------------------------------------------------------


def test_latency_empty_samples():
    s = LatencyStats.from_samples([])
    assert s.count == 0
    assert s.median_seconds is None
    assert s.p95_seconds is None


def test_latency_one_sample():
    s = LatencyStats.from_samples([42.0])
    assert s.count == 1
    assert s.median_seconds == 42.0
    assert s.p95_seconds == 42.0


def test_latency_median_and_p95():
    samples = list(range(1, 101))  # 1..100 seconds
    s = LatencyStats.from_samples(samples)
    assert s.count == 100
    # Median of 1..100 is 50.5 (statistics.median, ints)
    assert s.median_seconds == 50.5
    # 95th percentile (no interp) -> index round(0.95*99)=94 -> value 95
    assert s.p95_seconds == 95.0


# --- Period metrics: totals -------------------------------------------------


def _window():
    base = datetime(2026, 4, 26, 12, 0, tzinfo=timezone.utc)
    return base - timedelta(days=1), base + timedelta(days=1)


def test_empty_records_zero_metrics():
    start, end = _window()
    m = compute_period_metrics([], start, end, "default")
    assert m.total_tasks == 0
    assert m.completed_tasks == 0
    assert m.estimated_staff_minutes_saved == 0.0


def test_status_counts():
    start, end = _window()
    records = [
        _rec(task_id="a", status=OutcomeStatus.COMPLETED),
        _rec(task_id="b", status=OutcomeStatus.COMPLETED),
        _rec(task_id="c", status=OutcomeStatus.CANCELLED),
        _rec(task_id="d", status=OutcomeStatus.CREATED),
        _rec(task_id="e", status=OutcomeStatus.IN_PROGRESS),
    ]
    m = compute_period_metrics(records, start, end, "default")
    assert m.total_tasks == 5
    assert m.completed_tasks == 2
    assert m.cancelled_tasks == 1
    assert m.open_tasks == 2  # CREATED + IN_PROGRESS


# --- Latency aggregation -----------------------------------------------------


def test_resolution_latency_per_department():
    start, end = _window()
    base = datetime(2026, 4, 26, 12, 0, tzinfo=timezone.utc)

    records = [
        # Housekeeping: 60s and 120s resolutions
        _rec(
            task_id="h1",
            department=Department.HOUSEKEEPING,
            status=OutcomeStatus.COMPLETED,
            created_at=base,
            completed_at=base + timedelta(seconds=60),
        ),
        _rec(
            task_id="h2",
            department=Department.HOUSEKEEPING,
            status=OutcomeStatus.COMPLETED,
            created_at=base,
            completed_at=base + timedelta(seconds=120),
        ),
        # Maintenance: 600s
        _rec(
            task_id="m1",
            department=Department.MAINTENANCE,
            status=OutcomeStatus.COMPLETED,
            created_at=base,
            completed_at=base + timedelta(seconds=600),
        ),
    ]
    m = compute_period_metrics(records, start, end, "default")
    hk = m.by_department["housekeeping"]
    mn = m.by_department["maintenance"]

    assert hk.resolution.count == 2
    assert hk.resolution.median_seconds == 90.0
    assert mn.resolution.median_seconds == 600.0


# --- Safety counts -----------------------------------------------------------


def test_emergency_counts_and_latency():
    start, end = _window()
    base = datetime(2026, 4, 26, 12, 0, tzinfo=timezone.utc)
    records = [
        _rec(
            task_id="e1",
            emergency=True,
            status=OutcomeStatus.COMPLETED,
            created_at=base,
            in_progress_at=base + timedelta(seconds=30),
            completed_at=base + timedelta(seconds=300),
        ),
        _rec(task_id="e2", emergency=True),  # open emergency
        _rec(task_id="ok", emergency=False),  # not an emergency
    ]
    m = compute_period_metrics(records, start, end, "default")
    assert m.emergencies == 2
    # Only e1 has timing samples
    assert m.emergency_acknowledgement.median_seconds == 30.0
    assert m.emergency_resolution.median_seconds == 300.0


def test_repeat_issue_and_abuse_and_accessibility():
    start, end = _window()
    records = [
        _rec(task_id="a", repeat_count=2),
        _rec(task_id="b", repeat_count=4),
        _rec(task_id="c", abuse=True),
        _rec(task_id="d", accessibility=True),
        _rec(task_id="e", accessibility=True),
    ]
    m = compute_period_metrics(records, start, end, "default")
    assert m.repeat_issue_catches == 2
    assert m.abuse_incidents == 1
    assert m.accessibility_handled == 2


def test_quiet_hours_deferrals():
    start, end = _window()
    records = [
        _rec(task_id="a", quiet=True),
        _rec(task_id="b"),
    ]
    m = compute_period_metrics(records, start, end, "default")
    assert m.quiet_hours_deferrals == 1


# --- No-followup completions + saved time -----------------------------------


def test_no_followup_completions_only_count_when_explicitly_false():
    """needed_staff_followup=None must NOT count — we only count when
    we have explicit signal."""
    start, end = _window()
    records = [
        _rec(
            task_id="a",
            status=OutcomeStatus.COMPLETED,
            needed_followup=False,
        ),
        _rec(
            task_id="b",
            status=OutcomeStatus.COMPLETED,
            needed_followup=True,
        ),
        _rec(
            task_id="c",
            status=OutcomeStatus.COMPLETED,
            needed_followup=None,  # unknown
        ),
    ]
    m = compute_period_metrics(records, start, end, "default")
    assert m.no_followup_completions == 1


def test_estimated_staff_time_saved_breakdown():
    """Saved-time heuristic: 3min per no_followup completion + 15min per repeat catch."""
    start, end = _window()
    records = [
        _rec(
            task_id=f"n{i}",
            status=OutcomeStatus.COMPLETED,
            needed_followup=False,
        ) for i in range(10)
    ] + [
        _rec(task_id=f"r{i}", repeat_count=3) for i in range(2)
    ]
    m = compute_period_metrics(records, start, end, "default")
    # 10 * 3 + 2 * 15 = 60
    assert m.estimated_staff_minutes_saved == 60.0
    assert m.saved_minutes_breakdown["no_followup_completions"] == 30.0
    assert m.saved_minutes_breakdown["repeat_issue_catches"] == 30.0


# --- Tallies -----------------------------------------------------------------


def test_by_intent_tally():
    start, end = _window()
    records = [
        _rec(task_id="a", intent="amenity_request"),
        _rec(task_id="b", intent="amenity_request"),
        _rec(task_id="c", intent="maintenance_issue"),
    ]
    m = compute_period_metrics(records, start, end, "default")
    assert m.by_intent == {"amenity_request": 2, "maintenance_issue": 1}


def test_by_language_tally():
    start, end = _window()
    records = [
        _rec(task_id="a", language="en"),
        _rec(task_id="b", language="es"),
        _rec(task_id="c", language="es"),
    ]
    m = compute_period_metrics(records, start, end, "default")
    assert m.by_language == {"en": 1, "es": 2}


# --- to_dict + render_digest -------------------------------------------------


def test_to_dict_includes_assumption_block():
    """The saved-time assumption must be visible in the response so a GM
    can audit it instead of treating it as black box."""
    start, end = _window()
    m = compute_period_metrics([], start, end, "default")
    d = m.to_dict()
    assert "assumptions_minutes" in d["staff_impact"]
    assert d["staff_impact"]["assumptions_minutes"]["per_no_followup_completion"] > 0


def test_render_digest_handles_zero_activity():
    start, end = _window()
    m = compute_period_metrics([], start, end, "default")
    text = render_digest(m)
    assert "0 requests" in text


def test_render_digest_mentions_emergencies_and_repeats():
    start, end = _window()
    base = datetime(2026, 4, 26, 12, 0, tzinfo=timezone.utc)
    records = [
        _rec(
            task_id="e1",
            emergency=True,
            status=OutcomeStatus.COMPLETED,
            created_at=base,
            in_progress_at=base + timedelta(seconds=30),
            completed_at=base + timedelta(seconds=180),
        ),
        _rec(task_id="r1", repeat_count=2),
        _rec(
            task_id="n1",
            status=OutcomeStatus.COMPLETED,
            needed_followup=False,
        ),
    ]
    m = compute_period_metrics(records, start, end, "default")
    text = render_digest(m)
    assert "emergency" in text.lower()
    assert "repeat issue" in text.lower()
    assert "without staff follow-up" in text.lower()


# --- default_period ----------------------------------------------------------


def test_default_period_window_size():
    now = datetime(2026, 4, 26, 12, 0, tzinfo=timezone.utc)
    start, end = default_period(now, days=7)
    assert (end - start) == timedelta(days=7)
    assert end == now


def test_default_period_rejects_zero_days():
    import pytest
    now = datetime.now(timezone.utc)
    with pytest.raises(ValueError):
        default_period(now, days=0)

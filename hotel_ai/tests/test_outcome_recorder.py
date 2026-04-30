"""Tests for OutcomeRecorder — the orchestrator's telemetry hook."""

from __future__ import annotations

from datetime import date

from app.memory.outcome_store import JSONFileOutcomeStore
from app.models import (
    AccessibilityNeeds,
    AgentEvent,
    AgentEventType,
    Department,
    DepartmentAction,
    EventChannel,
    GuestProfile,
    HotelEvent,
    Plan,
    Priority,
    StayContext,
    ToolCall,
)
from app.models.outcome import OutcomeStatus
from app.services.outcome_recorder import OutcomeRecorder


def _stay() -> StayContext:
    return StayContext(
        guest=GuestProfile(guest_id="g1", full_name="Ada"),
        room_number="412",
        check_in=date(2026, 4, 23),
        check_out=date(2026, 4, 25),
        reservation_id="r1",
    )


def _event() -> HotelEvent:
    return HotelEvent(
        channel=EventChannel.GUEST_CHAT,
        reservation_id="r1",
        room_number="412",
        guest_id="g1",
        text="extra towels please",
    )


def _build_recorder(tmp_path) -> tuple[OutcomeRecorder, JSONFileOutcomeStore]:
    store = JSONFileOutcomeStore(str(tmp_path / "out.json"))
    return OutcomeRecorder(store), store


def _action(
    department: Department = Department.HOUSEKEEPING,
    priority: Priority = Priority.NORMAL,
    details: str = "",
) -> DepartmentAction:
    return DepartmentAction(
        department=department,
        summary="do thing",
        details=details,
        priority=priority,
    )


def _plan_with_tasks(actions: list[DepartmentAction], emergency: bool = False) -> Plan:
    """Build a Plan that has one tool_call per action (simulating what
    real agents emit)."""
    plan = Plan(
        intent="amenity_request",
        sentiment="neutral",
        priority="normal",
        emergency=emergency,
    )
    for a in actions:
        plan.tool_calls.append(ToolCall(
            tool="assignTask",
            args={
                "taskType": a.summary,
                "roomNumber": "412",
                "priority": a.priority.value,
            },
        ))
    return plan


def test_record_plan_writes_one_record_per_task(tmp_path):
    recorder, store = _build_recorder(tmp_path)
    actions = [
        _action(Department.HOUSEKEEPING),
        _action(Department.GUEST_RELATIONS),
    ]
    plan = _plan_with_tasks(actions)

    written = recorder.record_plan(plan, _event(), _stay(), actions)
    assert len(written) == 2

    # Both records should be retrievable by their synthetic task_id.
    for rec in written:
        fetched = store.get(rec.task_id)
        assert fetched is not None


def test_record_plan_skips_non_task_tool_calls(tmp_path):
    """Tool calls without a roomNumber arg are not 'real tasks'."""
    recorder, store = _build_recorder(tmp_path)
    actions = [_action(Department.HOUSEKEEPING)]
    plan = _plan_with_tasks(actions)
    # Replace the tool_call with a non-task one
    plan.tool_calls = [ToolCall(tool="sendNotification", args={"text": "hi"})]
    written = recorder.record_plan(plan, _event(), _stay(), actions)
    assert written == []


def test_record_plan_captures_abuse_marker(tmp_path):
    recorder, store = _build_recorder(tmp_path)
    actions = [_action(Department.SECURITY, details="[abuse-flagged] foo")]
    plan = _plan_with_tasks(actions)
    written = recorder.record_plan(plan, _event(), _stay(), actions)
    assert written[0].abuse_flagged is True


def test_record_plan_captures_quiet_hours_marker(tmp_path):
    recorder, _ = _build_recorder(tmp_path)
    actions = [
        _action(
            Department.HOUSEKEEPING,
            details="standard [quiet hours: defer to morning]",
        ),
    ]
    plan = _plan_with_tasks(actions)
    written = recorder.record_plan(plan, _event(), _stay(), actions)
    assert written[0].quiet_hours_deferred is True


def test_record_plan_captures_repeat_count(tmp_path):
    recorder, _ = _build_recorder(tmp_path)
    actions = [
        _action(
            Department.MAINTENANCE,
            details="AC issue [repeat issue: guest has reported 'maintenance_issue' 3 times in the last 24h]",
        ),
    ]
    plan = _plan_with_tasks(actions)
    written = recorder.record_plan(plan, _event(), _stay(), actions)
    assert written[0].repeat_count == 3


def test_record_plan_marks_emergency(tmp_path):
    recorder, _ = _build_recorder(tmp_path)
    actions = [_action(Department.SECURITY, priority=Priority.EMERGENCY)]
    plan = _plan_with_tasks(actions, emergency=True)
    written = recorder.record_plan(plan, _event(), _stay(), actions)
    assert written[0].emergency is True


def test_record_plan_marks_accessibility(tmp_path):
    """Either dept=ACCESSIBILITY or stay-side accessibility flag triggers it."""
    recorder, _ = _build_recorder(tmp_path)

    # Case 1: department is ACCESSIBILITY
    actions = [_action(Department.ACCESSIBILITY)]
    plan = _plan_with_tasks(actions)
    written = recorder.record_plan(plan, _event(), _stay(), actions)
    assert written[0].accessibility_flagged is True

    # Case 2: guest has registered_disability, dept is something else
    stay = _stay().model_copy(update={
        "guest": _stay().guest.model_copy(update={
            "accessibility": AccessibilityNeeds(registered_disability=True),
        })
    })
    actions = [_action(Department.HOUSEKEEPING)]
    plan = _plan_with_tasks(actions)
    written = recorder.record_plan(plan, _event(), stay, actions)
    assert written[0].accessibility_flagged is True


def test_record_status_updates_in_progress(tmp_path):
    recorder, store = _build_recorder(tmp_path)
    actions = [_action(Department.HOUSEKEEPING)]
    plan = _plan_with_tasks(actions)
    written = recorder.record_plan(plan, _event(), _stay(), actions)
    task_id = written[0].task_id

    updated = recorder.record_status(task_id, OutcomeStatus.IN_PROGRESS)
    assert updated.status == OutcomeStatus.IN_PROGRESS
    assert updated.in_progress_at is not None
    # Round-trip: store now returns the updated version.
    fetched = store.get(task_id)
    assert fetched.in_progress_at is not None


def test_record_status_completed_sets_completed_at(tmp_path):
    recorder, _ = _build_recorder(tmp_path)
    actions = [_action(Department.HOUSEKEEPING)]
    plan = _plan_with_tasks(actions)
    written = recorder.record_plan(plan, _event(), _stay(), actions)
    task_id = written[0].task_id

    updated = recorder.record_status(task_id, OutcomeStatus.COMPLETED, needed_followup=False)
    assert updated.status == OutcomeStatus.COMPLETED
    assert updated.completed_at is not None
    assert updated.needed_staff_followup is False


def test_record_status_idempotent_on_same_status(tmp_path):
    """Re-applying COMPLETED a second time must NOT overwrite the original timestamp."""
    recorder, _ = _build_recorder(tmp_path)
    actions = [_action(Department.HOUSEKEEPING)]
    plan = _plan_with_tasks(actions)
    written = recorder.record_plan(plan, _event(), _stay(), actions)
    task_id = written[0].task_id

    first = recorder.record_status(task_id, OutcomeStatus.COMPLETED)
    second = recorder.record_status(task_id, OutcomeStatus.COMPLETED)
    assert first.completed_at == second.completed_at


def test_record_status_unknown_task_returns_none(tmp_path):
    """Status updates for tasks that have no record (e.g. created before
    telemetry was wired) don't error — they're a no-op."""
    recorder, _ = _build_recorder(tmp_path)
    assert recorder.record_status("ghost_task", OutcomeStatus.COMPLETED) is None


def test_telemetry_failure_does_not_break_record_plan(tmp_path):
    """If the underlying store crashes, record_plan logs and returns
    whatever it already wrote — it never raises."""
    recorder, store = _build_recorder(tmp_path)

    def boom(*_a, **_kw):
        raise RuntimeError("db down")
    store.upsert = boom  # type: ignore[method-assign]

    actions = [_action(Department.HOUSEKEEPING)]
    plan = _plan_with_tasks(actions)
    # Should NOT raise:
    written = recorder.record_plan(plan, _event(), _stay(), actions)
    assert written == []

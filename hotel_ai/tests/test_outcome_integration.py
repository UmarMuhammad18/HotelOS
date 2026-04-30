"""
End-to-end test: orchestrator emits outcome records that metrics can aggregate.

This is the cross-cutting test that proves:
  - The orchestrator passes the right context to the recorder
  - The recorder writes one record per task
  - Metrics aggregate those records correctly
  - Status transitions update the same records

If any link in that chain breaks, this test catches it. The unit tests
on each layer give precise diagnostics; this one gives confidence the
integration is sound.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest

from app.agents.orchestrator import Orchestrator
from app.llm.client import FakeLLM
from app.memory.guest_memory import GuestMemory
from app.memory.outcome_store import JSONFileOutcomeStore
from app.memory.store import JSONFileStore
from app.models import (
    AccessibilityNeeds,
    EventChannel,
    GuestProfile,
    HotelEvent,
    StayContext,
)
from app.models.outcome import OutcomeStatus
from app.services.metrics import compute_period_metrics
from app.services.outcome_recorder import OutcomeRecorder


@pytest.fixture
def stay() -> StayContext:
    return StayContext(
        guest=GuestProfile(guest_id="g1", full_name="Ada"),
        room_number="412",
        check_in=date(2026, 4, 23),
        check_out=date(2026, 4, 25),
        reservation_id="r1",
    )


def _build(tmp_path, llm: FakeLLM):
    guest_store = JSONFileStore(str(tmp_path / "mem.json"))
    outcome_store = JSONFileOutcomeStore(str(tmp_path / "out.json"))
    memory = GuestMemory(guest_store)
    recorder = OutcomeRecorder(outcome_store)
    orch = Orchestrator(
        llm=llm,
        memory=memory,
        outcome_recorder=recorder,
        property_id="hotel-test",
    )
    return orch, outcome_store, recorder


def test_event_writes_outcome_record(tmp_path, stay):
    llm = FakeLLM(canned={
        "actions": [{
            "department": "housekeeping",
            "summary": "deliver towels",
            "details": "Routine.",
            "priority": "normal",
            "requires_coordination_with": [],
        }],
        "intent": "amenity_request",
        "sentiment": "neutral",
    })
    orch, store, _ = _build(tmp_path, llm)
    event = HotelEvent(
        channel=EventChannel.GUEST_CHAT,
        reservation_id="r1",
        room_number="412",
        guest_id="g1",
        text="towels please",
    )
    orch.build_plan(event, stay)

    # One record should exist with our property_id and intent
    now = datetime.now(timezone.utc)
    records = store.list_in_range(
        start=now - timedelta(minutes=1),
        end=now + timedelta(minutes=1),
        property_id="hotel-test",
    )
    assert len(records) == 1
    rec = records[0]
    assert rec.intent == "amenity_request"
    assert rec.department.value == "housekeeping"
    assert rec.property_id == "hotel-test"
    assert rec.status == OutcomeStatus.CREATED


def test_status_update_updates_existing_record(tmp_path, stay):
    llm = FakeLLM(canned={
        "actions": [{
            "department": "housekeeping",
            "summary": "deliver towels",
            "details": "Routine.",
            "priority": "normal",
            "requires_coordination_with": [],
        }],
        "intent": "amenity_request",
        "sentiment": "neutral",
    })
    orch, store, recorder = _build(tmp_path, llm)
    event = HotelEvent(
        channel=EventChannel.GUEST_CHAT,
        reservation_id="r1",
        room_number="412",
        guest_id="g1",
        text="towels",
    )
    orch.build_plan(event, stay)

    # Find the record by listing
    now = datetime.now(timezone.utc)
    [rec] = store.list_in_range(
        start=now - timedelta(minutes=1),
        end=now + timedelta(minutes=1),
    )
    task_id = rec.task_id

    # Now apply transitions
    recorder.record_status(task_id, OutcomeStatus.IN_PROGRESS)
    final = recorder.record_status(
        task_id, OutcomeStatus.COMPLETED, needed_followup=False
    )
    assert final.status == OutcomeStatus.COMPLETED
    assert final.in_progress_at is not None
    assert final.completed_at is not None
    # resolution_seconds is computed from timestamps
    assert final.resolution_seconds is not None
    assert final.resolution_seconds >= 0


def test_metrics_aggregate_after_full_lifecycle(tmp_path, stay):
    """Run several events through, mark some completed, verify metrics."""
    llm = FakeLLM(canned={
        "actions": [{
            "department": "housekeeping",
            "summary": "deliver towels",
            "details": "Routine.",
            "priority": "normal",
            "requires_coordination_with": [],
        }],
        "intent": "amenity_request",
        "sentiment": "neutral",
    })
    orch, store, recorder = _build(tmp_path, llm)

    # Three identical events. The 3rd triggers repeat-issue policy which
    # fans out to Guest Relations, so total records > 3. Filter to
    # housekeeping only for clean metric assertions.
    for i in range(3):
        event = HotelEvent(
            channel=EventChannel.GUEST_CHAT,
            reservation_id="r1",
            room_number="412",
            guest_id="g1",
            text=f"request {i}",
        )
        orch.build_plan(event, stay)

    now = datetime.now(timezone.utc)
    all_records = store.list_in_range(
        start=now - timedelta(minutes=1),
        end=now + timedelta(minutes=1),
    )
    assert len(all_records) >= 3

    hk_records = [r for r in all_records if r.department.value == "housekeeping"]
    assert len(hk_records) == 3

    recorder.record_status(hk_records[0].task_id, OutcomeStatus.COMPLETED, needed_followup=False)
    recorder.record_status(hk_records[1].task_id, OutcomeStatus.COMPLETED, needed_followup=False)

    now = datetime.now(timezone.utc)
    hk_only = [
        r for r in store.list_in_range(
            start=now - timedelta(minutes=2),
            end=now + timedelta(minutes=1),
        )
        if r.department.value == "housekeeping"
    ]
    m = compute_period_metrics(
        hk_only,
        start=now - timedelta(minutes=2),
        end=now + timedelta(minutes=1),
        property_id=None,
    )
    assert m.total_tasks == 3
    assert m.completed_tasks == 2
    assert m.open_tasks == 1
    assert m.no_followup_completions == 2
    # 2 no-followup completions (2*3=6min) + 1 repeat catch (15min) = 21min
    assert m.estimated_staff_minutes_saved == 21.0


def test_repeat_issue_recorded_in_outcome(tmp_path, stay):
    """Third report of same intent triggers repeat-issue policy; the
    recorder should capture the repeat_count from the action details."""
    llm = FakeLLM(canned={
        "actions": [{
            "department": "maintenance",
            "summary": "AC issue",
            "details": "Broken AC.",
            "priority": "normal",
            "requires_coordination_with": [],
        }],
        "intent": "maintenance_issue",
        "sentiment": "frustrated",
    })
    orch, store, _ = _build(tmp_path, llm)

    for i in range(3):
        event = HotelEvent(
            channel=EventChannel.GUEST_CHAT,
            reservation_id="r1",
            room_number="412",
            guest_id="g1",
            text=f"AC broken again {i}",
        )
        orch.build_plan(event, stay)

    now = datetime.now(timezone.utc)
    records = store.list_in_range(
        start=now - timedelta(minutes=1),
        end=now + timedelta(minutes=1),
    )
    # The third record should have a non-zero repeat_count for the
    # maintenance department (where the orchestrator added the marker).
    maint_records = [
        r for r in records if r.department.value == "maintenance"
    ]
    assert len(maint_records) == 3
    # The third one is the one after threshold -> repeat marker present
    assert maint_records[-1].repeat_count > 0


def test_orchestrator_works_without_recorder(tmp_path, stay):
    """Recorder is optional — orchestrator constructed without one
    must still handle events normally."""
    llm = FakeLLM(canned={
        "actions": [{
            "department": "housekeeping",
            "summary": "towels",
            "details": "Routine.",
            "priority": "normal",
            "requires_coordination_with": [],
        }],
        "intent": "amenity_request",
        "sentiment": "neutral",
    })
    guest_store = JSONFileStore(str(tmp_path / "mem.json"))
    memory = GuestMemory(guest_store)
    orch = Orchestrator(llm=llm, memory=memory)  # no recorder

    event = HotelEvent(
        channel=EventChannel.GUEST_CHAT,
        reservation_id="r1",
        room_number="412",
        guest_id="g1",
        text="towels",
    )
    plan = orch.build_plan(event, stay)
    # Plan still works as before — only telemetry is disabled.
    assert plan.tool_calls
    assert plan.guest_reply is not None

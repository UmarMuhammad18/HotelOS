"""Tests for JSONFileOutcomeStore."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.memory.outcome_store import JSONFileOutcomeStore
from app.models import Department, Priority
from app.models.outcome import OutcomeRecord, OutcomeStatus


def _record(
    task_id: str,
    *,
    created_at: datetime | None = None,
    department: Department = Department.HOUSEKEEPING,
    property_id: str = "default",
) -> OutcomeRecord:
    return OutcomeRecord(
        task_id=task_id,
        reservation_id="r1",
        guest_id="g1",
        room_number="412",
        property_id=property_id,
        department=department,
        intent="amenity_request",
        priority=Priority.NORMAL,
        created_at=created_at or datetime.now(timezone.utc),
    )


def test_upsert_then_get(tmp_path):
    store = JSONFileOutcomeStore(str(tmp_path / "out.json"))
    rec = _record("tsk_1")
    store.upsert(rec)
    fetched = store.get("tsk_1")
    assert fetched is not None
    assert fetched.task_id == "tsk_1"


def test_get_missing_returns_none(tmp_path):
    store = JSONFileOutcomeStore(str(tmp_path / "out.json"))
    assert store.get("nope") is None


def test_upsert_overwrites_same_task(tmp_path):
    """Re-upserting same task_id replaces the record (used for status updates)."""
    store = JSONFileOutcomeStore(str(tmp_path / "out.json"))
    rec = _record("tsk_1")
    store.upsert(rec)

    updated = rec.model_copy(update={"status": OutcomeStatus.COMPLETED})
    store.upsert(updated)

    fetched = store.get("tsk_1")
    assert fetched.status == OutcomeStatus.COMPLETED


def test_list_in_range_filters_by_date(tmp_path):
    store = JSONFileOutcomeStore(str(tmp_path / "out.json"))
    base = datetime(2026, 4, 26, 12, 0, tzinfo=timezone.utc)
    store.upsert(_record("old", created_at=base - timedelta(days=10)))
    store.upsert(_record("recent", created_at=base - timedelta(hours=2)))
    store.upsert(_record("future", created_at=base + timedelta(days=1)))

    found = store.list_in_range(
        start=base - timedelta(days=1),
        end=base + timedelta(hours=1),
    )
    ids = {r.task_id for r in found}
    assert ids == {"recent"}


def test_list_in_range_filters_by_property(tmp_path):
    store = JSONFileOutcomeStore(str(tmp_path / "out.json"))
    now = datetime.now(timezone.utc)
    store.upsert(_record("a", property_id="hotel-1"))
    store.upsert(_record("b", property_id="hotel-2"))

    only_h1 = store.list_in_range(
        start=now - timedelta(hours=1),
        end=now + timedelta(hours=1),
        property_id="hotel-1",
    )
    assert {r.task_id for r in only_h1} == {"a"}

    all_props = store.list_in_range(
        start=now - timedelta(hours=1),
        end=now + timedelta(hours=1),
        property_id=None,
    )
    assert {r.task_id for r in all_props} == {"a", "b"}


def test_results_sorted_by_created_at(tmp_path):
    store = JSONFileOutcomeStore(str(tmp_path / "out.json"))
    base = datetime(2026, 4, 26, tzinfo=timezone.utc)
    store.upsert(_record("c", created_at=base + timedelta(hours=2)))
    store.upsert(_record("a", created_at=base))
    store.upsert(_record("b", created_at=base + timedelta(hours=1)))

    found = store.list_in_range(
        start=base - timedelta(minutes=1),
        end=base + timedelta(hours=3),
    )
    assert [r.task_id for r in found] == ["a", "b", "c"]


def test_corrupt_file_yields_empty(tmp_path):
    """If the JSON file gets corrupted, we log and return empty rather
    than crashing the whole metrics endpoint."""
    p = tmp_path / "out.json"
    p.write_text("not valid json at all", encoding="utf-8")
    store = JSONFileOutcomeStore(str(p))
    assert store.list_in_range(
        start=datetime.now(timezone.utc) - timedelta(hours=1),
        end=datetime.now(timezone.utc) + timedelta(hours=1),
    ) == []

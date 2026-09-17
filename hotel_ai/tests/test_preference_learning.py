"""Phase 3 — preference learning, memory diff, proactive check-in, stay complete."""

from __future__ import annotations

from app.memory.guest_memory import GuestMemory, encode_request
from app.memory.preference_learner import (
    learn_preferences_from_requests,
    proactive_tasks_from_preferences,
)
from app.memory.store import JSONFileStore
from app.models.guest import GuestProfile


def _memory(tmp_path) -> GuestMemory:
    store = JSONFileStore(str(tmp_path / "mem.json"))
    return GuestMemory(store)


def _seed(mem: GuestMemory, guest_id: str = "g1") -> GuestProfile:
    profile = GuestProfile(guest_id=guest_id, full_name="Ada Lovelace")
    return mem.upsert_from_reservation(profile)


def test_keyword_rule_learns_extra_towels():
    lines = [
        encode_request("amenity_request", "Can I get extra towels please?"),
        encode_request("amenity_request", "Need more towels"),
    ]
    learned = learn_preferences_from_requests(lines)
    assert learned.get("extra_towels") is True
    assert learned.get("frequent_amenity_requests") is True


def test_pillow_type_extracted():
    lines = [encode_request("amenity_request", "Please leave a foam pillow")]
    learned = learn_preferences_from_requests(lines)
    assert learned.get("pillow") == "foam"


def test_no_learn_when_below_intent_threshold():
    lines = [encode_request("amenity_request", "hello")]
    learned = learn_preferences_from_requests(lines)
    assert "frequent_amenity_requests" not in learned


def test_diff_excludes_already_known_prefs():
    lines = [
        encode_request("amenity_request", "extra towels"),
        encode_request("amenity_request", "more towels"),
    ]
    learned = learn_preferences_from_requests(
        lines, existing={"extra_towels": True}
    )
    assert "extra_towels" not in learned


def test_guest_memory_learn_persists(tmp_path):
    mem = _memory(tmp_path)
    _seed(mem)
    mem.record_request("g1", "extra towels please", intent="amenity_request")
    mem.record_request("g1", "more towels", intent="amenity_request")

    learned = mem.learn_preferences("g1")
    assert learned.get("extra_towels") is True

    profile = mem.get_profile("g1")
    assert profile is not None
    assert profile.preferences.get("extra_towels") is True

    # Second run is a no-op diff
    assert mem.learn_preferences("g1") == {}


def test_memory_diff_is_read_only(tmp_path):
    mem = _memory(tmp_path)
    _seed(mem)
    mem.record_request("g1", "quiet room please", intent="amenity_request")
    mem.record_request("g1", "need a quiet room", intent="amenity_request")

    diff = mem.memory_diff("g1")
    assert diff.get("quiet_room") is True

    profile = mem.get_profile("g1")
    assert profile is not None
    assert "quiet_room" not in profile.preferences  # not written yet


def test_proactive_tasks_from_preferences():
    tasks = proactive_tasks_from_preferences(
        {"extra_towels": True, "pillow": "foam", "unknown_key": True}
    )
    depts = {t["department"] for t in tasks}
    assert "housekeeping" in depts
    assert any("towel" in t["summary"].lower() for t in tasks)
    assert any("foam" in t["details"].lower() for t in tasks)
    assert not any("unknown" in t["summary"].lower() for t in tasks)


def test_proactive_checkin_via_memory(tmp_path):
    mem = _memory(tmp_path)
    _seed(mem)
    mem.record_preference("g1", "extra_towels", True)
    mem.record_preference("g1", "late_checkout", True)

    tasks = mem.proactive_checkin_tasks("g1")
    assert len(tasks) >= 2
    summaries = " ".join(t["summary"].lower() for t in tasks)
    assert "towel" in summaries
    assert "checkout" in summaries


def test_complete_stay_learns_and_summarises(tmp_path):
    mem = _memory(tmp_path)
    _seed(mem)
    mem.record_request("g1", "foam pillow please", intent="amenity_request")
    mem.record_request("g1", "extra towels", intent="amenity_request")

    summary = mem.complete_stay("g1")
    assert "Ada" in summary

    profile = mem.get_profile("g1")
    assert profile is not None
    assert profile.preferences  # learning ran


def test_learn_missing_guest_returns_empty(tmp_path):
    mem = _memory(tmp_path)
    assert mem.learn_preferences("nope") == {}
    assert mem.memory_diff("nope") == {}
    assert mem.proactive_checkin_tasks("nope") == []

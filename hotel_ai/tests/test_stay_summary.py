"""Tests for GuestMemory.stay_summary — deterministic single-paragraph output."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.memory.guest_memory import GuestMemory, encode_request
from app.memory.store import JSONFileStore
from app.models import AccessibilityNeeds, GuestProfile


def _memory(tmp_path) -> GuestMemory:
    store = JSONFileStore(str(tmp_path / "mem.json"))
    return GuestMemory(store)


def test_no_profile_returns_helpful_default(tmp_path):
    mem = _memory(tmp_path)
    assert mem.stay_summary("nobody") == "No prior record on file."


def test_minimal_profile_summary(tmp_path):
    mem = _memory(tmp_path)
    mem.upsert_from_reservation(
        GuestProfile(guest_id="g1", full_name="Ada Lovelace")
    )
    out = mem.stay_summary("g1")
    # No flags, no preferences, no history -> name + neutral note.
    assert "Ada Lovelace" in out
    assert "no notable" in out.lower() or "—" in out


def test_vip_and_accessibility_flags_appear(tmp_path):
    mem = _memory(tmp_path)
    mem.upsert_from_reservation(GuestProfile(
        guest_id="g1",
        full_name="Ada Lovelace",
        vip=True,
        accessibility=AccessibilityNeeds(registered_disability=True),
    ))
    out = mem.stay_summary("g1")
    assert "VIP" in out
    assert "accessibility" in out.lower()


def test_language_preference_surfaced_when_non_english(tmp_path):
    mem = _memory(tmp_path)
    mem.upsert_from_reservation(
        GuestProfile(guest_id="g1", full_name="Sofia", language="es")
    )
    out = mem.stay_summary("g1")
    assert "es" in out  # "prefers es"


def test_english_language_not_surfaced(tmp_path):
    """English is the implicit default; don't waste a sentence on it."""
    mem = _memory(tmp_path)
    mem.upsert_from_reservation(
        GuestProfile(guest_id="g1", full_name="Ada", language="en")
    )
    out = mem.stay_summary("g1")
    assert "prefers en" not in out.lower()


def test_top_preferences_appear(tmp_path):
    mem = _memory(tmp_path)
    mem.upsert_from_reservation(GuestProfile(
        guest_id="g1",
        full_name="Ada",
        preferences={"pillow": "foam", "quiet_room": True, "newspaper": "FT"},
    ))
    out = mem.stay_summary("g1")
    assert "pillow" in out
    assert "foam" in out


def test_intent_counts_summarised(tmp_path):
    """Multiple recorded requests of the same intent should aggregate."""
    mem = _memory(tmp_path)
    mem.upsert_from_reservation(
        GuestProfile(guest_id="g1", full_name="Ada")
    )
    # Inject some past_requests directly through record_request.
    for _ in range(3):
        mem.record_request("g1", "AC issue again", intent="maintenance_issue")
    for _ in range(2):
        mem.record_request("g1", "extra towels", intent="amenity_request")

    out = mem.stay_summary("g1")
    # Should mention recent activity with counts.
    assert "recent activity" in out.lower()
    assert "maintenance_issue" in out


def test_summary_is_deterministic(tmp_path):
    """Same data -> same summary, every time. No LLM jitter."""
    mem = _memory(tmp_path)
    mem.upsert_from_reservation(GuestProfile(
        guest_id="g1",
        full_name="Ada",
        vip=True,
        preferences={"pillow": "foam"},
    ))
    out_1 = mem.stay_summary("g1")
    out_2 = mem.stay_summary("g1")
    out_3 = mem.stay_summary("g1")
    assert out_1 == out_2 == out_3

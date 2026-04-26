"""
Memory hydration into the LLM prompt.

When the orchestrator classifies an event, the LLM receives a "Guest
context" block assembled from GuestMemory. We pin that:
  1. The block appears in the user message.
  2. It includes recent past_requests when present.
  3. It surfaces VIP / accessibility / language flags.
  4. A first-time guest still gets a context block.
  5. After build_plan, the current event lands in memory for next time.
"""

from __future__ import annotations

from datetime import date

import pytest

from app.agents.orchestrator import Orchestrator
from app.config import get_settings
from app.memory.guest_memory import GuestMemory, encode_request
from app.memory.store import JSONFileStore
from app.models import (
    AccessibilityNeeds,
    EventChannel,
    GuestProfile,
    HotelEvent,
    StayContext,
)


@pytest.fixture(autouse=True)
def _clean_settings():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


class RecordingLLM:
    """LLM double that records the last user payload."""

    def __init__(self, canned: dict) -> None:
        self.canned = canned
        self.last_system: str | None = None
        self.last_user: str | None = None

    def classify_json(self, system: str, user: str) -> dict:
        self.last_system = system
        self.last_user = user
        return self.canned

    def reply_text(self, system: str, user: str) -> str:  # noqa: ARG002
        return "ok"

    def ping(self) -> bool:
        return True


_CANNED = {
    "actions": [{
        "department": "maintenance",
        "summary": "AC not cooling",
        "details": "Repeat AC complaint.",
        "priority": "normal",
        "requires_coordination_with": [],
    }],
    "intent": "maintenance_issue",
    "sentiment": "frustrated",
}


@pytest.fixture
def stay() -> StayContext:
    return StayContext(
        guest=GuestProfile(guest_id="g-ada", full_name="Ada Lovelace"),
        room_number="412",
        check_in=date(2026, 4, 23),
        check_out=date(2026, 4, 25),
        reservation_id="r1",
    )


def _build_orch(tmp_path, llm) -> tuple[Orchestrator, GuestMemory]:
    store = JSONFileStore(str(tmp_path / "mem.json"))
    memory = GuestMemory(store)
    orch = Orchestrator(llm=llm, memory=memory)
    return orch, memory


def _event(text: str = "My AC still isn't cooling") -> HotelEvent:
    return HotelEvent(
        channel=EventChannel.GUEST_CHAT,
        reservation_id="r1",
        room_number="412",
        guest_id="g-ada",
        text=text,
    )


def test_context_block_is_sent_to_llm(tmp_path, stay):
    llm = RecordingLLM(_CANNED)
    orch, _ = _build_orch(tmp_path, llm)
    orch.build_plan(_event(), stay)

    assert llm.last_user is not None
    assert "Guest context:" in llm.last_user
    assert "Current event" in llm.last_user
    assert "My AC still isn't cooling" in llm.last_user


def test_first_time_guest_context_is_marked(tmp_path, stay):
    llm = RecordingLLM(_CANNED)
    orch, _ = _build_orch(tmp_path, llm)
    orch.build_plan(_event(), stay)
    assert "Returning guest: no" in (llm.last_user or "")


def test_returning_guest_past_requests_are_in_context(tmp_path, stay):
    """Seed past_requests using the new pipe-encoded format and confirm
    they're rendered in the prompt."""
    llm = RecordingLLM(_CANNED)
    orch, memory = _build_orch(tmp_path, llm)

    profile = GuestProfile(
        guest_id="g-ada",
        full_name="Ada Lovelace",
        past_requests=[
            encode_request("maintenance_issue", "AC making loud noise"),
            encode_request("maintenance_issue", "AC not cooling earlier today"),
        ],
        preferences={"pillow": "foam", "quiet_room": True},
    )
    memory.upsert_from_reservation(profile)

    orch.build_plan(_event(), stay)

    user = llm.last_user or ""
    assert "Recent requests" in user
    assert "AC not cooling earlier today" in user
    assert "Known preferences" in user
    assert "pillow" in user
    assert "foam" in user
    assert "Returning guest: yes" in user


def test_vip_flag_and_accessibility_in_context(tmp_path):
    llm = RecordingLLM(_CANNED)
    stay = StayContext(
        guest=GuestProfile(
            guest_id="g-vip",
            full_name="M. VIP",
            vip=True,
            accessibility=AccessibilityNeeds(
                registered_disability=True,
                requires_evacuation_assistance=True,
            ),
        ),
        room_number="707",
        check_in=date(2026, 4, 23),
        check_out=date(2026, 4, 25),
        reservation_id="r-vip",
    )
    orch, _ = _build_orch(tmp_path, llm)
    event = HotelEvent(
        channel=EventChannel.GUEST_CHAT,
        reservation_id="r-vip",
        room_number="707",
        guest_id="g-vip",
        text="Could I get a late checkout?",
    )
    orch.build_plan(event, stay)

    user = llm.last_user or ""
    assert "VIP" in user
    assert "accessibility" in user.lower()
    assert "evacuation assistance required" in user


def test_past_requests_include_the_current_event_after_build(tmp_path, stay):
    llm = RecordingLLM(_CANNED)
    orch, memory = _build_orch(tmp_path, llm)

    memory.upsert_from_reservation(
        GuestProfile(guest_id="g-ada", full_name="Ada Lovelace")
    )

    orch.build_plan(_event("AC not cooling — first report"), stay)
    orch.build_plan(_event("AC still not cooling — second report"), stay)

    user_second = llm.last_user or ""
    assert "first report" in user_second
    assert "Returning guest: yes" in user_second


def test_build_plan_seeds_profile_for_transient_guest(tmp_path, stay):
    """The orchestrator must seed a profile for a guest that doesn't
    have one yet so subsequent record_request calls actually persist."""
    llm = RecordingLLM(_CANNED)
    orch, memory = _build_orch(tmp_path, llm)

    assert memory.get_profile("g-ada") is None
    orch.build_plan(_event("My AC isn't cooling"), stay)

    profile = memory.get_profile("g-ada")
    assert profile is not None
    assert profile.full_name == "Ada Lovelace"
    assert len(profile.past_requests) >= 1
    assert any("cooling" in r.lower() for r in profile.past_requests)

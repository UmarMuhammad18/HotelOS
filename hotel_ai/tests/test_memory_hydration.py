"""
Phase 2b — memory hydration tests.

Pins the behaviour that when the orchestrator classifies an event, the LLM
receives a "Guest context" block assembled from GuestMemory. The LLM is
free to ignore that context, but:

  1. The context block itself must appear in the user message.
  2. It must include the guest's recent past_requests when they exist.
  3. It must surface VIP / accessibility / language flags when set.
  4. A first-time guest must still get a context block (empty-history case).

We use a `RecordingLLM` double so we can assert on the exact user payload
the orchestrator hands to the LLM, without taking a dependency on a real
provider.
"""

from __future__ import annotations

from datetime import date

import pytest

from app.agents.orchestrator import Orchestrator
from app.memory.guest_memory import GuestMemory
from app.memory.store import JSONFileStore
from app.models import (
    AccessibilityNeeds,
    EventChannel,
    GuestProfile,
    HotelEvent,
    StayContext,
)


class RecordingLLM:
    """LLM double that records the last user payload and returns canned JSON."""

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
    # The text of the current event should follow the context block.
    assert "My AC still isn't cooling" in llm.last_user


def test_first_time_guest_context_is_marked(tmp_path, stay):
    llm = RecordingLLM(_CANNED)
    orch, _ = _build_orch(tmp_path, llm)
    orch.build_plan(_event(), stay)

    # With no profile seeded, the context should explicitly say this is
    # a first request / non-returning guest.
    assert "Returning guest: no" in (llm.last_user or "")


def test_returning_guest_past_requests_are_in_context(tmp_path, stay):
    """Seed past_requests on the guest profile and confirm they appear."""
    llm = RecordingLLM(_CANNED)
    orch, memory = _build_orch(tmp_path, llm)

    # Seed a profile with prior AC complaints.
    profile = GuestProfile(
        guest_id="g-ada",
        full_name="Ada Lovelace",
        past_requests=[
            "AC making loud noise",
            "AC not cooling earlier today",
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
    # Returning guest flag should flip on.
    assert "Returning guest: yes" in user


def test_vip_flag_and_accessibility_in_context(tmp_path):
    """VIP + accessibility needs must show up in the flags line."""
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
    """After build_plan completes, the current event should be recorded so
    the NEXT event sees it in its context block."""
    llm = RecordingLLM(_CANNED)
    orch, memory = _build_orch(tmp_path, llm)

    # Seed a bare profile first so record_request has somewhere to write.
    memory.upsert_from_reservation(
        GuestProfile(guest_id="g-ada", full_name="Ada Lovelace")
    )

    orch.build_plan(_event("AC not cooling — first report"), stay)
    orch.build_plan(_event("AC still not cooling — second report"), stay)

    user_second = llm.last_user or ""
    # Second call's context must mention the first call's text.
    assert "first report" in user_second
    assert "Returning guest: yes" in user_second

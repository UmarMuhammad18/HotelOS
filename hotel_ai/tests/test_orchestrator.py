"""
Orchestrator invariants for the advisor service.

The orchestrator now returns a Plan (not publishes tasks). These tests pin
the behaviours that matter most for integration with the Node executor:
  1. Simple request → correct department + matching tool_call.
  2. Emergency words → emergency flag + security + front_desk present.
  3. VIP guest → guest_relations added, priority bumped.
  4. Accessibility guest in emergency → accessibility agent included.
  5. LLM outage → degrades to front_desk triage, plan is still valid.
"""

from __future__ import annotations

from datetime import date

import pytest

from app.agents.orchestrator import Orchestrator
from app.llm.client import FakeLLM
from app.memory.guest_memory import GuestMemory
from app.memory.store import JSONFileStore
from app.models import (
    AccessibilityNeeds,
    AgentEventType,
    EventChannel,
    GuestProfile,
    HotelEvent,
    StayContext,
)


@pytest.fixture
def stay(tmp_path) -> StayContext:  # noqa: ARG001 - tmp_path used elsewhere
    return StayContext(
        guest=GuestProfile(guest_id="g1", full_name="Ada Lovelace"),
        room_number="412",
        check_in=date(2026, 4, 23),
        check_out=date(2026, 4, 25),
        reservation_id="r1",
    )


def _build_orch(tmp_path, llm: FakeLLM) -> Orchestrator:
    store = JSONFileStore(str(tmp_path / "mem.json"))
    memory = GuestMemory(store)
    return Orchestrator(llm=llm, memory=memory)


def _tool_names(plan):
    return [tc.tool for tc in plan.tool_calls]


def _agent_names(plan):
    return [e.agent for e in plan.events]


def test_towels_routed_to_housekeeping(tmp_path, stay):
    llm = FakeLLM(canned={
        "actions": [{
            "department": "housekeeping",
            "summary": "Deliver extra towels",
            "details": "Guest asked for extra towels.",
            "priority": "normal",
            "requires_coordination_with": [],
        }],
        "intent": "amenity_request",
        "sentiment": "neutral",
    })
    orch = _build_orch(tmp_path, llm)
    event = HotelEvent(
        channel=EventChannel.GUEST_CHAT,
        reservation_id="r1",
        room_number="412",
        guest_id="g1",
        text="Can I get extra towels please?",
    )
    plan = orch.build_plan(event, stay)

    assert "Housekeeping AI" in _agent_names(plan)
    assert _tool_names(plan) == ["assignTask"]
    assert plan.tool_calls[0].args["roomNumber"] == "412"
    assert plan.guest_reply is not None
    assert plan.emergency is False


def test_emergency_fans_out(tmp_path, stay):
    llm = FakeLLM(canned={
        "actions": [{
            "department": "security",
            "summary": "Respond to emergency",
            "details": "Guest yelled help.",
            "priority": "emergency",
            "requires_coordination_with": [],
        }],
        "intent": "emergency",
        "sentiment": "distressed",
    })
    orch = _build_orch(tmp_path, llm)
    event = HotelEvent(
        channel=EventChannel.GUEST_CHAT,
        reservation_id="r1",
        room_number="412",
        guest_id="g1",
        text="Help! There's smoke in my room!",
    )
    plan = orch.build_plan(event, stay)

    agents = _agent_names(plan)
    assert "Security AI" in agents
    assert "Front Desk AI" in agents
    assert plan.emergency is True
    assert plan.priority == "emergency"
    # every tool_call should target the right room
    for tc in plan.tool_calls:
        assert tc.args.get("roomNumber") == "412"


def test_accessibility_fan_out_on_emergency(tmp_path, stay):
    stay = stay.model_copy(update={
        "guest": stay.guest.model_copy(update={
            "accessibility": AccessibilityNeeds(registered_disability=True,
                                                requires_evacuation_assistance=True),
        })
    })
    llm = FakeLLM(canned={"actions": []})
    orch = _build_orch(tmp_path, llm)
    event = HotelEvent(
        channel=EventChannel.GUEST_CHAT,
        reservation_id="r1",
        room_number="412",
        guest_id="g1",
        text="Fire alarm going off, I can't move easily",
    )
    plan = orch.build_plan(event, stay)
    agents = _agent_names(plan)
    assert "Accessibility AI" in agents
    assert "Security AI" in agents
    assert "Front Desk AI" in agents
    assert plan.emergency is True


def test_vip_adds_guest_relations(tmp_path, stay):
    stay = stay.model_copy(update={
        "guest": stay.guest.model_copy(update={"vip": True}),
    })
    llm = FakeLLM(canned={
        "actions": [{
            "department": "maintenance",
            "summary": "Fix AC",
            "details": "AC not cooling.",
            "priority": "normal",
            "requires_coordination_with": [],
        }],
        "intent": "maintenance_issue",
        "sentiment": "frustrated",
    })
    orch = _build_orch(tmp_path, llm)
    event = HotelEvent(
        channel=EventChannel.GUEST_CHAT,
        reservation_id="r1",
        room_number="412",
        guest_id="g1",
        text="My AC is not working",
    )
    plan = orch.build_plan(event, stay)
    agents = _agent_names(plan)
    assert "Maintenance AI" in agents
    assert "Guest Experience" in agents  # guest_relations display name
    assert plan.priority in ("high", "urgent", "emergency")


def test_llm_failure_degrades_to_front_desk(tmp_path, stay):
    class Broken:
        def classify_json(self, system, user):  # noqa: ARG002
            raise RuntimeError("boom")

        def reply_text(self, system, user):  # noqa: ARG002
            raise RuntimeError("boom")

    orch = _build_orch(tmp_path, Broken())
    event = HotelEvent(
        channel=EventChannel.GUEST_CHAT,
        reservation_id="r1",
        room_number="412",
        guest_id="g1",
        text="something's weird",
    )
    plan = orch.build_plan(event, stay)
    assert "Front Desk AI" in _agent_names(plan)
    # Plan still has the orchestrator preamble events
    assert plan.events[0].agent == "Orchestrator"

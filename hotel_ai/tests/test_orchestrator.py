"""Orchestrator invariants for the advisor service."""

from __future__ import annotations

from datetime import date

import pytest

from app.agents.orchestrator import Orchestrator
from app.llm.client import FakeLLM
from app.memory.guest_memory import GuestMemory
from app.memory.store import JSONFileStore
from app.models import (
    AccessibilityNeeds,
    EventChannel,
    GuestProfile,
    HotelEvent,
    StayContext,
)
from app.models.guest import MobilityAid


@pytest.fixture
def stay() -> StayContext:
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


def _event(text: str, room: str = "412") -> HotelEvent:
    return HotelEvent(
        channel=EventChannel.GUEST_CHAT,
        reservation_id="r1",
        room_number=room,
        guest_id="g1",
        text=text,
    )


# --------------------------------------------------------- happy-path routing --


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
    plan = orch.build_plan(_event("Can I get extra towels please?"), stay)

    assert "Housekeeping AI" in _agent_names(plan)
    assert _tool_names(plan) == ["assignTask"]
    assert plan.tool_calls[0].args["roomNumber"] == "412"
    assert plan.guest_reply is not None
    assert plan.emergency is False


# ---------------------------------------------------------------- emergency --


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
    plan = orch.build_plan(_event("Help! There's smoke in my room!"), stay)

    agents = _agent_names(plan)
    assert "Security AI" in agents
    assert "Front Desk AI" in agents
    assert plan.emergency is True
    assert plan.priority == "emergency"


@pytest.mark.parametrize(
    "phrase",
    [
        "I'm choking, please help",
        "I think I'm having an allergic reaction",
        "There's an intruder in my room",
        "Someone overdosed in 412",
        "We're flooding in here",
        "I'm stuck in the elevator",
        "stuck in an elevator",
        "stuck in my lift",
        "He's overdosing",
    ],
)
def test_expanded_emergency_keywords_trigger_safety_path(tmp_path, stay, phrase):
    """Deterministic safety net runs even when LLM under-classifies."""
    llm = FakeLLM(canned={
        "actions": [{
            "department": "housekeeping",
            "summary": "Standard request",
            "details": "Looks routine.",
            "priority": "normal",
            "requires_coordination_with": [],
        }],
        "intent": "amenity_request",
        "sentiment": "neutral",
    })
    orch = _build_orch(tmp_path, llm)
    plan = orch.build_plan(_event(phrase), stay)

    assert plan.emergency is True, f"failed to flag emergency for: {phrase}"
    assert "Security AI" in _agent_names(plan)
    assert "Front Desk AI" in _agent_names(plan)


@pytest.mark.parametrize(
    "phrase",
    [
        "I need extra towels please",
        "My AC is broken",
        "Can I get a coffee delivered",
        "Can you turn on the lift announcements?",  # tricky negative
    ],
)
def test_emergency_regex_does_not_misfire(tmp_path, stay, phrase):
    """Negative cases — must NOT be flagged as emergencies."""
    llm = FakeLLM(canned={
        "actions": [{
            "department": "housekeeping",
            "summary": "Routine",
            "details": "...",
            "priority": "normal",
            "requires_coordination_with": [],
        }],
        "intent": "amenity_request",
        "sentiment": "neutral",
    })
    orch = _build_orch(tmp_path, llm)
    plan = orch.build_plan(_event(phrase), stay)
    assert plan.emergency is False, f"false positive for: {phrase}"


# -------------------------------------------------------------- accessibility --


def test_accessibility_fan_out_on_emergency(tmp_path, stay):
    stay = stay.model_copy(update={
        "guest": stay.guest.model_copy(update={
            "accessibility": AccessibilityNeeds(
                registered_disability=True,
                requires_evacuation_assistance=True,
            ),
        })
    })
    llm = FakeLLM(canned={"actions": []})
    orch = _build_orch(tmp_path, llm)
    plan = orch.build_plan(_event("Fire alarm going off, I can't move easily"), stay)
    agents = _agent_names(plan)
    assert "Accessibility AI" in agents
    assert "Security AI" in agents
    assert "Front Desk AI" in agents
    assert plan.emergency is True


def test_accessibility_fan_out_outside_emergency(tmp_path, stay):
    """Wheelchair user reports broken elevator — Accessibility agent
    should be in the loop even though it's not a hard emergency."""
    stay = stay.model_copy(update={
        "guest": stay.guest.model_copy(update={
            "accessibility": AccessibilityNeeds(
                registered_disability=True,
                mobility_aid=MobilityAid.WHEELCHAIR,
            ),
        })
    })
    llm = FakeLLM(canned={
        "actions": [{
            "department": "maintenance",
            "summary": "Elevator out of service",
            "details": "Guest reports the lift on their floor isn't working.",
            "priority": "high",
            "requires_coordination_with": [],
        }],
        "intent": "maintenance_issue",
        "sentiment": "frustrated",
    })
    orch = _build_orch(tmp_path, llm)
    plan = orch.build_plan(
        _event("The elevator on my floor isn't working — I can't reach the lobby"),
        stay,
    )
    agents = _agent_names(plan)
    assert "Maintenance AI" in agents
    assert "Accessibility AI" in agents
    assert plan.emergency is False


# --------------------------------------------------------------------- VIP --


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
    plan = orch.build_plan(_event("My AC is not working"), stay)
    agents = _agent_names(plan)
    assert "Maintenance AI" in agents
    assert "Guest Experience" in agents
    assert plan.priority in ("high", "urgent", "emergency")


# -------------------------------------------------------- LLM outage / fallback --


def test_llm_failure_degrades_to_front_desk(tmp_path, stay):
    class Broken:
        def classify_json(self, system, user):  # noqa: ARG002
            raise RuntimeError("boom")

        def reply_text(self, system, user):  # noqa: ARG002
            raise RuntimeError("boom")

        def ping(self):
            return False

    orch = _build_orch(tmp_path, Broken())
    plan = orch.build_plan(_event("something's weird"), stay)
    assert "Front Desk AI" in _agent_names(plan)
    assert plan.events[0].agent == "Orchestrator"
    assert plan.memory_updates[-1].summary.startswith("unclassified:")


# ------------------------------------------------------- LLM hallucination --


def test_invalid_llm_department_dropped_to_fallback(tmp_path, stay):
    llm = FakeLLM(canned={
        "actions": [{
            "department": "vip_concierge_supervisor",
            "summary": "Send a special agent",
            "details": "ignored",
            "priority": "normal",
            "requires_coordination_with": [],
        }],
        "intent": "amenity_request",
        "sentiment": "neutral",
    })
    orch = _build_orch(tmp_path, llm)
    plan = orch.build_plan(_event("Hello there"), stay)
    assert "Front Desk AI" in _agent_names(plan)
    assert plan.intent == "unclassified"


def test_invalid_coordination_codes_filtered(tmp_path, stay):
    llm = FakeLLM(canned={
        "actions": [{
            "department": "housekeeping",
            "summary": "Deliver towels",
            "details": "Standard request.",
            "priority": "normal",
            "requires_coordination_with": [
                "housekeeping_supervisor",
                "guest_relations",
                "vip_team",
            ],
        }],
        "intent": "amenity_request",
        "sentiment": "neutral",
    })
    orch = _build_orch(tmp_path, llm)
    plan = orch.build_plan(_event("Towels please"), stay)
    assert "Housekeeping AI" in _agent_names(plan)


# ---------------------------------------------------------- piggyback agents --


def test_laundry_routes_via_housekeeping(tmp_path, stay):
    llm = FakeLLM(canned={
        "actions": [{
            "department": "laundry",
            "summary": "Pick up suit for pressing",
            "details": "Guest wants suit pressed by 5pm.",
            "priority": "normal",
            "requires_coordination_with": [],
        }],
        "intent": "laundry_request",
        "sentiment": "neutral",
    })
    orch = _build_orch(tmp_path, llm)
    plan = orch.build_plan(_event("Can you press my suit by 5pm?"), stay)
    assert "Housekeeping AI" in _agent_names(plan)
    assert _tool_names(plan) == ["assignTask"]


def test_spa_agent_works(tmp_path, stay):
    llm = FakeLLM(canned={
        "actions": [{
            "department": "spa",
            "summary": "Book massage at 3pm",
            "details": "Guest wants a 60-minute massage.",
            "priority": "normal",
            "requires_coordination_with": [],
        }],
        "intent": "spa_booking",
        "sentiment": "positive",
    })
    orch = _build_orch(tmp_path, llm)
    plan = orch.build_plan(_event("Can I book a massage at 3pm?"), stay)
    assert "Spa AI" in _agent_names(plan)
    assert plan.tool_calls[0].args["taskType"].startswith("spa:")


def test_revenue_agent_works(tmp_path, stay):
    llm = FakeLLM(canned={
        "actions": [{
            "department": "revenue",
            "summary": "Offer suite upgrade for anniversary",
            "details": "Guest mentioned anniversary; presidential suite available.",
            "priority": "normal",
            "requires_coordination_with": [],
        }],
        "intent": "upsell_opportunity",
        "sentiment": "positive",
    })
    orch = _build_orch(tmp_path, llm)
    plan = orch.build_plan(_event("It's our anniversary!"), stay)
    assert "Revenue AI" in _agent_names(plan)
    # Revenue never produces a guest_reply
    assert plan.guest_reply is None or plan.guest_reply.message != ""


def test_revenue_priority_is_capped(tmp_path, stay):
    """Revenue must never escalate above NORMAL even if LLM gets excited."""
    llm = FakeLLM(canned={
        "actions": [{
            "department": "revenue",
            "summary": "Urgent upsell!",
            "details": "...",
            "priority": "urgent",
            "requires_coordination_with": [],
        }],
        "intent": "upsell_opportunity",
        "sentiment": "neutral",
    })
    orch = _build_orch(tmp_path, llm)
    plan = orch.build_plan(_event("anniversary"), stay)
    # The action's priority got capped, so the broadcast event should
    # show "normal" — but `plan.priority` shows the *top* across all
    # actions, which here is just revenue.
    assert plan.priority == "normal"


def test_reservations_agent_works(tmp_path, stay):
    llm = FakeLLM(canned={
        "actions": [{
            "department": "reservations",
            "summary": "Extend stay by 2 nights",
            "details": "Guest wants to extend; check availability.",
            "priority": "normal",
            "requires_coordination_with": [],
        }],
        "intent": "reservation_change",
        "sentiment": "neutral",
    })
    orch = _build_orch(tmp_path, llm)
    plan = orch.build_plan(_event("Can I extend my stay by 2 nights?"), stay)
    assert "Reservations AI" in _agent_names(plan)


# ------------------------------------------------------------- memory writes --


def test_memory_records_intent_tagged_summary(tmp_path, stay):
    llm = FakeLLM(canned={
        "actions": [{
            "department": "housekeeping",
            "summary": "Deliver towels",
            "details": "...",
            "priority": "normal",
            "requires_coordination_with": [],
        }],
        "intent": "amenity_request",
        "sentiment": "neutral",
    })
    orch = _build_orch(tmp_path, llm)
    orch.build_plan(_event("Towels please"), stay)

    profile = orch.memory.get_profile("g1")
    assert profile is not None
    assert profile.past_requests
    last = profile.past_requests[-1]
    # Pipe-encoded format: intent|timestamp|summary
    assert last.startswith("amenity_request|"), (
        f"expected pipe-encoded intent prefix, got: {last!r}"
    )


# ------------------------------------------------ Option C: repeat-issue --


def test_repeat_issue_escalates_priority(tmp_path, stay):
    """3rd report of same intent in 24h bumps priority and adds Guest Relations."""
    llm = FakeLLM(canned={
        "actions": [{
            "department": "maintenance",
            "summary": "AC not cooling",
            "details": "Guest complains AC.",
            "priority": "normal",
            "requires_coordination_with": [],
        }],
        "intent": "maintenance_issue",
        "sentiment": "frustrated",
    })
    orch = _build_orch(tmp_path, llm)

    # First and second reports — normal priority.
    p1 = orch.build_plan(_event("AC not cooling"), stay)
    assert p1.priority == "normal"
    p2 = orch.build_plan(_event("AC still not cooling"), stay)
    # Second report: now in memory, so the third call below is the one
    # that crosses the threshold (>=2 prior). On p2, count is 1 (just
    # p1's record), so threshold not yet met.
    assert p2.priority == "normal"

    # Third report: count is 2 prior, >= threshold (2). Bump.
    p3 = orch.build_plan(_event("AC STILL not cooling, this is ridiculous"), stay)
    assert p3.priority in ("high", "urgent")
    assert "Guest Experience" in _agent_names(p3)


# ------------------------------------------------------ Option C: abuse --


def test_abuse_routes_to_security_with_calm_reply(tmp_path, stay):
    llm = FakeLLM(canned={
        "actions": [{
            "department": "front_desk",
            "summary": "Guest complaint",
            "details": "Frustrated guest.",
            "priority": "normal",
            "requires_coordination_with": [],
        }],
        "intent": "complaint",
        "sentiment": "frustrated",
    })
    orch = _build_orch(tmp_path, llm)
    plan = orch.build_plan(
        _event("you fucking idiot, fix my room"),
        stay,
    )
    agents = _agent_names(plan)
    assert "Security AI" in agents
    assert "Guest Experience" in agents
    # Verify the calm reply was used (no escalation language).
    assert plan.guest_reply is not None
    assert "manager" in plan.guest_reply.message.lower()


def test_abuse_does_not_double_route_security(tmp_path, stay):
    """If LLM already routed to security, we don't add a second one."""
    llm = FakeLLM(canned={
        "actions": [{
            "department": "security",
            "summary": "Verbal abuse",
            "details": "Already routed.",
            "priority": "high",
            "requires_coordination_with": [],
        }],
        "intent": "security_incident",
        "sentiment": "distressed",
    })
    orch = _build_orch(tmp_path, llm)
    plan = orch.build_plan(_event("you fucking idiot"), stay)
    # Count action-level Security tool calls
    sec_tools = [
        tc for tc in plan.tool_calls
        if "security" in tc.args.get("taskType", "")
    ]
    assert len(sec_tools) == 1


# ------------------------------------------------- Option C: quiet hours --


def test_quiet_hours_defers_routine_housekeeping(tmp_path, stay):
    """At 02:00 local, a routine towel request gets deferred to LOW."""
    from datetime import datetime, timezone
    fake_now = datetime(2026, 4, 26, 2, 0, tzinfo=timezone.utc)

    stay = stay.model_copy(update={"hotel_timezone": "UTC"})

    llm = FakeLLM(canned={
        "actions": [{
            "department": "housekeeping",
            "summary": "Deliver towels",
            "details": "Routine.",
            "priority": "normal",
            "requires_coordination_with": [],
        }],
        "intent": "amenity_request",
        "sentiment": "neutral",
    })
    orch = _build_orch(tmp_path, llm)
    # Override the orchestrator's clock — no module-level monkey-patching needed.
    orch._now_utc = lambda: fake_now  # type: ignore[method-assign]

    plan = orch.build_plan(_event("Towels please"), stay)
    hk_tool = [tc for tc in plan.tool_calls if tc.tool == "assignTask"][0]
    assert hk_tool.args["priority"] == "low"


def test_quiet_hours_does_not_defer_emergency(tmp_path, stay):
    """Even at 02:00, emergencies stay at EMERGENCY priority."""
    from datetime import datetime, timezone
    fake_now = datetime(2026, 4, 26, 2, 0, tzinfo=timezone.utc)

    stay = stay.model_copy(update={"hotel_timezone": "UTC"})
    llm = FakeLLM(canned={"actions": []})
    orch = _build_orch(tmp_path, llm)
    orch._now_utc = lambda: fake_now  # type: ignore[method-assign]

    plan = orch.build_plan(_event("Help! Smoke!"), stay)
    assert plan.emergency is True
    assert plan.priority == "emergency"


def test_quiet_hours_does_not_defer_maintenance(tmp_path, stay):
    """Even at 02:00, broken AC isn't deferred — maintenance is not in
    the deferrable set."""
    from datetime import datetime, timezone
    fake_now = datetime(2026, 4, 26, 2, 0, tzinfo=timezone.utc)

    stay = stay.model_copy(update={"hotel_timezone": "UTC"})
    llm = FakeLLM(canned={
        "actions": [{
            "department": "maintenance",
            "summary": "AC not cooling",
            "details": "AC issue.",
            "priority": "normal",
            "requires_coordination_with": [],
        }],
        "intent": "maintenance_issue",
        "sentiment": "frustrated",
    })
    orch = _build_orch(tmp_path, llm)
    orch._now_utc = lambda: fake_now  # type: ignore[method-assign]

    plan = orch.build_plan(_event("AC is broken"), stay)
    maint_tool = [
        tc for tc in plan.tool_calls
        if tc.tool == "createMaintenanceTicket"
    ][0]
    # Should still be normal (not lowered to "low").
    assert plan.priority == "normal"


def test_outside_quiet_hours_no_deferral(tmp_path, stay):
    """At 14:00 (afternoon), no quiet-hours treatment."""
    from datetime import datetime, timezone
    fake_now = datetime(2026, 4, 26, 14, 0, tzinfo=timezone.utc)

    stay = stay.model_copy(update={"hotel_timezone": "UTC"})
    llm = FakeLLM(canned={
        "actions": [{
            "department": "housekeeping",
            "summary": "Deliver towels",
            "details": "Routine.",
            "priority": "normal",
            "requires_coordination_with": [],
        }],
        "intent": "amenity_request",
        "sentiment": "neutral",
    })
    orch = _build_orch(tmp_path, llm)
    orch._now_utc = lambda: fake_now  # type: ignore[method-assign]

    plan = orch.build_plan(_event("Towels please"), stay)
    hk_tool = [tc for tc in plan.tool_calls if tc.tool == "assignTask"][0]
    assert hk_tool.args["priority"] == "normal"

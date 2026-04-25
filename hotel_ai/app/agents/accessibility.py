"""
Accessibility agent.

Fires when the orchestrator detects the guest has registered accessibility
needs and the event is safety- or mobility-related. Responsibility is to
ensure a trained responder is routed, in person, fast.
"""

from __future__ import annotations

from app.agents.base import BaseAgent, PlanFragment
from app.models import (
    AgentEvent,
    AgentEventType,
    Department,
    DepartmentAction,
    GuestReply,
    Priority,
    StayContext,
    ToolCall,
)


class AccessibilityAgent(BaseAgent):
    department = Department.ACCESSIBILITY

    def handle(self, action: DepartmentAction, stay: StayContext) -> PlanFragment:
        if action.priority in (Priority.LOW, Priority.NORMAL):
            action = action.model_copy(update={"priority": Priority.HIGH})

        event_type = (
            AgentEventType.EMERGENCY
            if action.priority == Priority.EMERGENCY
            else AgentEventType.ALERT
        )

        tool = ToolCall(
            tool="assignTask",
            args={
                "taskType": (
                    f"accessibility_assistance: {action.summary} "
                    f"(aid={stay.guest.accessibility.mobility_aid.value})"
                ),
                "roomNumber": stay.room_number,
                "priority": action.priority.value,
            },
            broadcast_on_success=AgentEvent(
                agent=self.display_name,
                type=event_type,
                message=f"Accessibility-trained staff dispatched to room {stay.room_number}",
                details=action.details,
                priority=action.priority.value,
                room=stay.room_number,
            ),
        )
        return PlanFragment(
            events=[
                AgentEvent(
                    agent=self.display_name,
                    type=event_type,
                    message=(
                        f"Guest in room {stay.room_number} has registered accessibility needs; "
                        "routing a trained responder."
                    ),
                    details=action.details,
                    priority=action.priority.value,
                    room=stay.room_number,
                ),
            ],
            tool_calls=[tool],
            guest_reply=GuestReply(
                message=(
                    "We've received your request and a staff member trained to assist "
                    f"will be with you at room {stay.room_number} shortly."
                ),
                locale=stay.guest.language,
            ),
        )

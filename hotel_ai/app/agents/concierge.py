"""
Concierge agent — recommendations, bookings, transport.

Emits `assignTask` so a concierge staff member picks it up.
"""

from __future__ import annotations

from app.agents.base import BaseAgent, PlanFragment
from app.models import (
    AgentEvent,
    AgentEventType,
    Department,
    DepartmentAction,
    GuestReply,
    StayContext,
    ToolCall,
)


class ConciergeAgent(BaseAgent):
    department = Department.CONCIERGE

    def handle(self, action: DepartmentAction, stay: StayContext) -> PlanFragment:
        tool = ToolCall(
            tool="assignTask",
            args={
                "taskType": f"concierge: {action.summary}",
                "roomNumber": stay.room_number,
                "priority": action.priority.value,
            },
            broadcast_on_success=AgentEvent(
                agent=self.display_name,
                type=AgentEventType.EXECUTION,
                message=f"Concierge task assigned for room {stay.room_number}",
                details=action.details,
                priority=action.priority.value,
                room=stay.room_number,
            ),
        )
        return PlanFragment(
            events=[
                self._thought(f"Concierge request: {action.summary}", action.details),
                self._decision("Assigning to concierge team"),
            ],
            tool_calls=[tool],
            guest_reply=GuestReply(
                message=(
                    f"Our concierge team is on your request: {action.summary.lower()}. "
                    "They'll follow up with details shortly."
                ),
                locale=stay.guest.language,
            ),
        )

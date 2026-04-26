"""
Spa agent — wellness bookings, treatments, gym, pool.

Booking-oriented requests get an `assignTask` so a spa coordinator can
confirm availability with the guest. We do not auto-book — confirmation
loops belong to a human until we wire a real booking system.
"""

from __future__ import annotations

from app.agents.base import BaseAgent, PlanFragment
from app.models import (
    AgentEvent,
    AgentEventType,
    Department,
    DepartmentAction,
    StayContext,
    ToolCall,
)


class SpaAgent(BaseAgent):
    department = Department.SPA

    def handle(self, action: DepartmentAction, stay: StayContext) -> PlanFragment:
        tool = ToolCall(
            tool="assignTask",
            args={
                "taskType": f"spa: {action.summary}",
                "roomNumber": stay.room_number,
                "priority": action.priority.value,
            },
            broadcast_on_success=AgentEvent(
                agent=self.display_name,
                type=AgentEventType.EXECUTION,
                message=f"Spa booking task created for room {stay.room_number}",
                details=action.details,
                priority=action.priority.value,
                room=stay.room_number,
            ),
        )
        return PlanFragment(
            events=[
                self._thought(f"Spa request: {action.summary}", action.details),
                self._decision("Sending to spa coordinator for availability check"),
            ],
            tool_calls=[tool],
            guest_reply=self._reply(
                (
                    f"We've forwarded your request — {action.summary.lower()} — to "
                    "the spa team. They'll confirm availability shortly."
                ),
                stay,
            ),
        )

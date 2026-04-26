"""
Reservations agent — extending stays, room changes, cancellations, future bookings.

Anything that touches the PMS reservation record routes here. We never
modify the reservation directly — that's a human + PMS API job. We
create a coordination task and reply with a "we're on it" message so
the guest isn't left wondering.
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


class ReservationsAgent(BaseAgent):
    department = Department.RESERVATIONS

    def handle(self, action: DepartmentAction, stay: StayContext) -> PlanFragment:
        tool = ToolCall(
            tool="assignTask",
            args={
                "taskType": f"reservations: {action.summary}",
                "roomNumber": stay.room_number,
                "priority": action.priority.value,
            },
            broadcast_on_success=AgentEvent(
                agent=self.display_name,
                type=AgentEventType.EXECUTION,
                message=f"Reservations task created for room {stay.room_number}",
                details=action.details,
                priority=action.priority.value,
                room=stay.room_number,
            ),
        )
        return PlanFragment(
            events=[
                self._thought(
                    f"Reservation change request: {action.summary}",
                    action.details,
                ),
                self._decision("Routing to Reservations for PMS update"),
            ],
            tool_calls=[tool],
            guest_reply=self._reply(
                (
                    f"Our reservations team is looking into your request — "
                    f"{action.summary.lower()}. They'll come back to you with "
                    "confirmation shortly."
                ),
                stay,
            ),
        )

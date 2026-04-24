"""
Maintenance agent.

Emits a `createMaintenanceTicket` tool call matching
hotelos-api/src/agents/tools.js::createMaintenanceTicket({ roomNumber, issueDescription }).
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


class MaintenanceAgent(BaseAgent):
    department = Department.MAINTENANCE

    def handle(self, action: DepartmentAction, stay: StayContext) -> PlanFragment:
        tool = ToolCall(
            tool="createMaintenanceTicket",
            args={
                "roomNumber": stay.room_number,
                "issueDescription": action.summary,
            },
            broadcast_on_success=AgentEvent(
                agent=self.display_name,
                type=AgentEventType.ALERT,
                message=f"Maintenance ticket created for room {stay.room_number}",
                details=action.details,
                priority=action.priority.value,
                room=stay.room_number,
            ),
        )
        return PlanFragment(
            events=[
                self._thought(
                    f"Room {stay.room_number} reported: {action.summary}. "
                    "Maintenance needs a ticket.",
                    action.details,
                ),
                self._decision(f"Opening a {action.priority.value}-priority ticket"),
            ],
            tool_calls=[tool],
            guest_reply=GuestReply(
                message=(
                    f"Maintenance has been notified about: {action.summary.lower()}. "
                    f"A technician will be at room {stay.room_number} as soon as possible. "
                    "We're sorry for the inconvenience."
                ),
                locale=stay.guest.language,
            ),
        )

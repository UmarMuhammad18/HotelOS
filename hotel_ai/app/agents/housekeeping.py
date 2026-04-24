"""
Housekeeping agent.

Emits an `assignTask` tool call matching the existing
hotelos-api/src/agents/tools.js::assignTask({ taskType, roomNumber, priority }).
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


class HousekeepingAgent(BaseAgent):
    department = Department.HOUSEKEEPING

    def handle(self, action: DepartmentAction, stay: StayContext) -> PlanFragment:
        tool = ToolCall(
            tool="assignTask",
            args={
                "taskType": action.summary.lower(),
                "roomNumber": stay.room_number,
                "priority": action.priority.value,
            },
            broadcast_on_success=AgentEvent(
                agent=self.display_name,
                type=AgentEventType.EXECUTION,
                message=f"Housekeeping task dispatched for room {stay.room_number}",
                details=action.details,
                priority=action.priority.value,
                room=stay.room_number,
            ),
        )
        return PlanFragment(
            events=[
                self._thought(
                    f"Housekeeping request for room {stay.room_number}: {action.summary}",
                    action.details,
                ),
                self._decision(
                    f"Creating housekeeping task ({action.priority.value} priority)",
                ),
            ],
            tool_calls=[tool],
            guest_reply=GuestReply(
                message=(
                    f"Your request '{action.summary.lower()}' has been sent to "
                    f"Housekeeping. Someone will be at room {stay.room_number} shortly."
                ),
                locale=stay.guest.language,
            ),
        )

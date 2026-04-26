"""Front Desk agent — billing, keys, triage, general assistance."""

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


class FrontDeskAgent(BaseAgent):
    department = Department.FRONT_DESK

    def handle(self, action: DepartmentAction, stay: StayContext) -> PlanFragment:
        tool = ToolCall(
            tool="assignTask",
            args={
                "taskType": f"front_desk: {action.summary}",
                "roomNumber": stay.room_number,
                "priority": action.priority.value,
            },
            broadcast_on_success=AgentEvent(
                agent=self.display_name,
                type=AgentEventType.EXECUTION,
                message=f"Front desk task for room {stay.room_number}",
                details=action.details,
                priority=action.priority.value,
                room=stay.room_number,
            ),
        )
        return PlanFragment(
            events=[
                self._thought(f"Front desk item: {action.summary}", action.details),
                self._decision("Assigning to front desk"),
            ],
            tool_calls=[tool],
            guest_reply=self._reply(
                (
                    f"Front Desk has your request: {action.summary.lower()}. "
                    "They'll follow up shortly."
                ),
                stay,
            ),
        )

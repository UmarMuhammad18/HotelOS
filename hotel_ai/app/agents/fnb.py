"""Food & Beverage / Room Service agent."""

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


class FoodBeverageAgent(BaseAgent):
    department = Department.FOOD_BEVERAGE

    def handle(self, action: DepartmentAction, stay: StayContext) -> PlanFragment:
        tool = ToolCall(
            tool="assignTask",
            args={
                "taskType": f"room_service: {action.summary}",
                "roomNumber": stay.room_number,
                "priority": action.priority.value,
            },
            broadcast_on_success=AgentEvent(
                agent=self.display_name,
                type=AgentEventType.EXECUTION,
                message=f"Room service task dispatched for room {stay.room_number}",
                details=action.details,
                priority=action.priority.value,
                room=stay.room_number,
            ),
        )
        return PlanFragment(
            events=[
                self._thought(f"Room service order: {action.summary}", action.details),
                self._decision("Sending order to kitchen"),
            ],
            tool_calls=[tool],
            guest_reply=self._reply(
                (
                    f"Your order has been sent to Room Service: {action.summary}. "
                    "We'll let you know when it's on its way."
                ),
                stay,
            ),
        )

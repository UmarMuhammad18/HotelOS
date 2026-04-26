"""
Revenue agent — upsell opportunities, paid late checkout, room upgrades,
add-ons (champagne, dinner reservation, in-room amenities).

The Revenue agent is *low priority* — it never preempts a service or
maintenance request, and we explicitly skip it in emergency contexts.
Its primary job is to spot opportunities (anniversary mentions, repeat
visits, premium room availability) and queue a soft offer that staff
can present to the guest.

We do NOT auto-charge anything. Revenue actions surface to staff and
require human confirmation before any billable line item is created.
"""

from __future__ import annotations

from app.agents.base import BaseAgent, PlanFragment
from app.models import (
    AgentEvent,
    AgentEventType,
    Department,
    DepartmentAction,
    Priority,
    StayContext,
    ToolCall,
)


class RevenueAgent(BaseAgent):
    department = Department.REVENUE

    def handle(self, action: DepartmentAction, stay: StayContext) -> PlanFragment:
        # Revenue is never urgent. Cap priority at NORMAL so it never
        # preempts a real service request even if the LLM gets excited.
        if action.priority in (Priority.HIGH, Priority.URGENT, Priority.EMERGENCY):
            action = action.model_copy(update={"priority": Priority.NORMAL})

        tool = ToolCall(
            tool="assignTask",
            args={
                "taskType": f"revenue_opportunity: {action.summary}",
                "roomNumber": stay.room_number,
                "priority": action.priority.value,
            },
            broadcast_on_success=AgentEvent(
                agent=self.display_name,
                type=AgentEventType.EXECUTION,
                message=f"Revenue opportunity logged for room {stay.room_number}",
                details=action.details,
                priority=action.priority.value,
                room=stay.room_number,
            ),
        )
        return PlanFragment(
            events=[
                self._thought(
                    f"Possible upsell opportunity: {action.summary}",
                    action.details,
                ),
                self._decision(
                    "Queueing a soft offer for staff to present (no auto-charge)",
                ),
            ],
            tool_calls=[tool],
            # No guest_reply — Revenue's offer is presented by staff in
            # person or via a separate channel, never by the chatbot.
        )

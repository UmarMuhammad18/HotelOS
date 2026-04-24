"""
Guest Relations agent — soft human attention for VIPs, complaints, recovery.

Does NOT produce a guest_reply (another department usually already did).
Uses display name "Guest Experience" to match the existing Node
`sendMessage` tool's broadcast label.
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


class GuestRelationsAgent(BaseAgent):
    department = Department.GUEST_RELATIONS

    def handle(self, action: DepartmentAction, stay: StayContext) -> PlanFragment:
        tool = ToolCall(
            tool="assignTask",
            args={
                "taskType": f"guest_relations: {action.summary}",
                "roomNumber": stay.room_number,
                "priority": action.priority.value,
            },
            broadcast_on_success=AgentEvent(
                agent=self.display_name,
                type=AgentEventType.EXECUTION,
                message=f"Guest Experience follow-up queued for room {stay.room_number}",
                details=action.details,
                priority=action.priority.value,
                room=stay.room_number,
            ),
        )
        return PlanFragment(
            events=[
                self._thought(
                    f"{stay.guest.full_name} may need personal attention",
                    action.details,
                ),
                self._decision("Queueing a Guest Experience check-in"),
            ],
            tool_calls=[tool],
            # No guest_reply — GR reaches the guest via their own channel.
        )

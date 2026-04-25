"""
Security agent — wellness checks, incidents, evacuation support.

Emits a high-priority `assignTask` targeting the security pool. The
existing Node tools.js does not yet have a dedicated `dispatchSecurity`
helper; using `assignTask` keeps the contract working today. We ask the
Node team to add a typed tool in CONTRACT.md.
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


class SecurityAgent(BaseAgent):
    department = Department.SECURITY

    def handle(self, action: DepartmentAction, stay: StayContext) -> PlanFragment:
        # Security tasks are never LOW/NORMAL. Floor at HIGH.
        if action.priority in (Priority.LOW, Priority.NORMAL):
            action = action.model_copy(update={"priority": Priority.HIGH})

        is_emergency = action.priority == Priority.EMERGENCY
        event_type = AgentEventType.EMERGENCY if is_emergency else AgentEventType.ALERT

        tool = ToolCall(
            tool="assignTask",
            args={
                "taskType": f"security: {action.summary}",
                "roomNumber": stay.room_number,
                "priority": action.priority.value,
            },
            broadcast_on_success=AgentEvent(
                agent=self.display_name,
                type=event_type,
                message=f"Security dispatched to room {stay.room_number}",
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
                    message=f"Security response needed at room {stay.room_number}",
                    details=action.details,
                    priority=action.priority.value,
                    room=stay.room_number,
                ),
            ],
            tool_calls=[tool],
            # Guest is not reassured via chat for security — humans handle it.
        )

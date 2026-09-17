"""Guest Relations agent — soft human attention for VIPs and complaints."""

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

        # For recovery / frustration paths, send a calm acknowledgement.
        # For pure VIP awareness fan-outs, stay silent (staff reaches out).
        details_lc = (action.details or "").lower()
        summary_lc = (action.summary or "").lower()
        is_recovery = any(
            k in details_lc or k in summary_lc
            for k in ("frustrat", "recover", "complaint", "disappoint", "repeat")
        )
        guest_reply = None
        if is_recovery:
            name = stay.guest.full_name.split()[0] if stay.guest.full_name else "there"
            guest_reply = self._reply(
                (
                    f"We're truly sorry for the inconvenience, {name}. "
                    f"A Guest Experience manager is personally following up "
                    f"on this for room {stay.room_number}."
                ),
                stay,
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
            guest_reply=guest_reply,
        )

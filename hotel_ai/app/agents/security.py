"""
Security agent — wellness checks, incidents, evacuation support, abuse handling.

Guest-facing reply policy
-------------------------
Security used to stay silent on chat because "humans handle it." But if
security is the *only* department routed (e.g. the guest reports a
suspicious person on their floor), staying silent leaves the guest
hearing nothing back. We now always include a brief, reassuring
acknowledgment for non-emergencies; the orchestrator only sends the
FIRST agent's reply, so when another department also responds, this
one is naturally suppressed and we still avoid double-replies.

Hard emergencies (priority=EMERGENCY) explicitly skip the chat reply
because in a true emergency the right channel is voice / in-person, not
a chat acknowledgment.

Abuse handling (Option C)
-------------------------
When the orchestrator routes here with `abuse: True` in the action's
details (set by the orchestrator's abuse keyword detection), the agent
emits a deliberately calm, de-escalating reply rather than something
the LLM might pattern-match into a snappy comeback. We don't want our
chatbot escalating when a guest is upset.
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


# Marker the orchestrator can set in action.details to indicate abusive
# guest text. Cheaper than another field and easy to grep.
ABUSE_MARKER = "[abuse-flagged]"


class SecurityAgent(BaseAgent):
    department = Department.SECURITY

    def handle(self, action: DepartmentAction, stay: StayContext) -> PlanFragment:
        # Security tasks are never LOW/NORMAL. Floor at HIGH.
        if action.priority in (Priority.LOW, Priority.NORMAL):
            action = action.model_copy(update={"priority": Priority.HIGH})

        is_emergency = action.priority == Priority.EMERGENCY
        is_abuse = ABUSE_MARKER in (action.details or "")
        event_type = (
            AgentEventType.EMERGENCY if is_emergency else AgentEventType.ALERT
        )

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

        # Pick the right reply for the situation:
        guest_reply = None
        if is_emergency:
            # Voice / in-person channel takes over. Skip chat reply.
            pass
        elif is_abuse:
            # Calm, neutral acknowledgment. Don't engage with the
            # content of the abuse.
            guest_reply = self._reply(
                "Thanks for reaching out. We'd like to help — a manager will "
                "follow up with you shortly to make sure everything is sorted.",
                stay,
            )
        else:
            guest_reply = self._reply(
                (
                    "We've alerted our security team and someone will be "
                    f"with you at room {stay.room_number} shortly."
                ),
                stay,
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
            guest_reply=guest_reply,
        )

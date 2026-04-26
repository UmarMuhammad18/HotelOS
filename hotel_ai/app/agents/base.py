"""BaseAgent — common shape for all department agents."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from app.agents.localize import localized_reply
from app.llm.client import LLMClient
from app.models import (
    AgentEvent,
    AgentEventType,
    Department,
    DepartmentAction,
    GuestReply,
    MemoryUpdate,
    StayContext,
    ToolCall,
)


# Display names shown in the dashboard ActivityFeed. Extend when adding
# departments.
DISPLAY_NAME: dict[Department, str] = {
    Department.FRONT_DESK: "Front Desk AI",
    Department.HOUSEKEEPING: "Housekeeping AI",
    Department.CONCIERGE: "Concierge AI",
    Department.MAINTENANCE: "Maintenance AI",
    Department.FOOD_BEVERAGE: "Room Service AI",
    Department.GUEST_RELATIONS: "Guest Experience",
    Department.SECURITY: "Security AI",
    Department.ACCESSIBILITY: "Accessibility AI",
    Department.REVENUE: "Revenue AI",
    Department.RESERVATIONS: "Reservations AI",
    Department.SPA: "Spa AI",
    Department.LAUNDRY: "Housekeeping AI",
    Department.VALET: "Concierge AI",
}


@dataclass
class PlanFragment:
    """What one department agent contributes to the final Plan."""
    events: list[AgentEvent] = field(default_factory=list)
    tool_calls: list[ToolCall] = field(default_factory=list)
    guest_reply: GuestReply | None = None
    memory_updates: list[MemoryUpdate] = field(default_factory=list)


class BaseAgent(ABC):
    department: Department

    def __init__(self, llm: LLMClient) -> None:
        self.llm = llm

    @property
    def display_name(self) -> str:
        return DISPLAY_NAME[self.department]

    @abstractmethod
    def handle(self, action: DepartmentAction, stay: StayContext) -> PlanFragment:
        """Produce a fragment of the overall Plan."""

    # --- helpers --------------------------------------------------

    def _thought(self, message: str, details: str = "") -> AgentEvent:
        return AgentEvent(
            agent=self.display_name,
            type=AgentEventType.THOUGHT,
            message=message,
            details=details,
        )

    def _decision(self, message: str, details: str = "") -> AgentEvent:
        return AgentEvent(
            agent=self.display_name,
            type=AgentEventType.DECISION,
            message=message,
            details=details,
        )

    def _execution_event(self, message: str, details: str = "") -> AgentEvent:
        return AgentEvent(
            agent=self.display_name,
            type=AgentEventType.EXECUTION,
            message=message,
            details=details,
        )

    def _alert(self, message: str, details: str = "") -> AgentEvent:
        return AgentEvent(
            agent=self.display_name,
            type=AgentEventType.ALERT,
            message=message,
            details=details,
        )

    def _reply(self, english_message: str, stay: StayContext) -> GuestReply:
        """Render a guest reply in the guest's preferred language."""
        return localized_reply(self.llm, english_message, stay.guest.language)

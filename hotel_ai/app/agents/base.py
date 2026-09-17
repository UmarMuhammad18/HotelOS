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

    def _preference_note(self, stay: StayContext) -> str:
        """Short clause from known preferences, or empty string."""
        prefs = getattr(stay.guest, "preferences", None) or {}
        if not prefs:
            return ""
        # Surface at most two human-friendly preference hints
        labels = {
            "extra_towels": "extra towels",
            "extra_blankets": "extra blankets",
            "quiet_room": "a quiet room",
            "pillow": "your preferred pillow",
            "late_checkout": "late checkout",
            "early_checkin": "early check-in",
            "allergy_aware": "your allergy preferences",
        }
        hints: list[str] = []
        for key, label in labels.items():
            if key in prefs and prefs[key]:
                if key == "pillow" and isinstance(prefs[key], str) and prefs[key] not in (
                    "noted",
                    True,
                ):
                    hints.append(f"{prefs[key]} pillow")
                else:
                    hints.append(label)
            if len(hints) >= 2:
                break
        if not hints:
            return ""
        return " We've noted your preference for " + " and ".join(hints) + "."

    def _reply(self, english_message: str, stay: StayContext) -> GuestReply:
        """Render a guest reply in the guest's preferred language.

        Optionally appends a short preference acknowledgement so returning
        guests feel remembered without a second LLM call.
        """
        note = self._preference_note(stay)
        message = english_message.rstrip()
        if note and not message.endswith("."):
            message += "."
        message = (message + note).strip()
        return localized_reply(self.llm, message, stay.guest.language)

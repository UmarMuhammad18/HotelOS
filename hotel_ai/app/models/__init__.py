"""Domain models for the AI layer."""

from .guest import (
    AccessibilityNeeds,
    EmergencyProfile,
    GuestProfile,
    MobilityAid,
    StayContext,
)
from .task import (
    ALLOWED_LLM_DEPARTMENTS,
    Department,
    DepartmentAction,
    Priority,
    Task,
    TaskStatus,
)
from .event import EventChannel, HotelEvent
from .notification import Notification, NotificationAudience
from .plan import (
    AgentEvent,
    AgentEventType,
    GuestReply,
    MemoryUpdate,
    Plan,
    ToolCall,
)

__all__ = [
    "AccessibilityNeeds",
    "ALLOWED_LLM_DEPARTMENTS",
    "EmergencyProfile",
    "GuestProfile",
    "MobilityAid",
    "StayContext",
    "DepartmentAction",
    "Priority",
    "Task",
    "TaskStatus",
    "Department",
    "HotelEvent",
    "EventChannel",
    "Notification",
    "NotificationAudience",
    "AgentEvent",
    "AgentEventType",
    "GuestReply",
    "MemoryUpdate",
    "Plan",
    "ToolCall",
]

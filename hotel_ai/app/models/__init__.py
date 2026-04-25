"""
Domain models for the AI layer.

These are the lingua franca between the orchestrator, department agents,
memory store, and HTTP API. Keep them free of framework dependencies beyond
Pydantic so they are safe to import anywhere.
"""

from .guest import (
    AccessibilityNeeds,
    EmergencyProfile,
    GuestProfile,
    StayContext,
)
from .task import DepartmentAction, Priority, Task, TaskStatus, Department
from .event import HotelEvent, EventChannel
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
    "EmergencyProfile",
    "GuestProfile",
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

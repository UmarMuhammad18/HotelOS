"""
Task, Department, Priority and TaskStatus models.

A Task is the unit of work the AI creates and a department acts on. The
lifecycle is:

    PENDING -> ASSIGNED -> IN_PROGRESS -> COMPLETED
                                      \-> CANCELLED

Tasks are immutable from the AI side once created; staff apps send status
updates through `/tasks/{id}/status`.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


class Department(str, Enum):
    FRONT_DESK = "front_desk"
    HOUSEKEEPING = "housekeeping"
    CONCIERGE = "concierge"
    MAINTENANCE = "maintenance"
    FOOD_BEVERAGE = "food_beverage"
    GUEST_RELATIONS = "guest_relations"
    REVENUE = "revenue"
    SECURITY = "security"
    RESERVATIONS = "reservations"
    ACCESSIBILITY = "accessibility"
    SPA = "spa"
    LAUNDRY = "laundry"
    VALET = "valet"


class Priority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"          # VIP / complaints / SLA risk
    EMERGENCY = "emergency"    # life safety; preempts everything


class TaskStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class DepartmentAction(BaseModel):
    """
    What the orchestrator tells a department agent to do. A single event
    can fan out into multiple DepartmentActions (e.g. AC broken for a VIP
    → maintenance + guest_relations).
    """

    department: Department
    summary: str                    # one-line human-readable action
    details: str                    # free-text with enough context for staff
    priority: Priority = Priority.NORMAL
    requires_coordination_with: list[Department] = Field(default_factory=list)

    @field_validator("requires_coordination_with", mode="before")
    @classmethod
    def _none_is_empty_list(cls, v):
        """
        LLMs occasionally return `null` here instead of `[]`. Coerce to []
        so we don't fail validation on perfectly good classifications.
        """
        return [] if v is None else v


class Task(BaseModel):
    id: str = Field(default_factory=lambda: f"tsk_{uuid4().hex[:12]}")
    reservation_id: str
    guest_id: str
    room_number: str

    department: Department
    priority: Priority = Priority.NORMAL
    status: TaskStatus = TaskStatus.PENDING

    summary: str
    details: str

    # For coordination (e.g. maintenance task that also needs housekeeping to follow up).
    related_task_ids: list[str] = Field(default_factory=list)
    coordinate_with: list[Department] = Field(default_factory=list)

    source_event_id: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

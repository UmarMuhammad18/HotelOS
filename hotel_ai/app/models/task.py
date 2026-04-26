r"""
Task, Department, Priority and TaskStatus models.

A Task is the unit of work the AI creates and a department acts on. The
lifecycle is:

    PENDING -> ASSIGNED -> IN_PROGRESS -> COMPLETED
                                      \-> CANCELLED

Tasks are immutable from the AI side once created; staff apps send status
updates through `/tasks/{id}/status`.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


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


# Departments the LLM is allowed to choose. Kept here (not in the prompt
# string) so we can validate strictly without rewriting the prompt every
# time a new department comes online. The orchestrator drops actions whose
# `department` isn't in this set, falling back to FRONT_DESK if everything
# is invalid.
ALLOWED_LLM_DEPARTMENTS: frozenset[Department] = frozenset({
    Department.FRONT_DESK,
    Department.HOUSEKEEPING,
    Department.CONCIERGE,
    Department.MAINTENANCE,
    Department.FOOD_BEVERAGE,
    Department.GUEST_RELATIONS,
    Department.SECURITY,
    Department.ACCESSIBILITY,
    Department.REVENUE,
    Department.RESERVATIONS,
    Department.SPA,
    Department.LAUNDRY,
    Department.VALET,
})


class DepartmentAction(BaseModel):
    """What the orchestrator tells a department agent to do.

    A single event can fan out into multiple DepartmentActions (e.g. AC
    broken for a VIP → maintenance + guest_relations).
    """

    department: Department
    summary: str                    # one-line human-readable action
    details: str                    # free-text with enough context for staff
    priority: Priority = Priority.NORMAL
    requires_coordination_with: list[Department] = Field(default_factory=list)

    @field_validator("requires_coordination_with", mode="before")
    @classmethod
    def _none_is_empty_list(cls, v):
        """LLMs occasionally return `null` here instead of `[]`. Coerce
        to [] so we don't fail validation on perfectly good
        classifications."""
        return [] if v is None else v

    @field_validator("requires_coordination_with", mode="before")
    @classmethod
    def _filter_invalid_coordination_codes(cls, v):
        """LLMs sometimes hallucinate department codes that don't exist
        ("housekeeping_supervisor", "vip_team", etc). Keep only valid
        Department values so the action stays well-typed.
        """
        if v is None:
            return []
        if not isinstance(v, list):
            return v  # let pydantic produce the standard type error
        valid_values = {d.value for d in Department}
        return [item for item in v if (
            isinstance(item, Department) or
            (isinstance(item, str) and item in valid_values)
        )]


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

    related_task_ids: list[str] = Field(default_factory=list)
    coordinate_with: list[Department] = Field(default_factory=list)

    source_event_id: Optional[str] = None

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
    completed_at: Optional[datetime] = None

"""
HotelOS Pydantic Models
Central data contracts for the entire AI layer.
"""

from __future__ import annotations
from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


class TaskPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"
    EMERGENCY = "emergency"


class Department(str, Enum):
    HOUSEKEEPING = "housekeeping"
    MAINTENANCE = "maintenance"
    CONCIERGE = "concierge"
    FNB = "fnb"
    GUEST_RELATIONS = "guest_relations"
    FRONT_DESK = "front_desk"
    SECURITY = "security"
    SPA = "spa"
    VALET = "valet"
    REVENUE = "revenue"
    LAUNDRY = "laundry"
    ACCESSIBILITY = "accessibility"


class DepartmentAction(BaseModel):
    department: Department
    action: str
    details: str = ""
    priority: TaskPriority = TaskPriority.NORMAL
    eta_minutes: int | None = None


class Task(BaseModel):
    task_id: str
    room: str
    guest_name: str = ""
    department: Department
    description: str
    priority: TaskPriority = TaskPriority.NORMAL
    status: str = "open"  # open, in_progress, done
    created_at: str = ""
    source: str = "manual"  # manual, ai_predicted, ai_classified


class GuestPreference(BaseModel):
    key: str
    value: str
    confidence: float = 1.0  # 0-1, increases with repetition


class GuestProfile(BaseModel):
    room: str
    guest_name: str = ""
    guest_type: str = "standard"  # standard, premium, vip
    stay_count: int = 0
    preferences: list[GuestPreference] = Field(default_factory=list)
    history: list[dict[str, Any]] = Field(default_factory=list)
    accessibility_needs: list[str] = Field(default_factory=list)
    sentiment_score: float = 0.0  # -1 to 1


class OrchestratorResult(BaseModel):
    room: str
    priority: TaskPriority
    actions: list[DepartmentAction]
    reasoning: str = ""
    is_emergency: bool = False
    learning_notes: list[str] = Field(default_factory=list)


class ShiftHandoverBrief(BaseModel):
    shift: str  # morning, afternoon, night
    generated_at: str
    open_tasks: list[dict[str, Any]]
    vip_arrivals: list[dict[str, Any]]
    maintenance_flags: list[str]
    sentiment_flags: list[dict[str, Any]]
    summary: str
    handover_notes: str  # AI-generated narrative for incoming staff

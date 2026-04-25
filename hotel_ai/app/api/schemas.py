"""
HTTP request/response schemas for the advisor service.

This service no longer dispatches tasks or sends notifications itself.
Every endpoint returns a `Plan` describing what Node should do.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.models import (
    GuestProfile,
    HotelEvent,
    Plan,
    StayContext,
)


class AdviseRequest(BaseModel):
    """Node calls this for every guest/system event."""
    event: HotelEvent
    stay: StayContext


class AdviseResponse(BaseModel):
    plan: Plan


class TaskStatusAdviseRequest(BaseModel):
    """Node asks for the right guest-facing copy when a task moves."""
    task_id: str
    status: str                 # "pending" | "assigned" | "in_progress" | "completed" | "cancelled"
    stay: StayContext
    note: str | None = None


class TaskStatusAdviseResponse(BaseModel):
    plan: Plan


class EmergencyAdviseRequest(BaseModel):
    """Hard emergency entry — panic button, smoke alarm, fall sensor."""
    stay: StayContext
    source: str                 # "panic_button" | "smoke_detector" | ...
    details: str


class EmergencyAdviseResponse(BaseModel):
    plan: Plan


class UpsertGuestRequest(BaseModel):
    profile: GuestProfile


class GuestMemoryResponse(BaseModel):
    profile: GuestProfile | None

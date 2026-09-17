"""HTTP request/response schemas for the advisor service."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.models import (
    GuestProfile,
    HotelEvent,
    Plan,
    StayContext,
)


class AdviseRequest(BaseModel):
    event: HotelEvent
    stay: StayContext


class AdviseResponse(BaseModel):
    plan: Plan


class TaskStatusAdviseRequest(BaseModel):
    task_id: str
    status: str
    stay: StayContext
    note: str | None = None


class TaskStatusAdviseResponse(BaseModel):
    plan: Plan


class EmergencyAdviseRequest(BaseModel):
    stay: StayContext
    source: str
    details: str


class EmergencyAdviseResponse(BaseModel):
    plan: Plan


class UpsertGuestRequest(BaseModel):
    profile: GuestProfile


class GuestMemoryResponse(BaseModel):
    profile: GuestProfile | None


class ForgetGuestResponse(BaseModel):
    """Result of a GDPR right-to-erasure request."""
    guest_id: str
    deleted: bool   # False if the guest had no profile to delete


class StaySummaryResponse(BaseModel):
    """Deterministic one-paragraph summary of what we know about the guest."""
    guest_id: str
    summary: str


class DeepHealthResponse(BaseModel):
    """`/v1/health/deep` — also pings the LLM provider."""
    status: str          # "ok" | "degraded"
    llm_reachable: bool
    timestamp: int


class WebhookTestResponse(BaseModel):
    """`/v1/webhooks/test` — confirms Node→Python connectivity + auth."""
    received: bool
    echo: str


# --- Phase 3 -----------------------------------------------------------------


class MemoryDiffResponse(BaseModel):
    """Preferences that learning would (or did) materialise."""
    guest_id: str
    learned: dict[str, Any] = Field(default_factory=dict)
    message: str = ""


class LearnPreferencesResponse(BaseModel):
    """Result of running preference learning and writing to the profile."""
    guest_id: str
    learned: dict[str, Any] = Field(default_factory=dict)
    profile: GuestProfile | None = None


class ProactiveTask(BaseModel):
    department: str
    summary: str
    details: str


class ProactiveCheckinResponse(BaseModel):
    """Suggested pre-arrival tasks from known preferences."""
    guest_id: str
    tasks: list[ProactiveTask] = Field(default_factory=list)


class StayCompleteResponse(BaseModel):
    """Checkout / stay-complete: learn preferences + final summary."""
    guest_id: str
    summary: str
    learned: dict[str, Any] = Field(default_factory=dict)

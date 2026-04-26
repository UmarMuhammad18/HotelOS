"""HTTP request/response schemas for the advisor service."""

from __future__ import annotations

from pydantic import BaseModel

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

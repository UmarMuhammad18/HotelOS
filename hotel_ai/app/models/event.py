"""
HotelEvent — the single entry point for the AI layer.

The frontend/backend never call individual agents. They submit a HotelEvent
to `/events` and the orchestrator decides what to do.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class EventChannel(str, Enum):
    GUEST_CHAT = "guest_chat"
    GUEST_APP = "guest_app"
    VOICE = "voice"
    STAFF_CHAT = "staff_chat"
    SENSOR = "sensor"
    SYSTEM = "system"


class HotelEvent(BaseModel):
    """A raw signal that the AI must reason about."""

    id: str = Field(default_factory=lambda: f"evt_{uuid4().hex[:12]}")
    channel: EventChannel
    reservation_id: str
    room_number: str
    guest_id: str

    text: str = Field(..., description="What the guest / system said. Free-form.")
    metadata: dict = Field(default_factory=dict)

    received_at: datetime = Field(default_factory=_utcnow)
    trace_id: Optional[str] = None

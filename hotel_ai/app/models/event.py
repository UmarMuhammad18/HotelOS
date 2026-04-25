"""
HotelEvent — the single entry point for the AI layer.

The frontend/backend never call individual agents. They submit a HotelEvent
to `/events` and the orchestrator decides what to do. This keeps the
contract stable even as we evolve routing internally.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class EventChannel(str, Enum):
    GUEST_CHAT = "guest_chat"
    GUEST_APP = "guest_app"
    VOICE = "voice"
    STAFF_CHAT = "staff_chat"
    SENSOR = "sensor"            # e.g. IoT panic button, smoke alarm
    SYSTEM = "system"            # scheduled / internal triggers


class HotelEvent(BaseModel):
    """
    A raw signal that the AI must reason about.

    Example payloads:
      - guest typed "can I get extra towels?"
      - guest tapped "Something is wrong with my room" → "AC not cooling"
      - SOS button pressed in room 412
    """

    id: str = Field(default_factory=lambda: f"evt_{uuid4().hex[:12]}")
    channel: EventChannel
    reservation_id: str
    room_number: str
    guest_id: str

    text: str = Field(..., description="What the guest / system said. Free-form.")
    metadata: dict = Field(default_factory=dict)

    received_at: datetime = Field(default_factory=datetime.utcnow)
    trace_id: Optional[str] = None  # for cross-service tracing

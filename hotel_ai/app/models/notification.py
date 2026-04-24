"""
Notification — a message the AI wants sent to a human.

The AI layer doesn't push SMS/email/PN itself; it hands Notification objects
to the backend team's notification service. That keeps channel logic
(Twilio, FCM, email templates) out of the AI repo.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import uuid4

from pydantic import BaseModel, Field


class NotificationAudience(str, Enum):
    GUEST = "guest"
    STAFF = "staff"
    MANAGER = "manager"


class Notification(BaseModel):
    id: str = Field(default_factory=lambda: f"ntf_{uuid4().hex[:12]}")
    audience: NotificationAudience
    recipient_id: str                  # guest_id or staff_user_id or dept code
    title: str
    body: str
    related_task_id: str | None = None
    locale: str = "en"
    created_at: datetime = Field(default_factory=datetime.utcnow)

"""Notification — a message the AI wants sent to a human."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class NotificationAudience(str, Enum):
    GUEST = "guest"
    STAFF = "staff"
    MANAGER = "manager"


class Notification(BaseModel):
    id: str = Field(default_factory=lambda: f"ntf_{uuid4().hex[:12]}")
    audience: NotificationAudience
    recipient_id: str
    title: str
    body: str
    related_task_id: str | None = None
    locale: str = "en"
    created_at: datetime = Field(default_factory=_utcnow)

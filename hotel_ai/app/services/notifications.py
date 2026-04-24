"""
NotificationService — how the AI layer tells humans something happened.

Same pattern as TaskBus: an `InMemoryNotificationService` for tests, and
an HTTP-backed service for production that calls the backend team's
notification endpoint.
"""

from __future__ import annotations

from typing import Protocol

import httpx

from app.config import get_settings
from app.models import Notification
from app.utils.logging import get_logger

log = get_logger(__name__)


class NotificationService(Protocol):
    def send(self, notification: Notification) -> None: ...


class InMemoryNotificationService:
    def __init__(self) -> None:
        self.sent: list[Notification] = []

    def send(self, notification: Notification) -> None:
        log.info(
            "notification_sent",
            extra={"audience": notification.audience, "recipient_id": notification.recipient_id},
        )
        self.sent.append(notification)


class HTTPNotificationService:
    def __init__(self) -> None:
        s = get_settings()
        self._url = s.backend_notifications_url
        self._token = s.internal_api_token

    def send(self, notification: Notification) -> None:
        headers = {"Authorization": f"Bearer {self._token}"}
        try:
            httpx.post(
                self._url,
                headers=headers,
                json=notification.model_dump(mode="json"),
                timeout=5.0,
            ).raise_for_status()
        except httpx.HTTPError as e:
            log.error("notification_send_failed", extra={"error": str(e)})
            raise

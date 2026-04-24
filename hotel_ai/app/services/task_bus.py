"""
TaskBus — where Tasks go once the orchestrator has minted them.

The MVP runs in-process (a Python list + callbacks) so you can see the
flow end to end. In production, replace `InMemoryTaskBus` with a client
that POSTs to the backend's /internal/tasks endpoint, or publishes to
Redis/SQS/NATS. Agents and routes don't change.
"""

from __future__ import annotations

from typing import Callable, Protocol

import httpx

from app.config import get_settings
from app.models import Task
from app.utils.logging import get_logger

log = get_logger(__name__)


class TaskBus(Protocol):
    def publish(self, task: Task) -> None: ...


class InMemoryTaskBus:
    """Dev/test bus. Exposes `.tasks` so tests can assert what was published."""

    def __init__(self) -> None:
        self.tasks: list[Task] = []
        self._listeners: list[Callable[[Task], None]] = []

    def publish(self, task: Task) -> None:
        log.info("task_published", extra={"task_id": task.id, "dept": task.department})
        self.tasks.append(task)
        for fn in self._listeners:
            fn(task)

    def subscribe(self, fn: Callable[[Task], None]) -> None:
        self._listeners.append(fn)


class HTTPTaskBus:
    """Production bus — hands the task to the backend team's service."""

    def __init__(self) -> None:
        s = get_settings()
        self._url = s.backend_tasks_url
        self._token = s.internal_api_token

    def publish(self, task: Task) -> None:
        headers = {"Authorization": f"Bearer {self._token}"}
        try:
            httpx.post(
                self._url,
                headers=headers,
                json=task.model_dump(mode="json"),
                timeout=5.0,
            ).raise_for_status()
        except httpx.HTTPError as e:
            # Do not swallow silently — the caller should retry at a higher level.
            log.error("task_publish_failed", extra={"task_id": task.id, "error": str(e)})
            raise

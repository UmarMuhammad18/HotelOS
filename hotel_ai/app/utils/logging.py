"""
Structured JSON logging.

We emit JSON so the backend team's log pipeline (Datadog / Loki / etc.)
can index by trace_id, guest_id, and department without regex gymnastics.

Never pass raw GuestProfile here. Log `guest.redacted()` instead.
"""

import logging
from pythonjsonlogger import jsonlogger

from app.config import get_settings


def setup_logging() -> None:
    settings = get_settings()
    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s"
    )
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(settings.log_level.upper())


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)

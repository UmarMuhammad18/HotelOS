from __future__ import annotations

from typing import Any

_REGISTRY: Any = None
_REQUESTS: Any = None
_EVENTS: Any = None


def _init() -> None:
    global _REGISTRY, _REQUESTS, _EVENTS
    if _REGISTRY is not None:
        return
    try:
        from prometheus_client import CollectorRegistry, Counter

        _REGISTRY = CollectorRegistry()
        _REQUESTS = Counter(
            "hotelos_http_requests_total",
            "HTTP requests",
            ["method", "path", "status"],
            registry=_REGISTRY,
        )
        _EVENTS = Counter(
            "hotelos_events_total",
            "Guest events",
            ["intent", "emergency"],
            registry=_REGISTRY,
        )
    except ImportError:
        _REGISTRY = False


def observe_request(method: str, path: str, status: int) -> None:
    _init()
    if not _REQUESTS:
        return
    _REQUESTS.labels(method=method, path=path.split("?")[0][:80], status=str(status)).inc()


def observe_event(intent: str, emergency: bool) -> None:
    _init()
    if not _EVENTS:
        return
    _EVENTS.labels(intent=intent or "unknown", emergency=str(emergency).lower()).inc()


def metrics_payload() -> bytes:
    _init()
    if not _REGISTRY:
        return b"# prometheus_client not installed\n"
    from prometheus_client import generate_latest

    return generate_latest(_REGISTRY)

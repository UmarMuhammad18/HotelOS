"""End-to-end trace IDs.

Middleware assigns X-Trace-Id (or trusts an inbound one) and stashes
it in a contextvar so log records and outcome rows can join on it.
"""

from __future__ import annotations

from contextvars import ContextVar
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

_trace_id: ContextVar[str] = ContextVar("trace_id", default="")


def get_trace_id() -> str:
    return _trace_id.get() or ""


def set_trace_id(value: str) -> None:
    _trace_id.set(value)


class TraceIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        inbound = request.headers.get("x-trace-id") or request.headers.get("x-request-id")
        tid = (inbound or "").strip() or str(uuid4())
        token = _trace_id.set(tid)
        try:
            response = await call_next(request)
            response.headers["X-Trace-Id"] = tid
            return response
        finally:
            _trace_id.reset(token)

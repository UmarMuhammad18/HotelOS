"""
Advisor contract — the `Plan` the Python service returns to the Node layer.

Philosophy
----------
Python thinks; Node acts. A Plan is declarative: it says *what* should be
broadcast to the WebSocket feed, *which* tool calls Node should execute,
and *which* memory updates Python already applied.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AgentEventType(str, Enum):
    THOUGHT = "thought"
    DECISION = "decision"
    EXECUTION = "execution"
    ALERT = "alert"
    SUCCESS = "success"
    STATUS_CHANGE = "status_change"
    EMERGENCY = "emergency"


class AgentEvent(BaseModel):
    agent: str
    type: AgentEventType
    message: str
    details: str = ""
    priority: str | None = None
    room: str | None = None


class ToolCall(BaseModel):
    """Instruction for Node to invoke one of its tools.js functions."""
    tool: str
    args: dict[str, Any] = Field(default_factory=dict)
    broadcast_on_success: AgentEvent | None = None


class MemoryUpdate(BaseModel):
    """Informational only — Python has already applied these."""
    op: str
    guest_id: str
    summary: str


class GuestReply(BaseModel):
    """The text to send back over the /chat WebSocket."""
    message: str
    locale: str = "en"


class Plan(BaseModel):
    intent: str = ""
    sentiment: str = "neutral"
    priority: str = "normal"
    emergency: bool = False

    events: list[AgentEvent] = Field(default_factory=list)
    tool_calls: list[ToolCall] = Field(default_factory=list)
    guest_reply: GuestReply | None = None
    memory_updates: list[MemoryUpdate] = Field(default_factory=list)

    trace_id: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)

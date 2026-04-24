"""
Advisor contract — the `Plan` the Python service returns to the Node layer.

Philosophy
----------
Python thinks; Node acts. A Plan is declarative: it says *what* should be
broadcast to the WebSocket feed, *which* tool calls Node should execute
(against SQLite + WS + external services), and *which* memory updates
Python already applied. Node never needs to think — it just obeys the plan.

This matches the existing frontend contract in BACKEND_API.md:
  - WS `/` broadcasts AgentEvent objects to the dashboard ActivityFeed.
  - WS `/chat` returns a guest-visible message (if any).
  - REST tools in tools.js mutate the DB (tasks, rooms, etc).
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class AgentEventType(str, Enum):
    """
    Matches the existing frontend's expected types in ActivityFeed.
    `emergency` is a proposed addition we'll negotiate with the Node team.
    """
    THOUGHT = "thought"
    DECISION = "decision"
    EXECUTION = "execution"
    ALERT = "alert"
    SUCCESS = "success"
    STATUS_CHANGE = "status_change"
    EMERGENCY = "emergency"


class AgentEvent(BaseModel):
    """
    One entry in the real-time activity feed. Node broadcasts these over
    ws:// in the order Python returns them.

    `agent` is a display string the ActivityFeed shows; keep it consistent
    with the UI (e.g. "Orchestrator", "Maintenance AI").
    """
    agent: str
    type: AgentEventType
    message: str
    details: str = ""
    # Optional hints Node can use for styling or filtering
    priority: str | None = None  # "low"|"normal"|"high"|"urgent"|"emergency"
    room: str | None = None


class ToolCall(BaseModel):
    """
    Instruction for Node to invoke one of its tools.js functions.

    The `tool` name must match a function exported by hotelos-api/src/agents/tools.js.
    `args` is passed through verbatim — Python is responsible for matching
    the argument shape each tool expects.

    `broadcast_on_success` is an optional AgentEvent Node should push to the
    WS feed after the tool returns successfully. If the tool errors, Node
    broadcasts an `alert` event with the error instead (it does NOT retry;
    retries are Python's job on the next call).
    """
    tool: str
    args: dict[str, Any] = Field(default_factory=dict)
    broadcast_on_success: AgentEvent | None = None


class MemoryUpdate(BaseModel):
    """
    Informational only — Python has already applied these. Returned so
    Node can log them or show a "we remembered X" badge in the UI.
    """
    op: str                             # e.g. "record_preference", "record_request"
    guest_id: str
    summary: str


class GuestReply(BaseModel):
    """
    The text to send back over the /chat WebSocket to whoever sent the
    original message. None means don't reply (e.g. a sensor event).
    """
    message: str
    locale: str = "en"


class Plan(BaseModel):
    """
    Full advisor response. Node:
      1. Broadcasts every `event` in `events` in order.
      2. Executes every `tool_call`, broadcasting its `broadcast_on_success`
         after each one that succeeds.
      3. Sends `guest_reply.message` over the /chat WS if present.
      4. Logs `memory_updates` for audit.
    """
    intent: str = ""                    # short label: "amenity_request", "maintenance_issue", ...
    sentiment: str = "neutral"          # "neutral"|"positive"|"frustrated"|"distressed"
    priority: str = "normal"            # top-level priority for the whole event
    emergency: bool = False             # true if the emergency rail fired

    events: list[AgentEvent] = Field(default_factory=list)
    tool_calls: list[ToolCall] = Field(default_factory=list)
    guest_reply: GuestReply | None = None
    memory_updates: list[MemoryUpdate] = Field(default_factory=list)

    trace_id: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

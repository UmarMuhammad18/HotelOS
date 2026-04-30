"""
Outcome telemetry — one record per task lifecycle.

Why this exists
---------------
The whole sales pitch of an operations AI is "we save you time and prevent
complaints." Saying it is easy. Proving it is what wins renewals. This
model is the truth-on-disk of every action the AI took, every state
transition, and the latency between them, so we can answer questions
like:

  - "Median time-to-resolution for housekeeping requests this week?"
  - "Which intents most often hit repeat-issue escalation?"
  - "How many emergency events did we respond to in <60 seconds?"
  - "What % of guest chat replies didn't need staff follow-up?"

We deliberately store these as append-only records, never mutating
existing ones (except for status transitions, which we represent as new
timestamps on the same record). That makes the data trustworthy for
audit and lets us compute aggregates by replaying the log.

What we DO NOT store here
-------------------------
- Free-text guest messages (privacy — those live in `GuestMemory` only,
  truncated, and have a retention policy)
- LLM prompts/responses (separate audit log if you want it)
- Staff identities (those are a backend concern)

What we DO store
----------------
Just enough to compute outcome metrics: department, intent, priority,
emergency flag, language, and the four lifecycle timestamps.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field

from app.models import Department, Priority


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class OutcomeStatus(str, Enum):
    """Mirror of TaskStatus, copied here so this module never imports
    backend Task lifecycle details. The values match TaskStatus values
    so cross-referencing is trivial."""
    CREATED = "created"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class OutcomeRecord(BaseModel):
    """One record per (task_id) lifecycle.

    Created when the orchestrator first builds a Plan that contains a
    tool_call producing a task. Updated when the staff app sends a
    status transition through `/v1/tasks/status`.

    All datetime fields are timezone-aware (UTC). Latency derivations
    (e.g. `resolution_seconds`) are computed lazily from the timestamps
    so we never have to keep a derived field in sync with its sources.
    """

    id: str = Field(default_factory=lambda: f"out_{uuid4().hex[:12]}")

    # --- Identity / dedup ---
    task_id: str                                # primary join key
    event_id: Optional[str] = None              # source HotelEvent
    reservation_id: str
    guest_id: str
    room_number: str
    property_id: str = "default"                # for multi-property later

    # --- What happened ---
    department: Department
    intent: str = ""                            # e.g. "amenity_request"
    priority: Priority
    emergency: bool = False
    repeat_count: int = 0                       # >0 means this triggered repeat-issue logic
    accessibility_flagged: bool = False
    abuse_flagged: bool = False
    language: str = "en"                        # guest language
    quiet_hours_deferred: bool = False          # priority demoted by quiet-hours rule

    # --- Lifecycle timestamps ---
    created_at: datetime = Field(default_factory=_utcnow)
    in_progress_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None

    # --- Status (current, derived from timestamps) ---
    status: OutcomeStatus = OutcomeStatus.CREATED

    # --- Outcome flags (set on completion) ---
    needed_staff_followup: Optional[bool] = None  # set by /tasks/status note

    # ---------- Derived properties (not stored, computed on demand) ----------

    @property
    def acknowledgement_seconds(self) -> Optional[float]:
        """How long between task created and staff picking it up
        (in_progress)? `None` until in_progress lands."""
        if not self.in_progress_at:
            return None
        return (self.in_progress_at - self.created_at).total_seconds()

    @property
    def resolution_seconds(self) -> Optional[float]:
        """End-to-end time-to-completion. `None` until completed."""
        if not self.completed_at:
            return None
        return (self.completed_at - self.created_at).total_seconds()

    @property
    def is_open(self) -> bool:
        return self.status in (OutcomeStatus.CREATED, OutcomeStatus.IN_PROGRESS)

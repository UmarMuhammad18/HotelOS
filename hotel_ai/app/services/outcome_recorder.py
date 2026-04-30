"""
OutcomeRecorder — the only place that writes to OutcomeStore.

Why funnel through one class
----------------------------
Outcome telemetry is the foundation for every metric we surface to
hoteliers ("you saved X hours this week", "we caught Y likely
complaints"). If different code paths can write outcomes inconsistently,
the metrics lie. So we keep all writes in one place with a single
testable surface.

When records are written
------------------------
1. **`record_event`** — orchestrator calls this after building a Plan that
   emitted at least one task-creating tool call. One outcome record per
   task is created with the policy/intent/priority context.

2. **`record_status`** — the routes layer calls this when staff hits
   `/v1/tasks/status` to update a task. We update the matching record's
   timestamps and status.

What we deliberately do NOT do
------------------------------
- Compute and cache aggregates here. Aggregation lives in `metrics.py`
  and is computed on demand from the source-of-truth records. That keeps
  this module pure and testable, and avoids the "is the cache stale?"
  question.
- Write any PII. Records contain IDs and metadata only.
"""

from __future__ import annotations

from typing import Optional

from app.memory.outcome_store import OutcomeStore
from app.models import (
    Department,
    DepartmentAction,
    HotelEvent,
    Plan,
    Priority,
    StayContext,
    Task,
)
from app.models.outcome import OutcomeRecord, OutcomeStatus
from app.utils.logging import get_logger

log = get_logger(__name__)


# Marker the orchestrator sets in action.details when abuse keywords matched.
# Re-imported here from security.py so we don't take a hard dep on the agents
# package — recorder must be cheap to import in tests.
_ABUSE_MARKER = "[abuse-flagged]"
_QUIET_HOURS_MARKER = "[quiet hours: defer"
_REPEAT_MARKER = "[repeat issue:"


class OutcomeRecorder:
    def __init__(self, store: OutcomeStore) -> None:
        self._store = store

    # --- write paths ------------------------------------------------------

    def record_plan(
        self,
        plan: Plan,
        event: HotelEvent,
        stay: StayContext,
        actions: list[DepartmentAction],
        property_id: str = "default",
    ) -> list[OutcomeRecord]:
        """Create one OutcomeRecord per task-creating tool call in the plan.

        Tool calls without a real task (e.g. notifications) produce no
        record — those are not "outcomes" in the operational sense.

        We pair tool_calls with their originating action by zipping in
        order, which is correct because the orchestrator builds them in
        lockstep (one fragment per action, fragments appended in action
        order). If a fragment produced no tool_call (e.g. Guest Relations
        sometimes), the action is skipped silently.
        """
        records: list[OutcomeRecord] = []

        # Iterate actions and tool_calls in parallel: each agent contributes
        # zero-or-one task-producing tool_call. We use a simple cursor on
        # tool_calls to advance.
        tc_iter = iter(plan.tool_calls)
        for action in actions:
            tc = next(tc_iter, None)
            if tc is None:
                break
            # Skip non-task tool calls (heuristic: real tasks have a
            # `roomNumber` arg in our current Node contract).
            if "roomNumber" not in tc.args:
                continue
            # Pull the task_id off the tool call if Node already minted
            # one; otherwise we synthesize a deterministic placeholder.
            # In production Node returns the task_id after creation; the
            # `/tasks/status` call will then update the right record.
            task_id = tc.args.get("taskId") or _synthetic_task_id(event, action)

            record = OutcomeRecord(
                task_id=task_id,
                event_id=event.id,
                reservation_id=stay.reservation_id,
                guest_id=stay.guest.guest_id,
                room_number=stay.room_number,
                property_id=property_id,
                department=action.department,
                intent=plan.intent or "unclassified",
                priority=action.priority,
                emergency=plan.emergency,
                repeat_count=_count_repeat_marker(action.details),
                accessibility_flagged=action.department == Department.ACCESSIBILITY
                or stay.guest.accessibility.registered_disability,
                abuse_flagged=_ABUSE_MARKER in (action.details or ""),
                language=stay.guest.language or "en",
                quiet_hours_deferred=_QUIET_HOURS_MARKER in (action.details or ""),
            )
            try:
                self._store.upsert(record)
                records.append(record)
            except Exception as exc:  # noqa: BLE001
                # Outcome telemetry failure must NEVER break event handling.
                # Log loudly and move on.
                log.error(
                    "outcome_record_failed",
                    extra={"task_id": task_id, "error": str(exc)},
                )

        return records

    def record_status(
        self,
        task_id: str,
        new_status: OutcomeStatus,
        needed_followup: Optional[bool] = None,
    ) -> Optional[OutcomeRecord]:
        """Update the lifecycle timestamp + status for an existing record.

        Returns the updated record, or None if no record exists for this
        task_id (which can happen if the task was created before
        outcome telemetry was wired in — we don't error on those).

        Idempotent: re-applying the same status is a no-op timestamp-wise.
        """
        from datetime import datetime, timezone

        existing = self._store.get(task_id)
        if existing is None:
            log.info(
                "outcome_status_no_record",
                extra={"task_id": task_id, "new_status": new_status.value},
            )
            return None

        now = datetime.now(timezone.utc)
        updates: dict = {"status": new_status}

        # Set the right timestamp ONCE — re-applying the same status
        # doesn't overwrite earlier timing (which would distort metrics).
        if new_status == OutcomeStatus.IN_PROGRESS and not existing.in_progress_at:
            updates["in_progress_at"] = now
        elif new_status == OutcomeStatus.COMPLETED and not existing.completed_at:
            updates["completed_at"] = now
        elif new_status == OutcomeStatus.CANCELLED and not existing.cancelled_at:
            updates["cancelled_at"] = now

        if needed_followup is not None:
            updates["needed_staff_followup"] = needed_followup

        updated = existing.model_copy(update=updates)
        try:
            self._store.upsert(updated)
        except Exception as exc:  # noqa: BLE001
            log.error(
                "outcome_status_update_failed",
                extra={"task_id": task_id, "error": str(exc)},
            )
            return None
        return updated


# --- helpers -----------------------------------------------------------------


def _synthetic_task_id(event: HotelEvent, action: DepartmentAction) -> str:
    """Deterministic placeholder task_id when Node hasn't minted one yet.

    Format: `pending_<event_id>_<dept>`. The staff app must include the
    real task_id in the next `/tasks/status` call; if it doesn't we'll
    have orphan records, which is a surfacing-only concern (they show
    up as never-acknowledged in metrics).
    """
    return f"pending_{event.id}_{action.department.value}"


def _count_repeat_marker(details: Optional[str]) -> int:
    """Extract the repeat count from a marker like
    '[repeat issue: guest has reported 'X' 3 times in the last 24h]'.
    Returns 0 when no marker is present."""
    if not details or _REPEAT_MARKER not in details:
        return 0
    # Cheap string-find rather than regex: the orchestrator builds these
    # markers itself so we control the format.
    try:
        chunk = details.split(_REPEAT_MARKER, 1)[1]
        # chunk now starts with " guest has reported 'X' N times..."
        for token in chunk.split():
            if token.isdigit():
                return int(token)
    except Exception:  # noqa: BLE001
        pass
    return 0

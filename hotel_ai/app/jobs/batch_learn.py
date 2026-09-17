"""Batch preference learning over all known guests.

Intended for a nightly cron:
  POST /v1/jobs/batch-learn
  or:  python -m app.jobs.batch_learn
"""

from __future__ import annotations

from typing import Any

from app.memory.guest_memory import GuestMemory
from app.utils.logging import get_logger

log = get_logger(__name__)


def run_batch_learn(memory: GuestMemory, limit: int = 500) -> dict[str, Any]:
    """Run preference learning for up to `limit` guests.

    Returns a summary: processed, updated, skipped, errors.
    """
    guest_ids = memory.list_guest_ids(limit=limit)
    processed = 0
    updated = 0
    skipped = 0
    errors: list[str] = []

    for gid in guest_ids:
        processed += 1
        try:
            learned = memory.learn_preferences(gid)
            if learned:
                updated += 1
            else:
                skipped += 1
        except Exception as e:  # noqa: BLE001
            errors.append(f"{gid}: {e}")
            log.warning("batch_learn_guest_failed", extra={"guest_id": gid, "error": str(e)})

    summary = {
        "processed": processed,
        "updated": updated,
        "skipped": skipped,
        "errors": errors[:20],
        "error_count": len(errors),
    }
    log.info("batch_learn_complete", extra=summary)
    return summary

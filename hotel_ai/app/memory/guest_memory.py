"""
GuestMemory — the API agents use to read and learn about guests.

Memory updates happen at well-defined points, not on every LLM call:
  1. After a successful request (tag with intent + content)
  2. On stay completion (summary)
  3. On explicit guest feedback / survey responses
  4. Nightly / on-demand preference learning (Phase 3)

We do NOT let the LLM mutate memory directly. Mutations go through typed
methods so we can audit them.

Past-request format
-------------------
Each entry is `"<intent>|<utc_iso_timestamp>|<summary[:120]>"`. This lets
the orchestrator both render a human-readable trail in the LLM prompt
AND parse timestamps for repeat-issue detection without an extra DB.
The pipe separator is safe because guest text is truncated/escaped
before storage.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.memory.preference_learner import (
    learn_preferences_from_requests,
    merge_preferences,
    proactive_tasks_from_preferences,
)
from app.memory.store import MemoryStore
from app.models.guest import GuestProfile
from app.utils.logging import get_logger

log = get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


_MAX_PAST_REQUESTS = 50
_SEP = "|"


def _safe_summary(s: str) -> str:
    cleaned = (s or "").replace(_SEP, " ").replace("\n", " ").strip()
    return cleaned[:120]


def encode_request(intent: str, summary: str, ts: datetime | None = None) -> str:
    ts = ts or _utcnow()
    return f"{intent}{_SEP}{ts.isoformat()}{_SEP}{_safe_summary(summary)}"


def decode_request(line: str) -> tuple[str, datetime | None, str]:
    parts = line.split(_SEP, 2)
    if len(parts) == 3:
        intent, ts_str, summary = parts
        try:
            ts = datetime.fromisoformat(ts_str)
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            return intent, ts, summary
        except ValueError:
            return intent, None, summary
    legacy = line.split(":", 1)
    if len(legacy) == 2:
        return legacy[0].strip(), None, legacy[1].strip()
    return "", None, line


class GuestMemory:
    def __init__(self, store: MemoryStore) -> None:
        self._store = store

    def get_profile(self, guest_id: str) -> GuestProfile | None:
        return self._store.get(guest_id)

    def is_returning(self, guest_id: str) -> bool:
        p = self._store.get(guest_id)
        return bool(p and p.past_requests)

    def count_recent_intents(
        self,
        guest_id: str,
        intent: str,
        within: timedelta,
    ) -> int:
        if not intent:
            return 0
        p = self._store.get(guest_id)
        if not p or not p.past_requests:
            return 0
        cutoff = _utcnow() - within
        n = 0
        for line in p.past_requests:
            i, ts, _summary = decode_request(line)
            if i != intent or ts is None:
                continue
            if ts >= cutoff:
                n += 1
        return n

    def upsert_from_reservation(self, profile: GuestProfile) -> GuestProfile:
        existing = self._store.get(profile.guest_id)
        if existing:
            merged = existing.model_copy(
                update={
                    "full_name": profile.full_name,
                    "vip": profile.vip,
                    "email": profile.email,
                    "phone": profile.phone,
                    "language": profile.language,
                    "accessibility": profile.accessibility,
                    "emergency": profile.emergency,
                    "updated_at": _utcnow(),
                }
            )
            self._store.upsert(merged)
            return merged
        self._store.upsert(profile)
        return profile

    def record_preference(self, guest_id: str, key: str, value: Any) -> None:
        p = self._store.get(guest_id)
        if not p:
            log.warning("record_preference_missing_guest", extra={"guest_id": guest_id})
            return
        p.preferences[key] = value
        p.updated_at = _utcnow()
        self._store.upsert(p)

    def record_request(
        self,
        guest_id: str,
        summary: str,
        intent: Optional[str] = None,
    ) -> None:
        p = self._store.get(guest_id)
        if not p:
            return
        intent_tag = intent or "unclassified"
        line = encode_request(intent_tag, summary)
        p.past_requests = (p.past_requests + [line])[-_MAX_PAST_REQUESTS:]
        p.updated_at = _utcnow()
        self._store.upsert(p)

    def forget(self, guest_id: str) -> bool:
        return self._store.delete(guest_id)

    def stay_summary(self, guest_id: str) -> str:
        p = self._store.get(guest_id)
        if not p:
            return "No prior record on file."

        bits: list[str] = []
        if p.vip:
            bits.append("VIP guest")
        if p.accessibility.registered_disability:
            bits.append("registered accessibility needs")
        if p.language and p.language != "en":
            bits.append(f"prefers {p.language}")

        if p.preferences:
            prefs = list(p.preferences.items())[:3]
            bits.append(
                "preferences: " + ", ".join(f"{k}={v}" for k, v in prefs)
            )

        intent_counts: dict[str, int] = {}
        for line in p.past_requests[-25:]:
            i, _, _ = decode_request(line)
            if i:
                intent_counts[i] = intent_counts.get(i, 0) + 1
        if intent_counts:
            top = sorted(intent_counts.items(), key=lambda x: -x[1])[:3]
            bits.append(
                "recent activity: "
                + ", ".join(f"{i}×{n}" for i, n in top)
            )

        if not bits:
            return f"{p.full_name} — no notable preferences or history yet."
        return f"{p.full_name}: " + "; ".join(bits) + "."

    def list_guest_ids(self, limit: int = 500) -> list[str]:
        """Return known guest ids (for batch jobs)."""
        return self._store.list_ids(limit=limit)

    def learn_preferences(self, guest_id: str) -> dict[str, Any]:
        p = self._store.get(guest_id)
        if not p:
            return {}
        learned = learn_preferences_from_requests(
            p.past_requests,
            existing=p.preferences,
        )
        if not learned:
            return {}
        p.preferences = merge_preferences(p.preferences, learned)
        p.updated_at = _utcnow()
        self._store.upsert(p)
        log.info(
            "preferences_learned",
            extra={"guest_id": guest_id, "keys": list(learned.keys())},
        )
        return learned

    def memory_diff(self, guest_id: str) -> dict[str, Any]:
        p = self._store.get(guest_id)
        if not p:
            return {}
        return learn_preferences_from_requests(
            p.past_requests,
            existing=p.preferences,
        )

    def proactive_checkin_tasks(self, guest_id: str) -> list[dict[str, str]]:
        p = self._store.get(guest_id)
        if not p or not p.preferences:
            return []
        return proactive_tasks_from_preferences(p.preferences)

    def complete_stay(self, guest_id: str) -> str:
        self.learn_preferences(guest_id)
        summary = self.stay_summary(guest_id)
        log.info(
            "stay_completed",
            extra={"guest_id": guest_id, "summary_len": len(summary)},
        )
        return summary

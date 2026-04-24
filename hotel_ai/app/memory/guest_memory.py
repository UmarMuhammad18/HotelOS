"""
GuestMemory — the API agents use to read and learn about guests.

This is deliberately narrow. We want agents to get exactly what they need
(profile + recent preferences) without learning the storage layout.

Learning rule of thumb
----------------------
Memory updates happen at well-defined points, not on every LLM call:
1. After a successful request ("liked foam pillows" → `record_preference`).
2. On stay completion ("had 3 housekeeping requests" → summary).
3. On explicit guest feedback / survey responses.

We do NOT let the LLM mutate memory directly. Mutations go through typed
methods so we can audit them.
"""

from __future__ import annotations

from datetime import datetime

from app.memory.store import MemoryStore
from app.models.guest import GuestProfile
from app.utils.logging import get_logger

log = get_logger(__name__)


class GuestMemory:
    def __init__(self, store: MemoryStore) -> None:
        self._store = store

    # --- reads ---

    def get_profile(self, guest_id: str) -> GuestProfile | None:
        return self._store.get(guest_id)

    def is_returning(self, guest_id: str) -> bool:
        p = self._store.get(guest_id)
        return bool(p and p.past_requests)

    # --- writes (explicit, auditable) ---

    def upsert_from_reservation(self, profile: GuestProfile) -> GuestProfile:
        """Called when a reservation is created/updated in the PMS."""
        existing = self._store.get(profile.guest_id)
        if existing:
            # Preserve learned preferences; refresh identity fields.
            merged = existing.model_copy(
                update={
                    "full_name": profile.full_name,
                    "vip": profile.vip,
                    "email": profile.email,
                    "phone": profile.phone,
                    "language": profile.language,
                    "accessibility": profile.accessibility,
                    "emergency": profile.emergency,
                    "updated_at": datetime.utcnow(),
                }
            )
            self._store.upsert(merged)
            return merged
        self._store.upsert(profile)
        return profile

    def record_preference(self, guest_id: str, key: str, value) -> None:
        p = self._store.get(guest_id)
        if not p:
            log.warning("record_preference_missing_guest", extra={"guest_id": guest_id})
            return
        p.preferences[key] = value
        p.updated_at = datetime.utcnow()
        self._store.upsert(p)

    def record_request(self, guest_id: str, summary: str) -> None:
        p = self._store.get(guest_id)
        if not p:
            return
        # Keep the last 50 to bound memory size.
        p.past_requests = (p.past_requests + [summary])[-50:]
        p.updated_at = datetime.utcnow()
        self._store.upsert(p)

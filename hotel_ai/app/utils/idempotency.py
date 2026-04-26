"""
A tiny TTL cache for HTTP idempotency keys.

Why a custom class instead of `functools.lru_cache`
---------------------------------------------------
`lru_cache` has no time-based eviction — entries live forever. For
idempotency keys we want bounded TTL (5 min by default) so a stale key
from yesterday can't pin a Plan.

This is process-local. For multi-worker / multi-replica deploys,
substitute a Redis-backed implementation that exposes the same `get`
and `put` interface — the routes module never touches storage details.

Thread safety
-------------
A single `threading.Lock` serialises all mutations. The critical sections
are tiny (dict get/set + a list of keys for FIFO eviction) so contention
is negligible at the request rates this service targets.
"""

from __future__ import annotations

import threading
import time
from collections import OrderedDict
from typing import Generic, Optional, TypeVar

T = TypeVar("T")


class IdempotencyCache(Generic[T]):
    """Bounded, time-expiring key→value cache."""

    def __init__(self, ttl_seconds: int = 300, max_entries: int = 10_000) -> None:
        if ttl_seconds <= 0:
            raise ValueError("ttl_seconds must be positive")
        if max_entries <= 0:
            raise ValueError("max_entries must be positive")
        self._ttl = ttl_seconds
        self._max = max_entries
        self._lock = threading.Lock()
        self._data: "OrderedDict[str, tuple[float, T]]" = OrderedDict()

    def get(self, key: str) -> Optional[T]:
        with self._lock:
            entry = self._data.get(key)
            if entry is None:
                return None
            ts, value = entry
            if time.monotonic() - ts > self._ttl:
                del self._data[key]
                return None
            return value

    def put(self, key: str, value: T) -> None:
        with self._lock:
            self._data[key] = (time.monotonic(), value)
            self._data.move_to_end(key)
            while len(self._data) > self._max:
                self._data.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    def __len__(self) -> int:
        with self._lock:
            return len(self._data)

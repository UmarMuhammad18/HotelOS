"""
Per-IP sliding-window rate limiter.

Used on `/v1/events` so a single client can't hammer the LLM and run up
costs or push us into provider-side throttling. Implementation is in
memory and process-local; for multi-replica deploys swap to Redis.

Design notes
------------
- Sliding window vs token bucket: sliding window is closer to what
  users intuit ("60 requests per minute, no matter how I space them")
  and is trivial to implement with a deque of timestamps. Token-bucket
  would be smoother but more code.
- We trim the deque on every check so memory stays bounded even for
  long-running processes hammered by a few noisy clients.
- An "IP" here is whatever the route handler chooses to pass in —
  typically the client's reported address from the request, with
  X-Forwarded-For respected when behind a trusted proxy. The limiter
  itself is identity-agnostic.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from typing import Deque


class RateLimiter:
    def __init__(self, max_per_minute: int = 60) -> None:
        if max_per_minute < 0:
            raise ValueError("max_per_minute cannot be negative")
        # 0 disables the limiter (allows everything).
        self._max = max_per_minute
        self._window_seconds = 60.0
        self._lock = threading.Lock()
        self._hits: dict[str, Deque[float]] = {}

    @property
    def enabled(self) -> bool:
        return self._max > 0

    def check(self, key: str) -> bool:
        """Return True if a request from `key` is allowed RIGHT NOW.

        Records the request as part of the check (so the next call sees
        it). Equivalent to "claim a slot or reject."
        """
        if not self.enabled:
            return True
        now = time.monotonic()
        cutoff = now - self._window_seconds
        with self._lock:
            q = self._hits.setdefault(key, deque())
            # Drop everything older than the window.
            while q and q[0] < cutoff:
                q.popleft()
            if len(q) >= self._max:
                return False
            q.append(now)
            return True

    def reset(self, key: str | None = None) -> None:
        """Clear all hits for `key`, or every key when None. Useful in tests."""
        with self._lock:
            if key is None:
                self._hits.clear()
            else:
                self._hits.pop(key, None)

"""
Per-IP sliding-window rate limiter.

In-process by default. When REDIS_URL is configured, uses Redis so
multi-replica deploys share the same counters.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock
from typing import Deque

from app.utils.logging import get_logger

log = get_logger(__name__)


class RateLimiter:
    """Sliding 60s window. max_per_minute=0 disables."""

    def __init__(self, max_per_minute: int = 60, redis_url: str = "") -> None:
        if max_per_minute < 0:
            raise ValueError("max_per_minute must be >= 0")
        self.max_per_minute = max_per_minute
        self._redis_url = redis_url
        self._redis = None
        self._hits: dict[str, Deque[float]] = defaultdict(deque)
        self._lock = Lock()
        if redis_url:
            try:
                import redis

                self._redis = redis.Redis.from_url(redis_url, decode_responses=True)
                self._redis.ping()
                log.info("rate_limiter_redis")
            except Exception as e:  # noqa: BLE001
                log.warning("rate_limiter_redis_fallback", extra={"error": str(e)})
                self._redis = None

    @property
    def enabled(self) -> bool:
        return self.max_per_minute > 0

    def check(self, key: str) -> bool:
        if not self.enabled:
            return True
        if self._redis is not None:
            return self._check_redis(key)
        return self._check_memory(key)

    def _check_memory(self, key: str) -> bool:
        now = time.monotonic()
        window_start = now - 60.0
        with self._lock:
            q = self._hits[key]
            while q and q[0] < window_start:
                q.popleft()
            if len(q) >= self.max_per_minute:
                return False
            q.append(now)
            return True

    def _check_redis(self, key: str) -> bool:
        assert self._redis is not None
        rkey = f"rl:{key}"
        now = time.time()
        pipe = self._redis.pipeline()
        pipe.zremrangebyscore(rkey, 0, now - 60)
        pipe.zcard(rkey)
        pipe.zadd(rkey, {f"{now}": now})
        pipe.expire(rkey, 120)
        results = pipe.execute()
        count = int(results[1])
        return count < self.max_per_minute

    def reset(self, key: str | None) -> None:
        """Clear one key, or all keys when key is None."""
        if self._redis is not None and key is not None:
            try:
                self._redis.delete(f"rl:{key}")
            except Exception as e:  # noqa: BLE001
                log.warning("rate_limiter_redis_reset_failed", extra={"error": str(e)})
        with self._lock:
            if key is None:
                self._hits.clear()
            else:
                self._hits.pop(key, None)

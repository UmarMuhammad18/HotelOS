"""Tests for IdempotencyCache."""

from __future__ import annotations

import threading
import time

import pytest

from app.utils.idempotency import IdempotencyCache


def test_put_then_get_returns_value():
    cache: IdempotencyCache[str] = IdempotencyCache(ttl_seconds=60)
    cache.put("key-1", "plan-A")
    assert cache.get("key-1") == "plan-A"


def test_missing_key_returns_none():
    cache: IdempotencyCache[str] = IdempotencyCache(ttl_seconds=60)
    assert cache.get("does-not-exist") is None


def test_expired_entry_is_evicted_lazily():
    cache: IdempotencyCache[str] = IdempotencyCache(ttl_seconds=1)
    cache.put("k", "v")
    assert cache.get("k") == "v"
    time.sleep(1.1)
    assert cache.get("k") is None
    assert len(cache) == 0


def test_max_entries_evicts_oldest_first():
    cache: IdempotencyCache[int] = IdempotencyCache(
        ttl_seconds=60, max_entries=3
    )
    cache.put("a", 1)
    cache.put("b", 2)
    cache.put("c", 3)
    cache.put("d", 4)
    assert cache.get("a") is None
    assert cache.get("b") == 2
    assert cache.get("c") == 3
    assert cache.get("d") == 4


def test_clear_empties_cache():
    cache: IdempotencyCache[str] = IdempotencyCache(ttl_seconds=60)
    cache.put("k1", "v1")
    cache.put("k2", "v2")
    cache.clear()
    assert len(cache) == 0


def test_repeated_puts_refresh_value():
    cache: IdempotencyCache[str] = IdempotencyCache(ttl_seconds=60)
    cache.put("k", "first")
    cache.put("k", "second")
    assert cache.get("k") == "second"
    assert len(cache) == 1


def test_concurrent_puts_dont_lose_entries():
    cache: IdempotencyCache[int] = IdempotencyCache(
        ttl_seconds=60, max_entries=10_000
    )
    n = 200
    threads = [threading.Thread(target=cache.put, args=(f"k-{i}", i)) for i in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(cache) == n
    for i in range(n):
        assert cache.get(f"k-{i}") == i


def test_zero_ttl_rejected():
    with pytest.raises(ValueError):
        IdempotencyCache(ttl_seconds=0)


def test_negative_max_entries_rejected():
    with pytest.raises(ValueError):
        IdempotencyCache(ttl_seconds=60, max_entries=-1)

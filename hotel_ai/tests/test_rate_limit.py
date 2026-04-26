"""Tests for the per-IP sliding-window rate limiter."""

from __future__ import annotations

import threading
import time

import pytest

from app.utils.rate_limit import RateLimiter


def test_disabled_when_zero_allows_all():
    """max_per_minute=0 means the limiter is off; everything passes."""
    limiter = RateLimiter(max_per_minute=0)
    assert limiter.enabled is False
    for _ in range(1000):
        assert limiter.check("any-ip") is True


def test_under_the_limit_passes():
    limiter = RateLimiter(max_per_minute=5)
    for _ in range(5):
        assert limiter.check("ip-A") is True


def test_over_the_limit_is_rejected():
    limiter = RateLimiter(max_per_minute=3)
    assert limiter.check("ip-A") is True
    assert limiter.check("ip-A") is True
    assert limiter.check("ip-A") is True
    assert limiter.check("ip-A") is False  # 4th hit in window


def test_separate_ips_have_separate_buckets():
    """One spammer should not block another client."""
    limiter = RateLimiter(max_per_minute=2)
    assert limiter.check("ip-A") is True
    assert limiter.check("ip-A") is True
    assert limiter.check("ip-A") is False  # ip-A blocked
    assert limiter.check("ip-B") is True   # ip-B unaffected


def test_window_slides_so_old_hits_drop_off(monkeypatch):
    """After the window passes, slots free up again."""
    limiter = RateLimiter(max_per_minute=2)
    # The limiter uses time.monotonic internally; fake it.
    base = 1000.0
    current = [base]
    monkeypatch.setattr(
        "app.utils.rate_limit.time.monotonic",
        lambda: current[0],
    )

    assert limiter.check("ip-A") is True
    assert limiter.check("ip-A") is True
    assert limiter.check("ip-A") is False

    # Advance past the 60s window.
    current[0] = base + 61.0
    # All previous hits expired; should be allowed again.
    assert limiter.check("ip-A") is True


def test_reset_clears_one_key():
    limiter = RateLimiter(max_per_minute=1)
    assert limiter.check("ip-A") is True
    assert limiter.check("ip-A") is False
    limiter.reset("ip-A")
    assert limiter.check("ip-A") is True


def test_reset_all_clears_everything():
    limiter = RateLimiter(max_per_minute=1)
    limiter.check("ip-A")
    limiter.check("ip-B")
    limiter.reset(None)
    # Both buckets reset.
    assert limiter.check("ip-A") is True
    assert limiter.check("ip-B") is True


def test_concurrent_checks_are_thread_safe():
    """100 threads racing through a tight limit — totals must add up."""
    limiter = RateLimiter(max_per_minute=10)
    results: list[bool] = []
    lock = threading.Lock()

    def worker():
        ok = limiter.check("ip-shared")
        with lock:
            results.append(ok)

    threads = [threading.Thread(target=worker) for _ in range(100)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # Exactly 10 should have passed, 90 rejected. No torn writes
    # would either over-allow (above 10) or lose hits.
    passed = sum(1 for r in results if r)
    assert passed == 10


def test_negative_max_rejected():
    with pytest.raises(ValueError):
        RateLimiter(max_per_minute=-1)

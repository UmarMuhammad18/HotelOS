"""Tests for JSONFileStore — concurrency, atomicity, delete."""

from __future__ import annotations

import json
import threading

from app.memory.store import JSONFileStore
from app.models.guest import GuestProfile


def _profile(guest_id: str, name: str = "Test Guest") -> GuestProfile:
    return GuestProfile(guest_id=guest_id, full_name=name)


def test_upsert_then_get_round_trip(tmp_path):
    store = JSONFileStore(str(tmp_path / "mem.json"))
    store.upsert(_profile("g1", "Ada"))
    out = store.get("g1")
    assert out is not None
    assert out.guest_id == "g1"
    assert out.full_name == "Ada"


def test_get_missing_returns_none(tmp_path):
    store = JSONFileStore(str(tmp_path / "mem.json"))
    assert store.get("nope") is None


def test_concurrent_upserts_do_not_lose_entries(tmp_path):
    store = JSONFileStore(str(tmp_path / "mem.json"))
    n = 50

    def writer(i: int) -> None:
        store.upsert(_profile(f"g-{i}", f"Guest {i}"))

    threads = [threading.Thread(target=writer, args=(i,)) for i in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    for i in range(n):
        assert store.get(f"g-{i}") is not None, f"missing g-{i}"


def test_delete_returns_true_when_removed(tmp_path):
    store = JSONFileStore(str(tmp_path / "mem.json"))
    store.upsert(_profile("g1"))
    assert store.delete("g1") is True
    assert store.get("g1") is None


def test_delete_missing_returns_false(tmp_path):
    store = JSONFileStore(str(tmp_path / "mem.json"))
    assert store.delete("nope") is False


def test_file_is_valid_json_after_concurrent_writes(tmp_path):
    path = tmp_path / "mem.json"
    store = JSONFileStore(str(path))

    def writer(i: int) -> None:
        store.upsert(_profile(f"g-{i}"))

    threads = [threading.Thread(target=writer, args=(i,)) for i in range(20)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    data = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(data, dict)
    assert len(data) == 20

"""
Memory persistence.

Two backends are provided:
  - JSONFileStore   — single-process, file-backed. Good for dev / MVP.
  - PostgresStore   — multi-process safe. Used when DATABASE_URL is set.

Both implement the `MemoryStore` Protocol so swapping is one line in
main.py — agents and the orchestrator never know which backend they're
talking to.
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Protocol

from app.models.guest import GuestProfile
from app.utils.logging import get_logger

log = get_logger(__name__)


class MemoryStore(Protocol):
    def get(self, guest_id: str) -> GuestProfile | None: ...
    def upsert(self, profile: GuestProfile) -> None: ...
    def delete(self, guest_id: str) -> bool: ...
    def list_ids(self, limit: int = 500) -> list[str]: ...


class JSONFileStore:
    """JSON-file store with single-process locking."""

    def __init__(self, path: str) -> None:
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        if not self._path.exists():
            self._path.write_text("{}", encoding="utf-8")
        self._lock = threading.RLock()

    def _load(self) -> dict:
        return json.loads(self._path.read_text(encoding="utf-8") or "{}")

    def _save(self, data: dict) -> None:
        tmp = self._path.with_suffix(self._path.suffix + ".tmp")
        tmp.write_text(
            json.dumps(data, default=str, indent=2),
            encoding="utf-8",
        )
        os.replace(tmp, self._path)

    def get(self, guest_id: str) -> GuestProfile | None:
        with self._lock:
            data = self._load()
            raw = data.get(guest_id)
            return GuestProfile.model_validate(raw) if raw else None

    def upsert(self, profile: GuestProfile) -> None:
        with self._lock:
            data = self._load()
            data[profile.guest_id] = profile.model_dump(mode="json")
            self._save(data)

    def delete(self, guest_id: str) -> bool:
        with self._lock:
            data = self._load()
            if guest_id not in data:
                return False
            del data[guest_id]
            self._save(data)
            return True

    def list_ids(self, limit: int = 500) -> list[str]:
        with self._lock:
            data = self._load()
            return list(data.keys())[:limit]


class PostgresStore:
    """Postgres-backed memory store."""

    _DDL = """
    CREATE TABLE IF NOT EXISTS guest_profiles (
        guest_id   TEXT PRIMARY KEY,
        payload    JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """

    def __init__(self, dsn: str) -> None:
        try:
            import psycopg
            from psycopg_pool import ConnectionPool
        except ImportError as e:  # pragma: no cover
            raise RuntimeError(
                "PostgresStore requires `psycopg[binary]` and "
                "`psycopg_pool`. Install via "
                "`pip install psycopg[binary] psycopg_pool`."
            ) from e

        self._psycopg = psycopg
        self._pool = ConnectionPool(dsn, min_size=1, max_size=10, open=True)
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(self._DDL)
            conn.commit()
        log.info("postgres_store_ready")

    def get(self, guest_id: str) -> GuestProfile | None:
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT payload FROM guest_profiles WHERE guest_id = %s",
                (guest_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            payload = row[0]
            if isinstance(payload, str):
                payload = json.loads(payload)
            return GuestProfile.model_validate(payload)

    def upsert(self, profile: GuestProfile) -> None:
        payload = profile.model_dump(mode="json")
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO guest_profiles (guest_id, payload, updated_at)
                VALUES (%s, %s::jsonb, now())
                ON CONFLICT (guest_id) DO UPDATE
                  SET payload = EXCLUDED.payload,
                      updated_at = now()
                """,
                (profile.guest_id, json.dumps(payload, default=str)),
            )
            conn.commit()

    def delete(self, guest_id: str) -> bool:
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "DELETE FROM guest_profiles WHERE guest_id = %s",
                (guest_id,),
            )
            removed = cur.rowcount > 0
            conn.commit()
            return removed

    def list_ids(self, limit: int = 500) -> list[str]:
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT guest_id FROM guest_profiles ORDER BY updated_at DESC LIMIT %s",
                (limit,),
            )
            return [row[0] for row in cur.fetchall()]


def build_store(database_url: str, json_path: str) -> MemoryStore:
    """Pick a store implementation based on config."""
    if database_url:
        log.info("memory_store_postgres", extra={"dsn_set": True})
        return PostgresStore(database_url)
    log.info("memory_store_json_file", extra={"path": json_path})
    return JSONFileStore(json_path)

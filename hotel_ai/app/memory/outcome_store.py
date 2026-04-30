"""
Persistence for OutcomeRecord — the operational telemetry log.

Two backends, mirroring `MemoryStore`:
  - JSONFileOutcomeStore — single-process, file-backed. Good for dev / MVP.
  - PostgresOutcomeStore  — multi-process safe. Used when DATABASE_URL is set.

Why a separate store from GuestMemory?
--------------------------------------
- Different access patterns: outcomes are append-mostly + range-scanned by
  date for aggregation; guest memory is point-lookup by guest_id.
- Different retention: outcomes can live longer (12+ months for
  benchmarking); guest data has stricter privacy retention.
- Different sensitivity: outcomes contain no PII beyond IDs, so they're
  safer to share with analytics/BI.

Concurrency
-----------
JSONFileOutcomeStore uses a `threading.RLock` for in-process safety.
For multi-worker deploys, switch to Postgres via `DATABASE_URL`.

Atomicity
---------
We write via temp-file-and-rename so a crashed write never leaves a
torn JSON file.
"""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable, Optional, Protocol

from app.models.outcome import OutcomeRecord
from app.utils.logging import get_logger

log = get_logger(__name__)


class OutcomeStore(Protocol):
    def upsert(self, record: OutcomeRecord) -> None: ...
    def get(self, task_id: str) -> Optional[OutcomeRecord]: ...
    def list_in_range(
        self,
        start: datetime,
        end: datetime,
        property_id: Optional[str] = None,
    ) -> list[OutcomeRecord]: ...


# --- JSON file store ---------------------------------------------------------


class JSONFileOutcomeStore:
    """File-backed outcome store. Single-process only.

    Stores records keyed by `task_id`. We index by task_id (not the
    record's own `id`) because the orchestrator and the staff app both
    want to look up "what's the outcome record for task X" — that's the
    natural key.
    """

    def __init__(self, path: str) -> None:
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        if not self._path.exists():
            self._path.write_text("{}", encoding="utf-8")
        self._lock = threading.RLock()

    def _load(self) -> dict[str, dict]:
        try:
            return json.loads(self._path.read_text(encoding="utf-8") or "{}")
        except json.JSONDecodeError:
            log.error("outcome_store_corrupt", extra={"path": str(self._path)})
            return {}

    def _save(self, data: dict) -> None:
        tmp = self._path.with_suffix(self._path.suffix + ".tmp")
        tmp.write_text(
            json.dumps(data, default=str, indent=2),
            encoding="utf-8",
        )
        os.replace(tmp, self._path)

    def upsert(self, record: OutcomeRecord) -> None:
        with self._lock:
            data = self._load()
            data[record.task_id] = record.model_dump(mode="json")
            self._save(data)

    def get(self, task_id: str) -> Optional[OutcomeRecord]:
        with self._lock:
            data = self._load()
            raw = data.get(task_id)
            return OutcomeRecord.model_validate(raw) if raw else None

    def list_in_range(
        self,
        start: datetime,
        end: datetime,
        property_id: Optional[str] = None,
    ) -> list[OutcomeRecord]:
        """Return all records whose `created_at` falls in [start, end).

        Records are returned in creation order. `property_id=None`
        means "all properties" (single-tenant dev mode).

        Note: this scans the whole file. Fine at MVP scale (~tens of
        thousands of records); switch to PostgresOutcomeStore before
        that becomes a real concern.
        """
        with self._lock:
            data = self._load()
        out: list[OutcomeRecord] = []
        for raw in data.values():
            try:
                rec = OutcomeRecord.model_validate(raw)
            except Exception as e:  # noqa: BLE001
                log.warning("outcome_record_invalid", extra={"error": str(e)})
                continue
            # Ensure the timestamp is timezone-aware for comparison.
            ts = rec.created_at
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if not (start <= ts < end):
                continue
            if property_id is not None and rec.property_id != property_id:
                continue
            out.append(rec)
        out.sort(key=lambda r: r.created_at)
        return out


# --- Postgres store ----------------------------------------------------------
#
# Activated when DATABASE_URL is set. Schema auto-creates on first
# connection. The data layout mirrors the JSON store: one row per
# task_id, with the full record stored as JSONB so we can evolve fields
# without painful migrations during MVP.
#
# Indexed on (created_at, property_id) for the typical range query.


class PostgresOutcomeStore:
    """Postgres-backed outcome store."""

    _DDL = """
    CREATE TABLE IF NOT EXISTS outcome_records (
        task_id     TEXT PRIMARY KEY,
        property_id TEXT NOT NULL DEFAULT 'default',
        created_at  TIMESTAMPTZ NOT NULL,
        payload     JSONB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_outcome_records_created_at
        ON outcome_records (created_at);
    CREATE INDEX IF NOT EXISTS idx_outcome_records_property_created
        ON outcome_records (property_id, created_at);
    """

    def __init__(self, dsn: str) -> None:
        try:
            import psycopg
            from psycopg_pool import ConnectionPool
        except ImportError as e:  # pragma: no cover
            raise RuntimeError(
                "PostgresOutcomeStore requires `psycopg[binary]` and "
                "`psycopg_pool`. Install via "
                "`pip install psycopg[binary] psycopg_pool`."
            ) from e

        self._psycopg = psycopg
        self._pool = ConnectionPool(dsn, min_size=1, max_size=10, open=True)
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(self._DDL)
            conn.commit()
        log.info("postgres_outcome_store_ready")

    def upsert(self, record: OutcomeRecord) -> None:
        payload = record.model_dump(mode="json")
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO outcome_records
                  (task_id, property_id, created_at, payload)
                VALUES
                  (%s, %s, %s, %s::jsonb)
                ON CONFLICT (task_id) DO UPDATE
                  SET payload = EXCLUDED.payload
                """,
                (
                    record.task_id,
                    record.property_id,
                    record.created_at,
                    json.dumps(payload, default=str),
                ),
            )
            conn.commit()

    def get(self, task_id: str) -> Optional[OutcomeRecord]:
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT payload FROM outcome_records WHERE task_id = %s",
                (task_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            payload = row[0]
            if isinstance(payload, str):
                payload = json.loads(payload)
            return OutcomeRecord.model_validate(payload)

    def list_in_range(
        self,
        start: datetime,
        end: datetime,
        property_id: Optional[str] = None,
    ) -> list[OutcomeRecord]:
        with self._pool.connection() as conn, conn.cursor() as cur:
            if property_id is None:
                cur.execute(
                    """
                    SELECT payload FROM outcome_records
                    WHERE created_at >= %s AND created_at < %s
                    ORDER BY created_at ASC
                    """,
                    (start, end),
                )
            else:
                cur.execute(
                    """
                    SELECT payload FROM outcome_records
                    WHERE created_at >= %s AND created_at < %s
                      AND property_id = %s
                    ORDER BY created_at ASC
                    """,
                    (start, end, property_id),
                )
            out: list[OutcomeRecord] = []
            for (payload,) in cur.fetchall():
                if isinstance(payload, str):
                    payload = json.loads(payload)
                out.append(OutcomeRecord.model_validate(payload))
            return out


# --- factory -----------------------------------------------------------------


def build_outcome_store(database_url: str, json_path: str) -> OutcomeStore:
    """Pick a store backend based on config.

    Postgres wins when DATABASE_URL is set; falls back to JSON file
    otherwise. Same selection logic as `build_store` for guest memory.
    """
    if database_url:
        log.info("outcome_store_postgres", extra={"dsn_set": True})
        return PostgresOutcomeStore(database_url)
    log.info("outcome_store_json_file", extra={"path": json_path})
    return JSONFileOutcomeStore(json_path)

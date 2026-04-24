"""
Memory persistence.

We start with a file-backed JSON store so we can ship the MVP without
waiting for the backend's DB schema. The `MemoryStore` protocol means we
can later drop in a Postgres / Redis / DynamoDB implementation without
touching agents.

Safety notes
------------
- This file only contains projections of the PMS/CRM record — never the
  source of truth. The backend team's DB is authoritative.
- Accessibility and emergency fields are PII. When you swap in a real
  store, encrypt at rest and restrict access at the network layer.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Protocol

from app.models.guest import GuestProfile


class MemoryStore(Protocol):
    def get(self, guest_id: str) -> GuestProfile | None: ...
    def upsert(self, profile: GuestProfile) -> None: ...


class JSONFileStore:
    """Simple JSON-file store. Fine for dev and single-process deploys."""

    def __init__(self, path: str) -> None:
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        if not self._path.exists():
            self._path.write_text("{}", encoding="utf-8")

    def _load(self) -> dict:
        return json.loads(self._path.read_text(encoding="utf-8") or "{}")

    def _save(self, data: dict) -> None:
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, default=str, indent=2), encoding="utf-8")
        os.replace(tmp, self._path)

    def get(self, guest_id: str) -> GuestProfile | None:
        data = self._load()
        raw = data.get(guest_id)
        return GuestProfile.model_validate(raw) if raw else None

    def upsert(self, profile: GuestProfile) -> None:
        data = self._load()
        data[profile.guest_id] = profile.model_dump(mode="json")
        self._save(data)

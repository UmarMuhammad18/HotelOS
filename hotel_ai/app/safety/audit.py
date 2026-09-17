"""Append-only emergency audit log.

Every hard emergency and orchestrator-detected emergency is recorded
so GMs / security can review the trail. JSONL file by default; swap
to a SIEM sink later without changing call sites.
"""

from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.utils.logging import get_logger

log = get_logger(__name__)


class EmergencyAuditLog:
    def __init__(self, path: str = "./data/emergency_audit.jsonl") -> None:
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def record(
        self,
        *,
        guest_id: str | None,
        source: str,
        text: str,
        severity: str,
        plan_id: str | None = None,
        departments: list[str] | None = None,
        extra: dict[str, Any] | None = None,
    ) -> str:
        entry_id = str(uuid4())
        entry = {
            "id": entry_id,
            "ts": datetime.now(timezone.utc).isoformat(),
            "guest_id": guest_id,
            "source": source,
            "text": (text or "")[:500],
            "severity": severity,
            "plan_id": plan_id,
            "departments": departments or [],
            **(extra or {}),
        }
        line = json.dumps(entry, default=str) + "\n"
        with self._lock:
            with self._path.open("a", encoding="utf-8") as f:
                f.write(line)
        log.info(
            "emergency_audit",
            extra={"audit_id": entry_id, "severity": severity, "source": source},
        )
        return entry_id

    def recent(self, limit: int = 50) -> list[dict[str, Any]]:
        if not self._path.exists():
            return []
        with self._lock:
            lines = self._path.read_text(encoding="utf-8").splitlines()
        out: list[dict[str, Any]] = []
        for line in lines[-limit:]:
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return list(reversed(out))

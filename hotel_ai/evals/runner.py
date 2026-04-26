"""
Eval runner — load YAML fixtures, drive the orchestrator end-to-end against
a real LLM, score every assertion, and emit human + machine reports.

Each *case* gets its own fresh Orchestrator + GuestMemory backed by a temp
JSON file, so memory state never leaks between cases. Within a case, multiple
events DO share memory — that's the point of multi-event cases (e.g. "the
second AC complaint should be priority bumped because of the first one").

Real-LLM-only mode by design: we want to catch the kind of drift that
mocked LLMs can't see (Spanish 'Mantenimiento' vs English 'Housekeeping').
Set GROQ_API_KEY (or whatever the configured provider needs) before running.
"""

from __future__ import annotations

import json
import os
import time
import traceback
from dataclasses import asdict
from datetime import date
from pathlib import Path
from typing import Any

import yaml

from app.agents.orchestrator import Orchestrator
from app.llm.client import build_llm
from app.memory.guest_memory import GuestMemory
from app.memory.store import JSONFileStore
from app.models import (
    EventChannel,
    GuestProfile,
    HotelEvent,
    StayContext,
)

from evals.scoring import CaseResult, check


def _load_yaml(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def _build_stay(case: dict[str, Any]) -> StayContext:
    today = date.today()
    guest = GuestProfile(
        guest_id=case.get("guest_id", "g-eval"),
        full_name=case.get("guest_name", "Eval Guest"),
        language=case.get("guest_language", "en"),
        vip=bool(case.get("vip", False)),
    )
    return StayContext(
        guest=guest,
        room_number=str(case.get("room_number", "412")),
        check_in=today,
        check_out=today,
        reservation_id=case.get("reservation_id", "r-eval"),
    )


def _build_event(stay: StayContext, ev: dict[str, Any]) -> HotelEvent:
    channel_raw = ev.get("channel", "guest_chat")
    try:
        channel = EventChannel(channel_raw)
    except Exception:
        channel = EventChannel.GUEST_CHAT
    return HotelEvent(
        channel=channel,
        reservation_id=stay.reservation_id,
        room_number=stay.room_number,
        guest_id=stay.guest.guest_id,
        text=ev.get("text", ""),
    )


def run_fixture_file(
    path: Path,
    tmp_dir: Path,
    *,
    llm: Any | None = None,
) -> list[CaseResult]:
    """Run every case in one fixture file. `llm` is reused across cases to
    save on client construction; memory is reset per case."""
    spec = _load_yaml(path)
    cases = spec.get("cases") or []
    fixture_name = path.stem

    if llm is None:
        llm = build_llm()

    results: list[CaseResult] = []

    for case in cases:
        case_id = case.get("id", "<unnamed>")
        description = case.get("description", "")
        result = CaseResult(
            fixture=fixture_name,
            case_id=case_id,
            description=description,
        )

        # Per-case isolated memory — no leakage between cases.
        store_path = tmp_dir / f"{fixture_name}_{case_id}.json"
        if store_path.exists():
            store_path.unlink()
        store = JSONFileStore(str(store_path))
        memory = GuestMemory(store)
        orch = Orchestrator(llm=llm, memory=memory)

        stay = _build_stay(case)
        events = case.get("events") or []
        if not events:
            result.error = "case has no events"
            results.append(result)
            continue

        plan = None
        try:
            for ev in events:
                event = _build_event(stay, ev)
                plan = orch.build_plan(event, stay)
                # Per-event expectations may exist on multi-event cases.
                if "expect" in ev:
                    result.checks.extend(check(ev["expect"], plan))
        except Exception as exc:  # noqa: BLE001 — never let one case kill the run
            result.error = f"{type(exc).__name__}: {exc}"
            tb = traceback.format_exc(limit=3)
            result.error += f"\n{tb}"
            results.append(result)
            continue

        # Top-level case expectations apply to the FINAL plan.
        if "expect" in case and plan is not None:
            result.checks.extend(check(case["expect"], plan))

        results.append(result)

    return results


def render_markdown(results_by_fixture: dict[str, list[CaseResult]]) -> str:
    lines: list[str] = []
    total_cases = 0
    total_checks = 0
    failed_cases = 0
    failed_checks = 0

    lines.append("# Eval report")
    lines.append("")

    for fixture, cases in results_by_fixture.items():
        lines.append(f"## {fixture}")
        lines.append("")
        for case in cases:
            total_cases += 1
            checks = case.checks
            total_checks += len(checks)
            case_failed_checks = [c for c in checks if not c.passed]
            failed_checks += len(case_failed_checks)
            status = "PASS" if case.passed else "FAIL"
            if not case.passed:
                failed_cases += 1
            header = f"### [{status}] {case.case_id} — {case.description}"
            lines.append(header)
            if case.error:
                lines.append("")
                lines.append("**Error:**")
                lines.append("```")
                lines.append(case.error.strip())
                lines.append("```")
            for c in checks:
                lines.append(c.line())
            lines.append("")
        lines.append("")

    summary = (
        f"**Totals**: {total_cases - failed_cases}/{total_cases} cases passed, "
        f"{total_checks - failed_checks}/{total_checks} checks passed."
    )
    # Insert summary right after the title for fast scanning.
    lines.insert(2, summary)
    lines.insert(3, "")
    return "\n".join(lines)


def render_json(results_by_fixture: dict[str, list[CaseResult]]) -> str:
    serialisable = {
        fixture: [
            {
                **asdict(case),
                "passed": case.passed,
            }
            for case in cases
        ]
        for fixture, cases in results_by_fixture.items()
    }
    return json.dumps(serialisable, indent=2, default=str)


def run_all(
    fixtures_dir: Path,
    tmp_dir: Path,
    *,
    llm: Any | None = None,
) -> dict[str, list[CaseResult]]:
    fixtures = sorted(fixtures_dir.glob("*.yaml"))
    if llm is None:
        llm = build_llm()
    out: dict[str, list[CaseResult]] = {}
    for fp in fixtures:
        t0 = time.time()
        out[fp.stem] = run_fixture_file(fp, tmp_dir, llm=llm)
        dt = time.time() - t0
        print(f"  {fp.name}: {len(out[fp.stem])} cases in {dt:.1f}s")
    return out

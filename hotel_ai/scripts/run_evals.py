"""
Entry point for the LLM eval suite.

Usage (from frontend/hotel_ai/):

    # All fixtures
    python scripts/run_evals.py

    # A single fixture
    python scripts/run_evals.py --fixture routing

    # Custom output paths
    python scripts/run_evals.py --out reports/evals.md --json-out reports/evals.json

Real-LLM mode is the only mode for now — set GROQ_API_KEY (or whatever your
configured provider in app/llm/client.py needs) before running. Each case
runs against a fresh GuestMemory backed by a temp JSON file, so memory state
never leaks between cases.

Exit code is 0 if every case passes, 1 otherwise — so this is CI-friendly.
"""

from __future__ import annotations

import argparse
import os
import sys
import tempfile
from pathlib import Path

# Allow running as `python scripts/run_evals.py` from project root.
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from evals.runner import render_json, render_markdown, run_all, run_fixture_file  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Run hotel_ai LLM evals.")
    parser.add_argument(
        "--fixtures-dir",
        type=Path,
        default=_ROOT / "evals" / "fixtures",
        help="Directory containing *.yaml fixtures.",
    )
    parser.add_argument(
        "--fixture",
        action="append",
        default=None,
        help="Run only this fixture name (without .yaml). May be repeated.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=_ROOT / "evals" / "report.md",
        help="Markdown report path.",
    )
    parser.add_argument(
        "--json-out",
        type=Path,
        default=_ROOT / "evals" / "report.json",
        help="JSON report path.",
    )
    args = parser.parse_args()

    if not args.fixtures_dir.exists():
        print(f"Fixtures dir not found: {args.fixtures_dir}", file=sys.stderr)
        return 2

    # Quick sanity check — fail fast if the LLM isn't configured.
    if not (os.getenv("GROQ_API_KEY") or os.getenv("ANTHROPIC_API_KEY") or os.getenv("GEMINI_API_KEY")):
        print(
            "WARNING: No LLM API key detected in env (GROQ_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY).",
            file=sys.stderr,
        )
        print("Continuing — build_llm() may use a default provider, but expect failures otherwise.", file=sys.stderr)

    with tempfile.TemporaryDirectory(prefix="hotel_ai_evals_") as tmp:
        tmp_dir = Path(tmp)
        if args.fixture:
            results: dict = {}
            for name in args.fixture:
                path = args.fixtures_dir / f"{name}.yaml"
                if not path.exists():
                    print(f"Fixture not found: {path}", file=sys.stderr)
                    return 2
                print(f"Running {path.name}...")
                results[path.stem] = run_fixture_file(path, tmp_dir)
        else:
            print(f"Running all fixtures in {args.fixtures_dir}...")
            results = run_all(args.fixtures_dir, tmp_dir)

    md = render_markdown(results)
    js = render_json(results)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(md, encoding="utf-8")
    args.json_out.parent.mkdir(parents=True, exist_ok=True)
    args.json_out.write_text(js, encoding="utf-8")

    # Console summary
    total_cases = 0
    failed_cases = 0
    total_checks = 0
    failed_checks = 0
    for cases in results.values():
        for case in cases:
            total_cases += 1
            if not case.passed:
                failed_cases += 1
            total_checks += len(case.checks)
            failed_checks += sum(1 for c in case.checks if not c.passed)

    passed_cases = total_cases - failed_cases
    passed_checks = total_checks - failed_checks
    print()
    print(f"Cases:  {passed_cases}/{total_cases} passed")
    print(f"Checks: {passed_checks}/{total_checks} passed")
    print(f"Markdown report: {args.out}")
    print(f"JSON report:     {args.json_out}")

    return 0 if failed_cases == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

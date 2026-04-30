# Changelog

## 0.5.0 — outcome telemetry + metrics

The single most-asked-for feature when selling hotel-tech AI: **measurable
proof it helped.** This release adds an append-only telemetry log of
every task lifecycle, plus a metrics layer that turns it into the
numbers a GM cares about.

What hoteliers can now ask the service:

- "How many tasks did you handle this week?"
- "What's our median time-to-resolution per department?"
- "How many emergencies, and how fast did we acknowledge them?"
- "How many likely complaints did we catch via repeat-issue detection?"
- "How many requests resolved without staff follow-up?"
- "How many staff-hours did the AI save?" (with transparent assumptions)
- "Which intents and which languages dominate our request mix?"

### Added

- **`OutcomeRecord`** model — one record per task lifecycle, with the
  four lifecycle timestamps (created, in_progress, completed,
  cancelled), the policy/safety flags that fired (emergency, abuse,
  repeat_count, accessibility, quiet_hours_deferred), and computed
  latency properties.
  *Files: `app/models/outcome.py`.*
- **`OutcomeStore`** Protocol with two implementations:
  - `JSONFileOutcomeStore` — single-process, file-backed, atomic writes
  - `PostgresOutcomeStore` — multi-process safe, indexed on
    `(property_id, created_at)` for fast range queries
  Both behind a `build_outcome_store(database_url, json_path)` factory.
  *Files: `app/memory/outcome_store.py`.*
- **`OutcomeRecorder`** service — the single point of write for
  telemetry. Called from the orchestrator after `build_plan` and from
  `/v1/tasks/status` on transitions. Defensive: a recorder failure
  never breaks event handling.
  *Files: `app/services/outcome_recorder.py`.*
- **`metrics.py`** — pure functions over `list[OutcomeRecord]`. No
  I/O, no globals. Computes totals, per-department latency stats
  (median + p95), safety counts, and a transparent staff-hours-saved
  estimate (with assumption block surfaced in the response).
  *Files: `app/services/metrics.py`.*
- **`GET /v1/metrics/period`** — returns structured metrics for a
  rolling N-day window. Bound at 365 days. Supports `property_id`
  filter for multi-property portfolios.
- **`GET /v1/metrics/digest`** — same metrics plus a deterministic
  human-readable digest, ready to drop into a weekly email.
- **`property_id`** on every outcome record (defaults to `"default"`).
  Configurable via the `PROPERTY_ID` env var. Lays the foundation for
  the multi-property work coming next.

### Changed

- `Orchestrator.__init__` now accepts an optional `outcome_recorder`
  and a `property_id`. Both have safe defaults so existing
  callers/tests keep working unchanged.
- `/v1/tasks/status` now writes an outcome status transition. If the
  staff `note` contains "no followup" / "no follow-up" / "ai resolved",
  we mark the record as `needed_staff_followup=False` so it counts
  toward saved-time metrics.
- `Settings` gained `outcome_store_path` (default
  `./data/outcomes.json`) and `property_id` (default `"default"`).
- `main.py` wires `build_outcome_store` and `OutcomeRecorder` and
  injects them via dependency overrides.
- Service version bumped to `0.5.0`.

### Tests

- `tests/test_outcome_store.py` — store CRUD, range filtering,
  property filter, ordering, corrupt-file recovery (8 tests)
- `tests/test_outcome_recorder.py` — every flag captured correctly,
  status transitions idempotent, telemetry failures isolated (12 tests)
- `tests/test_metrics.py` — latency stats, totals, safety, no-followup
  rules, saved-time heuristic, digest rendering (~17 tests)
- `tests/test_outcome_integration.py` — end-to-end: orchestrator emits
  records, recorder updates them on `/tasks/status`, metrics aggregate
  correctly. Also pins that the orchestrator works WITHOUT a recorder
  (telemetry is opt-in). (5 tests)

### Why this matters commercially

Every hotel AI demo ends with "show me ROI." Most competitors hand-wave.
With this release the service can answer the question directly with
data the customer can verify. The saved-time heuristic is conservative
and surfaces its assumptions in the API response so the customer can
recalibrate it without us — an honesty signal that's rare in the space.

### Migration notes

- **No breaking changes** for existing API clients.
- **New endpoints:** `GET /v1/metrics/period`, `GET /v1/metrics/digest`.
- **Existing endpoint:** `/v1/tasks/status` now optionally inspects
  `note` for the no-followup signal. Older clients that omit the
  field still work; their completions just don't count toward the
  saved-time metric until they start sending it.
- **New env var (optional):** `OUTCOME_STORE_PATH` (default
  `./data/outcomes.json`), `PROPERTY_ID` (default `"default"`).
- **Postgres users:** the `outcome_records` table auto-creates on
  first connection (same DDL pattern as `guest_profiles`).

### Not yet (future releases)

- **Predictive operations** — proactive recommendations based on
  patterns in OutcomeRecord history (e.g. preventive maintenance
  scheduling).
- **Confidence-aware routing** — surface LLM confidence on each
  classification so low-confidence cases go to human triage.
- **A/B test harness** — `prompt_version` field on records to compare
  prompt variants on real traffic.
- **Real moderation pipeline** — Perspective/OpenAI moderation API
  primary, regex fallback, audit trail per event.

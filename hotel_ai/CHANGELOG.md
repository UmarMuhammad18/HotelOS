# Changelog

## 0.4.0 — review fixes + production hardening + Option C features

This release rolls up everything: the safe fixes from the original
review, several production-readiness improvements, and a set of
hospitality-specific features.

### Option A — Safe fixes

- **Auth header parsing.** `require_auth` now does case-insensitive
  scheme matching (`"Bearer"`, `"bearer"`, `"BEARER"` all valid) and
  uses `hmac.compare_digest` for the token comparison so a brute-force
  attacker can't recover the secret via response timing. Tokens with
  surrounding whitespace are tolerated.
  *Files: `app/api/routes.py`, `tests/test_auth.py`.*
- **UTC-aware datetimes.** Replaced every `datetime.utcnow()` (deprecated
  in 3.12+, returns naive timestamps) with `datetime.now(timezone.utc)`.
  Cross-service comparisons are now unambiguous.
  *Files: `app/models/{guest,task,event,plan,notification}.py`,
  `app/memory/guest_memory.py`.*
- **Thread-safe JSON store.** `JSONFileStore` uses a `threading.RLock`
  to serialise read-modify-write cycles. Two simultaneous
  `record_request` calls within one process can no longer lose each
  other's mutations. Multi-process deploys should use the new
  `PostgresStore` (see Option B).
  *Files: `app/memory/store.py`, `tests/test_memory_store.py`.*
- **Idempotency keys.** `/v1/events` and `/v1/emergency` accept an
  optional `Idempotency-Key` header. Retries within 5 minutes return
  the cached Plan instead of re-running the orchestrator.
  *Files: `app/utils/idempotency.py`, `app/api/routes.py`,
  `tests/test_idempotency.py`.*
- **Non-blocking event loop.** Routes dispatch the synchronous
  orchestrator via `asyncio.to_thread`, so the FastAPI event loop is
  never blocked by an LLM round-trip. Many requests can be in flight
  per worker.
  *Files: `app/api/routes.py`.*
- **Single-pass translation.** Translation now happens once, inside
  each agent, via `localized_reply`. The previous orchestrator-layer
  translate pass has been removed. Cost ~halves for non-English guests.
  *Files: `app/agents/localize.py`, `app/agents/base.py`, every agent.*
- **Accessibility-aware routing outside emergencies.** When a guest
  with registered accessibility needs reports an access-relevant
  event (broken elevator, evacuation drill, room change) at HIGH or
  URGENT priority, the Accessibility agent is now added to the
  routing automatically. Previously this only fired during hard
  emergencies.
  *Files: `app/agents/orchestrator.py`, `tests/test_orchestrator.py`.*
- **Expanded emergency keyword regex.** Now matches `choking`,
  `overdose|overdosed|overdosing` (verb forms), `allergic reaction`,
  `anaphylactic`, `intruder`, `attacked`, `assault`, `threat`,
  `flooding`, `panic`, `sos`, `burning`, and "stuck in the/a/my
  elevator|lift" (allowing filler words). Negative cases like
  "Can you turn on the lift announcements?" still pass through.
  *Files: `app/agents/orchestrator.py`, `tests/test_orchestrator.py`.*
- **`SecurityAgent` produces a guest reply** for non-emergency routing
  (e.g. report of suspicious person), so the guest isn't left with
  silence on chat. Hard emergencies still skip chat — voice and
  in-person are the right channels.
  *Files: `app/agents/security.py`.*
- **LAUNDRY and VALET are no longer silently dropped.** They piggyback
  on Housekeeping / Concierge handlers in the orchestrator's agent
  registry. Pinned by `test_laundry_routes_via_housekeeping`.
- **Hallucinated department codes are filtered.** `DepartmentAction`
  has a validator that drops invalid `requires_coordination_with`
  entries before they reach Pydantic enum coercion. The orchestrator
  also drops top-level actions whose `department` isn't in
  `ALLOWED_LLM_DEPARTMENTS`.
- **Memory writes are intent-tagged + timestamped.** Past requests
  are now stored as `"<intent>|<utc_iso_timestamp>|<summary[:120]>"`
  so future prompts can distinguish triaged from un-triaged history,
  and the orchestrator can do time-windowed queries (used by the new
  repeat-issue feature) without an extra events table.
- **`FakeLLM` deep-copies its canned response** to prevent test
  fixtures being mutated through repeated calls.
- **Groq default model upgraded** from `llama-3.1-8b-instant` to
  `llama-3.3-70b-versatile` for classification reliability. Override
  via `LLM_MODEL` env var.

### Option B — Production-readiness

- **`/v1/health/deep` endpoint.** Actually pings the LLM provider, so
  load balancers can fail over when the LLM is unreachable. Auth-
  required because pinging providers costs money.
  *Files: `app/api/routes.py`, `app/llm/client.py` (added `ping()` to
  every provider).*
- **`/v1/guests/{guest_id}` DELETE endpoint** (GDPR right-to-erasure).
  Requires `?confirm=true` so a stray DELETE doesn't wipe data. Backed
  by `MemoryStore.delete` and `GuestMemory.forget`.
  *Files: `app/api/routes.py`, `app/memory/store.py`,
  `app/memory/guest_memory.py`.*
- **Per-IP rate limiter on `/v1/events`.** Sliding-window, in-memory.
  Configure with `RATE_LIMIT_PER_MINUTE` (0 disables). Honours
  `X-Forwarded-For` for the original client IP.
  *Files: `app/utils/rate_limit.py`, `app/api/routes.py`,
  `tests/test_rate_limit.py`.*
- **PostgresStore.** Multi-process-safe alternative to `JSONFileStore`.
  Activates when `DATABASE_URL` is set. Schema auto-creates on first
  connection. Same `MemoryStore` Protocol — agents don't change.
  *Files: `app/memory/store.py`, `requirements-postgres.txt`.*
- **Three new department agents:** `SpaAgent`, `ReservationsAgent`,
  `RevenueAgent`. They're now real handlers instead of being silently
  dropped. Revenue priority is hard-capped at NORMAL so an excited
  LLM can't escalate an upsell offer above a real service request.
  *Files: `app/agents/{spa,reservations,revenue}.py`,
  `tests/test_orchestrator.py`.*

### Option C — Hospitality features

- **Repeat-issue detection.** `GuestMemory.count_recent_intents`
  counts prior reports of the same intent in a configurable window
  (default 24h, threshold 2). When triggered, the orchestrator bumps
  priority one step and adds Guest Relations to the routing.
  *Files: `app/memory/guest_memory.py`, `app/agents/orchestrator.py`,
  `tests/test_orchestrator.py`.*
- **Profanity / abuse handling.** A conservative regex catches direct
  slurs and threats; the orchestrator routes those events to Security
  (with a marker in details) and Guest Relations, while the Security
  agent emits a deliberately calm, de-escalating reply rather than
  letting the LLM generate a snappy comeback.
  *Files: `app/agents/orchestrator.py`, `app/agents/security.py`,
  `tests/test_orchestrator.py`.*
- **Quiet-hours awareness.** Between configured hours (default 22:00 →
  07:00 hotel-local), routine non-urgent work in deferrable
  departments (housekeeping, laundry, spa, revenue) is demoted to
  LOW priority. Emergencies, security, and maintenance always bypass.
  Hotel timezone is configurable per-stay (`StayContext.hotel_timezone`).
  *Files: `app/agents/orchestrator.py`, `app/models/guest.py`,
  `app/config.py`, `tests/test_orchestrator.py`.*
- **`/v1/stays/{reservation_id}/summary`.** Deterministic
  one-paragraph summary of what we know about a guest. Useful for
  next-visit prep. No LLM call — cheap and reproducible.
  *Files: `app/memory/guest_memory.py`, `app/api/routes.py`,
  `tests/test_stay_summary.py`.*
- **`/v1/webhooks/test`.** Round-trip test endpoint for Node→Python
  connectivity & auth. Echoes a payload value back so Node can
  confirm: URL is reachable, auth token correct, JSON round-trips.
  *Files: `app/api/routes.py`.*

### Internal

- Service version bumped to `0.4.0` in `main.py`.
- `MemoryStore` Protocol gained `delete`. `LLMClient` Protocol gained
  `ping`. `RetryingLLMClient` passes `ping` through to the inner
  client.
- Added `_now_utc` instance method on `Orchestrator` so quiet-hours
  tests can override the clock without monkey-patching modules.
- New tests:
  - `test_auth.py` — auth header edge cases
  - `test_idempotency.py` — TTL cache, concurrent puts
  - `test_memory_store.py` — concurrency, atomic writes, delete
  - `test_rate_limit.py` — sliding window, isolation, thread safety
  - `test_stay_summary.py` — deterministic output
- Substantially expanded `test_orchestrator.py`:
  - All 9 emergency phrases covered (positive + negative cases)
  - New agents (Spa, Reservations, Revenue)
  - Repeat-issue escalation
  - Abuse handling
  - Quiet hours (defer + don't-defer cases)
- Rewrote `test_multilingual_replies.py` against the new agent-layer
  translation pipeline.

### Migration notes

- **No breaking API changes** for clients calling `/v1/events`,
  `/v1/tasks/status`, `/v1/emergency`, `/v1/guests`, or
  `/v1/guests/{id}/memory`.
- **New optional headers:** `Idempotency-Key` on `/v1/events` and
  `/v1/emergency`. Send the same key for retry-safe behaviour.
- **New endpoints:** `DELETE /v1/guests/{id}?confirm=true`,
  `GET /v1/health/deep`, `GET /v1/stays/{id}/summary?guest_id=...`,
  `POST /v1/webhooks/test`.
- **Optional Postgres backend:** Set `DATABASE_URL` and install with
  `pip install -r requirements.txt -r requirements-postgres.txt`.
  The schema auto-creates on first run.

### Not done in this release (deliberately)

- Async LLM clients (full rewrite). The `asyncio.to_thread` pattern in
  routes is sufficient for current target load and avoids touching
  every agent.
- Vendor moderation API integration. The abuse keyword regex is the
  conservative deterministic backstop; wire Perspective API or OpenAI
  Moderation as the primary detector when ready, keeping the regex as
  a safety net.
- Redis-backed idempotency cache and rate limiter. Both are
  process-local; swap when scaling out replicas.

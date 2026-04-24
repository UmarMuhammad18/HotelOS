# Hotel AI — Implementation Roadmap

Phases are ordered so each one is shippable on its own. Don't skip phases.

## Phase 1 — MVP (week 1–2)

Goal: `/v1/events` turns a guest message into a routed task plus a guest ack.

- [x] Project scaffold (this repo).
- [x] Domain models (Event, Task, Notification, GuestProfile, StayContext).
- [x] Orchestrator + 8 department agents.
- [x] FakeLLM + AnthropicLLM wrapper.
- [x] In-memory TaskBus + NotificationService.
- [x] JSON-file guest memory.
- [x] FastAPI routes (`/events`, `/tasks/status`, `/emergency`, `/guests*`).
- [x] Orchestrator tests.
- [ ] CI: lint (ruff), type-check (mypy), tests (pytest) on every PR.
- [ ] Dockerfile for local parity.

## Phase 2 — Smarter routing (week 3)

- Few-shot examples in the classifier prompt, drawn from real past events.
- Include guest preferences + last 5 events in the classifier context.
- Sentiment handling: frustrated guests auto-copy guest_relations.
- Multi-step planning for coordinated requests.

## Phase 3 — Memory & learning (week 4)

- Replace `JSONFileStore` with Postgres-backed store.
- Nightly worker: summarise the day's events per guest into durable preferences (LLM in a controlled prompt writing through typed API).
- Proactive hooks on check-in: pre-create tasks from known preferences.
- Guest memory diff API so the frontend can show "we remembered: X".

## Phase 4 — Emergency & accessibility (week 5)

- Expand emergency regex to a small trained classifier; keep regex as a union.
- Panic-button integration (`/v1/emergency`) wired to real sensors via backend.
- Accessibility profile sourced from PMS accessibility field, not guest input.
- Audit log: every emergency event written to an append-only log store.
- Run-book for ops: what happens when the LLM is down during an emergency (answer: hard path still works, it doesn't call the LLM).

## Phase 5 — Production readiness (week 6+)

- Replace in-memory TaskBus with HTTP to the backend (`HTTPTaskBus`).
- Replace in-memory NotificationService with HTTP.
- Structured trace IDs end-to-end (request → task → notification).
- Rate limiting, request size limits, timeouts.
- Observability: metrics (router decisions per department, LLM latency, fallback rate), log redaction verification.
- Load test: sustained 50 RPS with p95 < 1.5s including LLM.
- Privacy review: retention, PII scope, logging.
- Runbook & on-call rotation.

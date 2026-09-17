# Hotel AI — Implementation Roadmap

Phases are ordered so each one is shippable on its own.

## Phase 1 — MVP ✅ (complete)

Goal: `/v1/events` turns a guest message into a routed task plus a guest ack.

- [x] Project scaffold
- [x] Domain models (Event, Task, Notification, GuestProfile, StayContext)
- [x] Orchestrator + department agents (11 agents)
- [x] FakeLLM + multi-provider LLM wrapper (Groq / Gemini / Anthropic)
- [x] In-memory TaskBus + NotificationService
- [x] JSON-file guest memory (+ Postgres option)
- [x] FastAPI routes (`/events`, `/tasks/status`, `/emergency`, `/guests*`, metrics)
- [x] Orchestrator + memory + outcome tests
- [x] **CI**: GitHub Actions (ruff + mypy + pytest)
- [x] **Dockerfile** for the AI service

## Phase 1.5 — Production hardening & hospitality features ✅ (v0.4 → v0.5)

- [x] Timing-safe auth, idempotency keys, rate limiting
- [x] GDPR delete endpoint
- [x] Deep health check
- [x] Outcome telemetry + metrics/digest endpoints (ROI story)
- [x] Repeat-issue detection
- [x] Quiet-hours awareness
- [x] Abuse / profanity handling
- [x] Multilingual single-pass translation
- [x] Accessibility-aware routing outside emergencies

## Phase 2 — Smarter routing ✅ (this release)

- [x] Few-shot examples in the classifier prompt (`app/agents/classify_prompt.py`)
- [x] Guest preferences + last 5 events already injected via `_build_context_block`
- [x] Sentiment handling: frustrated/distressed guests auto-route to Guest Relations
- [x] Confidence scores on classifications → `needs_human_triage` when confidence < 0.55
- [ ] Multi-step planning for highly coordinated requests (follow-up)

## Phase 3 — Memory & learning ✅ (this release)

- [x] Deterministic preference learner (`app/memory/preference_learner.py`)
- [x] `POST /v1/guests/{id}/memory/learn` — materialise prefs from history
- [x] `GET /v1/guests/{id}/memory/diff` — preview for "we remembered: X" UI
- [x] `GET /v1/guests/{id}/proactive-checkin` — pre-arrival task suggestions
- [x] `POST /v1/guests/{id}/stay-complete` — checkout: learn + final summary
- [ ] Nightly batch worker over all guests (call learn per guest via cron)

## Phase 4 — Emergency, moderation & accessibility polish

- [ ] Expand emergency detection (small classifier + regex union)
- [ ] Real moderation pipeline (Perspective / OpenAI Moderation primary, regex fallback)
- [ ] Panic-button / sensor integration via backend
- [ ] Audit log for every emergency event

## Phase 5 — Production scale & observability

- [ ] Replace in-memory TaskBus / NotificationService with HTTP to the backend
- [ ] Structured trace IDs end-to-end
- [ ] Redis-backed rate limiter + idempotency cache (for multi-replica)
- [ ] Metrics export (Prometheus / OpenTelemetry)
- [ ] Load test target: sustained 50 RPS with p95 < 1.5s including LLM

## Phase 6 — Product & frontend (future)

- [ ] Staff dashboard polish (AgentFeed, TaskBoard, live metrics)
- [ ] Metrics digest view in the admin UI
- [ ] Guest-facing memory / "we remembered" surfaces
- [ ] Mobile app improvements
- [ ] Predictive operations from OutcomeRecord patterns
- [ ] Voice channel (Whisper + TTS)
- [ ] PMS adapters (Opera, Mews, Cloudbeds, Apaleo)

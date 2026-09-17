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

## Phase 1.5 — Production hardening & hospitality features ✅

- [x] Timing-safe auth, idempotency keys, rate limiting
- [x] GDPR delete endpoint
- [x] Deep health check
- [x] Outcome telemetry + metrics/digest endpoints (ROI story)
- [x] Repeat-issue detection
- [x] Quiet-hours awareness
- [x] Abuse / profanity handling
- [x] Multilingual single-pass translation
- [x] Accessibility-aware routing outside emergencies

## Phase 2 — Smarter routing ✅

- [x] Few-shot examples in the classifier prompt
- [x] Guest preferences + last 5 events injected into context
- [x] Sentiment handling → Guest Relations
- [x] Confidence scores → `needs_human_triage`
- [x] Multi-step planning for coordinated multi-department requests

## Phase 3 — Memory & learning ✅

- [x] Deterministic preference learner
- [x] `POST /v1/guests/{id}/memory/learn`
- [x] `GET /v1/guests/{id}/memory/diff`
- [x] `GET /v1/guests/{id}/proactive-checkin`
- [x] `POST /v1/guests/{id}/stay-complete`
- [x] `POST /v1/jobs/batch-learn` — nightly batch over all guests

## Phase 4 — Emergency, moderation & accessibility polish ✅

- [x] Expanded emergency detection with severity tiers (`app/safety/emergency.py`)
- [x] Moderation pipeline — OpenAI Moderation when keyed, regex fallback
- [x] Panic / sensor hard path via `/v1/emergency` + audit trail
- [x] Append-only emergency audit log (`GET /v1/emergency/audit`)

## Phase 5 — Production scale & observability ✅ (hooks)

- [x] HTTP TaskBus / NotificationService already present; activate via `BACKEND_*_URL`
- [x] Structured `X-Trace-Id` middleware end-to-end
- [x] Redis-backed rate limiter when `REDIS_URL` is set (in-memory fallback)
- [x] Prometheus `/metrics` scrape endpoint
- [x] Load-test script: `scripts/load_test.py` (target 50 RPS / p95 < 1.5s with FakeLLM)

## Phase 6 — Product & frontend (next)

- [ ] Staff dashboard polish (AgentFeed, TaskBoard, live metrics)
- [ ] Metrics digest view in the admin UI
- [ ] Guest-facing memory / "we remembered" surfaces
- [ ] Mobile app improvements
- [ ] Predictive operations from OutcomeRecord patterns
- [ ] Voice channel (Whisper + TTS)
- [ ] PMS adapters (Opera, Mews, Cloudbeds, Apaleo)

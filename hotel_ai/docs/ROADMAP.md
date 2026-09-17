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

## Phase 2 — Smarter routing (next priority)

- [ ] Few-shot examples in the classifier prompt, drawn from real past events
- [ ] Include guest preferences + last 5 events in the classifier context
- [ ] Sentiment handling: frustrated guests auto-copy guest_relations
- [ ] Multi-step planning for coordinated requests
- [ ] Confidence scores on classifications → human triage queue for low confidence

## Phase 3 — Memory & learning

- [ ] Nightly worker: summarise the day's events per guest into durable preferences
- [ ] Proactive hooks on check-in: pre-create tasks from known preferences
- [ ] Guest memory diff API so the frontend can show "we remembered: X"
- [ ] Stay-complete summary (out-of-band)

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

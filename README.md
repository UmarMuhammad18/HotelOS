# HotelOS — Multi-Agent Hotel Operations AI

<div align="center">

**The hotel AI that proves its ROI.**

[![Tests](https://img.shields.io/badge/tests-148%20passing-2dcc70?style=flat-square)](https://github.com/UmarMuhammad18/HotelOS)
[![License](https://img.shields.io/badge/license-MIT-e8a020?style=flat-square)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.12-3178c6?style=flat-square)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square)](https://fastapi.tiangolo.com)

[**Live Demo →**](https://hotel-os-blond.vercel.app) · [API Docs](https://hotel-os-blond.vercel.app/docs) · [Slide Deck](#) · [Video Demo](#)

</div>

---

## What is HotelOS?

HotelOS is a production-grade multi-agent AI that handles hotel operations end-to-end — routing guest requests to the right department, escalating emergencies without LLM involvement, detecting repeat issues before they become complaints, and measuring its own impact so a GM can prove ROI on Monday morning.

**Most hotel AIs are a chatbot wrapper around GPT.** HotelOS is an orchestration layer with deterministic safety guarantees, institutional memory, multilingual support, and an outcome telemetry system that tracks every task lifecycle with four timestamps.

---

## The Problem We Solve

| Without HotelOS | With HotelOS |
|---|---|
| Guest requests routed manually | Classified and routed in <200ms |
| Same complaint handled fresh each shift | Repeat-issue detection escalates automatically |
| Emergency response depends on staff being awake | Deterministic safety net fires regardless of LLM |
| "Our AI helped" (no proof) | `/v1/metrics/digest` — auditable weekly report |
| One language supported | Multilingual replies, single LLM pass |

---

## Architecture

```
Guest Channels                    Orchestrator                    Department Agents
─────────────                     ────────────                    ─────────────────
💬 Chat        ─┐                 ┌─────────────────────┐        🛏  Front Desk
📱 Mobile App  ─┤                 │  1. LLM classify     │        🧹  Housekeeping
🔔 IoT Sensor  ─┼─→  HotelEvent →│  2. Policy rules     │→ →    🔧  Maintenance
📞 Voice       ─┤                 │  3. Fan-out          │        🍽  Food & Beverage
🌐 Web Portal  ─┘                 │  4. Memory update    │        🎯  Concierge
                                  │  5. Outcome record   │        🛡  Security
                                  └─────────────────────┘        ♿  Accessibility
                                                                  🛁  Spa
                                         ↓                       📅  Reservations
                                  ┌─────────────┐                💰  Revenue
                                  │ OutcomeStore│                ❤️  Guest Relations
                                  │ (telemetry) │
                                  └─────────────┘
                                         ↓
                                  GET /v1/metrics/digest
                                  → Weekly GM report
```

---

## Features

### 🧠 Intelligent Multi-Agent Routing
11 department agents + Laundry/Valet piggyback. Each agent produces a `PlanFragment` with events, tool calls, and a localized guest reply. The orchestrator merges them into a single `Plan` for Node to execute.

### 🔒 Deterministic Safety (LLM-Independent)
Safety doesn't depend on the model. Three deterministic layers run before any LLM output reaches production:

- **Emergency keywords** — 15+ patterns including `overdosing`, `stuck in the elevator`, `flooding`, `anaphylactic`. Fires security + front desk regardless of LLM classification.
- **Abuse handling** — Conservative regex catches direct threats. Routes to Security with a calm de-escalation reply (not an LLM-generated one).
- **Accessibility fan-out** — Wheelchair users and registered-disability guests always get an accessibility-trained responder, even outside emergencies.

### 🔁 Repeat-Issue Detection
Every intent is intent-tagged and timestamped in guest memory. When the same intent appears N times in a configurable window (default: 2× in 24h), priority bumps one level and Guest Relations is looped in automatically.

### 🌙 Quiet Hours Awareness
Between 22:00–07:00 (hotel-local timezone), routine requests from deferrable departments (Housekeeping, Laundry, Spa, Revenue) are demoted to LOW priority. Emergencies and maintenance always bypass.

### 🌍 Multilingual Replies
Translation happens once, at the agent layer, not in the orchestrator. Single LLM call per non-English guest. Falls back to English if translation fails. Covers any language the model supports.

### 📊 Outcome Telemetry
Every task gets an `OutcomeRecord` with four lifecycle timestamps (created → in_progress → completed → cancelled). The metrics layer aggregates:
- Median and p95 resolution time per department
- Emergency acknowledgement latency
- Repeat-issue catches, accessibility cases, abuse incidents
- Staff-hours saved (transparent heuristic, assumptions surfaced in API)
- No-followup completions (AI-only resolutions)

```bash
GET /v1/metrics/digest?days=7

{
  "digest": "Over the last 7 days, your AI handled 847 requests across 11 departments.\nEstimated staff time saved: ~23.1 hours (see breakdown for assumptions).\nSafety: 4 emergency events with a median 28s acknowledgement.\nCaught 12 repeat issues early — guest relations was looped in proactively.\n634 requests resolved without staff follow-up (75% of completed).",
  "metrics": { ... }
}
```

### 🏗 Production Hardening
- **Timing-safe auth** — `hmac.compare_digest`, case-insensitive Bearer
- **Idempotency keys** — `/v1/events` and `/v1/emergency` safe to retry
- **Rate limiting** — Per-IP sliding window, configurable
- **GDPR** — `DELETE /v1/guests/{id}?confirm=true` right-to-erasure
- **Deep health** — `GET /v1/health/deep` pings the LLM provider
- **Postgres** — Set `DATABASE_URL` to switch from JSON to Postgres automatically

---

## Quick Start

### Prerequisites
- Python 3.12+
- Node 18+
- A Groq API key (free tier works)

### 1. Clone and set up

```bash
git clone https://github.com/UmarMuhammad18/HotelOS
cd HotelOS/hotel_ai
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env — at minimum set LLM_PROVIDER=groq and GROQ_API_KEY=your_key
```

### 3. Run the AI service

```bash
uvicorn app.main:app --reload --port 8000
```

### 4. Test it

```bash
curl -X POST http://localhost:8000/v1/events \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "channel": "guest_chat",
      "reservation_id": "res_001",
      "room_number": "412",
      "guest_id": "guest_001",
      "text": "My AC is not cooling at all"
    },
    "stay": {
      "guest": { "guest_id": "guest_001", "full_name": "Ada Lovelace" },
      "room_number": "412",
      "check_in": "2026-04-26",
      "check_out": "2026-04-28",
      "reservation_id": "res_001"
    }
  }'
```

### 5. Run tests

```bash
pytest tests/ -v
# 148 tests, all passing
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/events` | Main entry — classify and route a guest event |
| `POST` | `/v1/emergency` | Hard emergency bypass — skips LLM classification |
| `POST` | `/v1/tasks/status` | Update task lifecycle + write outcome record |
| `GET`  | `/v1/guests/{id}/memory` | Fetch guest profile |
| `POST` | `/v1/guests` | Upsert guest profile |
| `DELETE` | `/v1/guests/{id}?confirm=true` | GDPR right-to-erasure |
| `GET`  | `/v1/stays/{id}/summary` | Deterministic guest summary |
| `GET`  | `/v1/metrics/period` | Structured metrics, rolling N-day window |
| `GET`  | `/v1/metrics/digest` | Human-readable weekly digest |
| `GET`  | `/v1/health` | Liveness check |
| `GET`  | `/v1/health/deep` | Deep check — pings LLM provider |
| `POST` | `/v1/webhooks/test` | Node→Python connectivity test |

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `groq` | `groq`, `gemini`, `anthropic`, or `fake` |
| `LLM_MODEL` | `llama-3.3-70b-versatile` | Model override |
| `GROQ_API_KEY` | — | Required for Groq |
| `INTERNAL_API_TOKEN` | — | Bearer token for auth (empty = dev mode) |
| `DATABASE_URL` | — | Postgres DSN — enables Postgres backend |
| `GUEST_MEMORY_PATH` | `./data/guest_memory.json` | JSON store path |
| `OUTCOME_STORE_PATH` | `./data/outcomes.json` | Outcome telemetry path |
| `PROPERTY_ID` | `default` | Tag for multi-property |
| `RATE_LIMIT_PER_MINUTE` | `60` | Per-IP rate limit (0 = disabled) |
| `REPEAT_ISSUE_THRESHOLD` | `2` | Reports before escalation |
| `REPEAT_ISSUE_WINDOW_HOURS` | `24` | Repeat-issue detection window |
| `QUIET_HOURS_START` | `22` | Quiet hours start (hotel-local) |
| `QUIET_HOURS_END` | `7` | Quiet hours end (hotel-local) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI Advisor | Python 3.12, FastAPI, Pydantic v2 |
| LLM Providers | Groq (default), Google Gemini, Anthropic |
| API Server | Node.js, Express, WebSocket |
| Staff Dashboard | React, Vercel |
| Mobile App | React Native (iOS + Android) |
| Memory | JSON file (dev) or Postgres (prod) |
| Testing | pytest, 148 tests |

---

## Roadmap

- [ ] **Predictive operations** — proactive recommendations from OutcomeRecord patterns
- [ ] **Voice channel** — Whisper STT + ElevenLabs TTS wired to `EventChannel.VOICE`
- [ ] **Multi-property** — per-property config, cross-property guest memory
- [ ] **Confidence-aware routing** — low-confidence events go to human triage queue
- [ ] **Real moderation pipeline** — Perspective API primary, regex fallback, audit log
- [ ] **PMS integrations** — Opera, Mews, Cloudbeds, Apaleo adapters

---

## Built at Encode Hackathon

HotelOS was built for the Encode Hackathon Agent Track. The Python AI service, all 11 agents, outcome telemetry system, and 148 tests were written in a single focused session.

**Live demo:** https://hotel-os-blond.vercel.app  
**GitHub:** https://github.com/UmarMuhammad18/HotelOS

---

<div align="center">
Made with care by
<a href="https://github.com/UmarMuhammad18">@UmarMuhammad18</a> ·
<a href="https://github.com/SudoJasper23">@SudoJasper23</a> ·
<a href="https://github.com/HIREN-BOSS">@HIREN-BOSS</a>
</div>
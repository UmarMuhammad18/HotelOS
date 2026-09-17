# HotelOS — Multi-Agent Hotel Operations AI

<div align="center">

**The hotel AI that proves its ROI.**

[![CI](https://github.com/UmarMuhammad18/HotelOS/actions/workflows/ci.yml/badge.svg)](https://github.com/UmarMuhammad18/HotelOS/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/python-3.12-3178c6?style=flat-square)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square)](https://fastapi.tiangolo.com)
[![License](https://img.shields.io/badge/license-MIT-e8a020?style=flat-square)](LICENSE)

[**Live Demo →**](https://hotel-os-blond.vercel.app) · [API Docs](https://hotel-os-blond.vercel.app/docs)

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
11 department agents + Laundry/Valet piggyback. Each agent produces a `PlanFragment` with events, tool calls, and a localized guest reply. The orchestrator merges them into a single `Plan` for the backend to execute.

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
Translation happens once, at the agent layer. Single LLM call per non-English guest. Falls back to English if translation fails.

### 📊 Outcome Telemetry (the ROI proof)
Every task gets an `OutcomeRecord` with four lifecycle timestamps. The metrics layer aggregates median/p95 resolution times, emergency latency, repeat-issue catches, staff-hours saved (transparent heuristic), and more.

```bash
GET /v1/metrics/digest?days=7
```

### 🏗 Production Hardening
- Timing-safe auth (`hmac.compare_digest`)
- Idempotency keys on `/v1/events` and `/v1/emergency`
- Per-IP rate limiting
- GDPR right-to-erasure
- Deep health check that pings the LLM provider
- JSON or Postgres storage (auto-selected via `DATABASE_URL`)

---

## Quick Start

### Option A — Local (Python)

```bash
git clone https://github.com/UmarMuhammad18/HotelOS
cd HotelOS/hotel_ai
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # set GROQ_API_KEY or LLM_PROVIDER=fake
uvicorn app.main:app --reload --port 8000
```

### Option B — Docker

```bash
cd hotel_ai
docker build -t hotel-ai .
docker run --rm -p 8000:8000 --env-file .env hotel-ai
```

Then open http://localhost:8000/docs

### Run the tests

```bash
cd hotel_ai
pip install -r requirements.txt -r requirements-dev.txt
LLM_PROVIDER=fake pytest tests/ -v
```

---

## API Reference (key endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/events` | Main entry — classify and route a guest event |
| `POST` | `/v1/emergency` | Hard emergency bypass (skips LLM) |
| `POST` | `/v1/tasks/status` | Update task lifecycle + write outcome record |
| `GET`  | `/v1/metrics/digest` | Human-readable weekly ROI digest |
| `GET`  | `/v1/metrics/period` | Structured metrics |
| `GET`  | `/v1/health` / `/v1/health/deep` | Liveness + LLM reachability |
| `DELETE` | `/v1/guests/{id}?confirm=true` | GDPR erasure |

Full contract: [`hotel_ai/docs/API.md`](hotel_ai/docs/API.md) and [`hotel_ai/docs/ARCHITECTURE.md`](hotel_ai/docs/ARCHITECTURE.md).

---

## Demo credentials (live site)

| Role | Credentials |
|------|-------------|
| Guest | Booking `BK-1000` / Lastname `Harrington` |
| Admin | `admin@hotelos.app` / `admin123` |
| Staff | `demo@hotelos.app` / `demo123` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI Advisor | Python 3.12, FastAPI, Pydantic v2 |
| LLM Providers | Groq (default), Gemini, Anthropic, FakeLLM |
| Memory / Telemetry | JSON (dev) or Postgres (prod) |
| Backend | Node.js / Express |
| Staff Dashboard | React |
| Mobile | React Native |
| CI | GitHub Actions (ruff + mypy + pytest) |
| Container | Docker |

---

## Roadmap (high level)

See the detailed plan in [`hotel_ai/docs/ROADMAP.md`](hotel_ai/docs/ROADMAP.md).

**Next up:** smarter routing (few-shot + history + sentiment), memory learning workers, then frontend polish.

---


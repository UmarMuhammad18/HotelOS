# Hotel AI Layer

The AI intelligence layer for HotelOS. This service is owned by the AI team and is
consumed over HTTP by the frontend (guest app, staff app) and the general backend.

It is responsible for:

- Understanding guest intent (chat / app requests / voice transcripts).
- Routing work automatically to the correct department.
- Maintaining guest memory across stays.
- Handling emergencies and accessibility-aware prioritisation.
- Emitting notifications back to guests and staff.

This repo does **not** own: authentication, payments, PMS integration internals,
or the staff/guest UIs. It exposes an HTTP + event contract that those systems
call.

## Quickstart

```bash
python -m venv .venv
source .venv/bin/activate          # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env               # fill in ANTHROPIC_API_KEY etc.
uvicorn app.main:app --reload
```

Then open http://localhost:8000/docs for the interactive API.

## Layout

```
hotel_ai/
├── app/
│   ├── main.py                # FastAPI entrypoint
│   ├── config.py              # Settings via pydantic-settings
│   ├── api/                   # HTTP contract (routes + schemas)
│   ├── agents/                # Orchestrator + department agents
│   ├── models/                # Domain models (Pydantic)
│   ├── memory/                # Guest memory store + repository
│   ├── llm/                   # LLM client wrapper
│   ├── services/              # Cross-cutting: notifications, task bus
│   └── utils/                 # Logging, helpers
├── tests/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── ROADMAP.md
└── requirements.txt
```

See `docs/ARCHITECTURE.md` for the full design.

"""
FastAPI entrypoint for the advisor service.

Wiring
------
We construct (and own the lifecycle of):
  - LLM client
  - Guest memory (JSON or Postgres)
  - Outcome store + recorder (JSON or Postgres)
  - Orchestrator (composed of the above)
and inject them into routes via dependency overrides.

Concurrency note
----------------
`/v1/events` and `/v1/emergency` dispatch the orchestrator via
`asyncio.to_thread`, so the FastAPI event loop is never blocked by the
LLM round-trip. A single uvicorn worker can serve many in-flight
requests without head-of-line blocking. For multi-worker deploys, set
`DATABASE_URL` so memory + outcome layers become Postgres-backed and
writes are no longer process-local.
"""

from __future__ import annotations

from fastapi import FastAPI

from app.agents.orchestrator import Orchestrator
from app.api import routes as api_routes
from app.config import get_settings
from app.llm.client import build_llm
from app.memory.guest_memory import GuestMemory
from app.memory.outcome_store import build_outcome_store
from app.memory.store import build_store
from app.services.outcome_recorder import OutcomeRecorder
from app.utils.logging import setup_logging


def create_app() -> FastAPI:
    setup_logging()
    settings = get_settings()

    # --- Guest memory ---
    guest_store = build_store(settings.database_url, settings.guest_memory_path)
    memory = GuestMemory(guest_store)

    # --- Outcome telemetry ---
    # Path is derived from the guest-memory path so dev installs get a
    # sensible default ("./data/outcomes.json" alongside the guest
    # memory file). Customers can override via OUTCOME_STORE_PATH if
    # they want a different location.
    outcome_path = settings.outcome_store_path
    outcome_store = build_outcome_store(settings.database_url, outcome_path)
    recorder = OutcomeRecorder(outcome_store)

    # --- LLM + orchestrator ---
    llm = build_llm()
    orchestrator = Orchestrator(
        llm=llm,
        memory=memory,
        outcome_recorder=recorder,
        property_id=settings.property_id,
    )

    app = FastAPI(title="Hotel AI Advisor", version="0.5.0")

    # Wire DI hooks
    app.dependency_overrides[api_routes.get_orchestrator] = lambda: orchestrator
    app.dependency_overrides[api_routes.get_memory] = lambda: memory
    app.dependency_overrides[api_routes.get_llm] = lambda: llm
    app.dependency_overrides[api_routes.get_outcome_store] = lambda: outcome_store
    app.dependency_overrides[api_routes.get_outcome_recorder] = lambda: recorder

    app.include_router(api_routes.router)
    return app


app = create_app()

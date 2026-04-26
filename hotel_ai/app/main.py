"""
FastAPI entrypoint for the advisor service.

The Python side no longer owns task dispatch or notification delivery —
Node does that. We wire only the LLM, memory, and orchestrator.

Concurrency note
----------------
`/v1/events` and `/v1/emergency` dispatch the orchestrator via
`asyncio.to_thread`, so the FastAPI event loop is never blocked by the
LLM round-trip. A single uvicorn worker can serve many in-flight
requests without head-of-line blocking. For multi-worker deploys, set
`DATABASE_URL` so the memory layer becomes Postgres-backed and writes
are no longer process-local.
"""

from __future__ import annotations

from fastapi import FastAPI

from app.agents.orchestrator import Orchestrator
from app.api import routes as api_routes
from app.config import get_settings
from app.llm.client import build_llm
from app.memory.guest_memory import GuestMemory
from app.memory.store import build_store
from app.utils.logging import setup_logging


def create_app() -> FastAPI:
    setup_logging()
    settings = get_settings()

    store = build_store(settings.database_url, settings.guest_memory_path)
    memory = GuestMemory(store)
    llm = build_llm()
    orchestrator = Orchestrator(llm=llm, memory=memory)

    app = FastAPI(title="Hotel AI Advisor", version="0.4.0")

    app.dependency_overrides[api_routes.get_orchestrator] = lambda: orchestrator
    app.dependency_overrides[api_routes.get_memory] = lambda: memory
    app.dependency_overrides[api_routes.get_llm] = lambda: llm

    app.include_router(api_routes.router)
    return app


app = create_app()

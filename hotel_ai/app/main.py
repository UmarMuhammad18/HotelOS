"""
FastAPI entrypoint for the advisor service.

The Python side no longer owns task dispatch or notification delivery —
Node does that. So we wire only the LLM, memory, and orchestrator.
"""

from __future__ import annotations

from fastapi import FastAPI

from app.agents.orchestrator import Orchestrator
from app.api import routes as api_routes
from app.config import get_settings
from app.llm.client import build_llm
from app.memory.guest_memory import GuestMemory
from app.memory.store import JSONFileStore
from app.utils.logging import setup_logging


def create_app() -> FastAPI:
    setup_logging()
    settings = get_settings()

    store = JSONFileStore(settings.guest_memory_path)
    memory = GuestMemory(store)
    llm = build_llm()
    orchestrator = Orchestrator(llm=llm, memory=memory)

    app = FastAPI(title="Hotel AI Advisor", version="0.2.0")

    app.dependency_overrides[api_routes.get_orchestrator] = lambda: orchestrator
    app.dependency_overrides[api_routes.get_memory] = lambda: memory

    app.include_router(api_routes.router)
    return app


app = create_app()

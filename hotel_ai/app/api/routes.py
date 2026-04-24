"""
HTTP routes for the advisor service.

Every route returns a `Plan`. Node is responsible for executing the plan
(broadcasting events, calling tools, sending guest replies over WS).

Auth
----
Bearer token in `Authorization`, checked against `INTERNAL_API_TOKEN`.
Dev mode (no token configured) skips auth so local testing is frictionless.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import JSONResponse

from app.agents.orchestrator import Orchestrator
from app.api.schemas import (
    AdviseRequest,
    AdviseResponse,
    EmergencyAdviseRequest,
    EmergencyAdviseResponse,
    GuestMemoryResponse,
    TaskStatusAdviseRequest,
    TaskStatusAdviseResponse,
    UpsertGuestRequest,
)
from app.config import get_settings
from app.memory.guest_memory import GuestMemory
from app.models import (
    AgentEvent,
    AgentEventType,
    EventChannel,
    GuestReply,
    HotelEvent,
    Plan,
)

router = APIRouter(prefix="/v1")


# --- auth ---------------------------------------------------------------------

def require_auth(authorization: str = Header(default="")) -> None:
    expected = get_settings().internal_api_token
    if not expected:
        return
    if authorization != f"Bearer {expected}":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid token")


# --- DI hooks (overridden in main.py) -----------------------------------------

def get_orchestrator() -> Orchestrator:  # pragma: no cover - overridden
    raise RuntimeError("Orchestrator dependency not wired")


def get_memory() -> GuestMemory:  # pragma: no cover - overridden
    raise RuntimeError("GuestMemory dependency not wired")


# --- routes -------------------------------------------------------------------

@router.get("/health")
def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@router.post(
    "/events",
    response_model=AdviseResponse,
    dependencies=[Depends(require_auth)],
)
def advise_event(
    body: AdviseRequest,
    orch: Orchestrator = Depends(get_orchestrator),
) -> AdviseResponse:
    """Main advisor entry — Python returns a Plan, Node executes it."""
    plan = orch.build_plan(body.event, body.stay)
    return AdviseResponse(plan=plan)


@router.post(
    "/tasks/status",
    response_model=TaskStatusAdviseResponse,
    dependencies=[Depends(require_auth)],
)
def advise_task_status(body: TaskStatusAdviseRequest) -> TaskStatusAdviseResponse:
    """
    Given a task status transition, return a Plan with the right guest
    message and activity-feed events. Node ran the actual state change
    in its DB; we just advise on messaging.
    """
    lang = body.stay.guest.language
    events: list[AgentEvent] = []
    guest_reply = None

    if body.status == "in_progress":
        events.append(AgentEvent(
            agent="Orchestrator",
            type=AgentEventType.EXECUTION,
            message=f"Staff en route for task {body.task_id}",
            room=body.stay.room_number,
        ))
        guest_reply = GuestReply(
            message="A team member is on the way to your room.",
            locale=lang,
        )
    elif body.status == "completed":
        events.append(AgentEvent(
            agent="Orchestrator",
            type=AgentEventType.SUCCESS,
            message=f"Task {body.task_id} complete",
            room=body.stay.room_number,
        ))
        guest_reply = GuestReply(
            message="Your request is complete. Is there anything else we can help with?",
            locale=lang,
        )
    elif body.status == "cancelled":
        events.append(AgentEvent(
            agent="Orchestrator",
            type=AgentEventType.ALERT,
            message=f"Task {body.task_id} cancelled",
            room=body.stay.room_number,
        ))
        guest_reply = GuestReply(
            message="Your request has been cancelled. Let us know if there's anything else.",
            locale=lang,
        )

    plan = Plan(
        intent="task_status_change",
        events=events,
        guest_reply=guest_reply,
    )
    return TaskStatusAdviseResponse(plan=plan)


@router.post(
    "/emergency",
    response_model=EmergencyAdviseResponse,
    dependencies=[Depends(require_auth)],
)
def advise_emergency(
    body: EmergencyAdviseRequest,
    orch: Orchestrator = Depends(get_orchestrator),
) -> EmergencyAdviseResponse:
    """
    Hard emergency entry. Bypasses LLM classification; runs the same
    orchestrator policy so accessibility/VIP fan-out still applies.
    """
    synthetic = HotelEvent(
        channel=EventChannel.SENSOR,
        reservation_id=body.stay.reservation_id,
        room_number=body.stay.room_number,
        guest_id=body.stay.guest.guest_id,
        text=f"EMERGENCY via {body.source}: {body.details}",
    )
    plan = orch.build_plan(synthetic, body.stay)
    return EmergencyAdviseResponse(plan=plan)


@router.get(
    "/guests/{guest_id}/memory",
    response_model=GuestMemoryResponse,
    dependencies=[Depends(require_auth)],
)
def get_guest_memory(
    guest_id: str,
    memory: GuestMemory = Depends(get_memory),
) -> GuestMemoryResponse:
    return GuestMemoryResponse(profile=memory.get_profile(guest_id))


@router.post(
    "/guests",
    response_model=GuestMemoryResponse,
    dependencies=[Depends(require_auth)],
)
def upsert_guest(
    body: UpsertGuestRequest,
    memory: GuestMemory = Depends(get_memory),
) -> GuestMemoryResponse:
    saved = memory.upsert_from_reservation(body.profile)
    return GuestMemoryResponse(profile=saved)

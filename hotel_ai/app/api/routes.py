"""
HTTP routes for the advisor service.

Every advisor route returns a `Plan`. Node is responsible for executing
the plan (broadcasting events, calling tools, sending guest replies
over WS).

Auth
----
Bearer token in `Authorization`, checked against `INTERNAL_API_TOKEN`,
case-insensitively for the scheme and via `hmac.compare_digest` for
the token itself (timing-safe).

Dev mode (no token configured) skips auth.

Idempotency
-----------
`/v1/events` and `/v1/emergency` accept an `Idempotency-Key` header.
Retries within 5 minutes of the same key return the cached Plan.

Rate limiting
-------------
`/v1/events` is rate-limited per client IP. Configure with
`RATE_LIMIT_PER_MINUTE` (0 disables).

Concurrency
-----------
`build_plan` is synchronous; we dispatch it via `asyncio.to_thread` so
the event loop is never blocked by the LLM round-trip.
"""

from __future__ import annotations

import asyncio
import hmac
import time
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse

from app.agents.orchestrator import Orchestrator
from app.api.schemas import (
    AdviseRequest,
    AdviseResponse,
    DeepHealthResponse,
    EmergencyAdviseRequest,
    EmergencyAdviseResponse,
    ForgetGuestResponse,
    GuestMemoryResponse,
    StaySummaryResponse,
    TaskStatusAdviseRequest,
    TaskStatusAdviseResponse,
    UpsertGuestRequest,
    WebhookTestResponse,
)
from app.config import get_settings
from app.llm.client import LLMClient
from app.memory.guest_memory import GuestMemory
from app.models import (
    AgentEvent,
    AgentEventType,
    EventChannel,
    GuestReply,
    HotelEvent,
    Plan,
)
from app.utils.idempotency import IdempotencyCache
from app.utils.rate_limit import RateLimiter

router = APIRouter(prefix="/v1")

# Process-local caches/limiters. For multi-replica deploys, swap to Redis.
_idempotency_cache = IdempotencyCache(ttl_seconds=300)
_rate_limiter = RateLimiter(max_per_minute=get_settings().rate_limit_per_minute)


# --- auth ---------------------------------------------------------------------

def require_auth(authorization: str = Header(default="")) -> None:
    """Validate `Authorization: Bearer <token>` against INTERNAL_API_TOKEN.

    - Case-insensitive scheme check.
    - Timing-safe token comparison via `hmac.compare_digest`.
    - When INTERNAL_API_TOKEN is empty (dev mode), auth is bypassed.
    """
    expected = get_settings().internal_api_token
    if not expected:
        return
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not hmac.compare_digest(
        token.strip(), expected
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid token")


# --- DI hooks (overridden in main.py) -----------------------------------------

def get_orchestrator() -> Orchestrator:  # pragma: no cover
    raise RuntimeError("Orchestrator dependency not wired")


def get_memory() -> GuestMemory:  # pragma: no cover
    raise RuntimeError("GuestMemory dependency not wired")


def get_llm() -> LLMClient:  # pragma: no cover
    raise RuntimeError("LLM dependency not wired")


# --- helpers ------------------------------------------------------------------

async def _run_with_idempotency(
    key: Optional[str],
    builder,
) -> Plan:
    """Cache wrapper. `builder` runs in a thread so the event loop stays free."""
    if key:
        cached = _idempotency_cache.get(key)
        if cached is not None:
            return cached
    plan = await asyncio.to_thread(builder)
    if key:
        _idempotency_cache.put(key, plan)
    return plan


def _client_ip(request: Request) -> str:
    """Best-effort client IP for rate limiting.

    Honours the standard X-Forwarded-For chain (uses the *first* entry
    which by convention is the original client). Falls back to
    `request.client.host`. Never returns empty — returns "unknown" so
    every request hits the limiter under SOME bucket.
    """
    fwd = request.headers.get("x-forwarded-for", "").strip()
    if fwd:
        first = fwd.split(",")[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


# --- routes -------------------------------------------------------------------

@router.get("/health")
def health() -> JSONResponse:
    """Cheap liveness check — does NOT touch the LLM."""
    return JSONResponse({"status": "ok", "ts": int(time.time())})


@router.get(
    "/health/deep",
    response_model=DeepHealthResponse,
    dependencies=[Depends(require_auth)],
)
async def health_deep(llm: LLMClient = Depends(get_llm)) -> DeepHealthResponse:
    """Deep healthcheck — actually pings the LLM provider.

    Use this for load-balancer probes that should fail over when the
    LLM is unreachable. Auth-required because pinging the provider
    costs us money.
    """
    reachable = await asyncio.to_thread(llm.ping)
    return DeepHealthResponse(
        status="ok" if reachable else "degraded",
        llm_reachable=bool(reachable),
        timestamp=int(time.time()),
    )


@router.post(
    "/events",
    response_model=AdviseResponse,
    dependencies=[Depends(require_auth)],
)
async def advise_event(
    body: AdviseRequest,
    request: Request,
    orch: Orchestrator = Depends(get_orchestrator),
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
) -> AdviseResponse:
    """Main advisor entry — Python returns a Plan, Node executes it.

    Send the same `Idempotency-Key` for safe retries; we'll return
    the original Plan instead of re-classifying.
    """
    # Rate limit per IP. Skipped when limiter is disabled (max_per_minute=0).
    if _rate_limiter.enabled:
        ip = _client_ip(request)
        if not _rate_limiter.check(ip):
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                detail="rate limit exceeded",
            )

    plan = await _run_with_idempotency(
        idempotency_key,
        lambda: orch.build_plan(body.event, body.stay),
    )
    return AdviseResponse(plan=plan)


@router.post(
    "/tasks/status",
    response_model=TaskStatusAdviseResponse,
    dependencies=[Depends(require_auth)],
)
def advise_task_status(body: TaskStatusAdviseRequest) -> TaskStatusAdviseResponse:
    """Pure templating — no LLM, no async needed."""
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
async def advise_emergency(
    body: EmergencyAdviseRequest,
    orch: Orchestrator = Depends(get_orchestrator),
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
) -> EmergencyAdviseResponse:
    """Hard emergency entry. Bypasses LLM classification.

    Idempotency matters MORE here — we don't want a flaky retry to
    dispatch security to the same room twice.
    """
    synthetic = HotelEvent(
        channel=EventChannel.SENSOR,
        reservation_id=body.stay.reservation_id,
        room_number=body.stay.room_number,
        guest_id=body.stay.guest.guest_id,
        text=f"EMERGENCY via {body.source}: {body.details}",
    )
    plan = await _run_with_idempotency(
        idempotency_key,
        lambda: orch.build_plan(synthetic, body.stay),
    )
    return EmergencyAdviseResponse(plan=plan)


# --- guest memory CRUD --------------------------------------------------------


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


@router.delete(
    "/guests/{guest_id}",
    response_model=ForgetGuestResponse,
    dependencies=[Depends(require_auth)],
)
def forget_guest(
    guest_id: str,
    confirm: bool = Query(False, description="Must be true to actually delete"),
    memory: GuestMemory = Depends(get_memory),
) -> ForgetGuestResponse:
    """GDPR right-to-erasure.

    Requires `?confirm=true` so a stray DELETE doesn't wipe data. The
    backend / dashboard should always pass it explicitly after a human
    confirms the request.
    """
    if not confirm:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Pass ?confirm=true to acknowledge this is a permanent deletion.",
        )
    deleted = memory.forget(guest_id)
    return ForgetGuestResponse(guest_id=guest_id, deleted=deleted)


# --- stay summary -------------------------------------------------------------


@router.get(
    "/stays/{reservation_id}/summary",
    response_model=StaySummaryResponse,
    dependencies=[Depends(require_auth)],
)
def stay_summary(
    reservation_id: str,
    guest_id: str = Query(..., description="Guest whose memory we summarise"),
    memory: GuestMemory = Depends(get_memory),
) -> StaySummaryResponse:
    """One-paragraph deterministic summary of what we know about the guest.

    Useful for the next visit's prep. We keep it deterministic (no
    LLM) so calling this is cheap and the answer is reproducible.
    `reservation_id` is in the path for routing semantics; the actual
    profile lookup is by `guest_id`.
    """
    summary = memory.stay_summary(guest_id)
    return StaySummaryResponse(guest_id=guest_id, summary=summary)


# --- webhooks ----------------------------------------------------------------


@router.post(
    "/webhooks/test",
    response_model=WebhookTestResponse,
    dependencies=[Depends(require_auth)],
)
def webhook_test(
    payload: dict | None = None,
) -> WebhookTestResponse:
    """Round-trip test endpoint for Node→Python connectivity & auth.

    Send any JSON body; we echo back the value of payload["echo"] (or
    a default) so Node can confirm:
      1. The URL is reachable.
      2. The auth token is correct.
      3. JSON round-trips intact.
    """
    if not isinstance(payload, dict):
        payload = {}
    echo = str(payload.get("echo", "pong"))
    return WebhookTestResponse(received=True, echo=echo)

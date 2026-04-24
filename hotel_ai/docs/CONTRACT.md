# Node ↔ Python Advisor Contract

This is the wire contract between `hotelos-api` (Node) and `hotel_ai` (Python).
Either side can change internally; this spec is what they agree on.

## Overview

- **Python is an advisor.** It thinks, Node acts.
- **Node calls Python** for every guest/system event, task-status change, and emergency.
- **Python returns a `Plan`.** The Plan contains activity-feed events, tool calls Node must execute, an optional guest reply, and any memory updates Python already applied.
- **Node executes the Plan** in order: broadcast events → call tools → broadcast per-tool success events → send guest reply.

## Endpoints Python exposes

Base URL: set by `PYTHON_ADVISOR_URL` env on the Node side, e.g. `http://localhost:9000/v1`.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/events` | Main entry — a guest said / did something, get a Plan. |
| POST | `/v1/tasks/status` | Task status moved, get a Plan with the right guest copy + feed event. |
| POST | `/v1/emergency` | Hard emergency path (panic button, sensor). Bypasses LLM. |
| GET  | `/v1/guests/{guest_id}/memory` | Read learned guest memory. |
| POST | `/v1/guests` | Upsert guest profile (call from PMS / reservation creation). |
| GET  | `/v1/health` | Liveness. |

All routes except `/health` require `Authorization: Bearer <INTERNAL_API_TOKEN>`.

## `POST /v1/events`

### Request
```json
{
  "event": {
    "id": "evt_abc",
    "channel": "guest_chat" | "guest_app" | "voice" | "staff_chat" | "sensor" | "system",
    "reservation_id": "r_123",
    "room_number": "412",
    "guest_id": "g_77",
    "text": "My AC is not working",
    "metadata": {},
    "trace_id": "trace_xyz"
  },
  "stay": {
    "guest": {
      "guest_id": "g_77",
      "full_name": "Ada Lovelace",
      "vip": true,
      "language": "en",
      "accessibility": { "registered_disability": false, "mobility_aid": "none" },
      "emergency": { "preferred_language": "en" },
      "preferences": {},
      "past_requests": []
    },
    "room_number": "412",
    "check_in": "2026-04-23",
    "check_out": "2026-04-25",
    "reservation_id": "r_123",
    "is_returning_guest": false
  }
}
```

### Response
```json
{
  "plan": {
    "intent": "maintenance_issue",
    "sentiment": "frustrated",
    "priority": "high",
    "emergency": false,
    "events": [
      { "agent": "Orchestrator",    "type": "thought",   "message": "Event received via guest_chat..." },
      { "agent": "Orchestrator",    "type": "decision",  "message": "Routing to: maintenance, guest_relations" },
      { "agent": "Maintenance AI",  "type": "thought",   "message": "Room 412 reported: Fix AC..." },
      { "agent": "Maintenance AI",  "type": "decision",  "message": "Opening a high-priority ticket" },
      { "agent": "Guest Experience","type": "thought",   "message": "Ada Lovelace may need personal attention" },
      { "agent": "Guest Experience","type": "decision",  "message": "Queueing a Guest Experience check-in" }
    ],
    "tool_calls": [
      {
        "tool": "createMaintenanceTicket",
        "args": { "roomNumber": "412", "issueDescription": "Fix AC" },
        "broadcast_on_success": {
          "agent": "Maintenance AI",
          "type": "alert",
          "message": "Maintenance ticket created for room 412",
          "details": "AC not cooling.",
          "priority": "high",
          "room": "412"
        }
      },
      {
        "tool": "assignTask",
        "args": { "taskType": "guest_relations: VIP guest has an active request...", "roomNumber": "412", "priority": "high" },
        "broadcast_on_success": {
          "agent": "Guest Experience",
          "type": "execution",
          "message": "Guest Experience follow-up queued for room 412",
          "priority": "high",
          "room": "412"
        }
      }
    ],
    "guest_reply": {
      "message": "Maintenance has been notified about: fix ac...",
      "locale": "en"
    },
    "memory_updates": [
      { "op": "record_request", "guest_id": "g_77", "summary": "My AC is not working" }
    ],
    "trace_id": "trace_xyz",
    "created_at": "2026-04-24T10:00:00Z"
  }
}
```

### Node's execution order

```text
for event in plan.events:            # activity feed
    broadcastFeed(event)
for call in plan.tool_calls:         # DB writes + side effects
    try:
        result = tools[call.tool](call.args)
        if call.broadcast_on_success:
            broadcastFeed(call.broadcast_on_success)
    except err:
        broadcastFeed({ agent: "Orchestrator", type: "alert",
                        message: f"Tool {call.tool} failed",
                        details: str(err) })
if plan.guest_reply:
    chatWsReply(plan.guest_reply.message)   # only when /chat WS is the source
```

## `POST /v1/tasks/status`

### Request
```json
{
  "task_id": "t_1730000000",
  "status": "pending" | "assigned" | "in_progress" | "completed" | "cancelled",
  "stay": { ... },
  "note": "optional staff note"
}
```

### Response
Plan with:
- An activity-feed event (`execution` / `success` / `alert`).
- A `guest_reply` in the guest's locale ("on the way" / "all done" / "cancelled").
- No `tool_calls` (Node already mutated the DB; advisor just shapes messaging).

## `POST /v1/emergency`

### Request
```json
{
  "stay": { ... },
  "source": "panic_button" | "smoke_detector" | "fall_sensor" | ...,
  "details": "Guest triggered in-room SOS button"
}
```

### Response
Plan flagged `emergency: true, priority: "emergency"`, with tool_calls dispatching **security, front desk, and accessibility (if registered)** regardless of LLM availability.

## Enumerations

### `AgentEventType`
`thought` · `decision` · `execution` · `alert` · `success` · `status_change` · `emergency`

Frontend `ActivityFeed` supports the first six today. `emergency` is **proposed** — negotiate with the Node team to add styling (red banner, sound, etc.). Until then, Python will fall back to `alert` if the team hasn't added `emergency` rendering yet.

### Agent display names
These are strings the UI shows. Keep them stable.

| Department  | Display name |
|-------------|--------------|
| orchestrator | `Orchestrator` |
| front_desk | `Front Desk AI` (**new — UI may need styling**) |
| housekeeping | `Housekeeping AI` |
| concierge | `Concierge AI` |
| maintenance | `Maintenance AI` |
| food_beverage | `Room Service AI` (**new**) |
| guest_relations | `Guest Experience` (matches existing tools.js label) |
| security | `Security AI` (**new**) |
| accessibility | `Accessibility AI` (**new**) |
| revenue | `Revenue AI` |

### Tool names Python emits

All of these already exist in `hotelos-api/src/agents/tools.js`:

- `assignTask({ taskType, roomNumber, priority })`
- `createMaintenanceTicket({ roomNumber, issueDescription })`
- `sendMessage({ guestId, message })`
- `updatePreferences({ guestId, preferences })`
- `sendUpgradeOffer({ guestId, roomNumber, offerPrice })`
- `adjustPricing({ roomType, percentage, reason })`
- `forecastDemand({ dateRange })`
- `updateTaskStatus({ taskId, newStatus })`
- `getGuestPreferences({ guestId })`
- `getTechnicianETA({ ticketId })`

## Proposed additions to Node (negotiation items)

Not blocking for MVP — we work around with `assignTask` — but cleaner long-term:

1. `dispatchSecurity({ roomNumber, severity, reason })` — dedicated security path.
2. `dispatchAccessibilityAssistance({ roomNumber, mobilityAid, reason })`.
3. `alertFrontDesk({ roomNumber, reason, priority })`.
4. Add a structured `accessibility` column on the guests table so we stop stuffing it into free-text `special_requests`.
5. Add `emergency` to the frontend's ActivityFeed rendering.

## Error handling

- Python returns HTTP 5xx only on real failures. Classification failures degrade internally to a safe "front desk triage" plan.
- Node should **fail open** — if the Python call times out or 5xx's, Node's existing keyword router can still produce a rough plan so the hotel keeps running. Treat Python as a quality upgrade, not a single point of failure.
- Timeout recommendation: 5s end-to-end for `/events`, 1s for `/tasks/status`, 2s for `/emergency`.

## Auth

`Authorization: Bearer <INTERNAL_API_TOKEN>` on every request. Rotate quarterly. In prod, consider mTLS between the two services.

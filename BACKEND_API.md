# HotelOS Backend API

Base URL: `http://localhost:8080` in development, or your deployed origin (HTTPS in production).

CORS is enabled for browser clients. WebSockets use the same host and port as HTTP.

---

## WebSockets

### Agent feed — `GET ws://<host>/` (or `wss://`)

- **Path**: `/` (root). Anything except `/chat` is handled by the feed socket.
- **Direction**: server → client (broadcast). Clients do not need to send messages for the feed.
- **First message** on connect: welcome `success` event.

**Agent / system event** (same shape the CRA `useWebSocketStore` / `ActivityFeed` expect):

```json
{
  "type": "thought | decision | execution | alert | success | status_change",
  "agent": "Orchestrator",
  "message": "Human readable summary",
  "details": "Optional longer text",
  "timestamp": "2026-04-19T12:00:00.000Z"
}
```

For **`status_change`**, the server may also send:

```json
{
  "type": "status_change",
  "room": "206",
  "status": "cleaning",
  "timestamp": "2026-04-19T12:00:00.000Z"
}
```

(`agent` / `message` may be omitted; the web UI maps `status_change` in `ActivityFeed`.)

### Staff chat — `GET ws://<host>/chat`

**Client → server** (either shape is accepted):

```json
{ "message": "Room 206 AC is broken" }
```

or (as the web `StaffChat` sends):

```json
{ "type": "chat", "message": "...", "timestamp": "..." }
```

**Server → client**:

```json
{
  "message": "Assistant reply text",
  "timestamp": "2026-04-19T12:00:00.000Z"
}
```

---

## REST

### Health

- **`GET /api/health`** — `{ status, simulation_running, simulation_speed, connected_feed, connected_chat }`

### Aggregated state (mobile / dashboards)

- **`GET /api/state`** — `{ metrics, rooms, guests, tasks }`  
  Optional header: `Authorization: Bearer <JWT>` (not required for this route).

### Rooms

- **`GET /api/rooms`** — array of room objects (`guest_id`, `do_not_disturb`, `amenities`, …).
- **`PATCH /api/rooms/:id`** — body fields: `status`, `do_not_disturb`, `rate`. Triggers feed `status_change` + `execution` messages.

### Guests

- **`GET /api/guests/:id`** — guest with `room_number`, `preferences`, `special_requests`, `purchase_history` JSON fields.

### Tasks

- **`GET /api/tasks`**
- **`POST /api/tasks/:id/assign`** — body: `{ "staffName": "Sarah" }` or `{ "assignedTo": "Sarah" }`
- **`POST /api/tasks/:id/complete`**

### Simulation

- **`POST /api/simulation/start`** — body optional `{ "speed": 1.5 }` (0.5–5)
- **`POST /api/simulation/stop`**
- **`PUT /api/simulation/speed`** — body `{ "speed": 2 }`
- **`POST /api/simulation/event`** — body `{ "eventType": "late_arrival" | "room_issue" | "vip_guest" | "staff_shortage" | "overbooking" | "early_checkout" }`
- **`POST /api/simulation/reset`** — clears tasks and notifications rows in SQLite (does not re-seed rooms).

### Stripe

- **`POST /api/create-payment-intent`** — body: `{ "amount": 4999, "currency": "usd", "productType": "upgrade", "metadata": {} }`  
  Response: `{ clientSecret, paymentIntentId }`  
  Requires `STRIPE_SECRET_KEY`. Optional `Authorization: Bearer <JWT>`.

- **`POST /api/create-checkout-session`** — hosted Checkout for mobile browsers.  
  Body: `{ amount, currency, productType, productName, successUrl, cancelUrl }`  
  Response: `{ url, sessionId }`.

- **`POST /api/stripe-webhook`** — **raw** JSON body; Stripe signature header.  
  Handles `payment_intent.succeeded` and `checkout.session.completed`.  
  Configure signing secret `STRIPE_WEBHOOK_SECRET`.

### OpenClaw (mock / proxy)

- **`POST /api/openclaw/command`** — body `{ "command": "...", "context": {} }`  
  If `OPENCLAW_API_URL` + `OPENCLAW_API_KEY` are set, forwards to `{OPENCLAW_API_URL}/command`. Otherwise returns `{ source: "mock", result: { ... } }`.

### Auth

- **`POST /api/login`** — `{ "email", "password" }` → `{ token, user }`
- **`GET /api/me`** — requires `Authorization: Bearer <token>`.

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP + WS port (default `8080`) |
| `DATABASE_FILE` | Path to SQLite file (default `./dev.db` under `hotelos-api`) |
| `DATABASE_SEED_DIR` | Directory containing `rooms.json` + `guests.json` (Docker: `/app/Database`) |
| `JWT_SECRET` | Signing secret for JWTs |
| `STRIPE_SECRET_KEY` | Stripe secret API key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |
| `OPENCLAW_API_URL` | Optional upstream base URL |
| `OPENCLAW_API_KEY` | Optional bearer token for OpenClaw |

---

## Errors

JSON errors: `{ "error": "message" }` with appropriate HTTP status.

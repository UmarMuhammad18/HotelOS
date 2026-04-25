# Node Integration Guide — wiring `pythonAdvisor.js` into `hotelos-api`

This is a step-by-step patch for the backend team (or for you, if you have
write access) to hook the existing Node agent system up to the Python
advisor without throwing away anything that already works.

**Shape of the change:** Node's keyword orchestrator becomes the *fallback*.
The hot path goes Node → Python (`/v1/events`) → Plan → Node executes the
Plan (broadcasts, tool calls, chat reply). If Python is down, Node keeps
routing the way it does today. Nothing the frontend relies on breaks.

---

## 0. Prerequisites

- `hotel_ai/` is running somewhere reachable from the Node box.
  - Local dev: `uvicorn app.main:app --port 9000` inside `hotel_ai/`.
  - Prod: wherever you host it. Use `INTERNAL_API_TOKEN` and HTTPS.
- Node 18+ (for global `fetch` and `AbortController`). If you're on older
  Node, `npm i node-fetch` and polyfill — or just upgrade.

## 1. Drop the client into `hotelos-api`

Copy the file from this repo:

```
hotel_ai/integration/node/pythonAdvisor.js
     →
hotelos-api/src/agents/pythonAdvisor.js
```

It's a standalone CommonJS module. It `require('./tools')` for the tool
registry; that path assumes it lives next to the existing `tools.js`.

## 2. Add env vars

Append to `hotelos-api/.env` (and `.env.example`):

```bash
PYTHON_ADVISOR_URL=http://localhost:9000/v1
PYTHON_ADVISOR_TOKEN=change-me-internal-token
PYTHON_ADVISOR_TIMEOUT_MS=5000
```

- The token must match Python's `INTERNAL_API_TOKEN`. Rotate quarterly.
- 5 s is the hard cap for `/events`. The advisor is designed to answer
  well under a second in normal conditions; the 5 s budget is purely
  for cold starts / LLM hiccups.

## 3. Wire it up in `server.js`

In `hotelos-api/src/server.js`, near where you create the WebSocket and
the existing orchestrator:

```js
const pythonAdvisor = require('./agents/pythonAdvisor');
const orchestrator  = require('./agents/orchestrator'); // existing

// The feed broadcaster you already use for agent events over WS.
// Shape: { agent, type, message, details?, priority?, room? }
function broadcastAgentEvent(ev) {
  // whatever you already do — push JSON to every connected `/` client
  wssAgents.clients.forEach(c => c.readyState === 1 && c.send(JSON.stringify(ev)));
}

// Optional: if this event came from the /chat WS, pass a reply fn.
// We only call this when the source is a guest chat.
function makeChatReply(chatWs) {
  return (message) => chatWs.send(JSON.stringify({ type: 'reply', message }));
}

pythonAdvisor.init({
  broadcastAgentEvent,
  sendChatReply: null,              // we'll pass per-call below
  fallback: orchestrator,           // the keyword router becomes the backup
});
```

## 4. Replace the routing call

Find the place where an incoming guest/staff event currently lands in
`orchestrator.processEvent(...)`. There are two sites in the current
codebase — the HTTP route and the `/chat` WS handler.

**Before (simplified):**

```js
ws.on('message', async (raw) => {
  const { text, guest, room } = JSON.parse(raw);
  const result = await orchestrator.processEvent(text, { guest, room });
  ws.send(JSON.stringify({ type: 'reply', message: result.reply }));
});
```

**After:**

```js
ws.on('message', async (raw) => {
  const { text, guest, room, reservationId, traceId } = JSON.parse(raw);
  const payload = pythonAdvisor.buildAdvisorPayload({
    channel: 'guest_chat',
    text,
    guest,
    room,
    reservationId,
    traceId,
  });
  const chatReply = (message) => ws.send(JSON.stringify({ type: 'reply', message }));
  await pythonAdvisor.processEvent(payload, chatReply);
  // Plan execution (broadcasts, tool calls, chat reply) already happened.
});
```

For the HTTP route that staff/panels use to post events, drop the
`chatReply` — the advisor will still broadcast on the feed; there's just
no WS to reply to:

```js
app.post('/api/events', async (req, res) => {
  const payload = pythonAdvisor.buildAdvisorPayload(req.body);
  try {
    const plan = await pythonAdvisor.processEvent(payload); // no chatReply
    res.json({ plan });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});
```

## 5. Status transitions and emergency

Everywhere you already call `updateTaskStatus(...)` from `tools.js`, add
a second call to the advisor so guest-facing copy stays on-brand and the
feed gets the right event:

```js
await tools.updateTaskStatus({ taskId, newStatus: 'in_progress' });
await pythonAdvisor.adviseTaskStatus({
  task_id: taskId,
  status: 'in_progress',
  stay,                 // same StayContext you'd build for /events
  note: 'Staff picked up the ticket',
}, chatReply);          // chatReply optional
```

For panic buttons / sensor triggers:

```js
await pythonAdvisor.adviseEmergency({
  stay,
  source: 'panic_button',
  details: 'Guest triggered in-room SOS',
});
```

The advisor will fan out security + front desk (+ accessibility if the
guest has a registered need) even if the LLM is down.

## 6. Keep the existing keyword router

Do **not** delete `orchestrator.js`. `pythonAdvisor.init({ fallback: orchestrator })`
uses it automatically when:

- Python times out (5 s default).
- Python returns 5xx.
- The advisor URL is unreachable.

When that happens the advisor broadcasts a degraded-mode alert on the
feed so staff know the hotel is running on the local router:

```json
{ "agent": "Orchestrator", "type": "alert",
  "message": "Advisor degraded — using local keyword router" }
```

## 7. Smoke test

```bash
# in hotel_ai/
uvicorn app.main:app --port 9000

# in hotelos-api/
curl -sS -X POST http://localhost:3001/api/events \
  -H 'Content-Type: application/json' \
  -d '{
    "channel":"guest_chat",
    "text":"My AC is not working",
    "guest":{"id":"g_77","name":"Ada Lovelace","is_vip":true,"language":"en"},
    "room":{"number":"412"},
    "reservationId":"r_123"
  }' | jq
```

You should see, in order, on the WS feed:
1. `Orchestrator / thought` — event received
2. `Orchestrator / decision` — routing to maintenance, guest_relations
3. `Maintenance AI / thought` + `decision`
4. `Guest Experience / thought` + `decision`
5. `Maintenance AI / alert` — ticket created (from `broadcast_on_success`)
6. `Guest Experience / execution` — follow-up queued

And the DB rows Python asked for (via `tools.createMaintenanceTicket` and
`tools.assignTask`) should exist.

## 8. Rollout

Suggested flight plan:

1. **Shadow mode.** Call `pythonAdvisor.processEvent` but ignore the plan
   (still use the old orchestrator as the source of truth). Diff the two
   in logs for a day. Good for confidence.
2. **Dual-write.** Start executing plans in non-prod rooms or a staff
   account only.
3. **Cutover.** Flip the route. Keep the keyword router wired as the
   fallback permanently — it's cheap insurance.

## 9. Things still to negotiate

These are called out in `CONTRACT.md` too; flagging here so the backend
team knows what's coming:

- **`dispatchSecurity`, `dispatchAccessibilityAssistance`, `alertFrontDesk`** —
  Python is currently overloading `assignTask` with typed prefixes. Works,
  but dedicated tools are cleaner. Medium priority.
- **Structured `accessibility` column on `guests`** — right now we pack it
  into `special_requests`. Blocks the accessibility agent from reasoning
  properly once we ship profile-aware plans.
- **`emergency` event type in the frontend's `ActivityFeed`** — Python
  falls back to `alert` today. Once the UI supports it, flip the flag on
  Python side.
- **`trace_id`** — we accept and echo it. If you plumb one through from
  the originating WS message, we'll tag every event and tool call with
  it for end-to-end log joining.

## 10. Rollback

It's a single-file swap. `git revert` the `server.js` diff and delete
`pythonAdvisor.js`. Nothing in the DB or WS protocol changed.

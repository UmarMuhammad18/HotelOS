# `hotelos-api/src/server.js` — hand-edit guide

Three surgical changes. Your exact line numbers will differ; search for
the anchor strings below.

## Change 1 — requires (top of file)

Find the block where agents are required:

```js
const orchestrator = require('./agents/orchestrator');
```

Add right after it:

```js
const pythonAdvisor = require('./agents/pythonAdvisor');
```

## Change 2 — wire the advisor once, after the WS server exists

Find the line that creates the agent-feed WS. In the current codebase
it's something like:

```js
const wssAgents = new WebSocket.Server({ server, path: '/' });
```

**Right after that block**, add:

```js
function broadcastAgentEvent(ev) {
  const payload = JSON.stringify(ev);
  wssAgents.clients.forEach((c) => {
    if (c.readyState === 1) c.send(payload);
  });
}

pythonAdvisor.init({
  broadcastAgentEvent,
  fallback: orchestrator, // keyword router stays as the safety net
});
```

If you already have a `broadcast` helper, pass that instead of defining
a new one — just make sure its argument shape is
`{ agent, type, message, details?, priority?, room? }`.

## Change 3 — route events through the advisor

### 3a. `/chat` WS handler

Find the handler. It currently looks roughly like:

```js
ws.on('message', async (raw) => {
  const { text, guest, room } = JSON.parse(raw);
  const result = await orchestrator.processEvent(text, { guest, room });
  ws.send(JSON.stringify({ type: 'reply', message: result.reply }));
});
```

Replace the body with:

```js
ws.on('message', async (raw) => {
  const msg = JSON.parse(raw);
  const payload = pythonAdvisor.buildAdvisorPayload({
    channel: 'guest_chat',
    text: msg.text,
    guest: msg.guest,
    room: msg.room,
    reservationId: msg.reservationId,
    traceId: msg.traceId,
  });
  const chatReply = (message) =>
    ws.send(JSON.stringify({ type: 'reply', message }));
  try {
    await pythonAdvisor.processEvent(payload, chatReply);
  } catch (err) {
    console.error('[chat] advisor failed:', err.message);
    chatReply('Sorry — our systems are briefly degraded. Staff have been notified.');
  }
});
```

### 3b. HTTP `/api/events` (if you have one)

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

### 3c. Task status transitions (optional but recommended)

Wherever you already call `tools.updateTaskStatus(...)`, add:

```js
await pythonAdvisor.adviseTaskStatus({
  task_id: taskId,
  status: newStatus,
  stay,
  note,
});
```

## That's it

Save, `npm start`, run the curl from `INTEGRATION_NODE.md` §7.

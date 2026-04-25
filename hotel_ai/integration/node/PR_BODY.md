## What this does

Adds a thin Node client that calls the Python advisor service (`hotel_ai`) for event routing, task-status messaging, and emergency dispatch.

The existing keyword orchestrator stays wired as the **fallback** — if Python is unreachable or times out, routing still works and the feed gets a degraded-mode alert. Nothing in the WS protocol or DB schema changes.

## Changes

- `src/agents/pythonAdvisor.js` — new drop-in client. Exports `init`, `processEvent`, `adviseTaskStatus`, `adviseEmergency`, `buildAdvisorPayload`, `executePlan`.
- `src/server.js` — wire `pythonAdvisor.init(...)` with the existing WS broadcaster and the keyword orchestrator as fallback; route `/chat` WS messages and the `/api/events` endpoint through `pythonAdvisor.processEvent`.
- `.env.example` — adds `PYTHON_ADVISOR_URL`, `PYTHON_ADVISOR_TOKEN`, `PYTHON_ADVISOR_TIMEOUT_MS`.

## Docs

- Wire contract (what Python returns): [`hotel_ai/docs/CONTRACT.md`](https://github.com/UmarMuhammad18/HotelOS/blob/main/hotel_ai/docs/CONTRACT.md)
- Integration details & rollout (shadow → dual-write → cutover): [`hotel_ai/docs/INTEGRATION_NODE.md`](https://github.com/UmarMuhammad18/HotelOS/blob/main/hotel_ai/docs/INTEGRATION_NODE.md)

> Note: `pythonAdvisor.js` is vendored here from `hotel_ai/integration/node/pythonAdvisor.js`. Treat that path in the Python repo as the source; re-copy on updates.

## Two questions for reviewers

1. Is the `broadcastAgentEvent({ agent, type, message, details?, priority?, room? })` shape I'm using in `init(...)` compatible with how you already broadcast on `wssAgents`? If field names differ, let me know and I'll adapt `executePlan` in the next revision.
2. Are you OK with `assignTask` being overloaded for security / accessibility / front-desk in v1, with dedicated `dispatchSecurity` / `dispatchAccessibilityAssistance` / `alertFrontDesk` tools as a follow-up PR?

## Test plan

- [ ] `npm test` passes (if there are tests).
- [ ] Server boots with `PYTHON_ADVISOR_URL` unset — fail-open hits the existing keyword router.
- [ ] Server boots with Python running — curl smoke test from `INTEGRATION_NODE.md` §7 produces the expected feed events.
- [ ] Kill the Python service mid-session — next event broadcasts `Advisor degraded — using local keyword router` and keeps working.

## Rollback

Single-file swap. Revert this PR and delete `src/agents/pythonAdvisor.js`. No data migrations.

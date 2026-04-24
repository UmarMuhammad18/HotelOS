# Hotel AI — Architecture

## 1. What this service does

The AI layer is a **stateless-ish HTTP service** that takes guest/system events and produces:

1. Tasks for hotel departments.
2. Notifications for guests and staff.
3. Updates to a guest memory store.

It is owned by the AI team. It does not own UI, persistence of operational data (tasks/notifications for audit), or the PMS. Those live in the general backend.

## 2. Components

```
         ┌─────────────────────────┐
Guest →  │ frontend (guest app)    │
Staff →  │ frontend (staff app)    │
         └────────────┬────────────┘
                      │ HTTPS (JSON)
                      ▼
              ┌───────────────┐
              │  Backend API  │   (owns auth, PMS, DB)
              └───────┬───────┘
                      │ calls /v1/events, /v1/tasks/status, /v1/emergency
                      ▼
        ┌───────────────────────────┐
        │   Hotel AI Layer (this)   │
        │  ┌─────────────────────┐  │
        │  │   Orchestrator      │  │  ← LLM-assisted triage + policy
        │  │  (classify+route)   │  │
        │  └─────┬────────┬──────┘  │
        │        │        │         │
        │  ┌─────▼──┐  ┌──▼──────┐  │
        │  │ Dept   │  │ Memory  │  │
        │  │ Agents │  │ Store   │  │
        │  └─────┬──┘  └─────────┘  │
        │        ▼                  │
        │  TaskBus  NotificationSvc │
        └────────┬───────┬──────────┘
                 │       │
                 ▼       ▼
        back to Backend for delivery
```

## 3. The orchestrator (brain)

- Receives a `HotelEvent`.
- Asks the LLM to classify it into `DepartmentAction`s (JSON).
- Runs **deterministic policy** on top of the LLM output:
  - **Emergency detection** (regex over a conservative allow-list of safety words).
  - **Accessibility fan-out** when the guest has registered needs and the event is safety-related.
  - **VIP fan-out** adds guest_relations.
- Dispatches each action to a department agent.
- Publishes the resulting `Task` to the `TaskBus`.
- Sends any acknowledging `Notification`s.
- Records the event in guest memory.

> Rule: **policy always wins over the LLM.** We don't let a statistical model decide whether to dispatch security.

## 4. Department agents

Each department is a thin class extending `BaseAgent`. Their job is to:

1. Turn a `DepartmentAction` into a concrete `Task` for their department.
2. Shape the guest-facing acknowledgement (tone, copy).
3. Optionally enforce department-specific rules (security minimum priority, accessibility minimum priority).

Agents are **pure functions** of (action, stay) → (task, notifications). That keeps them testable without I/O mocks.

### Which departments are agents vs tools?

| Department             | Form          | Rationale |
|------------------------|---------------|-----------|
| Front Desk             | Agent         | Human-facing, triage many kinds of requests |
| Housekeeping           | Agent         | High volume, stands on its own |
| Concierge              | Agent         | Conversational work, external coordination |
| Maintenance            | Agent         | High volume, clear SLA |
| Food & Beverage        | Agent         | Distinct workflow (orders, timing) |
| Guest Relations        | Agent         | Cross-cuts, gets copied on many events |
| Security               | Agent         | Emergency handling, strict policy |
| Accessibility          | Agent         | Safety critical, cross-cuts many events |
| Reservations           | **Tool/service** called from agents (check-out extension, rebooking). Less conversational. |
| Revenue / Upsell       | **Tool/service** — fires on specific triggers rather than free-form text. |
| Spa / Wellness         | Sub-agent of Concierge for MVP; promote to its own agent later. |
| Laundry                | Sub-agent of Housekeeping for MVP. |
| Valet / Transport      | Sub-agent of Concierge for MVP. |

This keeps the surface small while still modelling the business.

## 5. Memory & learning

- `GuestMemory` wraps a `MemoryStore` (JSON file in dev, Postgres later).
- Writes are **explicit and auditable**: `record_preference`, `record_request`, `upsert_from_reservation`. The LLM never mutates memory directly.
- On every event, the request text is appended to `past_requests` (bounded to 50).
- Learning points that matter most:
  - **Preference inference** — e.g. after 3 turndown-before-9pm requests, record `turndown_before_2100=true`.
  - **Stay-complete summary** — at check-out, summarise the stay and store compactly (run this out-of-band, not on the hot path).
  - **Proactive hooks** — on check-in, the orchestrator can pre-create tasks from preferences (e.g. foam pillows pre-placed).

Preference inference is the ideal use of an LLM behind a cron/queue — but it must write through `GuestMemory` methods, never directly.

## 6. Emergency & accessibility logic

Two layers:

1. **Hard path** — `/v1/emergency` from sensors/panic buttons. Bypasses the LLM.
2. **Soft path** — regex trigger in the orchestrator (`_EMERGENCY_PATTERNS`) escalates *any* event.

When either triggers:

- All produced actions are upgraded to `Priority.EMERGENCY`.
- Security and Front Desk are added if missing.
- If `guest.accessibility.registered_disability`, Accessibility is added.
- The AI sends a brief, low-anxiety acknowledgement to the guest (via the triggering department agent's `_guest_ack`).

Responsible handling rules:

- Never log the accessibility struct raw. Use `GuestProfile.redacted()`.
- Do **not** store medical diagnoses in this service. Keep the AI's view to "needs assistance / yes or no" plus mobility aid category.
- Accessibility data retention mirrors the PMS's; do not cache longer.
- Any automated action in emergencies must also create a task so there is a human in the loop — the AI informs; humans act.

## 7. Task lifecycle

```
AI creates  →  published to TaskBus (status=pending)
Backend/staff app picks up  →  assigned
Staff taps "on my way"      →  in_progress     ← AI emits guest "on the way" notif
Staff taps "complete"       →  completed       ← AI emits guest "all done" notif
                            ↘  cancelled
```

The AI does not store tasks long-term. The backend's DB does. The AI cares about status transitions only to produce the right guest messaging.

## 8. Making it feel like real AI (not if/else)

- Use the LLM for **classification + tone**, not for control flow over safety logic.
- Give the LLM structured output constraints (JSON schema in the prompt).
- Add a **preference-learning worker** (out-of-band) that summarises prior stays into durable preferences.
- Let agents use the LLM for **copywriting** the guest acknowledgement so it matches sentiment (frustrated vs neutral).
- Add **retrieval**: on each event, fetch the last N messages + guest preferences and include them in the classifier prompt.
- **Multi-step planning** for complex requests: the orchestrator can call the LLM a second time to plan coordination ("AC broken + VIP + late night → also book them a bottle of wine via F&B").
- Always keep a deterministic **safety rail** around the intelligent layer.

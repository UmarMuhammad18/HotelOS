# Hotel AI — HTTP API (v1)

All routes require `Authorization: Bearer <INTERNAL_API_TOKEN>` in non-dev environments.
Content type is `application/json`.

## POST /v1/events

Main entry point. Submit a guest/system event for routing.

**Request**
```json
{
  "event": {
    "channel": "guest_chat",
    "reservation_id": "r_123",
    "room_number": "412",
    "guest_id": "g_77",
    "text": "My AC isn't working"
  },
  "stay": {
    "guest": {
      "guest_id": "g_77",
      "full_name": "Ada Lovelace",
      "vip": true,
      "language": "en",
      "accessibility": { "registered_disability": false, "mobility_aid": "none" }
    },
    "room_number": "412",
    "check_in": "2026-04-23",
    "check_out": "2026-04-25",
    "reservation_id": "r_123",
    "is_returning_guest": true
  }
}
```

**Response**
```json
{
  "tasks": [
    { "id": "tsk_...", "department": "maintenance", "priority": "high", "status": "pending", ... },
    { "id": "tsk_...", "department": "guest_relations", "priority": "high", "status": "pending", ... }
  ],
  "notifications": [
    { "audience": "guest", "title": "We're on it", "body": "Maintenance has been notified..." }
  ]
}
```

## POST /v1/tasks/status

Staff/backend tells the AI a task moved; the AI returns guest notifications.

**Request**
```json
{ "task_id": "tsk_abc123", "status": "in_progress", "note": "tech en route" }
```

**Response**
```json
{
  "notifications": [
    { "audience": "guest", "title": "On the way", "body": "A team member is on the way to your room." }
  ]
}
```

## POST /v1/emergency

Hard emergency path (panic button, smoke detector). Bypasses LLM.

**Request**
```json
{
  "stay": { ... same shape as above ... },
  "source": "panic_button",
  "details": "Guest triggered in-room SOS button"
}
```

**Response**
```json
{ "tasks": [ ...EMERGENCY tasks for security/front_desk/accessibility... ] }
```

## GET /v1/guests/{guest_id}/memory

Returns the AI's projection of a guest profile + learned preferences.

## POST /v1/guests

Upsert a guest profile (e.g. on reservation creation). Preserves learned preferences.

## GET /v1/health

Liveness probe. Always returns `{"status":"ok"}`.

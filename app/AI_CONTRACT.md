# HotelOS AI Contract

## Endpoint
POST /process

## Input
{
  "room": "string",
  "late_arrival": "boolean",
  "needs_towels": "boolean",
  "guest_type": "string",
  "issue": "string",
  "request": "string",
  "food_order": "string"
}

## Output
{
  "actions": [
    "[Department] Action description"
  ]
}
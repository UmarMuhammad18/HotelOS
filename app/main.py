import asyncio

async def main():
    print("🚀 Starting HotelOS...\n")

    event = {
        "room": "204",
        "late_arrival": True,
        "needs_towels": True,
        "guest_type": "premium",
        "issue": "AC not working"
    }

    guest_memory = {
        "204": {
            "type": "premium",
            "preferences": ["late checkout", "extra towels"]
        }
    }

    print("📥 EVENT:", event)
    print("\n🧠 Orchestrator → analyzing situation...\n")

    guest = guest_memory.get(event["room"], {})

    print("🧹 Operations Agent → handling tasks...")
    if event["needs_towels"]:
        print(f"[ACTION] Assign housekeeping to room {event['room']}")

    if event["issue"]:
        print(f"[ACTION] Schedule maintenance for room {event['room']} ({event['issue']})")

    print("\n🧑 Guest Agent → improving experience...")
    if event["guest_type"] == "premium":
        print(f"[ACTION] Offer late checkout to room {event['room']}")
        print(f"[ACTION] Send apology message with compensation")

    if "extra towels" in guest.get("preferences", []):
        print(f"[MEMORY] Guest prefers extra towels → auto-prioritized service")

    if event["late_arrival"]:
        print(f"[SYSTEM] Adjust room settings for late arrival")

if __name__ == "__main__":
    asyncio.run(main())
from app.learning import get_guest_memory, update_memory


def run_hotel_ai(event):
    results = []

    print("🧠 Orchestrator → analyzing event...\n")
    print("[AI Reasoning] Evaluating guest status, issues, and service needs...\n")
    print("[AI Explanation] Decisions based on guest history, priority, and service optimization\n")

    # 🔥 PRIORITY SYSTEM
    priority = "normal"

    if event.get("guest_type") == "premium":
        priority = "high"

    if event.get("issue"):
        priority = "urgent"

    print(f"[System] Priority level: {priority}\n")

    # 🔥 LOAD MEMORY
    guest = get_guest_memory(event.get("room"))

    # 🔧 Maintenance + Collaboration
    if event.get("issue"):
        results.append(f"[Maintenance] Fixing {event['issue']} in room {event['room']}")
        results.append("[Guest Relations] Inform guest issue is being handled")

    # 👑 VIP Handling
    if event.get("guest_type") == "premium":
        results.append(f"[Guest Relations] VIP handling activated for room {event['room']}")
        results.append("[Revenue] Offer premium suite upgrade")
        results.append("[Concierge] Offer exclusive experience package")

    # 🧹 Housekeeping
    if event.get("needs_towels"):
        results.append(f"[Housekeeping] Towels sent to room {event['room']}")

    # 🚖 Concierge
    if event.get("request") == "taxi":
        results.append(f"[Concierge] Taxi booked for room {event['room']}")

    # 🍽️ Food & Beverage
    if event.get("food_order"):
        results.append(f"[F&B] Preparing {event['food_order']}")
        results.append("[Concierge] Suggest wine pairing for meal")

    # 🏨 Front Office
    if event.get("late_arrival"):
        results.append("[Front Office] Late check-in prepared")

    # 🚨 ESCALATION
    if priority == "urgent" and event.get("guest_type") == "premium":
        results.append("[ALERT] Manager notified immediately")

    # ⚠️ CONFLICT HANDLING
    if event.get("needs_towels") and event.get("issue") == "flood":
        results.append("[System] Emergency cleaning team dispatched")

    # 🧠 LEARNING OUTPUT
    if "extra towels" in guest.get("preferences", []):
        results.append("[Learning] Guest often requests extra towels → auto-prioritized")

    if "late check-in" in guest.get("preferences", []):
        results.append("[Learning] Guest often arrives late → front office pre-alerted")

    learned_foods = [p for p in guest.get("preferences", []) if p.startswith("likes ")]
    for item in learned_foods:
        results.append(f"[Learning] Known preference detected: {item}")

    # 🔁 UPDATE MEMORY
    update_memory(event)

    # 📊 SCORE SYSTEM (🔥 extra polish)
    score = len(results) * 10
    results.append(f"[System Score] AI handled {len(results)} actions → Score: {score}")

    return results
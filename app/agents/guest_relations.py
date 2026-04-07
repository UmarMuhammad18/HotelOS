def handle_guest_relations(event):
    if event.get("issue"):
        return f"[Guest Relations] Apology sent with compensation for room {event['room']}"
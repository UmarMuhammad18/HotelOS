def handle_concierge(event):
    if event.get("request") == "taxi":
        return f"[Concierge] Taxi booked for room {event['room']}"
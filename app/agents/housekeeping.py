def handle_housekeeping(event):
    if event.get("needs_towels"):
        return f"[Housekeeping] Towels sent to room {event['room']}"
def handle_maintenance(event):
    if event.get("issue"):
        return f"[Maintenance] Fixing {event['issue']} in room {event['room']}"
def handle_front_office(event):
    if event.get("late_arrival"):
        return f"[Front Office] Late check-in prepared for room {event['room']}"
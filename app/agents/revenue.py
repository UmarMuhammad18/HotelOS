def handle_revenue(event):
    if event.get("guest_type") == "premium":
        return f"[Revenue] Offer upgrade to premium suite for room {event['room']}"
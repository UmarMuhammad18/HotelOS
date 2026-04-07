def handle_food(event):
    if event.get("food_order"):
        return f"[F&B] Preparing {event['food_order']} for room {event['room']}"
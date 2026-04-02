def assign_housekeeping(room_number: str, priority: str) -> str:
    return f"[ACTION] Housekeeping assigned to room {room_number} ({priority})"

def offer_late_checkout(room_number: str) -> str:
    return f"[ACTION] Late checkout offered to room {room_number}"

def send_guest_message(room_number: str, message: str) -> str:
    return f"[ACTION] Message to room {room_number}: {message}"
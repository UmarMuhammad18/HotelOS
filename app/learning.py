"""
HotelOS Guest Memory
Stores guest preferences and history between stays.
Simple JSON file store — wire this up to a real DB for production.
"""

import json
import os
from datetime import datetime

MEMORY_FILE = os.path.join(os.path.dirname(__file__), "..", "guest_learning.json")


def load_memory() -> dict:
    path = os.path.abspath(MEMORY_FILE)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_memory(memory: dict) -> None:
    path = os.path.abspath(MEMORY_FILE)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(memory, f, indent=2)


def update_memory(event: dict) -> None:
    """
    Append event data to guest memory.
    Called after every classification so future predictions improve.
    """
    memory = load_memory()
    room = event.get("room")
    if not room:
        return

    if room not in memory:
        memory[room] = {"preferences": [], "history": []}

    prefs = memory[room]["preferences"]

    # Preference signals from events
    if event.get("needs_towels") and "extra towels" not in prefs:
        prefs.append("extra towels")

    if event.get("late_arrival") and "late check-in" not in prefs:
        prefs.append("late check-in")

    if event.get("food_order"):
        pref = f"likes {event['food_order']}"
        if pref not in prefs:
            prefs.append(pref)

    if event.get("request") == "taxi" and "needs transport support" not in prefs:
        prefs.append("needs transport support")

    if event.get("guest_type") in ("premium", "vip"):
        tier = f"tier:{event['guest_type']}"
        if tier not in prefs:
            prefs.append(tier)

    # Full event history for LLM context
    history_entry = {
        "date": datetime.utcnow().date().isoformat(),
        **{k: v for k, v in event.items() if k != "room"},
    }
    memory[room]["history"].append(history_entry)

    # Keep history bounded (last 20 events per room)
    if len(memory[room]["history"]) > 20:
        memory[room]["history"] = memory[room]["history"][-20:]

    save_memory(memory)


def get_guest_memory(room: str) -> dict:
    memory = load_memory()
    return memory.get(room, {"preferences": [], "history": []})


def get_all_rooms() -> list[str]:
    """Return all rooms that have memory."""
    return list(load_memory().keys())

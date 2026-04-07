import json
import os

MEMORY_FILE = "guest_learning.json"


def load_memory():
    if os.path.exists(MEMORY_FILE):
        with open(MEMORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_memory(memory):
    with open(MEMORY_FILE, "w", encoding="utf-8") as f:
        json.dump(memory, f, indent=2)


def update_memory(event):
    memory = load_memory()
    room = event.get("room")

    if not room:
        return

    if room not in memory:
        memory[room] = {
            "preferences": [],
            "history": []
        }

    if event.get("needs_towels"):
        if "extra towels" not in memory[room]["preferences"]:
            memory[room]["preferences"].append("extra towels")

    if event.get("late_arrival"):
        if "late check-in" not in memory[room]["preferences"]:
            memory[room]["preferences"].append("late check-in")

    if event.get("food_order"):
        food_pref = f"likes {event['food_order']}"
        if food_pref not in memory[room]["preferences"]:
            memory[room]["preferences"].append(food_pref)

    if event.get("request") == "taxi":
        if "needs transport support" not in memory[room]["preferences"]:
            memory[room]["preferences"].append("needs transport support")

    if event.get("issue"):
        memory[room]["history"].append(f"issue reported: {event['issue']}")

    save_memory(memory)


def get_guest_memory(room):
    memory = load_memory()
    return memory.get(room, {"preferences": [], "history": []})
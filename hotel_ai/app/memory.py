import json
import os
from typing import Dict, List

MEMORY_FILE = "guest_memory.json"

def get_memory() -> Dict[str, List[str]]:
    if not os.path.exists(MEMORY_FILE):
        return {}
    try:
        with open(MEMORY_FILE) as f:
            return json.load(f)
    except Exception:
        return {}

def save_memory(memory: Dict[str, List[str]]):
    with open(MEMORY_FILE, "w") as f:
        json.dump(memory, f, indent=2)

def add_preference(guest_id: str, preference: str):
    memory = get_memory()
    if guest_id not in memory:
        memory[guest_id] = []
    if preference not in memory[guest_id]:
        memory[guest_id].append(preference)
    save_memory(memory)

def get_preferences(guest_id: str) -> List[str]:
    memory = get_memory()
    return memory.get(guest_id, [])

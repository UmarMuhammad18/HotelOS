from .base_agent import BaseAgent
from typing import Dict, Any

class OperationsAgent(BaseAgent):
    def __init__(self):
        super().__init__("Operations Coordinator")

    async def reason(self, message: str, context: Dict[str, Any]) -> str:
        return f"Coordinating staff for: '{message}'. Need to ensure efficiency and minimize wait times for guests."

    async def act(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        if "clean" in message.lower():
            return {
                "action": "assign_cleaning",
                "message": "Housekeeping has been dispatched to Room 302 for immediate cleaning.",
                "data": {"room": "302", "staff": "Maria"}
            }
        return {
            "action": "assign_maintenance",
            "message": "Maintenance team has been alerted about the equipment issue.",
            "data": {"priority": "high", "location": "Lobby"}
        }

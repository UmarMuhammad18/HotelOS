from .base_agent import BaseAgent
from typing import Dict, Any

class MaintenanceAgent(BaseAgent):
    def __init__(self):
        super().__init__("Maintenance Supervisor")

    async def reason(self, message: str, context: Dict[str, Any]) -> str:
        return f"Evaluating maintenance request: '{message}'. Categorizing by urgency and asset type."

    async def act(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        if "eta" in message.lower() or "when" in message.lower():
            return {
                "action": "get_eta",
                "message": "The technician is currently finishing a task and will be at the location in 15 minutes.",
                "data": {"eta_minutes": 15, "technician": "Robert"}
            }
        return {
            "action": "create_ticket",
            "message": "A new maintenance ticket has been created and prioritized in the system.",
            "data": {"ticket_id": "MNT-772", "priority": "medium"}
        }

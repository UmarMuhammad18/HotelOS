from .base_agent import BaseAgent
from typing import Dict, Any

class RevenueAgent(BaseAgent):
    def __init__(self):
        super().__init__("Revenue Manager")

    async def reason(self, message: str, context: Dict[str, Any]) -> str:
        return f"Analyzing market demand and room availability for request: '{message}'. I should check if we can optimize pricing or offer an upgrade."

    async def act(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        if "price" in message.lower() or "rate" in message.lower():
            return {
                "action": "adjust_pricing",
                "message": "I've analyzed the current occupancy and adjusted the room rates to maximize revenue.",
                "data": {"new_rate": 250, "currency": "USD"}
            }
        return {
            "action": "offer_upgrade",
            "message": "I've identified a high-value guest and proposed a room upgrade to a Junior Suite.",
            "data": {"upgrade_to": "Junior Suite", "extra_cost": 50}
        }

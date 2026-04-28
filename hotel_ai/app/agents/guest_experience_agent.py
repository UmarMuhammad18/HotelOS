from .base_agent import BaseAgent
from typing import Dict, Any

class GuestExperienceAgent(BaseAgent):
    def __init__(self):
        super().__init__("Guest Liaison")

    async def reason(self, message: str, context: Dict[str, Any]) -> str:
        return f"Focusing on guest satisfaction for: '{message}'. Personalized service is key."

    async def act(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        if "preference" in message.lower() or "like" in message.lower():
            return {
                "action": "get_preferences",
                "message": "I've retrieved the guest's history and preferences to customize their stay.",
                "data": {"preferences": ["Extra pillows", "High floor", "Vegan menu"]}
            }
        return {
            "action": "send_message",
            "message": "I've sent a personalized welcome message to the guest's mobile app.",
            "data": {"recipient": "John Doe", "channel": "app"}
        }

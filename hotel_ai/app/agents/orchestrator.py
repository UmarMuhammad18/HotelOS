from typing import Dict, Any, List
from .revenue_agent import RevenueAgent
from .operations_agent import OperationsAgent
from .guest_experience_agent import GuestExperienceAgent
from .maintenance_agent import MaintenanceAgent

class Orchestrator:
    def __init__(self):
        self.agents = {
            "revenue": RevenueAgent(),
            "operations": OperationsAgent(),
            "guest_experience": GuestExperienceAgent(),
            "maintenance": MaintenanceAgent()
        }

    async def route_and_resolve(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        # Simple keyword-based routing for the demo
        msg_lower = message.lower()
        
        if any(k in msg_lower for k in ["price", "rate", "revenue", "upgrade"]):
            target = "revenue"
        elif any(k in msg_lower for k in ["clean", "staff", "assign", "room service"]):
            target = "operations"
        elif any(k in msg_lower for k in ["fix", "broken", "leak", "maintenance", "ticket", "eta"]):
            target = "maintenance"
        else:
            target = "guest_experience"

        agent = self.agents[target]
        thought = await agent.reason(message, context)
        result = await agent.act(message, context)

        return {
            "agent": agent.name,
            "thought": thought,
            "response": result["message"],
            "action": result["action"],
            "data": result["data"]
        }

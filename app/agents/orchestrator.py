from agents import Agent
from app.agents.operations import operations_agent
from app.agents.guest_experience import guest_agent

orchestrator = Agent(
    name="Hotel Orchestrator",
    instructions=(
        "You are the brain of a hotel. "
        "Decide which agent should handle each situation. "
        "Delegate tasks properly."
    ),
    handoffs=[operations_agent, guest_agent],
)
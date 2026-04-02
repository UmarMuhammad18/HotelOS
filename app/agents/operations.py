from agents import Agent
from app.tools.hotel_tools import assign_housekeeping

operations_agent = Agent(
    name="Operations Agent",
    instructions="Handle housekeeping and operational issues.",
    tools=[assign_housekeeping],
)
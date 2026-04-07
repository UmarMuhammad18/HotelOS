from agents import Agent
from app.tools.hotel_tools import offer_late_checkout, send_guest_message

guest_agent = Agent(
    name="Guest Experience Agent",
    instructions="You improve guest satisfaction and handle VIP guests.",
    tools=[offer_late_checkout, send_guest_message],
)
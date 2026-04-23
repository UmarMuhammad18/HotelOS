# HotelOS Multi-Agent System

This system uses a ReAct (Reason + Act) loop pattern to manage hotel operations. It consists of an Orchestrator and four specialised sub-agents.

## Architecture

*   **`orchestrator.js`**: Routes events based on keyword analysis to the correct sub-agent.
*   **`reasoning.js`**: Implements the generic ReAct loop, calling the LLM and iterating up to 5 times per event to execute actions.
*   **`llmClient.js`**: Wraps the LLM call. If `OPENAI_API_KEY` is not set, it provides mock JSON responses to simulate agent behavior.
*   **`tools.js`**: Exposes functions (`adjustPricing`, `assignTask`, `createMaintenanceTicket`, etc.) that interact with the SQLite DB and broadcast updates via WebSocket.
*   **`memory.js`**: Stores session history and long-term guest preferences.
*   **Sub-agents**: 
    *   `revenueAgent.js` (Pricing)
    *   `operationsAgent.js` (Tasks)
    *   `guestExperienceAgent.js` (Messaging, Preferences)
    *   `maintenanceAgent.js` (Tickets)
*   **`services/simulation.js`**: Generates periodic synthetic events and random room state changes.
*   **`services/openclaw.js`**: Connects to the external OpenClaw platform or mocks the responses.

## Environment Variables
Add the following to your `.env` file to fully enable external APIs (otherwise mocks will be used):
```env
OPENAI_API_KEY=sk-your-openai-key
OPENCLAW_API_KEY=your-openclaw-key
OPENCLAW_API_URL=https://api.openclaw.com
```

## How to Test

1. Start the API server:
   ```bash
   cd hotelos-api
   npm install openai # If missing
   npm start
   ```
2. Navigate to the frontend dashboard.
3. Use the **Control Panel** to click **"Start Simulation"**.
4. Observe the **Activity Feed**. The orchestrator will receive events, route them to an agent, and the agent will broadcast its *thoughts*, *decisions*, and *executions*.
5. Use the staff chat to send a message like "Guest in room 206 reported AC failure". The orchestrator will route it to the `Maintenance AI`, which will broadcast its thoughts and create a ticket.

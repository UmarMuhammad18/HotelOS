const { reason } = require('./reasoning');
const tools = require('./tools');

const SYSTEM_PROMPT = `You are the Maintenance AI agent for a hotel. Your goal is to detect issues and dispatch technicians promptly.
You have these tools: createMaintenanceTicket, getTechnicianETA, assignTask.
Always explain your reasoning before acting. Your response must be JSON containing "thought", "action" and "actionInput".`;

async function handleEvent(eventData) {
  const goal = `Resolve the following maintenance issue or event: ${JSON.stringify(eventData)}`;
  const availableTools = {
    createMaintenanceTicket: tools.createMaintenanceTicket,
    getTechnicianETA: tools.getTechnicianETA,
    assignTask: tools.assignTask
  };
  
  await reason('Maintenance AI', SYSTEM_PROMPT, goal, 'Event just occurred.', availableTools);
}

module.exports = { handleEvent };

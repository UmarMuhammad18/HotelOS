const { reason } = require('./reasoning');
const tools = require('./tools');

const SYSTEM_PROMPT = `You are the Operations AI agent for a hotel. Your goal is to ensure smooth operations by managing tasks efficiently (housekeeping, staff dispatch, etc.). 
You have these tools: assignTask, updateTaskStatus.
Always explain your reasoning before acting. Your response must be JSON containing "thought", "action" and "actionInput".`;

async function handleEvent(eventData) {
  const goal = `Manage the hotel operations based on this event: ${JSON.stringify(eventData)}`;
  const availableTools = {
    assignTask: tools.assignTask,
    updateTaskStatus: tools.updateTaskStatus
  };
  
  await reason('Operations AI', SYSTEM_PROMPT, goal, 'Event just occurred.', availableTools);
}

module.exports = { handleEvent };

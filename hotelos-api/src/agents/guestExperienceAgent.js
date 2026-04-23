const { reason } = require('./reasoning');
const tools = require('./tools');

const SYSTEM_PROMPT = `You are the Guest Experience AI agent for a hotel. Your goal is to maximize guest satisfaction through personalized messaging and handling their requests.
You have these tools: sendMessage, getGuestPreferences, updatePreferences, sendUpgradeOffer.
Always explain your reasoning before acting. Your response must be JSON containing "thought", "action" and "actionInput".`;

async function handleEvent(eventData) {
  const goal = `Ensure the guest has an excellent experience given this event/message: ${JSON.stringify(eventData)}`;
  const availableTools = {
    sendMessage: tools.sendMessage,
    getGuestPreferences: tools.getGuestPreferences,
    updatePreferences: tools.updatePreferences,
    sendUpgradeOffer: tools.sendUpgradeOffer
  };
  
  await reason('Guest Experience', SYSTEM_PROMPT, goal, 'Event just occurred.', availableTools);
}

module.exports = { handleEvent };

const { reason } = require('./reasoning');
const tools = require('./tools');

const SYSTEM_PROMPT = `You are the Revenue AI agent for a hotel. Your goal is to maximise revenue while maintaining guest satisfaction. 
You have these tools: adjustPricing, sendUpgradeOffer, forecastDemand.
Always explain your reasoning before acting. Your response must be JSON containing "thought", "action" and "actionInput".`;

async function handleEvent(eventData) {
  const goal = `Process the following event to optimise revenue: ${JSON.stringify(eventData)}`;
  const availableTools = {
    adjustPricing: tools.adjustPricing,
    sendUpgradeOffer: tools.sendUpgradeOffer,
    forecastDemand: tools.forecastDemand
  };
  
  await reason('Revenue AI', SYSTEM_PROMPT, goal, 'Event just occurred.', availableTools);
}

module.exports = { handleEvent };

const { callLLM } = require('./llmClient');
const { addShortTermMemory } = require('./memory');

let broadcastCallback = null;
function initReasoning(broadcast) {
  broadcastCallback = broadcast;
}

function broadcast(agent, type, message, details = '') {
  if (broadcastCallback) {
    broadcastCallback({
      type,
      agent,
      message,
      details,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Generic ReAct (Reason + Act) loop
 */
async function reason(agentName, systemPrompt, goal, context, availableTools) {
  let iterations = 0;
  const maxIterations = 5;
  let currentContext = context;

  while (iterations < maxIterations) {
    iterations++;
    
    // 1. Call LLM
    const userPrompt = `Goal: ${goal}\nContext: ${currentContext}\n\nWhat is your next thought and action?`;
    let response;
    try {
      response = await callLLM(systemPrompt, userPrompt);
    } catch (err) {
      console.error(`[${agentName}] LLM Error:`, err);
      break;
    }

    const { thought, action, actionInput } = response;

    // Broadcast thought
    if (thought) {
      broadcast(agentName, 'thought', thought);
      addShortTermMemory({ agent: agentName, type: 'thought', message: thought });
    }

    // 2. Execute action if not 'none'
    if (!action || action === 'none' || action === 'finish') {
      // Goal achieved or no further action needed
      break;
    }

    // Broadcast decision
    broadcast(agentName, 'decision', `Decided to use tool: ${action}`, JSON.stringify(actionInput));
    addShortTermMemory({ agent: agentName, type: 'decision', message: `Used ${action}` });

    let observation = '';
    // 3. Call tool
    if (availableTools[action]) {
      try {
        observation = await availableTools[action](actionInput);
      } catch (err) {
        observation = `Error executing ${action}: ${err.message}`;
      }
    } else {
      observation = `Tool ${action} not found.`;
    }

    // 4. Append observation to context
    currentContext += `\nAction: ${action}\nObservation: ${observation}\n`;
    
    // Let the loop continue to process the observation
  }
  
  return currentContext;
}

module.exports = { initReasoning, reason };

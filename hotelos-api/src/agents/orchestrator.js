const reasoning = require('./reasoning');
const tools = require('./tools');
const revenueAgent = require('./revenueAgent');
const operationsAgent = require('./operationsAgent');
const guestExperienceAgent = require('./guestExperienceAgent');
const maintenanceAgent = require('./maintenanceAgent');

let broadcastCallback = null;

function init(options) {
  const { broadcastAgentEvent, db } = options;
  broadcastCallback = broadcastAgentEvent;
  
  // Initialize subsystems
  tools.initTools(db, broadcastAgentEvent);
  reasoning.initReasoning(broadcastAgentEvent);

  broadcast('Orchestrator', 'success', 'Orchestrator and Sub-Agents initialized successfully.');
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
 * Route events to appropriate sub-agents
 */
async function processEvent(eventData) {
  const eventStr = typeof eventData === 'string' ? eventData.toLowerCase() : JSON.stringify(eventData).toLowerCase();
  
  broadcast('Orchestrator', 'thought', `Received event: ${eventStr}. Analyzing routing...`);

  if (eventStr.includes('price') || eventStr.includes('revenue') || eventStr.includes('forecast') || eventStr.includes('overbook')) {
    broadcast('Orchestrator', 'decision', `Routing event to Revenue AI.`);
    revenueAgent.handleEvent(eventData);
  } else if (eventStr.includes('maintenance') || eventStr.includes('issue') || eventStr.includes('ac') || eventStr.includes('hot')) {
    broadcast('Orchestrator', 'decision', `Routing event to Maintenance AI.`);
    maintenanceAgent.handleEvent(eventData);
  } else if (eventStr.includes('housekeeping') || eventStr.includes('clean') || eventStr.includes('staff') || eventStr.includes('checkout')) {
    broadcast('Orchestrator', 'decision', `Routing event to Operations AI.`);
    operationsAgent.handleEvent(eventData);
  } else if (eventStr.includes('guest') || eventStr.includes('message') || eventStr.includes('vip') || eventStr.includes('arrival') || eventStr.includes('noise')) {
    broadcast('Orchestrator', 'decision', `Routing event to Guest Experience AI.`);
    guestExperienceAgent.handleEvent(eventData);
  } else {
    // Default to Guest Experience or Operations
    broadcast('Orchestrator', 'decision', `Routing event to Guest Experience AI by default.`);
    guestExperienceAgent.handleEvent(eventData);
  }
}

module.exports = { init, processEvent };

const fs = require('fs');
const path = require('path');

// Memory storage
const shortTermMemory = [];
const SHORT_TERM_LIMIT = 20;

// MVP Long-term memory file
const LTM_FILE = path.join(__dirname, '..', '..', 'Database', 'long_term_memory.json');

// Initialize Long Term Memory
let longTermMemory = {};
try {
  if (fs.existsSync(LTM_FILE)) {
    longTermMemory = JSON.parse(fs.readFileSync(LTM_FILE, 'utf8'));
  }
} catch (err) {
  console.error('[memory] Could not load long_term_memory.json', err);
}

function persistLTM() {
  try {
    const dir = path.dirname(LTM_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LTM_FILE, JSON.stringify(longTermMemory, null, 2));
  } catch (err) {
    console.error('[memory] Failed to save long_term_memory.json', err);
  }
}

/**
 * Adds an interaction/event to short-term memory.
 */
function addShortTermMemory(event) {
  shortTermMemory.push({
    timestamp: new Date().toISOString(),
    ...event
  });
  if (shortTermMemory.length > SHORT_TERM_LIMIT) {
    shortTermMemory.shift();
  }
}

/**
 * Gets recent short-term memory as a string context.
 */
function getShortTermMemoryContext() {
  return shortTermMemory.map(m => `[${m.timestamp}] ${m.agent}: ${m.message}`).join('\n');
}

/**
 * Store a preference for a guest in long-term memory.
 */
function storePreference(guestId, text) {
  if (!longTermMemory[guestId]) {
    longTermMemory[guestId] = [];
  }
  longTermMemory[guestId].push({
    text,
    timestamp: new Date().toISOString()
  });
  persistLTM();
}

/**
 * Retrieve preferences for a guest (MVP: returns all strings).
 * If using vector DB later, this would rank by query embedding.
 */
function retrieveSimilarPreferences(guestId, query, topK = 5) {
  if (!longTermMemory[guestId]) return [];
  // For MVP, we simply return the topK most recent preferences
  return longTermMemory[guestId]
    .slice(-topK)
    .map(p => p.text);
}

module.exports = {
  addShortTermMemory,
  getShortTermMemoryContext,
  storePreference,
  retrieveSimilarPreferences
};

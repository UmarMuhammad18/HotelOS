const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

/**
 * Sends a message to the Python AI service and gets a decision/response.
 * @param {string} message - The input text from staff or system.
 * @param {object} context - Additional metadata (guest info, room state, etc).
 * @returns {Promise<object>} - The AI's thought process and action.
 */
async function callAgent(message, context = {}) {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/agent/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        context
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('AI Service Error:', error.message);
    return {
      agent: 'System',
      thought: 'The AI service is currently unavailable. Falling back to default protocol.',
      response: 'I am having trouble connecting to my specialized sub-agents. Please try again in a moment.',
      action: 'error_fallback',
      data: {}
    };
  }
}

module.exports = {
  callAgent
};

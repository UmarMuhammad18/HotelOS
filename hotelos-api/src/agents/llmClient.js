const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Calls OpenAI API (or falls back to mock if no key is provided).
 * The LLM is expected to return JSON in the format:
 * { "thought": "...", "action": "...", "actionInput": { ... } }
 */
async function callLLM(systemPrompt, userPrompt) {
  if (OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2,
          response_format: { type: "json_object" }
        })
      });
      if (!response.ok) {
        throw new Error(`OpenAI API Error: ${response.statusText}`);
      }
      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (err) {
      console.error('[llmClient] LLM call failed:', err.message);
      return generateMockResponse(systemPrompt, userPrompt);
    }
  }
  return generateMockResponse(systemPrompt, userPrompt);
}

function generateMockResponse(systemPrompt, userPrompt) {
  const p = userPrompt.toLowerCase();
  
  // If we already took an action and received an observation, we should end the loop.
  if (p.includes('observation:')) {
    return {
      thought: "The action was successful, I have completed my task.",
      action: "none",
      actionInput: {}
    };
  }
  
  if (p.includes('revenue') || p.includes('forecast') || p.includes('overbook')) {
    return {
      thought: "Demand changes detected, I should adjust pricing.",
      action: "adjustPricing",
      actionInput: { roomType: "suite", percentage: 15, reason: "High demand / Overbooking" }
    };
  }
  if (p.includes('maintenance') || p.includes('issue') || p.includes('ac ') || p.includes('hot ') || p.includes('cooling')) {
    return {
      thought: "An issue was reported. I should create a maintenance ticket.",
      action: "createMaintenanceTicket",
      actionInput: { roomNumber: "206", issueDescription: "Reported room issue" }
    };
  }
  if (p.includes('late arrival') || p.includes('checkout') || p.includes('vip') || p.includes('guest')) {
    return {
      thought: "The guest needs attention, sending a message or checking preferences.",
      action: "sendMessage",
      actionInput: { guestId: "g1", message: "Hello, we have noted your request and are preparing accordingly." }
    };
  }
  if (p.includes('housekeeping') || p.includes('clean') || p.includes('shortage')) {
    return {
      thought: "Housekeeping needs to be assigned to this room.",
      action: "assignTask",
      actionInput: { taskType: "cleaning", roomNumber: "101", priority: "high" }
    };
  }

  // Generic fallback action
  return {
    thought: "I am routing this general event. No specific tool needed right now.",
    action: "none",
    actionInput: {}
  };
}

module.exports = { callLLM };

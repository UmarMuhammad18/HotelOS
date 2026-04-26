/**
 * llmClient.js — Unified LLM client.
 * Priority: Anthropic Claude → OpenAI → keyword mock
 * Agents expect JSON: { "thought": "...", "action": "...", "actionInput": { ... } }
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY    || '';

async function callAnthropic(systemPrompt, userPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${res.statusText}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || '{}';
  const clean = text.replace(/```json|```/gi, '').trim();
  return JSON.parse(clean);
}

async function callOpenAI(systemPrompt, userPrompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

function generateMockResponse(_systemPrompt, userPrompt) {
  const p = userPrompt.toLowerCase();

  if (p.includes('observation:')) {
    return { thought: 'Action was successful. Task complete.', action: 'none', actionInput: {} };
  }
  if (p.includes('revenue') || p.includes('forecast') || p.includes('overbook') || p.includes('price')) {
    return {
      thought: 'Demand signal detected. Adjusting room pricing to optimise revenue.',
      action: 'adjustPricing',
      actionInput: { roomType: 'suite', percentage: 15, reason: 'High demand / overbooking risk' },
    };
  }
  if (p.includes('maintenance') || p.includes('issue') || p.includes('repair') ||
      p.includes('ac ') || p.includes('cooling') || p.includes('broken')) {
    return {
      thought: 'Maintenance issue reported. Creating a high-priority ticket.',
      action: 'createMaintenanceTicket',
      actionInput: { roomNumber: '206', issueDescription: 'Reported equipment issue' },
    };
  }
  if (p.includes('late arrival') || p.includes('vip') || p.includes('arrival') || p.includes('noise')) {
    return {
      thought: 'Guest attention required. Sending a personalised message.',
      action: 'sendMessage',
      actionInput: { guestId: 'g1', message: 'We are aware of your request and are handling it immediately.' },
    };
  }
  if (p.includes('housekeeping') || p.includes('clean') || p.includes('shortage') || p.includes('checkout')) {
    return {
      thought: 'Housekeeping task needed. Assigning to available staff.',
      action: 'assignTask',
      actionInput: { taskType: 'cleaning', roomNumber: '101', priority: 'high' },
    };
  }
  return {
    thought: 'General event received. No specific tool action required at this time.',
    action: 'none',
    actionInput: {},
  };
}

async function callLLM(systemPrompt, userPrompt) {
  if (ANTHROPIC_API_KEY) {
    try {
      return await callAnthropic(systemPrompt, userPrompt);
    } catch (err) {
      console.warn('[llmClient] Anthropic failed, trying OpenAI:', err.message);
    }
  }
  if (OPENAI_API_KEY) {
    try {
      return await callOpenAI(systemPrompt, userPrompt);
    } catch (err) {
      console.warn('[llmClient] OpenAI failed, falling back to mock:', err.message);
    }
  }
  return generateMockResponse(systemPrompt, userPrompt);
}

module.exports = { callLLM };

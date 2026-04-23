const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || '';
const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY || '';

async function callOpenClaw(command, context = {}) {
  const c = command.toLowerCase();

  if (OPENCLAW_API_KEY && OPENCLAW_API_URL) {
    try {
      const response = await fetch(`${OPENCLAW_API_URL.replace(/\/$/, '')}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENCLAW_API_KEY}`,
        },
        body: JSON.stringify({ command, context }),
      });
      if (response.ok) {
        const data = await response.json();
        return { source: 'openclaw', ...data };
      }
    } catch (err) {
      console.error('[OpenClaw] API call failed, falling back to mock.', err);
    }
  }

  // Fallback / Mock
  if (c.includes('price') || c.includes('revenue')) {
    return { 
      source: 'mock',
      action: 'dynamic_pricing', 
      message: 'Suggested +12% on premium rooms for Friday peak.', 
      tools: ['PolyForge', 'Foundry'] 
    };
  }
  if (c.includes('maint') || c.includes('repair')) {
    return { 
      source: 'mock',
      action: 'maintenance_routing', 
      message: 'Ticket routed to Engineering pool B — ETA 18 min.', 
      tools: ['clawtools'] 
    };
  }
  if (c.includes('guest') || c.includes('message')) {
    return { 
      source: 'mock',
      action: 'guest_messaging', 
      message: 'Draft welcome + upsell sent for review.', 
      tools: ['clawtools', 'Stratus X1-AC'] 
    };
  }
  return { 
    source: 'mock',
    action: 'general', 
    message: `Processed: "${command}"`, 
    context, 
    tools: ['clawtools'] 
  };
}

module.exports = { callOpenClaw };

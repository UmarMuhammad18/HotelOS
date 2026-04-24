/**
 * pythonAdvisor.js — Node client for the Python advisor service.
 *
 * Drop this file into `hotelos-api/src/agents/` and wire it into
 * orchestrator.js. See INTEGRATION_NODE.md for the full patch.
 *
 * Node talks to Python over HTTP. Python returns a `Plan` describing what
 * to broadcast and which tools to call. This module:
 *   1. Calls Python's REST endpoints.
 *   2. Executes the returned Plan: broadcasts events, runs tools.js
 *      functions, broadcasts per-tool-success events, and optionally
 *      emits a guest reply over the /chat WS.
 *
 * Fail-open: if Python is unreachable or errors, we broadcast a
 * degraded-mode alert and fall back to the existing keyword orchestrator.
 */

const tools = require('./tools');

const ADVISOR_URL = process.env.PYTHON_ADVISOR_URL || 'http://localhost:9000/v1';
const ADVISOR_TOKEN = process.env.PYTHON_ADVISOR_TOKEN || '';
const ADVISOR_TIMEOUT_MS = Number(process.env.PYTHON_ADVISOR_TIMEOUT_MS || 5000);

let broadcastCallback = null;
let chatSendCallback = null;
let fallbackOrchestrator = null;

function init({ broadcastAgentEvent, sendChatReply, fallback }) {
  broadcastCallback = broadcastAgentEvent;
  chatSendCallback = sendChatReply || null;
  fallbackOrchestrator = fallback || null;
}

function broadcast(ev) {
  if (!broadcastCallback) return;
  broadcastCallback({ timestamp: new Date().toISOString(), ...ev });
}

async function postAdvisor(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ADVISOR_TIMEOUT_MS);
  try {
    const res = await fetch(`${ADVISOR_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ADVISOR_TOKEN ? { Authorization: `Bearer ${ADVISOR_TOKEN}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Advisor ${path} -> ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Execute a Plan returned from the advisor.
 */
async function executePlan(plan, { chatReplyFn } = {}) {
  // 1. Broadcast activity-feed events in order.
  for (const ev of plan.events || []) {
    broadcast(ev);
  }

  // 2. Execute each tool call, broadcasting success/failure.
  for (const call of plan.tool_calls || []) {
    const fn = tools[call.tool];
    if (typeof fn !== 'function') {
      broadcast({
        agent: 'Orchestrator',
        type: 'alert',
        message: `Unknown tool requested by advisor: ${call.tool}`,
      });
      continue;
    }
    try {
      await fn(call.args || {});
      if (call.broadcast_on_success) broadcast(call.broadcast_on_success);
    } catch (err) {
      broadcast({
        agent: 'Orchestrator',
        type: 'alert',
        message: `Tool ${call.tool} failed`,
        details: err && err.message ? err.message : String(err),
      });
    }
  }

  // 3. Deliver guest reply (only if the caller passed a chat reply fn).
  if (plan.guest_reply && (chatReplyFn || chatSendCallback)) {
    const fn = chatReplyFn || chatSendCallback;
    try {
      fn(plan.guest_reply.message);
    } catch (err) {
      console.error('[advisor] chat reply failed:', err.message);
    }
  }

  return plan;
}

/**
 * Shape a HotelEvent + StayContext from the raw Node-side data.
 * The backend team's DB rows get mapped here once so individual call sites
 * don't need to know the wire format.
 */
function buildAdvisorPayload({ channel, text, guest, room, reservationId, metadata, traceId }) {
  return {
    event: {
      channel,
      reservation_id: reservationId || `r_${guest.id}`,
      room_number: room?.number || String(room),
      guest_id: guest.id,
      text,
      metadata: metadata || {},
      trace_id: traceId,
    },
    stay: {
      guest: {
        guest_id: guest.id,
        full_name: guest.name,
        vip: !!guest.is_vip,
        email: guest.email,
        phone: guest.phone,
        language: guest.language || 'en',
        accessibility: guest.accessibility || { registered_disability: false, mobility_aid: 'none' },
        emergency: guest.emergency || { preferred_language: guest.language || 'en' },
        preferences: guest.preferences || {},
        past_requests: guest.past_requests || [],
      },
      room_number: room?.number || String(room),
      check_in: guest.check_in,
      check_out: guest.check_out,
      reservation_id: reservationId || `r_${guest.id}`,
      is_returning_guest: !!guest.is_returning_guest,
    },
  };
}

/** Public: drive an event through Python; execute the plan. */
async function processEvent(payload, chatReplyFn) {
  try {
    const { plan } = await postAdvisor('/events', payload);
    return await executePlan(plan, { chatReplyFn });
  } catch (err) {
    console.error('[advisor] /events failed:', err.message);
    broadcast({
      agent: 'Orchestrator',
      type: 'alert',
      message: 'Advisor degraded — using local keyword router',
      details: err.message,
    });
    if (fallbackOrchestrator) {
      // Keep the hotel running on the existing Node orchestrator.
      return fallbackOrchestrator.processEvent(payload.event?.text || payload);
    }
    throw err;
  }
}

/** Public: advise on a task status transition. */
async function adviseTaskStatus({ task_id, status, stay, note }, chatReplyFn) {
  try {
    const { plan } = await postAdvisor('/tasks/status', { task_id, status, stay, note });
    return await executePlan(plan, { chatReplyFn });
  } catch (err) {
    console.error('[advisor] /tasks/status failed:', err.message);
  }
}

/** Public: hard emergency path. */
async function adviseEmergency({ stay, source, details }, chatReplyFn) {
  try {
    const { plan } = await postAdvisor('/emergency', { stay, source, details });
    return await executePlan(plan, { chatReplyFn });
  } catch (err) {
    console.error('[advisor] /emergency failed:', err.message);
    // On emergency, minimum viable broadcast so staff at least see it.
    broadcast({
      agent: 'Security AI',
      type: 'alert',
      message: `Emergency reported (${source}): ${details}`,
    });
  }
}

module.exports = {
  init,
  processEvent,
  adviseTaskStatus,
  adviseEmergency,
  buildAdvisorPayload,
  executePlan,
};

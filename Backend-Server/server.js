

const http      = require('http');
const WebSocket = require('ws');
const fs        = require('fs');
const path      = require('path');
const url       = require('url');

const PORT   = 8080;
const DB_DIR = path.join(__dirname, '..', 'database');

function dbPath(name) {
  return path.join(DB_DIR, `${name}.json`);
}

function readDb(name) {
  try { return JSON.parse(fs.readFileSync(dbPath(name), 'utf8')); }
  catch { return []; }
}

function writeDb(name, data) {
  fs.writeFileSync(dbPath(name), JSON.stringify(data, null, 2));
}

function appendLog(name, record, max = 500) {
  const records = readDb(name);
  record.created_at = new Date().toISOString();
  records.push(record);
  writeDb(name, records.slice(-max));
  return record;
}

function updateRecord(collection, id, fields) {
  const records = readDb(collection);
  const i = records.findIndex(r => r.id === id);
  if (i === -1) return null;
  records[i] = { ...records[i], ...fields, updated_at: new Date().toISOString() };
  writeDb(collection, records);
  return records[i];
}


const feedClients = new Set();
const chatClients = new Set();

function broadcastToFeed(type, agent, message, details = '') {
  const payload = JSON.stringify({
    type,     
    agent,
    message,
    details,
    timestamp: new Date().toISOString(),
  });
  for (const ws of feedClients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}


let simRunning = false;
let simSpeed   = 1.0;
let simTimer   = null;
let simIndex   = 0;

const SIM_MESSAGES = [
  { type: 'thought',   agent: 'Orchestrator',    message: 'Analysing occupancy patterns across all floors...' },
  { type: 'thought',   agent: 'Revenue AI',       message: 'Evaluating upsell opportunities for checked-in guests' },
  { type: 'decision',  agent: 'Revenue AI',       message: 'Adjusting weekend rates +$22 based on demand forecast' },
  { type: 'decision',  agent: 'Orchestrator',     message: 'Assigning housekeeping to room 206 — priority high' },
  { type: 'execution', agent: 'Housekeeping AI',  message: 'Room 206 status updated to cleaning' },
  { type: 'execution', agent: 'Concierge AI',     message: 'Suite upgrade offer sent to guest in room 303' },
  { type: 'alert',     agent: 'Maintenance AI',   message: 'AC failure detected in Room 206 — technician dispatched' },
  { type: 'alert',     agent: 'Orchestrator',     message: 'Checkout overdue for Room 211 — front desk notified' },
  { type: 'success',   agent: 'Housekeeping AI',  message: 'Room 207 cleaned and ready for next guest' },
  { type: 'success',   agent: 'Revenue AI',       message: 'Suite upgrade accepted by VIP guest — +$180 revenue' },
  { type: 'thought',   agent: 'Guest Experience', message: 'Checking preferences for arriving guests tonight' },
  { type: 'decision',  agent: 'Guest Experience', message: 'Proactive late-arrival prep triggered for room 104' },
  { type: 'execution', agent: 'Concierge AI',     message: 'Airport taxi confirmed for guest in room 101 at 08:00' },
  { type: 'success',   agent: 'Orchestrator',     message: 'All agents operating within normal parameters' },
];

function startSimulation(speed) {
  if (simTimer) clearInterval(simTimer);
  simRunning = true;
  simSpeed   = speed || 1.0;
  const delay = Math.round(3000 / simSpeed);
  simTimer = setInterval(() => {
    const msg = SIM_MESSAGES[simIndex % SIM_MESSAGES.length];
    simIndex++;
    broadcastToFeed(msg.type, msg.agent, msg.message, 'Action taken automatically');
  }, delay);
}

function stopSimulation() {
  simRunning = false;
  if (simTimer) { clearInterval(simTimer); simTimer = null; }
}

const EVENT_SCENARIOS = {
  late_arrival:   { type: 'alert',    agent: 'Front Office',    message: 'Late guest arrival — room 104 prep triggered',    details: 'Housekeeping and concierge notified' },
  room_issue:     { type: 'alert',    agent: 'Maintenance AI',  message: 'AC failure reported in Room 206',                  details: 'Maintenance team dispatched immediately' },
  vip_guest:      { type: 'decision', agent: 'Guest Experience',message: 'VIP check-in — white-glove protocol activated',    details: 'Champagne, escort, and suite upgrade offered' },
  staff_shortage: { type: 'alert',    agent: 'Orchestrator',    message: 'Staff shortage — only 2 housekeepers available',   details: 'Tasks re-prioritised, manager notified' },
  overbooking:    { type: 'alert',    agent: 'Revenue AI',      message: 'Overbooking detected — 2 rooms over capacity',     details: 'Partner hotel contacted for overflow' },
  early_checkout: { type: 'decision', agent: 'Guest Experience',message: 'Early checkout request from Room 302',              details: 'Recovery offer sent — $50 F&B credit' },
};


function getChatReply(message) {
  const m = message.toLowerCase();
  if (m.includes('ac') || m.includes('cooling') || m.includes('hot'))
    return 'Maintenance has been notified for the AC issue. A technician will arrive within 20 minutes.';
  if (m.includes('late') || m.includes('checkout'))
    return 'I will arrange the late checkout. What time does the guest need? I can extend up to 2 PM at no charge for loyalty members.';
  if (m.includes('upgrade') || m.includes('suite'))
    return 'Checking availability... Suite 304 is free tonight at +$80/night. Shall I send the offer to the guest now?';
  if (m.includes('clean') || m.includes('housekeeping') || m.includes('towel'))
    return 'Housekeeping dispatched. Expected to arrive in 15 minutes.';
  if (m.includes('food') || m.includes('room service') || m.includes('order'))
    return 'Room service order received. Estimated delivery: 30 minutes. Kitchen has been notified.';
  if (m.includes('taxi') || m.includes('transport') || m.includes('airport'))
    return 'I can arrange a taxi. What time does the guest need to leave, and what is the destination?';
  if (m.includes('noise') || m.includes('complaint'))
    return 'Complaint logged. Security has been notified and will attend within 10 minutes. Shall I offer the guest a gesture of goodwill?';
  return 'Understood. Our agent system is processing your request. Is there anything else I can help with?';
}

function parseBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

async function handleRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const pathname = url.parse(req.url).pathname;
  const method   = req.method;

  if (pathname === '/api/health' && method === 'GET') {
    return send(res, 200, {
      status: 'ok',
      simulation_running: simRunning,
      simulation_speed: simSpeed,
      connected_dashboards: feedClients.size,
      connected_chats: chatClients.size,
    });
  }

  if (pathname === '/api/state' && method === 'GET') {
    const rooms    = readDb('rooms');
    const guests   = readDb('guests');
    const staff    = readDb('staff');
    const tasks    = readDb('tasks');
    const events   = readDb('events').slice(-30).reverse();
    const actions  = readDb('actions').slice(-50).reverse();
    const occupied  = rooms.filter(r => r.status === 'occupied').length;
    const checkedIn = guests.filter(g => g.status === 'checked_in').length;
    const avail     = staff.filter(s => s.status === 'available').length;
    const pending   = tasks.filter(t => ['pending', 'assigned'].includes(t.status)).length;
    const revenue   = guests.filter(g => g.status === 'checked_in').reduce((s, g) => s + (g.spending || 0), 0);
    return send(res, 200, {
      metrics: {
        total_rooms: rooms.length,
        occupied_rooms: occupied,
        occupancy_rate: rooms.length ? +(occupied / rooms.length).toFixed(2) : 0,
        active_guests: checkedIn,
        available_staff: avail,
        total_staff: staff.length,
        pending_tasks: pending,
        revenue_today: +revenue.toFixed(2),
      },
      rooms, guests, staff, tasks,
      recent_events: events,
      recent_actions: actions,
    });
  }

  if (pathname === '/api/rooms' && method === 'GET')
    return send(res, 200, readDb('rooms'));

  if (pathname.match(/^\/api\/rooms\/[^/]+$/) && method === 'PATCH') {
    const id = pathname.split('/')[3];
    const body = await parseBody(req);
    const updated = updateRecord('rooms', id, body);
    if (!updated) return send(res, 404, { error: 'Room not found' });
    broadcastToFeed('execution', 'Orchestrator', `Room ${updated.number} updated — status: ${updated.status}`);
    return send(res, 200, updated);
  }

  if (pathname === '/api/guests' && method === 'GET')
    return send(res, 200, readDb('guests'));

  if (pathname.match(/^\/api\/guests\/[^/]+\/checkin$/) && method === 'POST') {
    const id = pathname.split('/')[3];
    const body = await parseBody(req);
    const now = new Date().toISOString();
    const guest = updateRecord('guests', id, { status: 'checked_in', room_id: body.room_id, check_in: now });
    if (!guest) return send(res, 404, { error: 'Guest not found' });
    const room = body.room_id ? updateRecord('rooms', body.room_id, { status: 'occupied', guest_id: id }) : null;
    broadcastToFeed('success', 'Front Office', `${guest.name} checked in to room ${room ? room.number : body.room_id}`);
    return send(res, 200, { guest, room });
  }

  if (pathname.match(/^\/api\/guests\/[^/]+\/checkout$/) && method === 'POST') {
    const id = pathname.split('/')[3];
    const guests = readDb('guests');
    const guest = guests.find(g => g.id === id);
    if (!guest) return send(res, 404, { error: 'Guest not found' });
    const roomId = guest.room_id;
    const now = new Date().toISOString();
    const updatedGuest = updateRecord('guests', id, { status: 'checked_out', room_id: null, check_out: now });
    if (roomId) updateRecord('rooms', roomId, { status: 'cleaning', guest_id: null });
    broadcastToFeed('execution', 'Front Office', `${guest.name} checked out — room queued for cleaning`);
    return send(res, 200, { guest: updatedGuest });
  }

  if (pathname.match(/^\/api\/guests\/[^/]+$/) && method === 'PATCH') {
    const id = pathname.split('/')[3];
    const body = await parseBody(req);
    const updated = updateRecord('guests', id, body);
    if (!updated) return send(res, 404, { error: 'Guest not found' });
    return send(res, 200, updated);
  }

  if (pathname === '/api/staff' && method === 'GET')
    return send(res, 200, readDb('staff'));

  if (pathname.match(/^\/api\/staff\/[^/]+$/) && method === 'PATCH') {
    const id = pathname.split('/')[3];
    const body = await parseBody(req);
    const updated = updateRecord('staff', id, body);
    if (!updated) return send(res, 404, { error: 'Staff not found' });
    broadcastToFeed('execution', 'Orchestrator', `${updated.name} → status: ${updated.status}`);
    return send(res, 200, updated);
  }

  if (pathname === '/api/tasks' && method === 'GET')
    return send(res, 200, readDb('tasks'));

  if (pathname === '/api/tasks' && method === 'POST') {
    const body = await parseBody(req);
    const task = {
      id: `t${Date.now()}`,
      status: 'pending',
      created_at: new Date().toISOString(),
      completed_at: null,
      ...body,
    };
    const tasks = readDb('tasks');
    tasks.push(task);
    writeDb('tasks', tasks);
    broadcastToFeed('decision', 'Orchestrator', `New task: ${task.title}`, `Priority: ${task.priority || 'medium'}`);
    return send(res, 201, task);
  }

  if (pathname.match(/^\/api\/tasks\/[^/]+$/) && method === 'PATCH') {
    const id = pathname.split('/')[3];
    const body = await parseBody(req);
    if (body.status === 'completed') body.completed_at = new Date().toISOString();
    const updated = updateRecord('tasks', id, body);
    if (!updated) return send(res, 404, { error: 'Task not found' });
    if (body.status === 'completed') {
      broadcastToFeed('success', 'Orchestrator', `Task completed: ${updated.title}`);
      if (updated.assigned_to) {
        updateRecord('staff', updated.assigned_to, { status: 'available', current_task_id: null });
      }
    }
    return send(res, 200, updated);
  }

  if (pathname === '/api/events' && method === 'GET')
    return send(res, 200, readDb('events').slice(-50).reverse());

  if (pathname === '/api/events' && method === 'POST') {
    const body = await parseBody(req);
    const event = appendLog('events', { id: `e${Date.now()}`, ...body }, 200);
    const typeMap = {
      guest_checkin: 'success', guest_checkout: 'execution',
      late_arrival: 'alert', room_issue: 'alert',
      vip_arrival: 'decision', complaint: 'alert',
      maintenance_needed: 'alert', upsell_opportunity: 'decision',
    };
    broadcastToFeed(
      typeMap[event.event_type] || 'thought',
      event.agent || 'Orchestrator',
      event.description || event.event_type,
      ''
    );
    return send(res, 201, event);
  }

  if (pathname === '/api/actions' && method === 'GET')
    return send(res, 200, readDb('actions').slice(-50).reverse());

  if (pathname === '/api/actions' && method === 'POST') {
    const body = await parseBody(req);
    const action = appendLog('actions', { id: `a${Date.now()}`, ...body }, 500);
    const typeMap = {
      assign_task: 'decision', adjust_pricing: 'decision',
      send_welcome: 'execution', alert_staff: 'alert',
      offer_upgrade: 'decision', escalate_issue: 'alert',
      task_completed: 'success', notify_guest: 'execution',
    };
    const agentLabel = {
      orchestrator: 'Orchestrator', operations: 'Operations AI',
      revenue: 'Revenue AI', guest_experience: 'Guest Experience',
    }[action.agent] || action.agent || 'Orchestrator';
    broadcastToFeed(
      typeMap[action.action_type] || 'execution',
      agentLabel,
      action.description,
      action.impact || ''
    );
    return send(res, 201, action);
  }

  if (pathname === '/api/simulation/start' && method === 'POST') {
    const body = await parseBody(req);
    startSimulation(body.speed || simSpeed);
    broadcastToFeed('success', 'Orchestrator', 'Simulation started — all agents online');
    return send(res, 200, { status: 'started', speed: simSpeed });
  }

  if (pathname === '/api/simulation/stop' && method === 'POST') {
    stopSimulation();
    broadcastToFeed('alert', 'Orchestrator', 'Simulation paused by operator');
    return send(res, 200, { status: 'stopped' });
  }

  if (pathname === '/api/simulation/speed' && method === 'PUT') {
    const body = await parseBody(req);
    simSpeed = body.speed || 1.0;
    if (simRunning) startSimulation(simSpeed);
    return send(res, 200, { speed: simSpeed });
  }

  if (pathname === '/api/simulation/event' && method === 'POST') {
    const body = await parseBody(req);
    const scenario = EVENT_SCENARIOS[body.eventType];
    if (scenario) {
      broadcastToFeed(scenario.type, scenario.agent, scenario.message, scenario.details);
      appendLog('events', {
        id: `e${Date.now()}`,
        event_type: body.eventType,
        description: scenario.message,
        agent: scenario.agent,
      }, 200);
    }
    return send(res, 200, { injected: body.eventType || 'unknown' });
  }

  if (pathname === '/api/simulation/reset' && method === 'POST') {
    stopSimulation();
    writeDb('tasks', []);
    writeDb('events', []);
    writeDb('actions', []);
    broadcastToFeed('alert', 'Orchestrator', 'System reset — returning to initial state');
    return send(res, 200, { status: 'reset' });
  }

  if (pathname === '/api/simulation/status' && method === 'GET') {
    return send(res, 200, {
      running: simRunning,
      speed: simSpeed,
      connected_dashboards: feedClients.size,
    });
  }

  return send(res, 404, { error: `Not found: ${method} ${pathname}` });
}

const httpServer = http.createServer(handleRequest);

const wsFeed = new WebSocket.Server({ noServer: true });
const wsChat = new WebSocket.Server({ noServer: true });

wsFeed.on('connection', (ws) => {
  feedClients.add(ws);
  console.log(`[Feed WS] connected — total: ${feedClients.size}`);
  ws.send(JSON.stringify({
    type: 'success', agent: 'Orchestrator',
    message: 'HotelOS backend connected — all systems operational',
    details: '', timestamp: new Date().toISOString(),
  }));
  ws.on('close', () => { feedClients.delete(ws); });
  ws.on('error', () => { feedClients.delete(ws); });
});

wsChat.on('connection', (ws) => {
  chatClients.add(ws);
  console.log(`[Chat WS] connected — total: ${chatClients.size}`);
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      broadcastToFeed('thought', 'Staff Chat', `Staff query: "${msg.message}"`, '');
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            message: getChatReply(msg.message),
            timestamp: new Date().toISOString(),
          }));
        }
      }, 900 + Math.random() * 600);
    } catch {}
  });
  ws.on('close', () => { chatClients.delete(ws); });
  ws.on('error', () => { chatClients.delete(ws); });
});

httpServer.on('upgrade', (request, socket, head) => {
  const { pathname } = url.parse(request.url);
  if (pathname === '/chat') {
    wsChat.handleUpgrade(request, socket, head, (ws) => wsChat.emit('connection', ws, request));
  } else {
    wsFeed.handleUpgrade(request, socket, head, (ws) => wsFeed.emit('connection', ws, request));
  }
});

httpServer.listen(PORT, () => {
  console.log(`\n🏨  HotelOS Backend`);
  console.log(`   REST API  → http://localhost:${PORT}/api`);
  console.log(`   Feed WS   → ws://localhost:${PORT}        (ActivityFeed, DashboardLayout)`);
  console.log(`   Chat WS   → ws://localhost:${PORT}/chat   (StaffChat)`);
  console.log(`   Health    → http://localhost:${PORT}/api/health\n`);
});

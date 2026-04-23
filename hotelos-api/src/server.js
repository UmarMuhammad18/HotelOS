/**
 * HotelOS API — Express REST + WebSocket feed (/), chat (/chat).
 * SQLite via sql.js (WASM). Message shapes match the CRA dashboard.
 */
require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { WebSocketServer } = require('ws');
const url = require('url');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Stripe = require('stripe');
const { getDb, persist, all, getOne } = require('./db');
const orchestrator = require('./agents/orchestrator');
const simulation = require('./services/simulation');
const openclaw = require('./services/openclaw');

const PORT = Number(process.env.PORT) || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-jwt-secret-change-me';
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || '';
const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY || '';

const stripe = STRIPE_SECRET ? new Stripe(STRIPE_SECRET) : null;

const app = express();
const feedClients = new Set();
const chatClients = new Set();

let saveTimer;
function schedulePersist(db) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persist(db), 400);
}

function broadcastFeed(obj) {
  const payload = JSON.stringify({
    ...obj,
    timestamp: obj.timestamp || new Date().toISOString(),
  });
  for (const ws of feedClients) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

// Old simulation logic removed. Handled by services/simulation.js

function safeJson(s, fallback) {
  try {
    return JSON.parse(s || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

function guestToApi(g) {
  return {
    id: g.id,
    name: g.name,
    email: g.email,
    phone: g.phone,
    status: g.status,
    room_id: g.room_id,
    room_number: g.room_number ?? null,
    loyalty_tier: g.loyalty_tier,
    is_vip: !!g.is_vip,
    spending: g.spending,
    check_in: g.check_in,
    check_out: g.check_out,
    preferences: safeJson(g.preferences, {}),
    special_requests: safeJson(g.special_requests, []),
    purchase_history: safeJson(g.purchase_history, []),
  };
}

function taskToApi(t) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assignedTo: t.assigned_to,
    createdAt: t.created_at,
    completedAt: t.completed_at,
  };
}

function authOptional(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
  } catch {
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.post(
  '/api/stripe-webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      return res.status(503).json({ error: 'Stripe webhook not configured' });
    }
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    const db = await getDb();
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      db.run('UPDATE payment_transactions SET status = ? WHERE stripe_payment_intent_id = ?', ['succeeded', pi.id]);
      schedulePersist(db);
      broadcastFeed({
        type: 'success',
        agent: 'Payments',
        message: `Payment confirmed: ${pi.id}`,
        details: `Amount: ${pi.amount_received / 100} ${pi.currency?.toUpperCase()}`,
      });
    }
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      db.run('UPDATE payment_transactions SET status = ? WHERE stripe_payment_intent_id = ?', ['succeeded', s.id]);
      schedulePersist(db);
      broadcastFeed({
        type: 'success',
        agent: 'Payments',
        message: `Checkout completed`,
        details: s.id,
      });
    }
    res.json({ received: true });
  }
);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/api/health', async (req, res) => {
  res.json({
    status: 'ok',
    simulation_running: simulation.getSimRunning(),
    simulation_speed: simulation.getSimSpeed(),
    connected_feed: feedClients.size,
    connected_chat: chatClients.size,
  });
});

app.get('/api/state', authOptional, async (req, res) => {
  const db = await getDb();
  const rooms = all(db, 'SELECT * FROM rooms ORDER BY number');
  const guests = all(
    db,
    `SELECT g.*, r.number as room_number FROM guests g LEFT JOIN rooms r ON g.room_id = r.id ORDER BY g.name`
  );
  const tasks = all(db, 'SELECT * FROM tasks ORDER BY datetime(created_at) DESC');
  const occupied = rooms.filter((r) => r.status === 'occupied').length;
  const checkedIn = guests.filter((g) => g.status === 'checked_in').length;
  const pending = tasks.filter((t) => ['pending', 'in-progress'].includes(t.status)).length;
  const revenue = guests.filter((g) => g.status === 'checked_in').reduce((s, g) => s + (g.spending || 0), 0);
  res.json({
    metrics: {
      total_rooms: rooms.length,
      occupied_rooms: occupied,
      occupancy_rate: rooms.length ? +(occupied / rooms.length).toFixed(2) : 0,
      active_guests: checkedIn,
      pending_tasks: pending,
      revenue_today: +revenue.toFixed(2),
    },
    rooms: rooms.map((r) => roomToApiWithDb(db, r)),
    guests: guests.map(guestToApi),
    tasks: tasks.map(taskToApi),
  });
});

function roomToApiWithDb(db, r) {
  const guestRow = getOne(db, 'SELECT id FROM guests WHERE room_id = ? LIMIT 1', [r.id]);
  return {
    id: r.id,
    number: r.number,
    floor: r.floor,
    type: r.type,
    status: r.status,
    guest_id: guestRow?.id ?? null,
    rate: r.rate,
    temperature: r.temperature,
    do_not_disturb: !!r.do_not_disturb,
    last_cleaned: r.last_cleaned,
    amenities: safeJson(r.amenities, []),
  };
}

app.get('/api/rooms', async (req, res) => {
  const db = await getDb();
  const rooms = all(db, 'SELECT * FROM rooms ORDER BY floor, number');
  res.json(rooms.map((r) => roomToApiWithDb(db, r)));
});

app.patch('/api/rooms/:id', async (req, res) => {
  const db = await getDb();
  const { id } = req.params;
  const body = req.body || {};
  const row = getOne(db, 'SELECT * FROM rooms WHERE id = ?', [id]);
  if (!row) return res.status(404).json({ error: 'Room not found' });
  let status = row.status;
  if (body.status != null) status = body.status === 'vacant' ? 'available' : body.status;
  const doNot = body.do_not_disturb != null ? (body.do_not_disturb ? 1 : 0) : row.do_not_disturb ? 1 : 0;
  const rate = body.rate != null ? Number(body.rate) : row.rate;
  db.run('UPDATE rooms SET status = ?, do_not_disturb = ?, rate = ? WHERE id = ?', [status, doNot, rate, id]);
  schedulePersist(db);
  const updated = getOne(db, 'SELECT * FROM rooms WHERE id = ?', [id]);
  broadcastFeed({
    type: 'status_change',
    room: updated.number,
    status: updated.status === 'available' ? 'vacant' : updated.status,
    timestamp: new Date().toISOString(),
  });
  
  orchestrator.processEvent({ type: 'status_change', room: updated.number, status: updated.status });
  res.json(roomToApiWithDb(db, updated));
});

app.get('/api/guests/:id', async (req, res) => {
  const db = await getDb();
  const g = getOne(
    db,
    `SELECT g.*, r.number as room_number FROM guests g LEFT JOIN rooms r ON g.room_id = r.id WHERE g.id = ?`,
    [req.params.id]
  );
  if (!g) return res.status(404).json({ error: 'Guest not found' });
  res.json(guestToApi(g));
});

app.get('/api/tasks', async (req, res) => {
  const db = await getDb();
  const tasks = all(db, 'SELECT * FROM tasks ORDER BY datetime(created_at) DESC');
  res.json(tasks.map(taskToApi));
});

app.post('/api/tasks/:id/assign', async (req, res) => {
  const staffName = req.body?.staffName ?? req.body?.assignedTo;
  if (!staffName) return res.status(400).json({ error: 'staffName or assignedTo required' });
  const db = await getDb();
  const row = getOne(db, 'SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Task not found' });
  db.run('UPDATE tasks SET assigned_to = ?, status = ? WHERE id = ?', [String(staffName), 'in-progress', req.params.id]);
  schedulePersist(db);
  const t = getOne(db, 'SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  broadcastFeed({ type: 'decision', agent: 'Orchestrator', message: `Task "${t.title}" assigned to ${staffName}`, details: '' });
  res.json(taskToApi(t));
});

app.post('/api/tasks/:id/complete', async (req, res) => {
  const db = await getDb();
  const row = getOne(db, 'SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Task not found' });
  const done = new Date().toISOString();
  db.run('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?', ['completed', done, req.params.id]);
  schedulePersist(db);
  const t = getOne(db, 'SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  broadcastFeed({ type: 'success', agent: 'Orchestrator', message: `Task completed: ${t.title}`, details: '' });
  res.json(taskToApi(t));
});

app.post('/api/simulation/start', async (req, res) => {
  const speed = req.body?.speed ?? simulation.getSimSpeed();
  simulation.startSimulation(speed);
  broadcastFeed({ type: 'success', agent: 'Orchestrator', message: 'Simulation started — all agents online', details: '' });
  res.json({ status: 'started', speed: simulation.getSimSpeed() });
});

app.post('/api/simulation/stop', (req, res) => {
  simulation.stopSimulation();
  broadcastFeed({ type: 'alert', agent: 'Orchestrator', message: 'Simulation paused by operator', details: '' });
  res.json({ status: 'stopped' });
});

app.put('/api/simulation/speed', async (req, res) => {
  const s = Number(req.body?.speed);
  const speed = Number.isFinite(s) ? Math.min(5, Math.max(0.5, s)) : simulation.getSimSpeed();
  if (simulation.getSimRunning()) simulation.startSimulation(speed);
  res.json({ speed: simulation.getSimSpeed() });
});

app.post('/api/simulation/event', (req, res) => {
  const key = req.body?.eventType;
  const event = simulation.injectEvent(key);
  if (event) {
    res.json({ injected: key, status: 'routed_to_orchestrator' });
  } else {
    res.json({ error: 'Unknown event type' });
  }
});

app.post('/api/simulation/reset', async (req, res) => {
  const db = await getDb();
  simulation.stopSimulation();
  db.run('DELETE FROM tasks');
  db.run('DELETE FROM notifications');
  schedulePersist(db);
  broadcastFeed({ type: 'alert', agent: 'Orchestrator', message: 'System reset — returning to initial state', details: '' });
  res.json({ status: 'reset' });
});

app.post('/api/create-payment-intent', authOptional, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'STRIPE_SECRET_KEY not configured on server' });
  }
  const amount = Math.max(50, Math.round(Number(req.body?.amount) || 0));
  const currency = (req.body?.currency || 'usd').toLowerCase();
  const productType = String(req.body?.productType || 'generic');
  const metadata = req.body?.metadata || {};
  const pi = await stripe.paymentIntents.create({
    amount,
    currency,
    automatic_payment_methods: { enabled: true },
    metadata: { productType, ...metadata },
  });
  const db = await getDb();
  const id = `pay_${Date.now()}`;
  db.run(
    `INSERT INTO payment_transactions (id, stripe_payment_intent_id, amount, currency, status, product_type, metadata) VALUES (?,?,?,?,?,?,?)`,
    [id, pi.id, amount, currency, pi.status, productType, JSON.stringify(metadata)]
  );
  schedulePersist(db);
  res.json({ clientSecret: pi.client_secret, paymentIntentId: pi.id });
});

/** Stripe Checkout (hosted) — easier for Expo Go / mobile WebBrowser flows */
app.post('/api/create-checkout-session', authOptional, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'STRIPE_SECRET_KEY not configured on server' });
  }
  const amount = Math.max(50, Math.round(Number(req.body?.amount) || 0));
  const currency = (req.body?.currency || 'usd').toLowerCase();
  const productType = String(req.body?.productType || 'generic');
  const productName = String(req.body?.productName || productType);
  const successUrl = String(req.body?.successUrl || 'http://localhost:8080/payment-done?session_id={CHECKOUT_SESSION_ID}');
  const cancelUrl = String(req.body?.cancelUrl || 'http://localhost:8080/payment-cancel');
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency,
          unit_amount: amount,
          product_data: { name: productName },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { productType },
  });
  const db = await getDb();
  const id = `pay_${Date.now()}`;
  db.run(
    `INSERT INTO payment_transactions (id, stripe_payment_intent_id, amount, currency, status, product_type, metadata) VALUES (?,?,?,?,?,?,?)`,
    [id, session.id, amount, currency, session.payment_status || 'open', productType, JSON.stringify({ checkout: true })]
  );
  schedulePersist(db);
  res.json({ url: session.url, sessionId: session.id });
});

app.post('/api/openclaw/command', async (req, res) => {
  const command = String(req.body?.command || '').trim();
  const context = req.body?.context || {};
  if (!command) return res.status(400).json({ error: 'command required' });

  const result = await openclaw.callOpenClaw(command, context);
  res.json(result);
});

app.get('/api/openclaw/marketplace', (req, res) => {
  res.json({
    plugins: [
      { id: 'plugin_1', name: 'Late checkout plugin', description: 'Automates late checkout requests' },
      { id: 'plugin_2', name: 'VIP recognition', description: 'Flags VIP guests automatically' },
      { id: 'plugin_3', name: 'Energy optimisation', description: 'Adjusts room temp dynamically' }
    ],
    forks: ['clawtools', 'PolyForge', 'Foundry', 'Stratus X1-AC'],
    useCases: [
      'Guest messaging automation',
      'Pricing adjustments',
      'Maintenance routing',
      'Task coordination'
    ]
  });
});

app.post('/api/agents/decide', async (req, res) => {
  const event = req.body;
  orchestrator.processEvent(event);
  res.json({ status: 'queued' });
});

app.get('/api/agents/status', (req, res) => {
  res.json({ status: 'online', orchestrator: 'active' });
});

app.post('/api/login', async (req, res) => {
  const db = await getDb();
  const email = String(req.body?.email || '').toLowerCase().trim();
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const user = getOne(db, 'SELECT * FROM staff_users WHERE email = ?', [email]);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

app.get('/api/me', requireAuth, async (req, res) => {
  const db = await getDb();
  const user = getOne(db, 'SELECT id, email, name, role FROM staff_users WHERE id = ?', [req.user.sub]);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  }
  res.status(404).send('Not found');
});

const server = http.createServer(app);

const wssFeed = new WebSocketServer({ noServer: true });
const wssChat = new WebSocketServer({ noServer: true });

wssFeed.on('connection', (ws) => {
  feedClients.add(ws);
  ws.send(
    JSON.stringify({
      type: 'success',
      agent: 'Orchestrator',
      message: 'HotelOS backend connected — all systems operational',
      details: '',
      timestamp: new Date().toISOString(),
    })
  );
  ws.on('close', () => feedClients.delete(ws));
  ws.on('error', () => feedClients.delete(ws));
});

wssChat.on('connection', (ws) => {
  chatClients.add(ws);
  ws.on('message', (raw) => {
    let text = '';
    try {
      const msg = JSON.parse(raw.toString());
      text = msg.message ?? msg.text ?? '';
    } catch {
      text = raw.toString();
    }
    if (text) {
      broadcastFeed({ type: 'thought', agent: 'Staff Chat', message: `Staff query: "${text}"`, details: '' });
      // Forward to Agent Orchestrator
      orchestrator.processEvent(`Staff Message: ${text}`);
      
      // Generic immediate acknowledgment
      ws.send(
        JSON.stringify({
          message: "I have received your request and forwarded it to the AI Agent system.",
          timestamp: new Date().toISOString(),
        })
      );
    }
  });
  ws.on('close', () => chatClients.delete(ws));
  ws.on('error', () => chatClients.delete(ws));
});

server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;
  if (pathname === '/chat') {
    wssChat.handleUpgrade(request, socket, head, (ws) => {
      wssChat.emit('connection', ws, request);
    });
  } else {
    wssFeed.handleUpgrade(request, socket, head, (ws) => {
      wssFeed.emit('connection', ws, request);
    });
  }
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down HotelOS API...');
  try {
    const db = await getDb();
    if (db) {
      console.log('Final database persistence...');
      persist(db);
    }
  } catch (err) {
    console.error('Error during shutdown persistence:', err);
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

getDb()
  .then((db) => {
    // Initialize Agents
    orchestrator.init({
      broadcastAgentEvent: broadcastFeed,
      db: db
    });
    
    // Initialize Simulation
    simulation.initSimulation({
      broadcastAgentEvent: broadcastFeed,
      getDb: getDb,
      orchestratorProcessEvent: orchestrator.processEvent
    });

    server.listen(PORT, () => {
      console.log(`\nHotelOS API listening on http://localhost:${PORT}`);
      console.log(`  Feed WS  ws://localhost:${PORT}/`);
      console.log(`  Chat WS  ws://localhost:${PORT}/chat\n`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

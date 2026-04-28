/**
 * HotelOS API — Express REST + WebSocket feed (/) + chat (/chat).
 * SQLite via sql.js (WASM). Stripe payments. JWT auth.
 *
 * Complete edition:
 *  - Anthropic Claude LLM client (falls back to OpenAI → mock)
 *  - Rate limiting on all routes (strict on /api/login)
 *  - Input validation middleware
 *  - Global async error handler
 *  - GET /api/payments — payment history endpoint
 *  - POST /api/guests/:id/preferences — update guest preferences
 *  - GET /api/notifications — notification list
 *  - POST /api/notifications/:id/read — mark notification read
 *  - Graceful shutdown with DB persistence
 */
require('dotenv').config();

const http    = require('http');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const { getDb, persist, all, getOne } = require('./db');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const Stripe  = require('stripe');

const orchestrator  = require('./agents/orchestrator');
const pythonAdvisor = require('./agents/pythonAdvisor');
const simulation    = require('./services/simulation');
const openclaw      = require('./services/openclaw');
const { callAgent } = require('./services/aiClient');

const { rateLimit }                        = require('./middleware/rateLimiter');
const { required, validateAmount, validateTaskId, validateRoomId, sanitiseString } = require('./middleware/validate');
const { errorHandler, asyncHandler }       = require('./middleware/errorHandler');

const PORT                = Number(process.env.PORT) || 8080;
const JWT_SECRET          = process.env.JWT_SECRET || 'dev-insecure-jwt-secret-change-me';
const STRIPE_SECRET       = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

const stripe = STRIPE_SECRET ? new Stripe(STRIPE_SECRET) : null;

const app         = express();
const { initWebSockets, broadcastFeed } = require('./websocket');

let saveTimer;
function schedulePersist(db) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persist(db), 400);
}

// broadcastFeed is now imported from websocket.js

function safeJson(s, fallback) {
  try { return JSON.parse(s || 'null') ?? fallback; } catch { return fallback; }
}

function guestToApi(g) {
  return {
    id: g.id, name: g.name, email: g.email, phone: g.phone,
    status: g.status, room_id: g.room_id, room_number: g.room_number ?? null,
    loyalty_tier: g.loyalty_tier, is_vip: !!g.is_vip, spending: g.spending,
    check_in: g.check_in, check_out: g.check_out,
    preferences: safeJson(g.preferences, {}),
    special_requests: safeJson(g.special_requests, []),
    purchase_history: safeJson(g.purchase_history, []),
  };
}

function taskToApi(t) {
  return {
    id: t.id, title: t.title, description: t.description,
    status: t.status, priority: t.priority,
    assignedTo: t.assigned_to, createdAt: t.created_at, completedAt: t.completed_at,
  };
}

function roomToApiWithDb(db, r) {
  const guestRow = getOne(db, 'SELECT id FROM guests WHERE room_id = ? LIMIT 1', [r.id]);
  return {
    id: r.id, number: r.number, floor: r.floor, type: r.type, status: r.status,
    guest_id: guestRow?.id ?? null, rate: r.rate, temperature: r.temperature,
    do_not_disturb: !!r.do_not_disturb, last_cleaned: r.last_cleaned,
    amenities: safeJson(r.amenities, []),
  };
}

function notifToApi(n) {
  return {
    id: n.id, title: n.title, message: n.message, type: n.type,
    read: !!n.read, timestamp: n.timestamp, staff_id: n.staff_id,
  };
}

function paymentToApi(p) {
  return {
    id: p.id, stripe_payment_intent_id: p.stripe_payment_intent_id,
    amount: p.amount, currency: p.currency, status: p.status,
    product_type: p.product_type, metadata: safeJson(p.metadata, {}),
    created_at: p.created_at,
  };
}

function authOptional(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) { req.user = null; return next(); }
  try { req.user = jwt.verify(h.slice(7), JWT_SECRET); } catch { req.user = null; }
  next();
}

function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer '))
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

const globalLimiter = rateLimit({ windowMs: 60_000, max: 120 });
const loginLimiter  = rateLimit({ windowMs: 15 * 60_000, max: 10, message: 'Too many login attempts. Try again in 15 minutes.' });
const payLimiter    = rateLimit({ windowMs: 60_000, max: 20 });


app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET)
    return res.status(503).json({ error: 'Stripe webhook not configured' });

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
    broadcastFeed({ type: 'success', agent: 'Payments', message: `Payment confirmed: ${pi.id}`, details: `Amount: ${pi.amount_received / 100} ${pi.currency?.toUpperCase()}` });
  }
  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    db.run('UPDATE payment_transactions SET status = ? WHERE stripe_payment_intent_id = ?', ['succeeded', s.id]);
    schedulePersist(db);
    broadcastFeed({ type: 'success', agent: 'Payments', message: 'Checkout completed', details: s.id });
  }
  res.json({ received: true });
}));

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '256kb' }));
app.use(globalLimiter);


app.get('/api/health', asyncHandler(async (_req, res) => {
  res.json({
    status: 'ok',
    simulation_running: simulation.getSimRunning(),
    simulation_speed: simulation.getSimSpeed(),
    connected_feed: feedClients.size,
    connected_chat: chatClients.size,
  });
}));


app.post('/api/login', loginLimiter, required(['email', 'password']), asyncHandler(async (req, res) => {
  const db       = await getDb();
  const email    = sanitiseString(req.body.email).toLowerCase().trim();
  const password = String(req.body.password);

  const user = getOne(db, 'SELECT * FROM staff_users WHERE email = ?', [email]);
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}));

app.get('/api/me', requireAuth, asyncHandler(async (req, res) => {
  const db   = await getDb();
  const user = getOne(db, 'SELECT id, email, name, role FROM staff_users WHERE id = ?', [req.user.sub]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
}));


app.get('/api/state', authOptional, asyncHandler(async (_req, res) => {
  const db     = await getDb();
  const rooms  = all(db, 'SELECT * FROM rooms ORDER BY number');
  const guests = all(db, 'SELECT g.*, r.number as room_number FROM guests g LEFT JOIN rooms r ON g.room_id = r.id ORDER BY g.name');
  const tasks  = all(db, 'SELECT * FROM tasks ORDER BY datetime(created_at) DESC');

  const occupied   = rooms.filter(r => r.status === 'occupied').length;
  const checkedIn  = guests.filter(g => g.status === 'checked_in').length;
  const pending    = tasks.filter(t => ['pending', 'in-progress'].includes(t.status)).length;
  const revenue    = guests.filter(g => g.status === 'checked_in').reduce((s, g) => s + (g.spending || 0), 0);

  res.json({
    metrics: {
      total_rooms: rooms.length, occupied_rooms: occupied,
      occupancy_rate: rooms.length ? +(occupied / rooms.length).toFixed(2) : 0,
      active_guests: checkedIn, pending_tasks: pending, revenue_today: +revenue.toFixed(2),
    },
    rooms:  rooms.map(r => roomToApiWithDb(db, r)),
    guests: guests.map(guestToApi),
    tasks:  tasks.map(taskToApi),
  });
}));


app.get('/api/rooms', asyncHandler(async (_req, res) => {
  const db    = await getDb();
  const rooms = all(db, 'SELECT * FROM rooms ORDER BY floor, number');
  res.json(rooms.map(r => roomToApiWithDb(db, r)));
}));

app.patch('/api/rooms/:id', validateRoomId, asyncHandler(async (req, res) => {
  const db  = await getDb();
  const row = getOne(db, 'SELECT * FROM rooms WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Room not found' });

  const body   = req.body || {};
  const status = body.status != null ? (body.status === 'vacant' ? 'available' : sanitiseString(body.status, 32)) : row.status;
  const doNot  = body.do_not_disturb != null ? (body.do_not_disturb ? 1 : 0) : (row.do_not_disturb ? 1 : 0);
  const rate   = body.rate != null ? Number(body.rate) : row.rate;

  db.run('UPDATE rooms SET status = ?, do_not_disturb = ?, rate = ? WHERE id = ?', [status, doNot, rate, req.params.id]);
  schedulePersist(db);

  const updated = getOne(db, 'SELECT * FROM rooms WHERE id = ?', [req.params.id]);
  broadcastFeed({ type: 'status_change', room: updated.number, status: updated.status === 'available' ? 'vacant' : updated.status });
  orchestrator.processEvent({ type: 'status_change', room: updated.number, status: updated.status });
  res.json(roomToApiWithDb(db, updated));
}));


app.get('/api/guests', asyncHandler(async (_req, res) => {
  const db     = await getDb();
  const guests = all(db, 'SELECT g.*, r.number as room_number FROM guests g LEFT JOIN rooms r ON g.room_id = r.id ORDER BY g.name');
  res.json(guests.map(guestToApi));
}));

app.get('/api/guests/:id', asyncHandler(async (req, res) => {
  const db = await getDb();
  const g  = getOne(db, 'SELECT g.*, r.number as room_number FROM guests g LEFT JOIN rooms r ON g.room_id = r.id WHERE g.id = ?', [req.params.id]);
  if (!g) return res.status(404).json({ error: 'Guest not found' });
  res.json(guestToApi(g));
}));

app.post('/api/guests/:id/preferences', asyncHandler(async (req, res) => {
  const db   = await getDb();
  const guest = getOne(db, 'SELECT * FROM guests WHERE id = ?', [req.params.id]);
  if (!guest) return res.status(404).json({ error: 'Guest not found' });

  const existing = safeJson(guest.preferences, {});
  const updated  = { ...existing, ...req.body };
  db.run('UPDATE guests SET preferences = ? WHERE id = ?', [JSON.stringify(updated), req.params.id]);
  schedulePersist(db);
  res.json({ id: req.params.id, preferences: updated });
}));


app.get('/api/tasks', asyncHandler(async (_req, res) => {
  const db    = await getDb();
  const tasks = all(db, 'SELECT * FROM tasks ORDER BY datetime(created_at) DESC');
  res.json(tasks.map(taskToApi));
}));

app.post('/api/tasks', required(['title']), asyncHandler(async (req, res) => {
  const db       = await getDb();
  const id       = `t${Date.now()}`;
  const title    = sanitiseString(req.body.title, 128);
  const desc     = sanitiseString(req.body.description || '', 512);
  const priority = ['low','medium','high'].includes(req.body.priority) ? req.body.priority : 'medium';
  const assigned = req.body.assignedTo ? sanitiseString(req.body.assignedTo, 64) : null;

  db.run(
    'INSERT INTO tasks (id, title, description, status, priority, assigned_to) VALUES (?,?,?,?,?,?)',
    [id, title, desc, 'pending', priority, assigned]
  );
  schedulePersist(db);
  const t = getOne(db, 'SELECT * FROM tasks WHERE id = ?', [id]);
  broadcastFeed({ type: 'decision', agent: 'Orchestrator', message: `New task created: ${title}`, details: priority });
  res.status(201).json(taskToApi(t));
}));

app.post('/api/tasks/:id/assign', validateTaskId, asyncHandler(async (req, res) => {
  const staffName = sanitiseString(req.body?.staffName ?? req.body?.assignedTo ?? '', 64);
  if (!staffName) return res.status(400).json({ error: 'staffName or assignedTo required' });

  const db  = await getDb();
  const row = getOne(db, 'SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Task not found' });

  db.run('UPDATE tasks SET assigned_to = ?, status = ? WHERE id = ?', [staffName, 'in-progress', req.params.id]);
  schedulePersist(db);
  const t = getOne(db, 'SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  broadcastFeed({ type: 'decision', agent: 'Orchestrator', message: `Task "${t.title}" assigned to ${staffName}`, details: '' });
  res.json(taskToApi(t));
}));

app.post('/api/tasks/:id/complete', validateTaskId, asyncHandler(async (req, res) => {
  const db  = await getDb();
  const row = getOne(db, 'SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Task not found' });

  const done = new Date().toISOString();
  db.run('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?', ['completed', done, req.params.id]);
  schedulePersist(db);
  const t = getOne(db, 'SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  broadcastFeed({ type: 'success', agent: 'Orchestrator', message: `Task completed: ${t.title}`, details: '' });
  res.json(taskToApi(t));
}));


app.get('/api/notifications', authOptional, asyncHandler(async (_req, res) => {
  const db    = await getDb();
  const notifs = all(db, 'SELECT * FROM notifications ORDER BY datetime(timestamp) DESC LIMIT 100');
  res.json(notifs.map(notifToApi));
}));

app.post('/api/notifications/:id/read', asyncHandler(async (req, res) => {
  const db = await getDb();
  const n  = getOne(db, 'SELECT * FROM notifications WHERE id = ?', [req.params.id]);
  if (!n) return res.status(404).json({ error: 'Notification not found' });
  db.run('UPDATE notifications SET read = 1 WHERE id = ?', [req.params.id]);
  schedulePersist(db);
  res.json({ id: req.params.id, read: true });
}));

app.post('/api/notifications/read-all', asyncHandler(async (_req, res) => {
  const db = await getDb();
  db.run('UPDATE notifications SET read = 1');
  schedulePersist(db);
  res.json({ ok: true });
}));


app.get('/api/payments', requireAuth, asyncHandler(async (req, res) => {
  const db       = await getDb();
  const limit    = Math.min(Number(req.query.limit) || 50, 200);
  const offset   = Number(req.query.offset) || 0;
  const payments = all(db, 'SELECT * FROM payment_transactions ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?', [limit, offset]);
  const total    = (db.exec('SELECT COUNT(*) FROM payment_transactions')[0]?.values?.[0]?.[0]) ?? 0;
  res.json({ payments: payments.map(paymentToApi), total, limit, offset });
}));

app.post('/api/create-payment-intent', payLimiter, authOptional, validateAmount, asyncHandler(async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'STRIPE_SECRET_KEY not configured on server' });

  const amount      = req.body.amount;
  const currency    = sanitiseString(req.body?.currency || 'usd', 3).toLowerCase();
  const productType = sanitiseString(req.body?.productType || 'generic', 64);
  const metadata    = req.body?.metadata || {};

  const pi = await stripe.paymentIntents.create({
    amount, currency,
    automatic_payment_methods: { enabled: true },
    metadata: { productType, ...metadata },
  });

  const db = await getDb();
  const id = `pay_${Date.now()}`;
  db.run(
    'INSERT INTO payment_transactions (id, stripe_payment_intent_id, amount, currency, status, product_type, metadata) VALUES (?,?,?,?,?,?,?)',
    [id, pi.id, amount, currency, pi.status, productType, JSON.stringify(metadata)]
  );
  schedulePersist(db);
  res.json({ clientSecret: pi.client_secret, paymentIntentId: pi.id });
}));

app.post('/api/create-checkout-session', payLimiter, authOptional, validateAmount, asyncHandler(async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'STRIPE_SECRET_KEY not configured on server' });

  const amount      = req.body.amount;
  const currency    = sanitiseString(req.body?.currency || 'usd', 3).toLowerCase();
  const productType = sanitiseString(req.body?.productType || 'generic', 64);
  const productName = sanitiseString(req.body?.productName || productType, 128);
  const successUrl  = String(req.body?.successUrl || `http://localhost:${PORT}/payment-done?session_id={CHECKOUT_SESSION_ID}`);
  const cancelUrl   = String(req.body?.cancelUrl  || `http://localhost:${PORT}/payment-cancel`);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price_data: { currency, unit_amount: amount, product_data: { name: productName } }, quantity: 1 }],
    success_url: successUrl, cancel_url: cancelUrl,
    metadata: { productType },
  });

  const db = await getDb();
  const id = `pay_${Date.now()}`;
  db.run(
    'INSERT INTO payment_transactions (id, stripe_payment_intent_id, amount, currency, status, product_type, metadata) VALUES (?,?,?,?,?,?,?)',
    [id, session.id, amount, currency, session.payment_status || 'open', productType, JSON.stringify({ checkout: true })]
  );
  schedulePersist(db);
  res.json({ url: session.url, sessionId: session.id });
}));


app.post('/api/simulation/start', asyncHandler(async (req, res) => {
  const speed = req.body?.speed ?? simulation.getSimSpeed();
  simulation.startSimulation(speed);
  broadcastFeed({ type: 'success', agent: 'Orchestrator', message: 'Simulation started — all agents online', details: '' });
  res.json({ status: 'started', speed: simulation.getSimSpeed() });
}));

app.post('/api/simulation/stop', (req, res) => {
  simulation.stopSimulation();
  broadcastFeed({ type: 'alert', agent: 'Orchestrator', message: 'Simulation paused by operator', details: '' });
  res.json({ status: 'stopped' });
});

app.put('/api/simulation/speed', asyncHandler(async (req, res) => {
  const s     = Number(req.body?.speed);
  const speed = Number.isFinite(s) ? Math.min(5, Math.max(0.5, s)) : simulation.getSimSpeed();
  if (simulation.getSimRunning()) simulation.startSimulation(speed);
  res.json({ speed: simulation.getSimSpeed() });
}));

app.post('/api/simulation/event', (req, res) => {
  const key   = req.body?.eventType;
  const event = simulation.injectEvent(key);
  event ? res.json({ injected: key, status: 'routed_to_orchestrator' })
        : res.json({ error: 'Unknown event type', available: Object.keys(simulation.EVENT_SCENARIOS) });
});

app.post('/api/simulation/reset', asyncHandler(async (_req, res) => {
  const db = await getDb();
  simulation.stopSimulation();
  db.run('DELETE FROM tasks');
  db.run('DELETE FROM notifications');
  schedulePersist(db);
  broadcastFeed({ type: 'alert', agent: 'Orchestrator', message: 'System reset — returning to initial state', details: '' });
  res.json({ status: 'reset' });
}));


app.post('/api/agents/decide', asyncHandler(async (req, res) => {
  orchestrator.processEvent(req.body);
  res.json({ status: 'queued' });
}));

app.post('/api/agents/advise', asyncHandler(async (req, res) => {
  const plan = await pythonAdvisor.processEvent(req.body);
  res.json({ plan });
}));

app.get('/api/agents/status', (_req, res) => {
  res.json({ status: 'online', orchestrator: 'active' });
});


app.post('/api/openclaw/command', asyncHandler(async (req, res) => {
  const command = sanitiseString(String(req.body?.command || '').trim(), 512);
  if (!command) return res.status(400).json({ error: 'command required' });
  const result = await openclaw.callOpenClaw(command, req.body?.context || {});
  res.json(result);
}));

app.get('/api/openclaw/marketplace', (_req, res) => {
  res.json({
    plugins: [
      { id: 'plugin_1', name: 'Late checkout plugin',  description: 'Automates late checkout requests' },
      { id: 'plugin_2', name: 'VIP recognition',        description: 'Flags VIP guests automatically' },
      { id: 'plugin_3', name: 'Energy optimisation',    description: 'Adjusts room temp dynamically' },
    ],
    forks: ['clawtools', 'PolyForge', 'Foundry', 'Stratus X1-AC'],
    useCases: ['Guest messaging automation', 'Pricing adjustments', 'Maintenance routing', 'Task coordination'],
  });
});


app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  res.status(404).send('Not found');
});

app.use(errorHandler);

const server  = http.createServer(app);
const { feedClients, chatClients } = initWebSockets(server, broadcastFeed);


const shutdown = async (signal) => {
  console.log(`\n[${signal}] Shutting down HotelOS API...`);
  try {
    const db = await getDb();
    if (db) { console.log('Final database persistence...'); persist(db); }
  } catch (err) { console.error('Error during shutdown persistence:', err); }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000); // hard kill after 5 s
};

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => { console.error('[uncaughtException]', err); });
process.on('unhandledRejection', (reason) => { console.error('[unhandledRejection]', reason); });

getDb().then((db) => {
  orchestrator.init({ broadcastAgentEvent: broadcastFeed, db });
  pythonAdvisor.init({ broadcastAgentEvent: broadcastFeed, fallback: orchestrator });
  simulation.initSimulation({ 
    broadcastAgentEvent: broadcastFeed, 
    getDb, 
    orchestratorProcessEvent: async (event) => {
      const message = typeof event === 'string' ? event : (event.message || event.type);
      const aiResponse = await callAgent(message, { source: 'simulation', event });
      
      broadcastFeed({
        type: 'thought',
        agent: aiResponse.agent,
        message: aiResponse.thought,
        details: aiResponse.action
      });
      
      broadcastFeed({
        type: 'decision',
        agent: aiResponse.agent,
        message: aiResponse.response,
        details: JSON.stringify(aiResponse.data)
      });
    } 
  });

  server.listen(PORT, () => {
    console.log(`\nHotelOS API listening on http://localhost:${PORT}`);
    console.log(`  Feed WS  ws://localhost:${PORT}/`);
    console.log(`  Chat WS  ws://localhost:${PORT}/chat\n`);
  });
}).catch((err) => { console.error(err); process.exit(1); });

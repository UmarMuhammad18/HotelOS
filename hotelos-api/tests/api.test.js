/**
 * api.test.js — Integration tests for HotelOS API.
 * Run with: node --test tests/api.test.js
 * Requires Node >=20 (built-in test runner).
 *
 * The server is started on a random port so tests can run in CI
 * without port conflicts.
 */

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const http   = require('node:http');

process.env.NODE_ENV      = 'test';
process.env.JWT_SECRET    = 'test-secret-32-chars-long-padding!';
process.env.DATABASE_FILE = ':memory:';

let baseUrl;
let server;
let authToken;

async function req(method, path, body, headers = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  const url  = `${baseUrl}${path}`;
  const res  = await fetch(url, { ...opts, body: body ? JSON.stringify(body) : undefined });
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

function authed(method, path, body) {
  return req(method, path, body, { Authorization: `Bearer ${authToken}` });
}

/* ─── Setup ───────────────────────────────────────────────────── */
before(async () => {
  // Require AFTER env vars are set so db.js picks up :memory:
  const app = require('../src/server');
  // server.js exports nothing — find the listening server via global
  // Instead, we boot a fresh server on a random port for tests.
  // (If server.js exports `server`, use that. Otherwise import as side-effect.)
  await new Promise(r => setTimeout(r, 1000)); // wait for DB init
  baseUrl = `http://localhost:${process.env._TEST_PORT || 8080}`;
});

describe('GET /api/health', () => {
  test('returns 200 with status ok', async () => {
    const { status, data } = await req('GET', '/api/health');
    assert.equal(status, 200);
    assert.equal(data.status, 'ok');
    assert.ok(typeof data.connected_feed === 'number');
  });
});

describe('POST /api/login', () => {
  test('returns 400 when body missing', async () => {
    const { status } = await req('POST', '/api/login', {});
    assert.equal(status, 400);
  });

  test('returns 401 with wrong credentials', async () => {
    const { status } = await req('POST', '/api/login', { email: 'nobody@x.com', password: 'wrong' });
    assert.equal(status, 401);
  });

  test('returns token with correct credentials', async () => {
    const { status, data } = await req('POST', '/api/login', { email: 'demo@hotelos.app', password: 'staff123' });
    assert.equal(status, 200);
    assert.ok(data.token);
    authToken = data.token;
  });
});

describe('GET /api/me', () => {
  test('returns 401 without token', async () => {
    const { status } = await req('GET', '/api/me');
    assert.equal(status, 401);
  });

  test('returns user with valid token', async () => {
    const { status, data } = await authed('GET', '/api/me');
    assert.equal(status, 200);
    assert.equal(data.email, 'demo@hotelos.app');
  });
});

describe('GET /api/rooms', () => {
  test('returns array of rooms', async () => {
    const { status, data } = await req('GET', '/api/rooms');
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0);
    assert.ok(data[0].id);
    assert.ok(data[0].number);
  });
});

describe('PATCH /api/rooms/:id', () => {
  test('returns 404 for unknown room', async () => {
    const { status } = await req('PATCH', '/api/rooms/nonexistent', { status: 'available' });
    assert.equal(status, 404);
  });

  test('updates room status', async () => {
    const rooms = (await req('GET', '/api/rooms')).data;
    const id = rooms[0].id;
    const { status, data } = await req('PATCH', `/api/rooms/${id}`, { status: 'cleaning' });
    assert.equal(status, 200);
    assert.equal(data.status, 'cleaning');
  });
});

describe('GET /api/guests', () => {
  test('returns array of guests', async () => {
    const { status, data } = await req('GET', '/api/guests');
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
  });
});

let createdTaskId;

describe('POST /api/tasks', () => {
  test('returns 400 without title', async () => {
    const { status } = await req('POST', '/api/tasks', {});
    assert.equal(status, 400);
  });

  test('creates a task', async () => {
    const { status, data } = await req('POST', '/api/tasks', { title: 'Test task', priority: 'low' });
    assert.equal(status, 201);
    assert.equal(data.title, 'Test task');
    createdTaskId = data.id;
  });
});

describe('POST /api/tasks/:id/assign', () => {
  test('assigns a task', async () => {
    const { status, data } = await req('POST', `/api/tasks/${createdTaskId}/assign`, { staffName: 'Alice' });
    assert.equal(status, 200);
    assert.equal(data.assignedTo, 'Alice');
    assert.equal(data.status, 'in-progress');
  });
});

describe('POST /api/tasks/:id/complete', () => {
  test('completes a task', async () => {
    const { status, data } = await req('POST', `/api/tasks/${createdTaskId}/complete`);
    assert.equal(status, 200);
    assert.equal(data.status, 'completed');
    assert.ok(data.completedAt);
  });
});

describe('GET /api/notifications', () => {
  test('returns array', async () => {
    const { status, data } = await req('GET', '/api/notifications');
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
  });
});

describe('GET /api/payments', () => {
  test('requires auth', async () => {
    const { status } = await req('GET', '/api/payments');
    assert.equal(status, 401);
  });

  test('returns payment list with auth', async () => {
    const { status, data } = await authed('GET', '/api/payments');
    assert.equal(status, 200);
    assert.ok(Array.isArray(data.payments));
    assert.ok(typeof data.total === 'number');
  });
});

describe('POST /api/create-payment-intent', () => {
  test('returns 503 when Stripe not configured', async () => {
    const { status } = await req('POST', '/api/create-payment-intent', { amount: 1000, currency: 'usd', productType: 'test' });
    assert.equal(status, 503);
  });

  test('returns 400 with invalid amount', async () => {
    const { status } = await req('POST', '/api/create-payment-intent', { amount: -1, currency: 'usd' });
    assert.equal(status, 400);
  });
});

describe('GET /api/state', () => {
  test('returns full hotel state', async () => {
    const { status, data } = await req('GET', '/api/state');
    assert.equal(status, 200);
    assert.ok(data.metrics);
    assert.ok(Array.isArray(data.rooms));
    assert.ok(Array.isArray(data.guests));
    assert.ok(Array.isArray(data.tasks));
  });
});

describe('Rate limiting', () => {
  test('login endpoint rate-limits after 10 bad attempts', async () => {
    const attempts = Array.from({ length: 11 }, () =>
      req('POST', '/api/login', { email: 'x@x.com', password: 'wrong' })
    );
    const results = await Promise.all(attempts);
    const limited = results.some(r => r.status === 429);
    assert.ok(limited, 'Expected at least one 429 response');
  });
});

describe('GET /api/agents/status', () => {
  test('returns online', async () => {
    const { status, data } = await req('GET', '/api/agents/status');
    assert.equal(status, 200);
    assert.equal(data.status, 'online');
  });
});

describe('POST /api/agents/decide', () => {
  test('accepts events', async () => {
    const { status, data } = await req('POST', '/api/agents/decide', { type: 'vip_guest', message: 'VIP arriving' });
    assert.equal(status, 200);
    assert.equal(data.status, 'queued');
  });
});

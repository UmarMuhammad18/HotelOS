/**
 * agents.test.js — Unit tests for agent subsystems.
 * Run with: node --test tests/agents.test.js
 */

const { test, describe, mock } = require('node:test');
const assert = require('node:assert/strict');

describe('memory.js', () => {
  const memory = require('../src/agents/memory');

  test('addShortTermMemory stores and retrieves context', () => {
    memory.addShortTermMemory({ agent: 'TestAgent', message: 'Hello world' });
    const ctx = memory.getShortTermMemoryContext();
    assert.ok(ctx.includes('TestAgent'));
    assert.ok(ctx.includes('Hello world'));
  });

  test('storePreference and retrieveSimilarPreferences round-trips', () => {
    memory.storePreference('guest_test', 'Prefers late checkout');
    const prefs = memory.retrieveSimilarPreferences('guest_test', '', 5);
    assert.ok(prefs.includes('Prefers late checkout'));
  });

  test('short-term memory respects limit of 20', () => {
    for (let i = 0; i < 25; i++) {
      memory.addShortTermMemory({ agent: 'A', message: `msg${i}` });
    }
    const ctx = memory.getShortTermMemoryContext();
    const lines = ctx.split('\n').filter(Boolean);
    assert.ok(lines.length <= 20);
  });
});

describe('tools.js — mock DB', () => {
  const { initTools, forecastDemand, getTechnicianETA } = require('../src/agents/tools');

  // These tools don't need DB
  test('forecastDemand returns a percentage string', async () => {
    const result = await forecastDemand({ dateRange: 'next week' });
    assert.ok(typeof result === 'string');
    assert.ok(result.includes('%'));
  });

  test('getTechnicianETA returns a time string', async () => {
    const result = await getTechnicianETA({ ticketId: 'test' });
    assert.ok(typeof result === 'string');
    assert.ok(result.includes('minutes'));
  });
});

describe('llmClient.js — mock fallback', () => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const { callLLM } = require('../src/agents/llmClient');

  test('returns action for revenue events', async () => {
    const res = await callLLM('system', 'Goal: revenue forecast event');
    assert.ok(res.thought);
    assert.ok(typeof res.action === 'string');
  });

  test('returns action for maintenance events', async () => {
    const res = await callLLM('system', 'Goal: maintenance issue reported');
    assert.equal(res.action, 'createMaintenanceTicket');
  });

  test('ends loop on observation', async () => {
    const res = await callLLM('system', 'Context: Observation: done');
    assert.equal(res.action, 'none');
  });
});

describe('validate middleware', () => {
  const { required, validateAmount, sanitiseString } = require('../src/middleware/validate');

  test('required() blocks missing fields', () => {
    const req = { body: { email: 'a@b.com' } };
    const res = { status: (s) => ({ json: (d) => ({ s, d }) }) };
    let nextCalled = false;
    required(['email', 'password'])(req, res, () => { nextCalled = true; });
    assert.ok(!nextCalled);
  });

  test('required() passes when all fields present', () => {
    const req = { body: { email: 'a@b.com', password: 'secret' } };
    const res = {};
    let nextCalled = false;
    required(['email', 'password'])(req, res, () => { nextCalled = true; });
    assert.ok(nextCalled);
  });

  test('validateAmount rejects negative values', () => {
    const req = { body: { amount: -50 } };
    let rejected = false;
    const res = { status: () => ({ json: () => { rejected = true; } }) };
    validateAmount(req, res, () => {});
    assert.ok(rejected);
  });

  test('validateAmount accepts positive values', () => {
    const req = { body: { amount: 1000 } };
    let nextCalled = false;
    validateAmount(req, {}, () => { nextCalled = true; });
    assert.ok(nextCalled);
    assert.equal(req.body.amount, 1000);
  });

  test('sanitiseString strips html chars', () => {
    const result = sanitiseString('<script>alert(1)</script>');
    assert.ok(!result.includes('<'));
    assert.ok(!result.includes('>'));
  });
});

describe('rateLimiter.js', () => {
  const { rateLimit } = require('../src/middleware/rateLimiter');

  test('allows requests within limit', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 3 });
    const req = { ip: '1.2.3.4', path: '/test' };
    let passCount = 0;
    const res = { status: () => ({ json: () => {} }), setHeader: () => {} };
    for (let i = 0; i < 3; i++) limiter(req, res, () => passCount++);
    assert.equal(passCount, 3);
  });

  test('blocks requests over limit', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 2 });
    const req = { ip: '9.9.9.1', path: '/over' };
    let blocked = false;
    const res = {
      status: () => ({ json: () => { blocked = true; } }),
      setHeader: () => {},
    };
    for (let i = 0; i < 3; i++) limiter(req, res, () => {});
    assert.ok(blocked);
  });
});

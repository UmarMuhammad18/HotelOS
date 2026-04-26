/**
 * validate.js — Request body validation middleware.
 * Lightweight schema checking without external dependencies.
 */

function required(fields) {
  return (req, res, next) => {
    const missing = fields.filter(f => req.body?.[f] == null || req.body[f] === '');
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }
    next();
  };
}

function validateAmount(req, res, next) {
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }
  req.body.amount = Math.round(amount);
  next();
}

function validateTaskId(req, res, next) {
  if (!req.params.id || typeof req.params.id !== 'string' || req.params.id.length > 64) {
    return res.status(400).json({ error: 'Invalid task id' });
  }
  next();
}

function validateRoomId(req, res, next) {
  if (!req.params.id || typeof req.params.id !== 'string' || req.params.id.length > 64) {
    return res.status(400).json({ error: 'Invalid room id' });
  }
  next();
}

function sanitiseString(value, maxLen = 255) {
  if (typeof value !== 'string') return '';
  return value.slice(0, maxLen).replace(/[<>]/g, '');
}

module.exports = { required, validateAmount, validateTaskId, validateRoomId, sanitiseString };

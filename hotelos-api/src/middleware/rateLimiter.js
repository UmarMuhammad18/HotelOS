/**
 * rateLimiter.js — In-memory sliding-window rate limiter.
 * No external dependencies. Suitable for single-process deployments.
 * For multi-process / Redis-backed, replace with express-rate-limit + ioredis.
 */

const windows = new Map();

/**
 * @param {object} opts
 * @param {number} opts.windowMs   - Window size in milliseconds (default 60 000)
 * @param {number} opts.max        - Max requests per window (default 60)
 * @param {string} [opts.message]  - Error message
 */
function rateLimit({ windowMs = 60_000, max = 60, message = 'Too many requests, please try again later.' } = {}) {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of windows) {
      if (now - entry.start > windowMs) windows.delete(key);
    }
  }, 5 * 60_000).unref();

  return (req, res, next) => {
    const key = req.ip + ':' + req.path;
    const now = Date.now();
    const entry = windows.get(key);

    if (!entry || now - entry.start > windowMs) {
      windows.set(key, { start: now, count: 1 });
      return next();
    }

    entry.count++;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.start + windowMs - now) / 1000));
      return res.status(429).json({ error: message });
    }
    next();
  };
}

module.exports = { rateLimit };

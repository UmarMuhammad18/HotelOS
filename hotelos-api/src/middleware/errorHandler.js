/**
 * errorHandler.js — Global Express error-handling middleware.
 * Must be registered LAST with app.use(errorHandler).
 */

function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const isDev  = process.env.NODE_ENV !== 'production';

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${status}`, err.message);
  if (isDev && err.stack) console.error(err.stack);

  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(isDev ? { stack: err.stack } : {}),
  });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { errorHandler, asyncHandler };

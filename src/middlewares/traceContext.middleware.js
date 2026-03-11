import logger from '../core/logger.js';

/**
 * Middleware to extract W3C Trace Context from Dapr's traceparent header
 *
 * Dapr automatically propagates W3C Trace Context via the 'traceparent' header
 * Format: version-traceId-spanId-flags (e.g., 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01)
 *
 * This middleware:
 * - Extracts traceId and spanId from the traceparent header
 * - Makes them available to controllers/services via req.traceId and req.spanId
 * - Adds X-Trace-ID to response headers for client-side correlation
 * - Provides fallback values when Dapr tracing is not enabled
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {void}
 */
const traceContextMiddleware = (req, res, next) => {
  const traceparent = req.headers['traceparent'];
  const startTime = Date.now();

  if (traceparent) {
    // Parse W3C Trace Context format: version-traceId-spanId-flags
    const parts = traceparent.split('-');
    if (parts.length === 4) {
      req.traceId = parts[1]; // 32-character trace ID
      req.spanId = parts[2]; // 16-character span ID
    }
  }

  // Fallback if traceparent header is not present (e.g., direct API calls)
  req.traceId = req.traceId || 'no-trace';
  req.spanId = req.spanId || 'no-span';

  // Add trace ID to response headers for client-side correlation
  res.setHeader('X-Trace-ID', req.traceId);

  // Add to locals for access in templates/views if needed
  res.locals.traceId = req.traceId;
  res.locals.spanId = req.spanId;

  // Log incoming request with body preview for POST/PUT/PATCH
  const bodyPreview =
    ['POST', 'PUT', 'PATCH'].includes(req.method) && req.body ? Object.keys(req.body).join(', ') : undefined;

  logger.info(`→ ${req.method} ${req.originalUrl}`, {
    traceId: req.traceId,
    spanId: req.spanId,
    method: req.method,
    url: req.originalUrl,
    bodyFields: bodyPreview,
    userId: req.user?.id,
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    logger[level](`← ${req.method} ${req.originalUrl} ${statusCode} (${duration}ms)`, {
      traceId: req.traceId,
      spanId: req.spanId,
      method: req.method,
      url: req.originalUrl,
      statusCode,
      duration,
      userId: req.user?.id,
    });

    return originalSend.call(this, data);
  };

  next();
};

export default traceContextMiddleware;

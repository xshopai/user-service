import logger from '../core/logger.js';

/**
 * Centralized error handling middleware
 * Logs errors with trace context and returns consistent error responses
 * @param {Error & {status?: number, code?: string, details?: any}} err - Error object
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} _next - Express next function (unused)
 * @returns {void}
 */
export const errorHandler = (err, req, res, _next) => {
  const status = err.status || 500;
  const traceId = req.traceId || 'no-trace';
  const spanId = req.spanId || 'no-span';

  // Log the error with full details
  logger.error(`Request failed: ${req.method} ${req.originalUrl} - ${err.message || 'Unknown error'}`, {
    traceId,
    spanId,
    method: req.method,
    url: req.originalUrl,
    status,
    errorCode: err.code || 'INTERNAL_ERROR',
    errorMessage: err.message,
    errorStack: err.stack,
    userId: req.user?._id,
  });

  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
      details: err.details || null,
      traceId: req.traceId || null,
    },
  });
};

export default errorHandler;

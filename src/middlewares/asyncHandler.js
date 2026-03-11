/**
 * Async handler middleware for Express
 * Wraps async route handlers to catch rejected promises and pass errors to next()
 * @param {Function} fn - Async route handler function
 * @returns {import('express').RequestHandler} Express middleware function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;

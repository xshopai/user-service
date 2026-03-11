/**
 * Custom error class for consistent error responses across the application
 * @extends Error
 */
class ErrorResponse extends Error {
  /**
   * Create an ErrorResponse
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code
   * @param {string|null} [code=null] - Error code for client-side handling
   */
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode; // Add for test compatibility
    this.code = code;
  }
}

export default ErrorResponse;

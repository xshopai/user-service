import { describe, it, expect } from '@jest/globals';
import ErrorResponse from '../../../src/core/errors.js';

describe('ErrorResponse', () => {
  describe('constructor', () => {
    it('should create an error with message and status code', () => {
      const error = new ErrorResponse('Test error', 400);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.status).toBe(400);
      expect(error.code).toBeNull();
    });

    it('should create an error with message, status code, and error code', () => {
      const error = new ErrorResponse('Invalid email', 400, 'INVALID_EMAIL');

      expect(error.message).toBe('Invalid email');
      expect(error.statusCode).toBe(400);
      expect(error.status).toBe(400);
      expect(error.code).toBe('INVALID_EMAIL');
    });

    it('should create a 404 error', () => {
      const error = new ErrorResponse('User not found', 404, 'USER_NOT_FOUND');

      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('USER_NOT_FOUND');
    });

    it('should create a 401 unauthorized error', () => {
      const error = new ErrorResponse('Unauthorized', 401, 'UNAUTHORIZED');

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('should create a 403 forbidden error', () => {
      const error = new ErrorResponse('Access denied', 403, 'FORBIDDEN');

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });

    it('should create a 409 conflict error', () => {
      const error = new ErrorResponse('Email already exists', 409, 'EMAIL_EXISTS');

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('EMAIL_EXISTS');
    });

    it('should create a 500 internal server error', () => {
      const error = new ErrorResponse('Internal server error', 500, 'INTERNAL_ERROR');

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
    });

    it('should have null code when not provided', () => {
      const error = new ErrorResponse('Some error', 400);

      expect(error.code).toBeNull();
    });

    it('should extend Error class', () => {
      const error = new ErrorResponse('Test', 400);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('Error');
    });

    it('should have stack trace', () => {
      const error = new ErrorResponse('Test', 400);

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });
  });

  describe('error usage', () => {
    it('should be throwable', () => {
      expect(() => {
        throw new ErrorResponse('Test error', 400, 'TEST_ERROR');
      }).toThrow(ErrorResponse);
    });

    it('should be catchable', () => {
      try {
        throw new ErrorResponse('Test error', 400, 'TEST_ERROR');
      } catch (err) {
        expect(err).toBeInstanceOf(ErrorResponse);
        expect(err.message).toBe('Test error');
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('TEST_ERROR');
      }
    });

    it('should preserve message in catch block', () => {
      let caughtError;
      try {
        throw new ErrorResponse('Custom message', 404, 'NOT_FOUND');
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError.message).toBe('Custom message');
    });
  });

  describe('common error scenarios', () => {
    it('should create validation error', () => {
      const error = new ErrorResponse('Validation failed', 400, 'VALIDATION_ERROR');

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should create authentication error', () => {
      const error = new ErrorResponse('Invalid credentials', 401, 'INVALID_CREDENTIALS');

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should create authorization error', () => {
      const error = new ErrorResponse('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS');

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should create resource not found error', () => {
      const error = new ErrorResponse('Resource not found', 404, 'RESOURCE_NOT_FOUND');

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should create duplicate resource error', () => {
      const error = new ErrorResponse('Resource already exists', 409, 'DUPLICATE_RESOURCE');

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('DUPLICATE_RESOURCE');
    });
  });
});

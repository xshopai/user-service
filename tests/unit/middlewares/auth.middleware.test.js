import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { requireAuth, requireServiceToken, requireAdmin, requireRoles } from '../../../src/middlewares/auth.middleware.js';
import User from '../../../src/models/user.model.js';
import ErrorResponse from '../../../src/core/errors.js';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../../src/models/user.model.js');
jest.mock('../../../src/core/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Auth Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup environment variables
    process.env.JWT_SECRET = 'test-secret';
    process.env.SERVICE_AUTH_TOKEN = 'auth-service-token';
    process.env.SERVICE_ADMIN_TOKEN = 'admin-service-token';

    mockReq = {
      headers: {},
      cookies: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('requireAuth', () => {
    it('should authenticate user with valid JWT in Authorization header', async () => {
      const token = 'valid.jwt.token';
      mockReq.headers.authorization = `Bearer ${token}`;

      const decodedToken = {
        sub: 'user-123',
        email: 'test@example.com',
        roles: ['customer'],
      };

      const mockUser = {
        _id: 'user-123',
        email: 'test@example.com',
        isActive: true,
        roles: ['customer'],
      };

      jwt.verify = jest.fn().mockReturnValue(decodedToken);
      User.findById = jest.fn().mockResolvedValue(mockUser);

      await requireAuth(mockReq, mockRes, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith(token, 'test-secret', expect.any(Object));
      expect(User.findById).toHaveBeenCalledWith('user-123');
      expect(mockReq.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should authenticate user with valid JWT in cookies', async () => {
      const token = 'valid.jwt.token';
      mockReq.cookies.jwt = token;

      const decodedToken = {
        sub: 'user-123',
        email: 'test@example.com',
        roles: ['customer'],
      };

      const mockUser = {
        _id: 'user-123',
        email: 'test@example.com',
        isActive: true,
      };

      jwt.verify = jest.fn().mockReturnValue(decodedToken);
      User.findById = jest.fn().mockResolvedValue(mockUser);

      await requireAuth(mockReq, mockRes, mockNext);

      expect(mockReq.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should return 401 if no token provided', async () => {
      await requireAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(401);
      expect(mockNext.mock.calls[0][0].message).toContain('No token found');
    });

    it('should return 401 if token is invalid', async () => {
      mockReq.headers.authorization = 'Bearer invalid.token';
      
      jwt.verify = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await requireAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(401);
    });

    it('should return 401 if token is expired', async () => {
      mockReq.headers.authorization = 'Bearer expired.token';
      
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      jwt.verify = jest.fn().mockImplementation(() => {
        throw expiredError;
      });

      await requireAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
      expect(mockNext.mock.calls[0][0].message).toContain('expired');
    });

    it('should continue with JWT claims if user not found in database', async () => {
      mockReq.headers.authorization = 'Bearer valid.token';

      const decodedToken = {
        sub: 'non-existent-user',
        email: 'test@example.com',
        roles: ['customer'],
      };

      jwt.verify = jest.fn().mockReturnValue(decodedToken);
      User.findById = jest.fn().mockResolvedValue(null);

      await requireAuth(mockReq, mockRes, mockNext);

      // Should continue with JWT claims
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user._id).toBe('non-existent-user');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should return 403 if user account is deactivated', async () => {
      mockReq.headers.authorization = 'Bearer valid.token';

      const decodedToken = {
        sub: 'user-123',
        email: 'test@example.com',
        roles: ['customer'],
      };

      const mockUser = {
        _id: 'user-123',
        email: 'test@example.com',
        isActive: false,
      };

      jwt.verify = jest.fn().mockReturnValue(decodedToken);
      User.findById = jest.fn().mockResolvedValue(mockUser);

      await requireAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
      expect(mockNext.mock.calls[0][0].message).toContain('deactivated');
    });
  });

  describe('requireServiceToken', () => {
    it('should authenticate valid service token', async () => {
      mockReq.headers['x-service-token'] = 'auth-service-token';
      mockReq.path = '/internal/users/test@example.com';
      mockReq.method = 'GET';

      await requireServiceToken(mockReq, mockRes, mockNext);

      expect(mockReq.callingService).toBe('auth-service');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should return 401 if no service token provided', async () => {
      mockReq.path = '/internal/users/test@example.com';
      mockReq.method = 'GET';

      await requireServiceToken(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(401);
      expect(mockNext.mock.calls[0][0].message).toContain('No service token');
    });

    it('should return 401 if service token is invalid', async () => {
      mockReq.headers['x-service-token'] = 'invalid-token';
      mockReq.path = '/internal/users/test@example.com';
      mockReq.method = 'GET';

      await requireServiceToken(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(401);
      expect(mockNext.mock.calls[0][0].message).toContain('Invalid service token');
    });

    it('should authenticate admin service token', async () => {
      mockReq.headers['x-service-token'] = 'admin-service-token';
      mockReq.path = '/internal/admin/users';
      mockReq.method = 'GET';

      await requireServiceToken(mockReq, mockRes, mockNext);

      expect(mockReq.callingService).toBe('admin-service');
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requireAdmin', () => {
    it('should allow access for admin user', async () => {
      mockReq.user = {
        _id: 'admin-123',
        roles: ['admin'],
      };

      await requireAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow access for user with admin role among multiple roles', async () => {
      mockReq.user = {
        _id: 'user-123',
        roles: ['customer', 'admin'],
      };

      await requireAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should return 403 for non-admin user', async () => {
      mockReq.user = {
        _id: 'user-123',
        roles: ['customer'],
      };

      await requireAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
      expect(mockNext.mock.calls[0][0].message).toContain('admin');
    });

    it('should return 403 for user with no roles', async () => {
      mockReq.user = {
        _id: 'user-123',
        roles: [],
      };

      await requireAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('requireRoles', () => {
    it('should allow access for user with required role', async () => {
      mockReq.user = {
        _id: 'user-123',
        roles: ['premium'],
      };

      const middleware = requireRoles('premium', 'admin');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow access for user with one of multiple required roles', async () => {
      mockReq.user = {
        _id: 'user-123',
        roles: ['customer'],
      };

      const middleware = requireRoles('customer', 'premium', 'admin');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow access for admin if admin is in required roles', async () => {
      mockReq.user = {
        _id: 'admin-123',
        roles: ['admin'],
      };

      const middleware = requireRoles('premium', 'admin');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should return 403 for user without required roles', async () => {
      mockReq.user = {
        _id: 'user-123',
        roles: ['customer'],
      };

      const middleware = requireRoles('premium', 'gold');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
      expect(mockNext.mock.calls[0][0].message).toContain('Required roles');
    });

    it('should return 403 for empty roles array', async () => {
      mockReq.user = {
        _id: 'user-123',
        roles: [],
      };

      const middleware = requireRoles('premium');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
    });

    it('should return 403 for user without roles property', async () => {
      mockReq.user = {
        _id: 'user-123',
      };

      const middleware = requireRoles('premium');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
    });

    it('should return 401 if no user authenticated', async () => {
      mockReq.user = null;

      const middleware = requireRoles('premium');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(401);
    });
  });
});

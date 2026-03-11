import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import logger from '../core/logger.js';
import ErrorResponse from '../core/errors.js';

/**
 * @typedef {Object} JwtConfig
 * @property {string} secret - JWT secret key
 * @property {string} issuer - JWT issuer
 * @property {string} audience - JWT audience
 */

/**
 * Get JWT configuration from environment variables
 * @returns {JwtConfig} JWT configuration object
 */
const getJwtConfig = () => ({
  secret: process.env.JWT_SECRET,
  issuer: process.env.JWT_ISSUER || 'auth-service',
  audience: process.env.JWT_AUDIENCE || 'xshopai-platform',
});

/**
 * Get JWT secret from environment
 * @returns {string} JWT secret
 */
const getJwtSecret = () => process.env.JWT_SECRET;

// Cache service tokens configuration
let serviceTokensCache = null;

/**
 * Get service token configuration from environment.
 * Used for validating incoming requests from other services.
 * Uses {SERVICE_NAME}_SERVICE_TOKEN pattern (e.g., AUTH_SERVICE_TOKEN).
 * @returns {Record<string, string>} Map of service names to tokens
 */
function getServiceTokens() {
  if (!serviceTokensCache) {
    serviceTokensCache = {
      'auth-service': process.env.AUTH_SERVICE_TOKEN,
      'admin-service': process.env.ADMIN_SERVICE_TOKEN,
      'order-service': process.env.ORDER_SERVICE_TOKEN,
      'web-bff': process.env.WEBBFF_SERVICE_TOKEN,
    };
    // Filter out undefined/null values
    serviceTokensCache = Object.fromEntries(Object.entries(serviceTokensCache).filter(([, v]) => v));
    logger.info(`Service tokens loaded for ${Object.keys(serviceTokensCache).length} services`);
  }
  return serviceTokensCache;
}

/**
 * Middleware to validate service-to-service authentication tokens.
 *
 * Checks for X-Service-Token header and validates against configured service tokens.
 * Used for endpoints that receive calls from other services (auth-service, admin-service, etc.)
 *
 * Usage:
 *   router.get('/internal/users/:email', requireServiceToken, getUserByEmail);
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export async function requireServiceToken(req, res, next) {
  try {
    // Extract service token from custom header
    const serviceToken = req.headers['x-service-token'];

    if (!serviceToken) {
      logger.warn('Service authentication required: No service token provided', {
        path: req.path,
        method: req.method,
      });
      return next(new ErrorResponse('Service authentication required: No service token provided', 401));
    }

    // Validate token against configured service tokens
    const validTokens = getServiceTokens();

    // Check if token matches any configured service token
    let matchingService = null;
    for (const [serviceName, validToken] of Object.entries(validTokens)) {
      if (serviceToken === validToken) {
        matchingService = serviceName;
        break;
      }
    }

    if (!matchingService) {
      logger.warn('Invalid service token provided', {
        path: req.path,
        method: req.method,
      });
      return next(new ErrorResponse('Invalid service token: Service authentication failed', 401));
    }

    // Store calling service info for logging/audit
    req.callingService = matchingService;
    logger.info(`Service authentication successful: ${matchingService}`, {
      path: req.path,
      method: req.method,
      callingService: matchingService,
    });

    next();
  } catch (err) {
    logger.error('Service authentication error', { error: err.message });
    return next(new ErrorResponse('Service authentication failed', 500));
  }
}

/**
 * Middleware for JWT authentication in the user service.
 * Checks for a JWT in the Authorization header or cookies, verifies it, and attaches user info to req.user.
 * Also checks if the user account is active in the database.
 * Responds with 401 Unauthorized or 403 if the account is deactivated.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export async function requireAuth(req, res, next) {
  try {
    let token;
    // Check Authorization header first
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      logger.warn('requireAuth: No token found');
      return next(new ErrorResponse('Unauthorized: No token found in Authorization header or cookies', 401));
    }

    // Get JWT secret from environment
    const secret = getJwtSecret();

    // Verify token
    let decoded;
    try {
      // Get full JWT config for validation options
      const jwtConfig = getJwtConfig();
      decoded = jwt.verify(token, secret, {
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      });
    } catch (err) {
      logger.warn('requireAuth: Invalid token', { error: err });
      return next(new ErrorResponse('Unauthorized: Invalid or expired token', 401));
    }

    req.user = {
      _id: decoded.sub || decoded.id, // Use 'sub' (standard JWT claim) or fallback to 'id'
      email: decoded.email,
      roles: decoded.roles || [],
      name: decoded.name,
      emailVerified: decoded.emailVerified,
    };

    // Optional: Check if user exists in local database (only for user-service specific operations)
    // For admin operations that don't require local user data, we trust the JWT
    try {
      const user = await User.findById(req.user._id);
      if (user) {
        // User exists locally, use full user object
        if (user.isActive === false) {
          return next(new ErrorResponse('Forbidden: Account deactivated', 403));
        }
        req.user = user;
      }
      // If user doesn't exist locally, continue with JWT claims (for admin operations)
    } catch (dbError) {
      logger.warn('User lookup failed, continuing with JWT claims', {
        userId: req.user._id,
        error: dbError.message,
      });
    }

    next();
  } catch (err) {
    logger.error('requireAuth: Error during authentication', { error: err });
    return next(new ErrorResponse('Internal server error', 500));
  }
}

/**
 * Middleware to require specific roles
 * Usage: requireRoles('admin', 'manager')
 * @param {...string} roles - Required role names
 * @returns {import('express').RequestHandler} Express middleware function
 */
export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      logger.warn('requireRoles: No authenticated user');
      return next(new ErrorResponse('Unauthorized: Authentication required', 401));
    }

    const userRoles = req.user.roles || [];
    const hasRole = roles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      logger.warn('requireRoles: Insufficient permissions', {
        userId: req.user._id,
        requiredRoles: roles,
        userRoles: userRoles,
      });
      return next(new ErrorResponse(`Forbidden: Required roles: ${roles.join(' or ')}`, 403));
    }

    logger.info('requireRoles: Authorization successful', {
      userId: req.user._id,
      roles: userRoles,
    });
    next();
  };
}

/**
 * Middleware to require admin role
 * Convenience wrapper around requireRoles
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {void}
 */
export function requireAdmin(req, res, next) {
  return requireRoles('admin')(req, res, next);
}

/**
 * Middleware to require customer role (or admin)
 * Admins can access customer endpoints
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {void}
 */
export function requireCustomer(req, res, next) {
  return requireRoles('customer', 'admin')(req, res, next);
}

/**
 * Optional authentication middleware
 * Attaches user info if token is present, but doesn't require it
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export async function optionalAuth(req, res, next) {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      req.user = null;
      return next();
    }

    // Get JWT secret from environment
    const secret = getJwtSecret();
    const jwtConfig = getJwtConfig();

    try {
      const decoded = jwt.verify(token, secret, {
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      });
      req.user = {
        _id: decoded.id,
        email: decoded.email,
        roles: decoded.roles || [],
      };
      logger.debug('optionalAuth: Token validated', { userId: req.user._id });
    } catch (err) {
      logger.debug('optionalAuth: Invalid token', { error: err.message });
      req.user = null;
    }

    next();
  } catch (err) {
    logger.error('optionalAuth: Error getting JWT secret', { error: err });
    req.user = null;
    next();
  }
}

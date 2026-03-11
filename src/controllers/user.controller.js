import ErrorResponse from '../core/errors.js';
import logger from '../core/logger.js';
import User from '../models/user.model.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import userValidator from '../validators/user.validator.js';
import * as userService from '../services/user.service.js';
import {
  publishUserCreated,
  publishUserDeleted,
  publishUserUpdated,
  publishUserDeactivated,
  publishUserReactivated,
} from '../events/publisher.js';

/**
 * @typedef {Object} CreateUserRequest
 * @property {string} email - User's email address
 * @property {string} password - User's password
 * @property {string} firstName - User's first name
 * @property {string} lastName - User's last name
 * @property {string} [phoneNumber] - User's phone number
 * @property {boolean} [isEmailVerified] - Email verification status
 * @property {string[]} [roles] - User roles
 */

/**
 * @typedef {Object} UpdateUserRequest
 * @property {string} [firstName] - User's first name
 * @property {string} [lastName] - User's last name
 * @property {string} [displayName] - User's display name
 * @property {string} [phoneNumber] - User's phone number
 * @property {boolean} [isActive] - Account active status
 * @property {boolean} [isEmailVerified] - Email verification status
 * @property {Object} [preferences] - User preferences
 */

/**
 * @typedef {Object} UpdatePasswordRequest
 * @property {string} currentPassword - Current password
 * @property {string} newPassword - New password
 */

/**
 * @typedef {Object} BatchGetUsersRequest
 * @property {string[]} userIds - Array of user IDs to retrieve
 */

/**
 * Create a new user
 * @param {import('express').Request<{}, {}, CreateUserRequest>} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
// @desc    Create a new user
// @route   POST /users
// @access  Public
export const createUser = asyncHandler(async (req, res, next) => {
  // Validate request body
  const { email, password, firstName, lastName, phoneNumber } = req.body;

  // Use centralized validator
  const validation = userValidator.validateUserData({ email, password, firstName, lastName, phoneNumber });
  if (!validation.valid) {
    return next(new ErrorResponse(validation.error, 400, validation.code));
  }

  // Check for duplicate email
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new ErrorResponse('Email already exists', 409, 'EMAIL_EXISTS'));
  }

  logger.info('Creating new user', { email, traceId: req.traceId, spanId: req.spanId });

  try {
    // Only create user with basic fields - nested documents should be added via specific endpoints
    const userData = {
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      // Note: addresses, paymentMethods, wishlist should be added via their respective endpoints
      // Note: tier defaults to 'basic' - upgrades handled through admin actions or payment systems
    };

    // Allow setting isEmailVerified and roles for testing/admin purposes
    // In production, these would typically be set through separate workflows
    if (req.body.isEmailVerified !== undefined) {
      userData.isEmailVerified = req.body.isEmailVerified;
    }
    if (req.body.roles && Array.isArray(req.body.roles)) {
      userData.roles = req.body.roles;
    }

    const user = new User(userData);
    await user.save();

    logger.info('User created successfully', {
      userId: user._id,
      email: user.email,
      hasEmailVerified: user.isEmailVerified,
      traceId: req.traceId,
      spanId: req.spanId,
    }); // Extract client IP address
    const clientIP =
      req.ip ||
      req.connection?.remoteAddress ||
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      'unknown';

    // Extract User-Agent string
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Publish user.created event to message broker
    const traceId = req.traceId;
    await publishUserCreated(user, traceId, clientIP, userAgent);

    res.status(201).json(user);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return next(new ErrorResponse(err.message, 400, 'MONGOOSE_VALIDATION', { errors: err.errors }));
    }
    return next(err);
  }
});

/**
 * Get own user profile
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
// @desc    Get own user profile
// @route   GET /users
// @access  Private
export const getUser = asyncHandler(async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.user._id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

/**
 * Update own user profile, password, or deactivate account
 * @param {import('express').Request<{}, {}, UpdateUserRequest>} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
// @desc    Update own user profile, password, or deactivate account
// @route   PATCH /users
// @access  Private
export const updateUser = asyncHandler(async (req, res, next) => {
  try {
    // Check if isActive is being changed (for deactivate/reactivate events)
    const currentUser = await User.findById(req.user._id).select('isActive');
    const wasActive = currentUser?.isActive;

    const result = await userService.updateUser(req.user._id, req.body, { isAdmin: false });

    // Extract client IP address
    const clientIP =
      req.ip ||
      req.connection?.remoteAddress ||
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      'unknown';

    // Extract User-Agent string
    const userAgent = req.headers['user-agent'] || 'unknown';

    const traceId = req.traceId;

    // Check if isActive status changed
    if ('isActive' in req.body && wasActive !== req.body.isActive) {
      if (req.body.isActive === false) {
        // Account deactivated
        await publishUserDeactivated(result._id?.toString() || req.user._id.toString(), traceId, null, 'user_request');
        logger.info('Account deactivated via profile update', { userId: req.user._id, traceId });
      } else if (req.body.isActive === true) {
        // Account reactivated
        await publishUserReactivated(result._id?.toString() || req.user._id.toString(), traceId, null);
        logger.info('Account reactivated via profile update', { userId: req.user._id, traceId });
      }
    } else {
      // Regular profile update - publish user.updated event
      await publishUserUpdated(result, traceId, req.user._id.toString(), clientIP, userAgent);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @desc    Delete own user account (self-service)
 * @route   DELETE /users
 * @access  Private
 */
export const deleteUser = asyncHandler(async (req, res, next) => {
  try {
    // Get user info before deletion for event payload
    const user = await User.findById(req.user._id).select('email');
    const userId = req.user._id.toString();
    const userEmail = user?.email;

    await userService.deleteUser(req.user._id);

    // Publish user.deleted event (PRD 4.3)
    const traceId = req.traceId;
    await publishUserDeleted(userId, userEmail, traceId, null, 'user_request');

    logger.info('User deleted own account', { userId: req.user._id, traceId });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * Find user by email
 * @param {import('express').Request<{}, {}, {}, {email: string}>} req - Express request with email query param
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
// @desc    Find user by email
// @route   GET /users/findByEmail
// @access  Public (service-to-service)
export const findByEmail = asyncHandler(async (req, res, next) => {
  try {
    logger.info('Finding user by email', { email: req.query.email });
    const user = await userService.getUserByEmail(req.query.email);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

/**
 * Find user by ID
 * @param {import('express').Request<{id: string}>} req - Express request with ID param
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
// @desc    Find user by ID
// @route   GET /users/:id
// @access  Public (service-to-service)
export const getUserById = asyncHandler(async (req, res, next) => {
  try {
    logger.info('Finding user by ID', { userId: req.params.id });
    const user = await userService.getUserById(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

/**
 * Batch get users by IDs
 * @param {import('express').Request<{}, {}, BatchGetUsersRequest>} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
// @desc    Batch get users by IDs
// @route   POST /users/batch
// @access  Public (service-to-service)
export const batchGetUsers = asyncHandler(async (req, res, next) => {
  const { userIds } = req.body;

  // Validate input
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return next(new ErrorResponse('userIds must be a non-empty array', 400, 'INVALID_INPUT'));
  }

  // Limit batch size to prevent abuse
  if (userIds.length > 100) {
    return next(new ErrorResponse('Maximum 100 userIds per request', 400, 'BATCH_SIZE_EXCEEDED'));
  }

  try {
    // Fetch users by IDs (exclude password)
    const users = await User.find({
      _id: { $in: userIds },
      isActive: true,
    }).select('_id email firstName lastName roles createdAt');

    // Create map for quick lookup
    const userMap = {};
    users.forEach((user) => {
      userMap[user._id.toString()] = {
        userId: user._id.toString(),
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User',
        roles: user.roles,
        createdAt: user.createdAt,
      };
    });

    logger.info('Batch user lookup completed', {
      requestedCount: userIds.length,
      foundCount: users.length,
      traceId: req.traceId,
    });

    res.status(200).json({
      success: true,
      data: userMap,
    });
  } catch (err) {
    next(err);
  }
});

// Test compatibility functions - aliases to existing functions

/**
 * Deactivate account (set isActive to false)
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
// @desc    Deactivate account (set isActive to false)
// @route   PATCH /users/deactivate
// @access  Private
export const deactivateAccount = asyncHandler(async (req, res, next) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.user._id, { isActive: false }, { new: true });
    if (!updatedUser) {
      return next(new ErrorResponse('User not found', 404, 'USER_NOT_FOUND'));
    }

    // Publish user.deactivated event (PRD 4.17)
    const traceId = req.traceId;
    await publishUserDeactivated(updatedUser._id.toString(), traceId, null, 'user_request');

    logger.info('Account deactivated', {
      userId: updatedUser._id,
      traceId: req.traceId,
    });

    res.status(200).json({ message: 'Account deactivated', user: updatedUser });
  } catch (err) {
    next(err);
  }
});

/**
 * Update password
 * @param {import('express').Request<{}, {}, UpdatePasswordRequest>} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
// @desc    Update password
// @route   PATCH /users/password
// @access  Private
export const updatePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new ErrorResponse('Current password and new password are required', 400, 'PASSWORDS_REQUIRED'));
  }

  try {
    // Get user with password
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return next(new ErrorResponse('User not found', 404, 'USER_NOT_FOUND'));
    }

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return next(new ErrorResponse('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD'));
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * Update user by ID (admin function)
 * @param {import('express').Request<{id: string}, {}, UpdateUserRequest>} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
// @desc    Update user by ID (admin function)
// @route   PATCH /admin/users/:id
// @access  Private/Admin
export const updateUserById = asyncHandler(async (req, res, next) => {
  try {
    const result = await userService.updateUser(req.params.id, req.body, { isAdmin: true });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @typedef {Object} UpdateUserPasswordRequest
 * @property {string} newPassword - New password to set
 */

/**
 * Update user password by ID (admin function)
 * @param {import('express').Request<{id: string}, {}, UpdateUserPasswordRequest>} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
// @desc    Update user password by ID (admin function)
// @route   PATCH /admin/users/:id/password
// @access  Private/Admin
export const updateUserPasswordById = asyncHandler(async (req, res, next) => {
  const { newPassword } = req.body;

  if (!newPassword) {
    return next(new ErrorResponse('New password is required', 400, 'PASSWORD_REQUIRED'));
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return next(new ErrorResponse('User not found', 404, 'USER_NOT_FOUND'));
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: 'User password updated successfully' });
  } catch (err) {
    next(err);
  }
});

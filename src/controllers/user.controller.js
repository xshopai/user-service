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
  publishUserLoggedIn,
  publishUserLoggedOut,
  publishUserDeactivated,
  publishUserReactivated,
} from '../events/publisher.js';

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
    await userService.deleteUser(req.user._id);
    logger.info('User deleted own account', { userId: req.user._id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

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

// Test compatibility functions - aliases to existing functions

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

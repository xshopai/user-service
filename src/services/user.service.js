import User from '../models/user.model.js';
import userValidator from '../validators/user.validator.js';
import ErrorResponse from '../core/errors.js';
import mongoose from 'mongoose';

/**
 * Get user by ID
 * @param {string} userId - User ID (MongoDB ObjectId)
 * @returns {Promise<import('mongoose').Document>} User document without password
 * @throws {ErrorResponse} If user ID is invalid or user not found
 */
export async function getUserById(userId) {
  // Validate ObjectId format first
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ErrorResponse('Invalid user ID format', 400, 'INVALID_USER_ID');
  }

  const user = await User.findById(userId, '-password');
  if (!user) {
    throw new ErrorResponse('User not found', 404, 'USER_NOT_FOUND');
  }
  return user;
}

/**
 * @typedef {Object} UpdateUserOptions
 * @property {boolean} [isAdmin=false] - Whether the update is being performed by an admin
 */

/**
 * Update user by ID
 * @param {string} userId - User ID (MongoDB ObjectId)
 * @param {Object} updateFields - Fields to update
 * @param {string} [updateFields.firstName] - User's first name
 * @param {string} [updateFields.lastName] - User's last name
 * @param {string} [updateFields.displayName] - User's display name
 * @param {string} [updateFields.phoneNumber] - User's phone number
 * @param {string} [updateFields.email] - User's email (admin only)
 * @param {boolean} [updateFields.isEmailVerified] - Email verification status (admin only)
 * @param {boolean} [updateFields.isActive] - Account active status
 * @param {string[]} [updateFields.roles] - User roles (admin only)
 * @param {string} [updateFields.tier] - User tier (admin only)
 * @param {string} [updateFields.password] - User password
 * @param {Object} [updateFields.preferences] - User preferences
 * @param {UpdateUserOptions} [options] - Update options
 * @returns {Promise<import('mongoose').Document|{message: string}>} Updated user document or success message
 * @throws {ErrorResponse} If validation fails or user not found
 */
export async function updateUser(userId, updateFields, { isAdmin = false } = {}) {
  // Define allowed fields based on user role
  const allowedFields = isAdmin
    ? [
      'firstName',
      'lastName',
      'displayName',
      'phoneNumber',
      'email',
      'isEmailVerified',
      'isActive',
      'roles',
      'tier',
      'password',
      'preferences',
    ]
    : ['firstName', 'lastName', 'displayName', 'phoneNumber', 'isActive', 'isEmailVerified', 'password', 'preferences'];

  // Filter to only allowed fields
  const update = {};
  for (const field of allowedFields) {
    if (field in updateFields) {
      update[field] = updateFields[field];
    }
  }

  if (Object.keys(update).length === 0) {
    throw new ErrorResponse('No updatable fields provided', 400, 'NO_UPDATABLE_FIELDS');
  }

  // Validate fields that are being updated
  if ('email' in update) {
    if (!userValidator.isValidEmail(update.email)) {
      throw new ErrorResponse('Email is required, must be valid, 5-100 chars.', 400, 'INVALID_EMAIL');
    }
  }

  if ('firstName' in update) {
    if (!userValidator.isValidFirstName(update.firstName)) {
      throw new ErrorResponse(
        'First name must contain only letters, spaces, hyphens, apostrophes, and periods (max 50 chars).',
        400,
        'INVALID_NAME'
      );
    }
  }

  if ('lastName' in update) {
    if (!userValidator.isValidLastName(update.lastName)) {
      throw new ErrorResponse(
        'Last name must contain only letters, spaces, hyphens, apostrophes, and periods (max 50 chars).',
        400,
        'INVALID_NAME'
      );
    }
  }

  if ('displayName' in update) {
    if (!userValidator.isValidDisplayName(update.displayName)) {
      throw new ErrorResponse('Display name must be less than 100 characters.', 400, 'INVALID_NAME');
    }
  }

  if ('phoneNumber' in update) {
    if (!userValidator.isValidPhoneNumber(update.phoneNumber)) {
      throw new ErrorResponse(
        'Phone number must be valid (7-15 digits, can include spaces, hyphens, parentheses, and optional + prefix).',
        400,
        'INVALID_PHONE_NUMBER'
      );
    }
  }

  if ('roles' in update) {
    if (!userValidator.isValidRoles(update.roles)) {
      throw new ErrorResponse('Roles must be an array of valid role strings.', 400, 'INVALID_ROLES');
    }
  }

  if ('tier' in update) {
    if (!isAdmin) {
      throw new ErrorResponse('Tier can only be modified by administrators.', 403, 'FORBIDDEN');
    }
    if (!userValidator.isValidTier(update.tier)) {
      throw new ErrorResponse(
        'Tier must be a valid tier string (basic, premium, gold, platinum).',
        400,
        'INVALID_TIER'
      );
    }
  }

  if ('password' in update) {
    const passwordValidation = userValidator.isValidPassword(update.password);
    if (!passwordValidation || !passwordValidation.valid) {
      throw new ErrorResponse(passwordValidation?.error || 'Invalid password', 400, 'INVALID_PASSWORD');
    }

    // Handle password update separately (requires special logic)
    const user = await User.findById(userId);
    if (!user) {
      throw new ErrorResponse('User not found', 404, 'USER_NOT_FOUND');
    }

    user.password = update.password;
    await user.save();
    delete update.password;

    if (Object.keys(update).length === 0) {
      return { message: 'Password updated successfully' };
    }
  }

  const updatedUser = await User.findByIdAndUpdate(userId, update, { new: true });
  if (!updatedUser) {
    throw new ErrorResponse('User not found', 404, 'USER_NOT_FOUND');
  }
  return updatedUser;
}

/**
 * Delete user by ID
 * @param {string} userId - User ID (MongoDB ObjectId)
 * @returns {Promise<void>}
 * @throws {ErrorResponse} If user not found
 */
export async function deleteUser(userId) {
  const user = await User.findByIdAndDelete(userId);
  if (!user) {
    throw new ErrorResponse('User not found', 404, 'USER_NOT_FOUND');
  }
}

/**
 * Get user by email
 * @param {string} email - User's email address
 * @returns {Promise<import('mongoose').Document>} User document
 * @throws {ErrorResponse} If email is invalid or user not found
 */
export async function getUserByEmail(email) {
  if (!email) {
    throw new ErrorResponse('Email is required', 400, 'EMAIL_REQUIRED');
  }
  if (!userValidator.isValidEmail(email)) {
    throw new ErrorResponse('Invalid email', 400, 'INVALID_EMAIL');
  }
  const user = await User.findOne({ email });
  if (!user) {
    throw new ErrorResponse('User not found', 404, 'USER_NOT_FOUND');
  }
  return user;
}

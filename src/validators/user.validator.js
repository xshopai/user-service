import mongoose from 'mongoose';

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string} [error] - Error message if validation failed
 * @property {string} [code] - Error code if validation failed
 */

/**
 * @typedef {Object} PasswordValidationResult
 * @property {boolean} valid - Whether password is valid
 * @property {string} [error] - Error message if validation failed
 */

/**
 * @typedef {Object} UserDataValidation
 * @property {string} [email] - User's email
 * @property {string} [password] - User's password
 * @property {string} [firstName] - User's first name
 * @property {string} [lastName] - User's last name
 * @property {string} [phoneNumber] - User's phone number
 */

/**
 * @typedef {Object} ValidationOptions
 * @property {boolean} [isUpdate] - Whether this is an update operation
 */

// User input validation utility
const userValidator = {
  /**
   * Validate user data (for creation or update)
   * @param {UserDataValidation} data - User data to validate
   * @param {ValidationOptions} [options] - Validation options
   * @returns {ValidationResult} Validation result
   */
  validateUserData({ email, password, firstName, lastName, phoneNumber }, options = { isUpdate: false }) {
    // Email validation (required for creation, optional for update)
    if (!options.isUpdate && !email) {
      return { valid: false, error: 'Email is required', code: 'EMAIL_REQUIRED' };
    }
    if (email && !this.isValidEmail(email)) {
      return { valid: false, error: 'Email is required, must be valid, 5-100 chars.', code: 'INVALID_EMAIL' };
    }

    // Password validation (required for creation, optional for update)
    if (!options.isUpdate && !password) {
      return { valid: false, error: 'Password is required', code: 'PASSWORD_REQUIRED' };
    }
    if (password) {
      const passwordValidation = this.isValidPassword(password);
      if (!passwordValidation.valid) {
        return { valid: false, error: passwordValidation.error, code: 'INVALID_PASSWORD' };
      }
    }

    // FirstName validation (optional but must be valid if provided)
    if (firstName && !this.isValidFirstName(firstName)) {
      return {
        valid: false,
        error: 'First name must contain only letters, spaces, hyphens, apostrophes, and periods (max 50 chars).',
        code: 'INVALID_NAME',
      };
    }

    // LastName validation (optional but must be valid if provided)
    if (lastName && !this.isValidLastName(lastName)) {
      return {
        valid: false,
        error: 'Last name must contain only letters, spaces, hyphens, apostrophes, and periods (max 50 chars).',
        code: 'INVALID_NAME',
      };
    }

    // PhoneNumber validation (optional but must be valid if provided)
    if (phoneNumber && !this.isValidPhoneNumber(phoneNumber)) {
      return {
        valid: false,
        error:
          'Phone number must be valid (7-15 digits, can include spaces, hyphens, parentheses, and optional + prefix).',
        code: 'INVALID_PHONE_NUMBER',
      };
    }

    return { valid: true };
  },

  /**
   * Validate MongoDB ObjectId format
   * @param {string} id - ObjectId to validate
   * @returns {boolean} Whether the ID is valid
   */
  isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
  },
  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} Whether the email is valid
   */
  isValidEmail(email) {
    // Must be string, trimmed, valid email, min 5, max 100
    return (
      typeof email === 'string' &&
      email.trim().length >= 5 &&
      email.trim().length <= 100 &&
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
    );
  },
  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {PasswordValidationResult} Validation result
   */
  isValidPassword(password) {
    if (typeof password !== 'string') {
      return { valid: false, error: 'Password must be a string' };
    }
    if (password.trim().length < 6 || password.trim().length > 25) {
      return { valid: false, error: 'Password must be between 6 and 25 characters' };
    }
    if (!/[A-Za-z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one letter' };
    }
    if (!/\d/.test(password)) {
      return { valid: false, error: 'Password must contain at least one number' };
    }
    return { valid: true };
  },
  /**
   * Validate first name
   * @param {string} firstName - First name to validate
   * @returns {boolean} Whether the first name is valid
   */
  isValidFirstName(firstName) {
    // Optional field, but if provided must be valid
    if (!firstName) {
      return true;
    }
    return (
      typeof firstName === 'string' &&
      firstName.trim().length >= 2 && // Minimum 2 characters
      firstName.trim().length <= 50 &&
      /^[a-zA-Z\s\-'\.]+$/.test(firstName.trim())
    );
  },
  /**
   * Validate last name
   * @param {string} lastName - Last name to validate
   * @returns {boolean} Whether the last name is valid
   */
  isValidLastName(lastName) {
    // Optional field, but if provided must be valid
    if (!lastName) {
      return true;
    }
    return (
      typeof lastName === 'string' &&
      lastName.trim().length > 0 &&
      lastName.trim().length <= 50 &&
      /^[a-zA-Z\s\-'\.]+$/.test(lastName.trim())
    );
  },
  /**
   * Validate display name
   * @param {string} displayName - Display name to validate
   * @returns {boolean} Whether the display name is valid
   */
  isValidDisplayName(displayName) {
    // Optional field, but if provided must be valid
    if (!displayName) {
      return true;
    }
    return typeof displayName === 'string' && displayName.trim().length > 0 && displayName.trim().length <= 100;
  },
  /**
   * Validate phone number
   * @param {string} phoneNumber - Phone number to validate
   * @returns {boolean} Whether the phone number is valid
   */
  isValidPhoneNumber(phoneNumber) {
    // Optional field, but if provided must be valid
    if (!phoneNumber) {
      return true;
    }

    if (typeof phoneNumber !== 'string') {
      return false;
    }

    const trimmed = phoneNumber.trim();

    // Check length (allowing for international format with + and spaces/dashes)
    if (trimmed.length < 7 || trimmed.length > 20) {
      return false;
    }

    // Allow digits, spaces, hyphens, parentheses, and leading +
    // Examples: +1234567890, (123) 456-7890, +44 20 7123 4567, 123-456-7890
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;

    if (!phoneRegex.test(trimmed)) {
      return false;
    }

    // Ensure there are at least 7 digits (minimum for any valid phone number)
    const digitCount = (trimmed.match(/\d/g) || []).length;
    return digitCount >= 7 && digitCount <= 15;
  },
  /**
   * Validate user roles array
   * @param {string[]} roles - Array of role names
   * @returns {boolean} Whether the roles are valid
   */
  isValidRoles(roles) {
    // Must be array of valid role strings
    const validRoles = ['customer', 'admin', 'vendor', 'moderator', 'support'];
    return (
      Array.isArray(roles) &&
      roles.length > 0 &&
      roles.every(
        (role) => typeof role === 'string' && role.trim().length > 0 && validRoles.includes(role.trim().toLowerCase())
      )
    );
  },
  /**
   * Validate user tier
   * @param {string} tier - User tier to validate
   * @returns {boolean} Whether the tier is valid
   */
  isValidTier(tier) {
    // Must be a valid tier string
    const validTiers = ['basic', 'premium', 'gold', 'platinum'];
    return typeof tier === 'string' && tier.trim().length > 0 && validTiers.includes(tier.trim().toLowerCase());
  },
};

export default userValidator;

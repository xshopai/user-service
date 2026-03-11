import asyncHandler from '../middlewares/asyncHandler.js';
import ErrorResponse from '../core/errors.js';
import userPaymentValidator from '../validators/user.payment.validator.js';
import User from '../models/user.model.js';
import logger from '../core/logger.js';

/**
 * User Payment Methods Management Controller
 * Handles all payment method-related operations for authenticated users
 */

/**
 * @typedef {Object} PaymentMethod
 * @property {string} [_id] - Payment method ID (auto-generated)
 * @property {string} type - Payment type (credit_card, debit_card, paypal)
 * @property {string} provider - Payment provider (visa, mastercard, amex, paypal)
 * @property {string} last4 - Last 4 digits of card/account
 * @property {number} expiryMonth - Expiry month (1-12)
 * @property {number} expiryYear - Expiry year (4 digits)
 * @property {string} [cardholderName] - Cardholder name
 * @property {boolean} [isDefault] - Whether this is the default payment method
 */

/**
 * Get all payment methods for the authenticated user
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
/**
 * @desc    Get all payment methods for the authenticated user
 * @route   GET /users/payment-methods
 * @access  Private
 */
export const getPaymentMethods = asyncHandler(async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('paymentMethods');
    if (!user) {
      return next(new ErrorResponse('User not found', 404, 'USER_NOT_FOUND'));
    }

    logger.info(`Payment methods retrieved for user: ${req.user._id}`);
    res.json({
      paymentMethods: user.paymentMethods || [],
      count: user.paymentMethods?.length || 0,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Add payment method to user's payment methods list
 * @param {import('express').Request<{}, {}, PaymentMethod>} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
/**
 * @desc    Add payment method to user's payment methods list
 * @route   POST /users/payment-methods
 * @access  Private
 */
export const addPaymentMethod = asyncHandler(async (req, res, next) => {
  const paymentData = req.body;

  // Validate the payment method data directly using payment validator
  const validation = userPaymentValidator.validatePaymentMethod(paymentData);

  if (!validation.valid) {
    return next(new ErrorResponse(validation.errors.join('; '), 400, 'INVALID_PAYMENT_METHOD'));
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new ErrorResponse('User not found', 404, 'USER_NOT_FOUND'));
    }

    // Use normalized payment data from validator (converts strings to numbers, extracts last4)
    // Remove fields that should never be stored: cardNumber, cvv, billingAddress
    // eslint-disable-next-line no-unused-vars
    const { cardNumber, cvv, billingAddress, ...paymentToStore } = validation.normalizedPayment;

    // CRITICAL PERFORMANCE OPTIMIZATION:
    // When setting a new payment as default, we must unset isDefault on other payment methods.
    // Using atomic MongoDB operations ($set, $push) instead of modifying subdocuments in memory
    // prevents Mongoose from validating ALL existing payment methods in the array.
    //
    // Why this matters:
    // - If user has expired payment methods (e.g., expiryYear: 2022), loading them into memory
    //   and calling user.save() would trigger validation on ALL subdocuments, causing failures.
    // - Atomic operations bypass Mongoose validation for existing records, only validating new data.
    // - This is more efficient and scalable for users with many payment methods.
    if (paymentToStore.isDefault) {
      await User.updateOne(
        { _id: req.user._id },
        {
          $set: { 'paymentMethods.$[].isDefault': false },
          $push: { paymentMethods: paymentToStore },
        }
      );

      // Fetch the newly added payment method
      const updatedUser = await User.findById(req.user._id).select('paymentMethods');
      const newPaymentMethod = updatedUser.paymentMethods[updatedUser.paymentMethods.length - 1];

      logger.info(`Payment method added for user: ${req.user._id}`);
      return res.status(201).json({
        message: 'Payment method added successfully',
        paymentMethod: newPaymentMethod,
      });
    }

    // If not default, just add normally using atomic operation to avoid validation issues
    await User.updateOne({ _id: req.user._id }, { $push: { paymentMethods: paymentToStore } });

    // Fetch the newly added payment method
    const updatedUser = await User.findById(req.user._id).select('paymentMethods');
    const newPaymentMethod = updatedUser.paymentMethods[updatedUser.paymentMethods.length - 1];

    logger.info(`Payment method added for user: ${req.user._id}`);
    res.status(201).json({
      message: 'Payment method added successfully',
      paymentMethod: newPaymentMethod,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @desc    Update specific payment method
 * @route   PATCH /users/payment-methods/:paymentId
 * @access  Private
 */
export const updatePaymentMethod = asyncHandler(async (req, res, next) => {
  const { paymentId } = req.params;
  const paymentData = req.body;

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new ErrorResponse('User not found', 404, 'USER_NOT_FOUND'));
    }

    const paymentMethod = user.paymentMethods.id(paymentId);
    if (!paymentMethod) {
      return next(new ErrorResponse('Payment method not found', 404, 'PAYMENT_METHOD_NOT_FOUND'));
    }

    // Merge existing payment method with incoming data for validation
    const mergedPaymentMethod = { ...paymentMethod.toObject(), ...paymentData };

    // Validate the complete merged payment method using payment validator
    const validation = userPaymentValidator.validatePaymentMethod(mergedPaymentMethod);
    if (!validation.valid) {
      return next(new ErrorResponse(validation.errors.join('; '), 400, 'INVALID_PAYMENT_METHOD'));
    }

    // Use normalized data from validator (handles type conversions)
    // Only extract the fields that were in the original paymentData (don't overwrite everything)
    const updatedData = {};
    Object.keys(paymentData).forEach((key) => {
      if (validation.normalizedPayment[key] !== undefined) {
        updatedData[key] = validation.normalizedPayment[key];
      }
    });

    // If setting this as default, use atomic operations to avoid validating all subdocuments
    if (updatedData.isDefault === true) {
      // Build update object for the specific payment method
      const updateFields = {};
      Object.keys(updatedData).forEach((key) => {
        updateFields[`paymentMethods.$.${key}`] = updatedData[key];
      });

      await User.updateOne(
        { _id: req.user._id, 'paymentMethods._id': paymentId },
        {
          $set: {
            'paymentMethods.$[other].isDefault': false,
            ...updateFields,
          },
        },
        {
          arrayFilters: [{ 'other._id': { $ne: paymentMethod._id } }],
        }
      );

      // Fetch updated payment method
      const updatedUser = await User.findById(req.user._id).select('paymentMethods');
      const updatedPaymentMethod = updatedUser.paymentMethods.id(paymentId);

      logger.info(`Payment method updated for user: ${req.user._id}, payment: ${paymentId}`);
      return res.json({ message: 'Payment method updated successfully', paymentMethod: updatedPaymentMethod });
    }

    // If not setting as default, update normally
    Object.assign(paymentMethod, updatedData);
    await user.save({ validateModifiedOnly: true });

    logger.info(`Payment method updated for user: ${req.user._id}, payment: ${paymentId}`);
    res.json({ message: 'Payment method updated successfully', paymentMethod });
  } catch (err) {
    next(err);
  }
});

/**
 * @desc    Remove payment method from user's payment methods list
 * @route   DELETE /users/payment-methods/:paymentId
 * @access  Private
 */
export const removePaymentMethod = asyncHandler(async (req, res, next) => {
  const { paymentId } = req.params;

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new ErrorResponse('User not found', 404, 'USER_NOT_FOUND'));
    }

    const paymentMethod = user.paymentMethods.id(paymentId);
    if (!paymentMethod) {
      return next(new ErrorResponse('Payment method not found', 404, 'PAYMENT_METHOD_NOT_FOUND'));
    }

    user.paymentMethods.pull(paymentId);
    // Use validateModifiedOnly to skip validation of existing payment methods
    await user.save({ validateModifiedOnly: true });

    logger.info(`Payment method removed for user: ${req.user._id}, payment: ${paymentId}`);
    res.json({ message: 'Payment method removed successfully' });
  } catch (err) {
    next(err);
  }
});

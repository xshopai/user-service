import User from '../models/user.model.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import ErrorResponse from '../core/errors.js';
import logger from '../core/logger.js';
import { publishUserUpdated } from '../events/publisher.js';

/**
 * @desc    Get user preferences
 * @route   GET /api/users/preferences
 * @access  Private
 */
export const getPreferences = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  const user = await User.findById(userId).select('preferences');
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  logger.info('User preferences retrieved', null, {
    operation: 'get_preferences',
    userId: userId.toString(),
    traceId: req.traceId,
  });

  res.json({
    success: true,
    data: user.preferences || { theme: 'light', notifications: { email: true, sms: false } },
  });
});

/**
 * @desc    Update user preferences
 * @route   PATCH /api/users/preferences
 * @access  Private
 */
export const updatePreferences = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { theme, notifications } = req.body;

  // Validate theme if provided
  if (theme && !['light', 'dark', 'auto'].includes(theme)) {
    return next(new ErrorResponse('Invalid theme value. Must be light, dark, or auto', 400));
  }

  // Validate notifications if provided
  if (notifications) {
    if (notifications.email !== undefined && typeof notifications.email !== 'boolean') {
      return next(new ErrorResponse('notifications.email must be a boolean', 400));
    }
    if (notifications.sms !== undefined && typeof notifications.sms !== 'boolean') {
      return next(new ErrorResponse('notifications.sms must be a boolean', 400));
    }
  }

  const user = await User.findById(userId);
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Update preferences
  if (!user.preferences) {
    user.preferences = { theme: 'light', notifications: { email: true, sms: false } };
  }

  if (theme) {
    user.preferences.theme = theme;
  }

  if (notifications) {
    if (notifications.email !== undefined) {
      user.preferences.notifications.email = notifications.email;
    }
    if (notifications.sms !== undefined) {
      user.preferences.notifications.sms = notifications.sms;
    }
  }

  await user.save();

  // Publish event
  await publishUserUpdated(user, req.traceId, userId.toString(), req.ip, req.get('user-agent'));

  logger.info('User preferences updated', null, {
    operation: 'update_preferences',
    userId: userId.toString(),
    traceId: req.traceId,
  });

  res.json({
    success: true,
    message: 'Preferences updated successfully',
    data: user.preferences,
  });
});

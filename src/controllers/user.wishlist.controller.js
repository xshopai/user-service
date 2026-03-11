import asyncHandler from '../middlewares/asyncHandler.js';
import ErrorResponse from '../core/errors.js';
import userWishlistValidator from '../validators/user.wishlist.validator.js';
import User from '../models/user.model.js';
import logger from '../core/logger.js';

/**
 * User Wishlist Management Controller
 * Handles all wishlist-related operations for authenticated users
 */

/**
 * @typedef {Object} WishlistItem
 * @property {string} [_id] - Wishlist item ID (auto-generated)
 * @property {string} productId - Product ID
 * @property {string} [productName] - Product name
 * @property {number} [price] - Product price
 * @property {Date} [addedAt] - Date added to wishlist
 */

/**
 * Get all wishlist items for the authenticated user
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
/**
 * @desc    Get all wishlist items for the authenticated user
 * @route   GET /users/wishlist
 * @access  Private
 */
export const getWishlist = asyncHandler(async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('wishlist');
    if (!user) {
      return next(new ErrorResponse('User not found', 404, 'USER_NOT_FOUND'));
    }

    logger.info(`Wishlist retrieved for user: ${req.user._id}`);
    res.json({
      wishlist: user.wishlist || [],
      count: user.wishlist?.length || 0,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Add item to user's wishlist
 * @param {import('express').Request<{}, {}, WishlistItem>} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
/**
 * @desc    Add item to user's wishlist
 * @route   POST /users/wishlist
 * @access  Private
 */
export const addToWishlist = asyncHandler(async (req, res, next) => {
  const wishlistData = req.body;

  // Validate the wishlist data directly using wishlist validator
  const validation = userWishlistValidator.validateWishlistItem(wishlistData);
  if (!validation.valid) {
    return next(new ErrorResponse(validation.errors.join('; '), 400, 'INVALID_WISHLIST_ITEM'));
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new ErrorResponse('User not found', 404, 'USER_NOT_FOUND'));
    }

    // Check if product is already in wishlist
    const existingItem = user.wishlist.find((item) => item.productId === wishlistData.productId);
    if (existingItem) {
      return next(new ErrorResponse('Product already in wishlist', 409, 'PRODUCT_ALREADY_IN_WISHLIST'));
    }

    user.wishlist.push(wishlistData);
    await user.save();

    logger.info(`Item added to wishlist for user: ${req.user._id}, product: ${wishlistData.productId}`);
    res.status(201).json({
      message: 'Item added to wishlist successfully',
      wishlistItem: user.wishlist[user.wishlist.length - 1],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @desc    Update specific wishlist item
 * @route   PATCH /users/wishlist/:wishlistId
 * @access  Private
 */
export const updateWishlistItem = asyncHandler(async (req, res, next) => {
  const { wishlistId } = req.params;
  const wishlistData = req.body;

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new ErrorResponse('User not found', 404, 'USER_NOT_FOUND'));
    }

    const wishlistItem = user.wishlist.id(wishlistId);
    if (!wishlistItem) {
      return next(new ErrorResponse('Wishlist item not found', 404, 'WISHLIST_ITEM_NOT_FOUND'));
    }

    // Merge existing wishlist item with incoming data for validation
    const mergedWishlistItem = { ...wishlistItem.toObject(), ...wishlistData };

    // Validate the complete merged wishlist item using wishlist validator
    const validation = userWishlistValidator.validateWishlistItem(mergedWishlistItem);
    if (!validation.valid) {
      return next(new ErrorResponse(validation.errors.join('; '), 400, 'INVALID_WISHLIST_ITEM'));
    }

    // Update only the provided fields
    Object.assign(wishlistItem, wishlistData);
    await user.save();

    logger.info(`Wishlist item updated for user: ${req.user._id}, item: ${wishlistId}`);
    res.json({ message: 'Wishlist item updated successfully', wishlistItem });
  } catch (err) {
    next(err);
  }
});

/**
 * @desc    Remove item from user's wishlist
 * @route   DELETE /users/wishlist/:wishlistId
 * @access  Private
 */
export const removeFromWishlist = asyncHandler(async (req, res, next) => {
  const { wishlistId } = req.params;

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new ErrorResponse('User not found', 404, 'USER_NOT_FOUND'));
    }

    const wishlistItem = user.wishlist.id(wishlistId);
    if (!wishlistItem) {
      return next(new ErrorResponse('Wishlist item not found', 404, 'WISHLIST_ITEM_NOT_FOUND'));
    }

    user.wishlist.pull(wishlistId);
    await user.save();

    logger.info(`Item removed from wishlist for user: ${req.user._id}, item: ${wishlistId}`);
    res.json({ message: 'Item removed from wishlist successfully' });
  } catch (err) {
    next(err);
  }
});

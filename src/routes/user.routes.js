import express from 'express';
import {
  createUser,
  findByEmail,
  getUserById,
  updateUser,
  getUser,
  deleteUser,
  batchGetUsers,
} from '../controllers/user.controller.js';
import { getAddresses, addAddress, updateAddress, removeAddress } from '../controllers/user.address.controller.js';
import {
  getPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  removePaymentMethod,
} from '../controllers/user.payment.controller.js';
import {
  getWishlist,
  addToWishlist,
  updateWishlistItem,
  removeFromWishlist,
} from '../controllers/user.wishlist.controller.js';
import { getPreferences, updatePreferences } from '../controllers/user.preferences.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public service-to-service routes (no auth required)
router.get('/findByEmail', findByEmail);
router.get('/:id', getUserById);
router.post('/', createUser);
router.post('/batch', batchGetUsers);

// Self-service routes (auth required)
router.get('/', requireAuth, getUser); // get own profile
router.patch('/', requireAuth, updateUser); // update own profile, password, or deactivate
router.delete('/', requireAuth, deleteUser); // self-service delete own account

// Address management routes
router.get('/addresses', requireAuth, getAddresses);
router.post('/addresses', requireAuth, addAddress);
router.patch('/addresses/:addressId', requireAuth, updateAddress);
router.delete('/addresses/:addressId', requireAuth, removeAddress);

// Payment method management routes
router.get('/paymentmethods', requireAuth, getPaymentMethods);
router.post('/paymentmethods', requireAuth, addPaymentMethod);
router.patch('/paymentmethods/:paymentId', requireAuth, updatePaymentMethod);
router.delete('/paymentmethods/:paymentId', requireAuth, removePaymentMethod);

// Wishlist management routes
router.get('/wishlist', requireAuth, getWishlist);
router.post('/wishlist', requireAuth, addToWishlist);
router.patch('/wishlist/:wishlistId', requireAuth, updateWishlistItem);
router.delete('/wishlist/:wishlistId', requireAuth, removeFromWishlist);

// Preferences management routes
router.get('/preferences', requireAuth, getPreferences);
router.patch('/preferences', requireAuth, updatePreferences);

export default router;

import User from '../models/user.model.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import * as userService from '../services/user.service.js';
import logger from '../core/logger.js';
import {
  publishUserUpdated,
  publishUserDeleted,
  publishUserDeactivated,
  publishUserReactivated,
} from '../events/publisher.js';
import ErrorResponse from '../core/errors.js';

/**
 * @desc    Get comprehensive user statistics for admin dashboard
 * @route   GET /admin/users/stats
 * @access  Admin only
 * @query   includeRecent - Include recent users (true/false)
 * @query   recentLimit - Limit for recent users (default: 10)
 * @query   period - Analytics period (e.g., '30d', '7d', '1y')
 */
export const getStats = asyncHandler(async (req, res, _next) => {
  const includeRecent = req.query.includeRecent === 'true';
  const recentLimit = parseInt(req.query.recentLimit) || 10;
  const period = req.query.period;

  logger.info('Fetching comprehensive user statistics', {
    userId: req.user?._id,
    traceId: req.traceId,
    spanId: req.spanId,
    includeRecent,
    recentLimit,
    period,
  });

  // Get current date for calculations
  const now = new Date();
  const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Parallel aggregation queries for better performance
  const queries = [
    // Total users count (all users)
    User.countDocuments({ isActive: { $ne: false } }),

    // Active users (logged in within last 30 days)
    User.countDocuments({
      isActive: { $ne: false },
      lastLoginAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
    }),

    // New users this month
    User.countDocuments({
      createdAt: { $gte: firstDayThisMonth },
    }),

    // New users last month (for growth calculation)
    User.countDocuments({
      createdAt: {
        $gte: firstDayLastMonth,
        $lte: lastDayLastMonth,
      },
    }),

    // Total customers count (only users with 'customer' role, excluding admins)
    User.countDocuments({
      isActive: { $ne: false },
      roles: { $in: ['customer'], $nin: ['admin'] },
    }),

    // New customers this month (only users with 'customer' role)
    User.countDocuments({
      createdAt: { $gte: firstDayThisMonth },
      roles: { $in: ['customer'], $nin: ['admin'] },
    }),

    // New customers last month (for customer growth calculation)
    User.countDocuments({
      createdAt: {
        $gte: firstDayLastMonth,
        $lte: lastDayLastMonth,
      },
      roles: { $in: ['customer'], $nin: ['admin'] },
    }),
  ];

  // Add recent users query if requested
  if (includeRecent) {
    queries.push(
      User.find({ isActive: { $ne: false } }, 'firstName lastName email roles createdAt')
        .sort({ createdAt: -1 })
        .limit(recentLimit)
        .lean(),
    );
  }

  const results = await Promise.all(queries);
  const [
    totalUsers,
    activeUsers,
    newUsersThisMonth,
    newUsersLastMonth,
    totalCustomers,
    newCustomersThisMonth,
    newCustomersLastMonth,
    recentUsersData,
  ] = results;

  // Calculate growth percentage (all users)
  const growth =
    newUsersLastMonth > 0
      ? (((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100).toFixed(1)
      : newUsersThisMonth > 0
        ? 100
        : 0;

  // Calculate customer growth percentage
  const customerGrowth =
    newCustomersLastMonth > 0
      ? (((newCustomersThisMonth - newCustomersLastMonth) / newCustomersLastMonth) * 100).toFixed(1)
      : newCustomersThisMonth > 0
        ? 100
        : 0;

  const stats = {
    total: totalUsers,
    active: activeUsers,
    newThisMonth: newUsersThisMonth,
    growth: parseFloat(growth),
    // Customer-specific stats (excluding admins)
    customers: totalCustomers,
    newCustomersThisMonth: newCustomersThisMonth,
    customerGrowth: parseFloat(customerGrowth),
  };

  // Add recent users if requested
  if (includeRecent && recentUsersData) {
    stats.recentUsers = recentUsersData.map((user) => ({
      id: user._id.toString(),
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: user.roles.includes('admin') ? 'admin' : 'customer',
      createdAt: user.createdAt.toISOString(),
    }));
  }

  // Add analytics if period is specified
  if (period) {
    const daysMap = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
    };
    const days = daysMap[period] || 30;
    const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Get user registrations over the period
    const registrations = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: periodStart },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    stats.analytics = {
      period,
      registrations: registrations.map((r) => ({
        date: r._id,
        count: r.count,
      })),
    };
  }

  logger.info('Comprehensive user statistics retrieved successfully', {
    userId: req.user?._id,
    traceId: req.traceId,
    spanId: req.spanId,
    stats: {
      total: stats.total,
      active: stats.active,
      includeRecent,
      includedRecentCount: stats.recentUsers?.length || 0,
      includedAnalytics: !!period,
    },
  });

  res.json(stats);
});

/**
 * @desc    Get all users with pagination and filters (admin only)
 * @route   GET /admin/users
 * @access  Admin only
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20, max: 100)
 * @query   email - Filter by email (partial match)
 * @query   role - Filter by role (customer, admin)
 * @query   isActive - Filter by active status (true, false)
 * @query   isEmailVerified - Filter by verification status (true, false)
 * @query   search - Search across first name, last name, email
 */
export const getUsers = asyncHandler(async (req, res, _next) => {
  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 per page
  const skip = (page - 1) * limit;

  // Build filter query
  const filter = {};

  // Email filter (partial match)
  if (req.query.email) {
    filter.email = { $regex: req.query.email, $options: 'i' };
  }

  // Role filter
  if (req.query.role) {
    filter.roles = req.query.role;
  }

  // Active status filter
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
  }

  // Email verification filter
  if (req.query.isEmailVerified !== undefined) {
    filter.isEmailVerified = req.query.isEmailVerified === 'true';
  }

  // Search across multiple fields
  if (req.query.search) {
    const searchRegex = { $regex: req.query.search, $options: 'i' };
    filter.$or = [{ firstName: searchRegex }, { lastName: searchRegex }, { email: searchRegex }];
  }

  // Execute query with pagination
  const [users, total] = await Promise.all([
    User.find(filter, '-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  logger.info('Admin user list retrieved', {
    adminId: req.user?._id,
    page,
    limit,
    total,
    filters: filter,
    traceId: req.traceId,
  });

  res.json({
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
  });
});

/**
 * @desc    Create a new user (admin only)
 * @route   POST /admin/users
 * @access  Admin only
 */
export const createUser = asyncHandler(async (req, res, next) => {
  // Map phone field to phoneNumber if provided
  if (req.body.phone && !req.body.phoneNumber) {
    req.body.phoneNumber = req.body.phone;
  }

  // Note: We can't directly call createUserBase because it calls res.status(201).json()
  // and we need to ensure password is excluded from the response.
  // Instead, we'll implement user creation here with proper admin context.

  const { firstName, lastName, email, password, phoneNumber, roles, isActive } = req.body;

  // Basic validation
  if (!email || !password || !firstName || !lastName) {
    return next(
      new ErrorResponse('Email, password, first name, and last name are required', 400, 'MISSING_REQUIRED_FIELDS'),
    );
  }

  // Check for duplicate email
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return next(new ErrorResponse('Email already exists', 409, 'EMAIL_EXISTS'));
  }

  try {
    // Create new user with admin-specified fields
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password, // Will be hashed by model pre-save middleware
      phoneNumber,
      roles: roles || ['customer'],
      isActive: isActive !== undefined ? isActive : true,
      isEmailVerified: false,
      createdBy: req.user?._id?.toString() || 'ADMIN',
      updatedBy: req.user?._id?.toString() || 'ADMIN',
    });

    logger.info('User created by admin', {
      userId: user._id,
      adminId: req.user?._id,
      traceId: req.traceId,
      spanId: req.spanId,
    });

    // Extract client IP and User-Agent for event publishing
    const clientIP =
      req.ip ||
      req.connection?.remoteAddress ||
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const traceId = req.traceId;

    // Publish user.created event
    await userEventPublisher.publishUserCreated(user, traceId, clientIP, userAgent);

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json(userResponse);
  } catch (err) {
    logger.error('Failed to create user', {
      error: err.message,
      adminId: req.user?._id,
      traceId: req.traceId,
      spanId: req.spanId,
    });
    next(err);
  }
});

/**
 * @desc    Get any user by ID (admin only)
 * @route   GET /admin/users/:id
 * @access  Admin only
 */
export const getUser = asyncHandler(async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

/**
 * @desc    Update any user by ID (admin only)
 * @route   PATCH /admin/users/:id
 * @access  Admin only
 */
export const updateUser = asyncHandler(async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    const adminUserId = req.user?._id?.toString();

    // Prevent admin from modifying their own role or active status
    if (targetUserId === adminUserId) {
      if (req.body.roles !== undefined || req.body.isActive === false) {
        return next(
          new ErrorResponse('Cannot modify your own role or deactivate your own account', 403, 'SELF_MODIFICATION'),
        );
      }
    }

    // Check if isActive is being changed (for deactivate/reactivate events)
    const currentUser = await User.findById(targetUserId).select('isActive');
    const wasActive = currentUser?.isActive;

    const result = await userService.updateUser(targetUserId, req.body, { isAdmin: true });

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
        // Account deactivated by admin
        await publishUserDeactivated(targetUserId, traceId, adminUserId, 'admin_action');
        logger.info('Account deactivated by admin', {
          targetUserId,
          adminId: adminUserId,
          traceId,
        });
      } else if (req.body.isActive === true) {
        // Account reactivated by admin
        await publishUserReactivated(targetUserId, traceId, adminUserId);
        logger.info('Account reactivated by admin', {
          targetUserId,
          adminId: adminUserId,
          traceId,
        });
      }
    } else {
      // Regular admin update - publish user.updated event
      await publishUserUpdated(result, traceId, adminUserId, clientIP, userAgent);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @desc    Delete any user by ID (admin only)
 * @route   DELETE /admin/users/:id
 * @access  Admin only
 */
export const deleteUser = asyncHandler(async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    const adminUserId = req.user?._id?.toString();

    // Prevent admin from deleting their own account
    if (targetUserId === adminUserId) {
      return next(new ErrorResponse('Cannot delete your own account', 403, 'SELF_DELETION'));
    }

    // Get user info before deletion for event payload
    const user = await User.findById(targetUserId).select('email');
    const userEmail = user?.email;

    await userService.deleteUser(targetUserId);

    // Publish user.deleted event (PRD 4.16)
    const traceId = req.traceId;
    await publishUserDeleted(targetUserId, userEmail, traceId, adminUserId, 'admin_action');

    logger.info('User deleted by admin', {
      targetUserId,
      adminId: adminUserId,
      traceId,
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

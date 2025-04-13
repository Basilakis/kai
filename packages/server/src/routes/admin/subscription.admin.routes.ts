/**
 * Admin Subscription Routes
 * 
 * This file defines routes for admin management of subscription tiers, user subscriptions,
 * and subscription analytics.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware, adminMiddleware } from '../../middleware/auth.middleware';
import subscriptionAdminController from '../../controllers/admin/subscription.admin.controller';

// Use type assertion to handle TypeScript definition issue
const router = (express as any).Router();

// Apply auth and admin middleware to all routes
router.use(authMiddleware, adminMiddleware);

// Subscription Tiers
/**
 * @route   GET /api/admin/subscriptions/tiers
 * @desc    Get all subscription tiers
 * @access  Admin
 */
router.get(
  '/tiers',
  asyncHandler(subscriptionAdminController.getAllSubscriptionTiers)
);

/**
 * @route   GET /api/admin/subscriptions/tiers/:id
 * @desc    Get subscription tier by ID
 * @access  Admin
 */
router.get(
  '/tiers/:id',
  asyncHandler(subscriptionAdminController.getSubscriptionTierById)
);

/**
 * @route   POST /api/admin/subscriptions/tiers
 * @desc    Create subscription tier
 * @access  Admin
 */
router.post(
  '/tiers',
  asyncHandler(subscriptionAdminController.createSubscriptionTier)
);

/**
 * @route   PUT /api/admin/subscriptions/tiers/:id
 * @desc    Update subscription tier
 * @access  Admin
 */
router.put(
  '/tiers/:id',
  asyncHandler(subscriptionAdminController.updateSubscriptionTier)
);

/**
 * @route   DELETE /api/admin/subscriptions/tiers/:id
 * @desc    Delete subscription tier
 * @access  Admin
 */
router.delete(
  '/tiers/:id',
  asyncHandler(subscriptionAdminController.deleteSubscriptionTier)
);

// User Subscriptions
/**
 * @route   GET /api/admin/subscriptions/users
 * @desc    Get all user subscriptions
 * @access  Admin
 */
router.get(
  '/users',
  asyncHandler(subscriptionAdminController.getAllUserSubscriptions)
);

/**
 * @route   GET /api/admin/subscriptions/users/:id
 * @desc    Get user subscription by ID
 * @access  Admin
 */
router.get(
  '/users/:id',
  asyncHandler(subscriptionAdminController.getUserSubscriptionById)
);

/**
 * @route   GET /api/admin/subscriptions/users/by-user/:userId
 * @desc    Get user subscription by user ID
 * @access  Admin
 */
router.get(
  '/users/by-user/:userId',
  asyncHandler(subscriptionAdminController.getUserSubscriptionByUserId)
);

/**
 * @route   PUT /api/admin/subscriptions/users/:id
 * @desc    Update user subscription
 * @access  Admin
 */
router.put(
  '/users/:id',
  asyncHandler(subscriptionAdminController.updateUserSubscription)
);

/**
 * @route   POST /api/admin/subscriptions/users/:id/cancel
 * @desc    Cancel user subscription
 * @access  Admin
 */
router.post(
  '/users/:id/cancel',
  asyncHandler(subscriptionAdminController.cancelUserSubscription)
);

/**
 * @route   POST /api/admin/subscriptions/users/:id/change-tier
 * @desc    Change user subscription tier
 * @access  Admin
 */
router.post(
  '/users/:id/change-tier',
  asyncHandler(subscriptionAdminController.changeUserSubscriptionTier)
);

// Credits
/**
 * @route   POST /api/admin/subscriptions/credits/:userId/add
 * @desc    Add credits to user
 * @access  Admin
 */
router.post(
  '/credits/:userId/add',
  asyncHandler(subscriptionAdminController.addCreditsToUser)
);

/**
 * @route   GET /api/admin/subscriptions/credits/:userId/history
 * @desc    Get user credit history
 * @access  Admin
 */
router.get(
  '/credits/:userId/history',
  asyncHandler(subscriptionAdminController.getUserCreditHistory)
);

// Analytics
/**
 * @route   GET /api/admin/subscriptions/analytics
 * @desc    Get subscription analytics
 * @access  Admin
 */
router.get(
  '/analytics',
  asyncHandler(subscriptionAdminController.getSubscriptionAnalytics)
);

/**
 * @route   GET /api/admin/subscriptions/analytics/by-date
 * @desc    Get subscription analytics by date range
 * @access  Admin
 */
router.get(
  '/analytics/by-date',
  asyncHandler(subscriptionAdminController.getSubscriptionAnalyticsByDateRange)
);

/**
 * @route   GET /api/admin/subscriptions/analytics/churn
 * @desc    Get subscription churn analytics
 * @access  Admin
 */
router.get(
  '/analytics/churn',
  asyncHandler(subscriptionAdminController.getSubscriptionChurnAnalytics)
);

/**
 * @route   GET /api/admin/subscriptions/analytics/revenue
 * @desc    Get subscription revenue analytics
 * @access  Admin
 */
router.get(
  '/analytics/revenue',
  asyncHandler(subscriptionAdminController.getSubscriptionRevenueAnalytics)
);

// Plan Versioning
/**
 * @route   GET /api/admin/subscriptions/tiers/:id/versions
 * @desc    Get subscription tier versions
 * @access  Admin
 */
router.get(
  '/tiers/:id/versions',
  asyncHandler(subscriptionAdminController.getSubscriptionTierVersions)
);

/**
 * @route   POST /api/admin/subscriptions/tiers/:id/versions
 * @desc    Create subscription tier version
 * @access  Admin
 */
router.post(
  '/tiers/:id/versions',
  asyncHandler(subscriptionAdminController.createSubscriptionTierVersion)
);

// Subscription State Transitions
/**
 * @route   GET /api/admin/subscriptions/users/:id/transitions
 * @desc    Get subscription state transitions
 * @access  Admin
 */
router.get(
  '/users/:id/transitions',
  asyncHandler(subscriptionAdminController.getSubscriptionStateTransitions)
);

export default router;

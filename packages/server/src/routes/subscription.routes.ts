/**
 * Subscription Routes
 *
 * This file defines routes for managing subscription tiers, user subscriptions, and credits.
 * It includes endpoints for:
 * - Viewing available subscription tiers
 * - Admin management of subscription tiers
 * - Users managing their own subscription
 * - Credit management (balance, transactions, purchase, usage)
 * - Payment method management
 */

import express from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware, authorizeRoles } from '../middleware/auth.middleware';
import subscriptionController from '../controllers/subscription.controller';

// Use type assertion to handle TypeScript definition issue
const router = (express as any).Router();

// Public routes (no authentication required)
/**
 * @route   GET /api/subscriptions/tiers
 * @desc    Get all public subscription tiers (admin gets all tiers)
 * @access  Public
 */
router.get(
  '/tiers',
  asyncHandler(subscriptionController.getSubscriptionTiers)
);

/**
 * @route   GET /api/subscriptions/tiers/:id
 * @desc    Get a specific subscription tier by ID
 * @access  Public
 */
router.get(
  '/tiers/:id',
  asyncHandler(subscriptionController.getSubscriptionTierById)
);

// Protected routes (authentication required)
/**
 * @route   GET /api/subscriptions/my-subscription
 * @desc    Get current user's subscription
 * @access  Private
 */
router.get(
  '/my-subscription',
  authMiddleware,
  asyncHandler(subscriptionController.getCurrentUserSubscription)
);

/**
 * @route   PUT /api/subscriptions/my-subscription
 * @desc    Update current user's subscription
 * @access  Private
 */
router.put(
  '/my-subscription',
  authMiddleware,
  asyncHandler(subscriptionController.updateUserSubscriptionTier)
);

// Admin routes (admin authentication required)
/**
 * @route   POST /api/subscriptions/tiers
 * @desc    Create a new subscription tier
 * @access  Admin
 */
router.post(
  '/tiers',
  authMiddleware,
  authorizeRoles(['admin']),
  asyncHandler(subscriptionController.createTier)
);

/**
 * @route   PUT /api/subscriptions/tiers/:id
 * @desc    Update a subscription tier
 * @access  Admin
 */
router.put(
  '/tiers/:id',
  authMiddleware,
  authorizeRoles(['admin']),
  asyncHandler(subscriptionController.updateTier)
);

/**
 * @route   DELETE /api/subscriptions/tiers/:id
 * @desc    Delete a subscription tier
 * @access  Admin
 */
router.delete(
  '/tiers/:id',
  authMiddleware,
  authorizeRoles(['admin']),
  asyncHandler(subscriptionController.deleteTier)
);

// Credit management routes
/**
 * @route   GET /api/subscriptions/credits
 * @desc    Get user's credit balance
 * @access  Private
 */
router.get(
  '/credits',
  authMiddleware,
  asyncHandler(subscriptionController.getUserCreditBalance)
);

/**
 * @route   GET /api/subscriptions/credits/transactions
 * @desc    Get user's credit transactions
 * @access  Private
 */
router.get(
  '/credits/transactions',
  authMiddleware,
  asyncHandler(subscriptionController.getUserCreditTransactions)
);

/**
 * @route   POST /api/subscriptions/credits/purchase
 * @desc    Purchase credits
 * @access  Private
 */
router.post(
  '/credits/purchase',
  authMiddleware,
  asyncHandler(subscriptionController.purchaseCredits)
);

/**
 * @route   POST /api/subscriptions/credits/use
 * @desc    Use credits
 * @access  Private
 */
router.post(
  '/credits/use',
  authMiddleware,
  asyncHandler(subscriptionController.useUserCredits)
);

/**
 * @route   POST /api/subscriptions/credits/use-service
 * @desc    Use credits for a specific service
 * @access  Private
 */
router.post(
  '/credits/use-service',
  authMiddleware,
  asyncHandler(subscriptionController.useServiceCredits)
);

/**
 * @route   GET /api/subscriptions/credits/usage-by-service
 * @desc    Get credit usage by service
 * @access  Private
 */
router.get(
  '/credits/usage-by-service',
  authMiddleware,
  asyncHandler(subscriptionController.getUserCreditUsageByService)
);

/**
 * @route   GET /api/subscriptions/service-costs
 * @desc    Get all service costs
 * @access  Private
 */
router.get(
  '/service-costs',
  authMiddleware,
  asyncHandler(subscriptionController.getServiceCosts)
);

// Subscription management routes
/**
 * @route   POST /api/subscriptions/subscribe
 * @desc    Subscribe to a paid plan
 * @access  Private
 */
router.post(
  '/subscribe',
  authMiddleware,
  asyncHandler(subscriptionController.subscribeUser)
);

/**
 * @route   POST /api/subscriptions/cancel
 * @desc    Cancel subscription
 * @access  Private
 */
router.post(
  '/cancel',
  authMiddleware,
  asyncHandler(subscriptionController.cancelUserSubscription)
);

/**
 * @route   POST /api/subscriptions/change-plan
 * @desc    Change subscription plan
 * @access  Private
 */
router.post(
  '/change-plan',
  authMiddleware,
  asyncHandler(subscriptionController.changeUserSubscriptionPlan)
);

// Payment method routes
/**
 * @route   GET /api/subscriptions/payment-methods
 * @desc    Get user's payment methods
 * @access  Private
 */
router.get(
  '/payment-methods',
  authMiddleware,
  asyncHandler(subscriptionController.getPaymentMethods)
);

export default router;
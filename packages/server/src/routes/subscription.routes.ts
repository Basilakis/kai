/**
 * Subscription Routes
 * 
 * This file defines routes for managing subscription tiers and user subscriptions.
 * It includes endpoints for:
 * - Viewing available subscription tiers
 * - Admin management of subscription tiers
 * - Users managing their own subscription
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

export default router;
/**
 * Subscription Pause Routes
 * 
 * This file defines the routes for pausing and resuming subscriptions,
 * including scheduling future resumption.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import pauseController from '../../controllers/subscription/pause.controller';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   POST /api/subscriptions/pause
 * @desc    Pause a subscription
 * @access  Private
 */
router.post(
  '/',
  asyncHandler(pauseController.pauseSubscription)
);

/**
 * @route   POST /api/subscriptions/pause/resume
 * @desc    Resume a paused subscription
 * @access  Private
 */
router.post(
  '/resume',
  asyncHandler(pauseController.resumeSubscription)
);

/**
 * @route   PUT /api/subscriptions/pause
 * @desc    Update pause settings for a subscription
 * @access  Private
 */
router.put(
  '/',
  asyncHandler(pauseController.updatePauseSettings)
);

/**
 * @route   GET /api/subscriptions/pause/history
 * @desc    Get pause history for a subscription
 * @access  Private
 */
router.get(
  '/history',
  asyncHandler(pauseController.getPauseHistory)
);

export default router;

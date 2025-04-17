/**
 * Proration Routes
 * 
 * This file defines the routes for subscription proration,
 * including previewing and applying prorated subscription changes.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import prorationController from '../../controllers/subscription/proration.controller';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /api/subscriptions/proration/preview
 * @desc    Preview a subscription change with proration
 * @access  Private
 */
router.get(
  '/preview',
  asyncHandler(prorationController.previewProration)
);

/**
 * @route   POST /api/subscriptions/proration/apply
 * @desc    Apply a prorated subscription change
 * @access  Private
 */
router.post(
  '/apply',
  asyncHandler(prorationController.applyProration)
);

export default router;

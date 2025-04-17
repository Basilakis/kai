/**
 * Credit Top-up Routes
 * 
 * This file defines the routes for credit top-up management,
 * including automatic top-up settings and manual top-ups.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireModuleAccess } from '../../middleware/module-access.middleware';
import topupController from '../../controllers/credit/topup.controller';

const router = express.Router();

// All routes require authentication and credits module access
router.use(authMiddleware, requireModuleAccess('credits'));

/**
 * @route   GET /api/credits/topup/settings
 * @desc    Get credit top-up setting for the current user
 * @access  Private
 */
router.get(
  '/settings',
  asyncHandler(topupController.getTopupSetting)
);

/**
 * @route   POST /api/credits/topup/settings
 * @desc    Create or update credit top-up setting
 * @access  Private
 */
router.post(
  '/settings',
  asyncHandler(topupController.createOrUpdateTopupSetting)
);

/**
 * @route   DELETE /api/credits/topup/settings
 * @desc    Delete credit top-up setting
 * @access  Private
 */
router.delete(
  '/settings',
  asyncHandler(topupController.deleteTopupSetting)
);

/**
 * @route   GET /api/credits/topup/history
 * @desc    Get credit top-up history for the current user
 * @access  Private
 */
router.get(
  '/history',
  asyncHandler(topupController.getTopupHistory)
);

/**
 * @route   POST /api/credits/topup/manual
 * @desc    Trigger a manual top-up
 * @access  Private
 */
router.post(
  '/manual',
  asyncHandler(topupController.manualTopup)
);

/**
 * @route   POST /api/credits/topup/check
 * @desc    Check if the user needs a top-up and process it if needed
 * @access  Private
 */
router.post(
  '/check',
  asyncHandler(topupController.checkAndProcessTopup)
);

export default router;

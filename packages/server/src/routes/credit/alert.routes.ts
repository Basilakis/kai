/**
 * Credit Alert Routes
 * 
 * This file defines the routes for credit alert management,
 * including setting up alerts and viewing alert history.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import alertController from '../../controllers/credit/alert.controller';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /api/credits/alerts/settings
 * @desc    Get credit alert settings for the current user
 * @access  Private
 */
router.get(
  '/settings',
  asyncHandler(alertController.getAlertSettings)
);

/**
 * @route   POST /api/credits/alerts/settings
 * @desc    Create a credit alert setting
 * @access  Private
 */
router.post(
  '/settings',
  asyncHandler(alertController.createAlertSetting)
);

/**
 * @route   PUT /api/credits/alerts/settings/:settingId
 * @desc    Update a credit alert setting
 * @access  Private
 */
router.put(
  '/settings/:settingId',
  asyncHandler(alertController.updateAlertSetting)
);

/**
 * @route   DELETE /api/credits/alerts/settings/:settingId
 * @desc    Delete a credit alert setting
 * @access  Private
 */
router.delete(
  '/settings/:settingId',
  asyncHandler(alertController.deleteAlertSetting)
);

/**
 * @route   GET /api/credits/alerts/history
 * @desc    Get credit alert history for the current user
 * @access  Private
 */
router.get(
  '/history',
  asyncHandler(alertController.getAlertHistory)
);

/**
 * @route   POST /api/credits/alerts/test/:settingId
 * @desc    Test alert delivery
 * @access  Private
 */
router.post(
  '/test/:settingId',
  asyncHandler(alertController.testAlertDelivery)
);

/**
 * @route   POST /api/credits/alerts/check
 * @desc    Check if the user needs alerts and process them if needed
 * @access  Private
 */
router.post(
  '/check',
  asyncHandler(alertController.checkAndProcessAlerts)
);

/**
 * @route   GET /api/credits/alerts/types
 * @desc    Get available alert types
 * @access  Private
 */
router.get(
  '/types',
  asyncHandler(alertController.getAlertTypes)
);

export default router;

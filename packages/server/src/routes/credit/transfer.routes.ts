/**
 * Credit Transfer Routes
 * 
 * This file defines the routes for credit transfers between users,
 * including initiating transfers and viewing transfer history.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireModuleAccess } from '../../middleware/module-access.middleware';
import transferController from '../../controllers/credit/transfer.controller';

const router = express.Router();

// All routes require authentication and credits module access
router.use(authMiddleware, requireModuleAccess('credits'));

/**
 * @route   POST /api/credits/transfer
 * @desc    Transfer credits to another user
 * @access  Private
 */
router.post(
  '/',
  asyncHandler(transferController.transferCredits)
);

/**
 * @route   GET /api/credits/transfer/history
 * @desc    Get transfer history for the current user
 * @access  Private
 */
router.get(
  '/history',
  asyncHandler(transferController.getTransferHistory)
);

/**
 * @route   GET /api/credits/transfer/:transferId
 * @desc    Get a transfer by ID
 * @access  Private
 */
router.get(
  '/:transferId',
  asyncHandler(transferController.getTransferById)
);

/**
 * @route   GET /api/credits/transfer/find-user
 * @desc    Find a user by email
 * @access  Private
 */
router.get(
  '/find-user',
  asyncHandler(transferController.findUserByEmail)
);

export default router;

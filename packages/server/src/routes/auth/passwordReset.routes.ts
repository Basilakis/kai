/**
 * Password Reset Routes
 * 
 * This file defines the routes for password reset functionality,
 * including requesting a reset token and resetting the password.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import passwordResetController from '../../controllers/auth/passwordReset.controller';

const router = express.Router();

/**
 * @route   POST /api/auth/password-reset/request
 * @desc    Request a password reset
 * @access  Public
 */
router.post(
  '/request',
  asyncHandler(passwordResetController.requestPasswordReset)
);

/**
 * @route   GET /api/auth/password-reset/validate/:token
 * @desc    Validate a password reset token
 * @access  Public
 */
router.get(
  '/validate/:token',
  asyncHandler(passwordResetController.validateResetToken)
);

/**
 * @route   POST /api/auth/password-reset/reset
 * @desc    Reset password with token
 * @access  Public
 */
router.post(
  '/reset',
  asyncHandler(passwordResetController.resetPassword)
);

export default router;

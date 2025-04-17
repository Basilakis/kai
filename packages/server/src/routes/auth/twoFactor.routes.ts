/**
 * Two-Factor Authentication Routes
 * 
 * This file defines the routes for two-factor authentication,
 * including setup, verification, and management.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import twoFactorController from '../../controllers/auth/twoFactor.controller';

const router = express.Router();

/**
 * @route   GET /api/auth/2fa/settings
 * @desc    Get two-factor settings for the current user
 * @access  Private
 */
router.get(
  '/settings',
  authMiddleware,
  asyncHandler(twoFactorController.getTwoFactorSettingsHandler)
);

/**
 * @route   POST /api/auth/2fa/totp/setup
 * @desc    Setup TOTP two-factor authentication
 * @access  Private
 */
router.post(
  '/totp/setup',
  authMiddleware,
  asyncHandler(twoFactorController.setupTOTP)
);

/**
 * @route   POST /api/auth/2fa/totp/verify
 * @desc    Verify and enable TOTP two-factor authentication
 * @access  Private
 */
router.post(
  '/totp/verify',
  authMiddleware,
  asyncHandler(twoFactorController.verifyTOTP)
);

/**
 * @route   POST /api/auth/2fa/sms/setup
 * @desc    Setup SMS two-factor authentication
 * @access  Private
 */
router.post(
  '/sms/setup',
  authMiddleware,
  asyncHandler(twoFactorController.setupSMS)
);

/**
 * @route   POST /api/auth/2fa/sms/verify
 * @desc    Verify and enable SMS two-factor authentication
 * @access  Private
 */
router.post(
  '/sms/verify',
  authMiddleware,
  asyncHandler(twoFactorController.verifySMS)
);

/**
 * @route   POST /api/auth/2fa/email/setup
 * @desc    Setup email two-factor authentication
 * @access  Private
 */
router.post(
  '/email/setup',
  authMiddleware,
  asyncHandler(twoFactorController.setupEmail)
);

/**
 * @route   POST /api/auth/2fa/email/verify
 * @desc    Verify and enable email two-factor authentication
 * @access  Private
 */
router.post(
  '/email/verify',
  authMiddleware,
  asyncHandler(twoFactorController.verifyEmail)
);

/**
 * @route   POST /api/auth/2fa/disable
 * @desc    Disable two-factor authentication
 * @access  Private
 */
router.post(
  '/disable',
  authMiddleware,
  asyncHandler(twoFactorController.disableTwoFactor)
);

/**
 * @route   POST /api/auth/2fa/send-code
 * @desc    Send verification code for login
 * @access  Public (with session token)
 */
router.post(
  '/send-code',
  asyncHandler(twoFactorController.sendVerificationCode)
);

/**
 * @route   POST /api/auth/2fa/verify-code
 * @desc    Verify two-factor code for login
 * @access  Public (with session token)
 */
router.post(
  '/verify-code',
  asyncHandler(twoFactorController.verifyTwoFactorCode)
);

/**
 * @route   POST /api/auth/2fa/verify-backup
 * @desc    Verify backup code for login
 * @access  Public (with session token)
 */
router.post(
  '/verify-backup',
  asyncHandler(twoFactorController.verifyBackupCode)
);

export default router;

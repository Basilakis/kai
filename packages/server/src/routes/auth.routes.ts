import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import * as sessionController from '../controllers/auth/session.controller';
import * as passwordResetController from '../controllers/auth/passwordReset.controller';
import * as twoFactorController from '../controllers/auth/twoFactor.controller';

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', asyncHandler(sessionController.registerUser));

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post('/login', asyncHandler(sessionController.loginUser));

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user / clear cookie
 * @access  Private
 */
router.post('/logout', authMiddleware, asyncHandler(sessionController.logoutUser));

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public (with refresh token)
 */
// Note: Path changed to match controller
router.post('/sessions/refresh', asyncHandler(sessionController.refreshSession));


// --- Session Management Routes ---

/**
 * @route   GET /api/auth/sessions
 * @desc    Get all active sessions for the current user
 * @access  Private
 */
router.get('/sessions', authMiddleware, asyncHandler(sessionController.getUserSessionsHandler));

/**
 * @route   DELETE /api/auth/sessions/:sessionId
 * @desc    Revoke a specific session
 * @access  Private
 */
router.delete('/sessions/:sessionId', authMiddleware, asyncHandler(sessionController.revokeSession));

/**
 * @route   DELETE /api/auth/sessions
 * @desc    Revoke all sessions except the current one
 * @access  Private
 */
router.delete('/sessions', authMiddleware, asyncHandler(sessionController.revokeAllSessions));


// --- Password Reset ---

/**
 * @route   POST /api/auth/reset-password
 * @desc    Request password reset
 * @access  Public
 */
// Note: Path changed to match controller
router.post('/password-reset/request', asyncHandler(passwordResetController.requestPasswordReset));

/**
 * @route   PUT /api/auth/reset-password/:resetToken
 * @desc    Reset password
 * @access  Public (with reset token)
 */
// Note: Path and method changed to match controller
router.post('/password-reset/reset', asyncHandler(passwordResetController.resetPassword));

/**
 * @route   GET /api/auth/password-reset/validate/:token
 * @desc    Validate password reset token
 * @access  Public
 */
router.get('/password-reset/validate/:token', asyncHandler(passwordResetController.validateResetToken));

/**
 * @route   GET /api/auth/verify-email/:verificationToken
 * @desc    Verify email address
 * @access  Public (with verification token)
 */
router.get('/verify-email/:verificationToken', asyncHandler(sessionController.verifyEmailHandler));


// --- Two-Factor Authentication ---

/**
 * @route   POST /api/auth/2fa/totp/setup
 * @desc    Setup TOTP two-factor authentication
 * @access  Private
 */
router.post('/2fa/totp/setup', authMiddleware, asyncHandler(twoFactorController.setupTOTP));

/**
 * @route   POST /api/auth/2fa/sms/setup
 * @desc    Setup SMS two-factor authentication
 * @access  Private
 */
router.post('/2fa/sms/setup', authMiddleware, asyncHandler(twoFactorController.setupSMS));

/**
 * @route   POST /api/auth/2fa/email/setup
 * @desc    Setup email two-factor authentication
 * @access  Private
 */
router.post('/2fa/email/setup', authMiddleware, asyncHandler(twoFactorController.setupEmail));

/**
 * @route   POST /api/auth/mfa/verify
 * @desc    Verify and enable TOTP two-factor authentication
 * @access  Private
 */
router.post('/2fa/totp/verify', authMiddleware, asyncHandler(twoFactorController.verifyTOTP));

/**
 * @route   POST /api/auth/2fa/sms/verify
 * @desc    Verify and enable SMS two-factor authentication
 * @access  Private
 */
router.post('/2fa/sms/verify', authMiddleware, asyncHandler(twoFactorController.verifySMS));

/**
 * @route   POST /api/auth/2fa/email/verify
 * @desc    Verify and enable email two-factor authentication
 * @access  Private
 */
router.post('/2fa/email/verify', authMiddleware, asyncHandler(twoFactorController.verifyEmail));

/**
 * @route   POST /api/auth/2fa/verify-code
 * @desc    Verify two-factor code for login
 * @access  Public (with session token)
 */
router.post('/2fa/verify-code', asyncHandler(twoFactorController.verifyTwoFactorCode));

/**
 * @route   POST /api/auth/2fa/verify-backup
 * @desc    Verify backup code for login
 * @access  Public (with session token)
 */
router.post('/2fa/verify-backup', asyncHandler(twoFactorController.verifyBackupCode));

/**
 * @route   GET /api/auth/2fa/settings
 * @desc    Get two-factor settings for the current user
 * @access  Private
 */
router.get('/2fa/settings', authMiddleware, asyncHandler(twoFactorController.getTwoFactorSettingsHandler));

/**
 * @route   POST /api/auth/2fa/disable
 * @desc    Disable a specific two-factor authentication method
 * @access  Private
 */
router.post('/2fa/disable', authMiddleware, asyncHandler(twoFactorController.disableTwoFactor));

/**
 * @route   POST /api/auth/2fa/send-code
 * @desc    Send verification code for login (used when 2FA is required)
 * @access  Public (requires intermediate session state or user identifier)
 */
router.post('/2fa/send-code', asyncHandler(twoFactorController.sendVerificationCode));


export default router;
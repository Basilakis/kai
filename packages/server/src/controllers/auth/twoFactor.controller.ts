/**
 * Two-Factor Authentication Controller
 *
 * This controller handles API endpoints for managing two-factor authentication,
 * including setup, verification, and management.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { ApiError } from '../../middleware/error.middleware';
import twoFactorService from '../../services/auth/twoFactor.service';
import {
  TwoFactorMethod,
  getTwoFactorSettings,
  getTwoFactorSettingByMethod
} from '../../models/twoFactor.model';
import securityLogger, { SecurityEventType, SecurityOutcome } from '../../utils/securityLogger';

/**
 * Get two-factor settings for the current user
 * @route GET /api/auth/2fa/settings
 * @access Private
 */
export const getTwoFactorSettingsHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    // Get all two-factor settings for the user
    const settings = await getTwoFactorSettings(userId);

    // Remove sensitive data
    const sanitizedSettings = settings.map(setting => ({
      id: setting.id,
      method: setting.method,
      isVerified: setting.isVerified,
      isEnabled: setting.isEnabled,
      phoneNumber: setting.phoneNumber ? `${setting.phoneNumber.slice(0, 4)}****${setting.phoneNumber.slice(-4)}` : undefined,
      email: setting.email ? `${setting.email.slice(0, 2)}****${setting.email.slice(setting.email.indexOf('@'))}` : undefined,
      lastUsedAt: setting.lastUsedAt,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt
    }));

    res.status(200).json({
      success: true,
      data: sanitizedSettings
    });
  } catch (error) {
    logger.error(`Error getting two-factor settings: ${error}`);
    throw new ApiError(500, 'Failed to get two-factor settings');
  }
};

/**
 * Setup TOTP two-factor authentication
 * @route POST /api/auth/2fa/totp/setup
 * @access Private
 */
export const setupTOTP = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { appName } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    // Log security event - attempt
    securityLogger.logSecurityEvent({
      type: SecurityEventType.TWO_FACTOR,
      outcome: SecurityOutcome.ATTEMPT,
      userId,
      ipAddress,
      userAgent,
      resourceType: 'two_factor_auth',
      details: {
        method: TwoFactorMethod.TOTP,
        action: 'setup',
        appName
      }
    });

    // Setup TOTP
    const result = await twoFactorService.setupTOTP(userId, appName || 'KAI');

    // Log security event - success
    securityLogger.logSecurityEvent({
      type: SecurityEventType.TWO_FACTOR,
      outcome: SecurityOutcome.SUCCESS,
      userId,
      ipAddress,
      userAgent,
      resourceType: 'two_factor_auth',
      details: {
        method: TwoFactorMethod.TOTP,
        action: 'setup'
      }
    });

    res.status(200).json({
      success: true,
      data: {
        secret: result.secret,
        qrCodeUrl: result.qrCodeUrl,
        backupCodes: result.backupCodes
      },
      message: 'TOTP setup initiated. Please verify with a token to enable.'
    });
  } catch (error) {
    const userId = req.user.id;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    // Log security event - failure
    securityLogger.logSecurityEvent({
      type: SecurityEventType.TWO_FACTOR,
      outcome: SecurityOutcome.FAILURE,
      userId,
      ipAddress,
      userAgent,
      resourceType: 'two_factor_auth',
      details: {
        method: TwoFactorMethod.TOTP,
        action: 'setup',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    logger.error(`Error setting up TOTP: ${error}`);
    throw new ApiError(500, 'Failed to setup TOTP');
  }
};

/**
 * Verify and enable TOTP two-factor authentication
 * @route POST /api/auth/2fa/totp/verify
 * @access Private
 */
export const verifyTOTP = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    if (!token) {
      throw new ApiError(400, 'Token is required');
    }

    // Verify and enable TOTP
    const isValid = await twoFactorService.verifyAndEnableTOTP(userId, token);

    if (!isValid) {
      throw new ApiError(400, 'Invalid token');
    }

    res.status(200).json({
      success: true,
      message: 'TOTP verification successful. Two-factor authentication is now enabled.'
    });
  } catch (error) {
    logger.error(`Error verifying TOTP: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to verify TOTP');
  }
};

/**
 * Setup SMS two-factor authentication
 * @route POST /api/auth/2fa/sms/setup
 * @access Private
 */
export const setupSMS = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      throw new ApiError(400, 'Phone number is required');
    }

    // Setup SMS verification
    await twoFactorService.setupSMS(userId, phoneNumber);

    res.status(200).json({
      success: true,
      message: 'SMS verification code sent. Please verify to enable two-factor authentication.'
    });
  } catch (error) {
    logger.error(`Error setting up SMS verification: ${error}`);
    throw new ApiError(500, 'Failed to setup SMS verification');
  }
};

/**
 * Verify and enable SMS two-factor authentication
 * @route POST /api/auth/2fa/sms/verify
 * @access Private
 */
export const verifySMS = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
      throw new ApiError(400, 'Verification code is required');
    }

    // Verify and enable SMS
    const isValid = await twoFactorService.verifyAndEnableSMS(userId, code);

    if (!isValid) {
      throw new ApiError(400, 'Invalid verification code');
    }

    // Get the SMS setting to return backup codes
    const setting = await getTwoFactorSettingByMethod(userId, TwoFactorMethod.SMS);

    res.status(200).json({
      success: true,
      data: {
        backupCodes: setting?.backupCodes || []
      },
      message: 'SMS verification successful. Two-factor authentication is now enabled.'
    });
  } catch (error) {
    logger.error(`Error verifying SMS: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to verify SMS');
  }
};

/**
 * Setup email two-factor authentication
 * @route POST /api/auth/2fa/email/setup
 * @access Private
 */
export const setupEmail = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { email } = req.body;

    if (!email) {
      throw new ApiError(400, 'Email is required');
    }

    // Setup email verification
    await twoFactorService.setupEmail(userId, email);

    res.status(200).json({
      success: true,
      message: 'Email verification code sent. Please verify to enable two-factor authentication.'
    });
  } catch (error) {
    logger.error(`Error setting up email verification: ${error}`);
    throw new ApiError(500, 'Failed to setup email verification');
  }
};

/**
 * Verify and enable email two-factor authentication
 * @route POST /api/auth/2fa/email/verify
 * @access Private
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
      throw new ApiError(400, 'Verification code is required');
    }

    // Verify and enable email
    const isValid = await twoFactorService.verifyAndEnableEmail(userId, code);

    if (!isValid) {
      throw new ApiError(400, 'Invalid verification code');
    }

    // Get the email setting to return backup codes
    const setting = await getTwoFactorSettingByMethod(userId, TwoFactorMethod.EMAIL);

    res.status(200).json({
      success: true,
      data: {
        backupCodes: setting?.backupCodes || []
      },
      message: 'Email verification successful. Two-factor authentication is now enabled.'
    });
  } catch (error) {
    logger.error(`Error verifying email: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to verify email');
  }
};

/**
 * Disable two-factor authentication
 * @route POST /api/auth/2fa/disable
 * @access Private
 */
export const disableTwoFactor = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { method } = req.body;

    if (!method || !Object.values(TwoFactorMethod).includes(method as TwoFactorMethod)) {
      throw new ApiError(400, 'Valid two-factor method is required');
    }

    // Disable two-factor authentication
    await twoFactorService.disableTwoFactor(userId, method as TwoFactorMethod);

    res.status(200).json({
      success: true,
      message: `${method} two-factor authentication has been disabled.`
    });
  } catch (error) {
    logger.error(`Error disabling two-factor authentication: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to disable two-factor authentication');
  }
};

/**
 * Send verification code for login
 * @route POST /api/auth/2fa/send-code
 * @access Public (with session token)
 */
export const sendVerificationCode = async (req: Request, res: Response) => {
  try {
    const { userId, method } = req.body;

    if (!userId) {
      throw new ApiError(400, 'User ID is required');
    }

    if (!method || !Object.values(TwoFactorMethod).includes(method as TwoFactorMethod)) {
      throw new ApiError(400, 'Valid two-factor method is required');
    }

    // Send verification code
    await twoFactorService.sendVerificationCode(userId, method as TwoFactorMethod);

    res.status(200).json({
      success: true,
      message: 'Verification code sent successfully.'
    });
  } catch (error) {
    logger.error(`Error sending verification code: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to send verification code');
  }
};

/**
 * Verify two-factor code for login
 * @route POST /api/auth/2fa/verify-code
 * @access Public (with session token)
 */
export const verifyTwoFactorCode = async (req: Request, res: Response) => {
  try {
    const { userId, method, code } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    // Log security event - attempt
    securityLogger.logSecurityEvent({
      type: SecurityEventType.AUTHENTICATION,
      outcome: SecurityOutcome.ATTEMPT,
      userId,
      ipAddress,
      userAgent,
      resourceType: 'two_factor_auth',
      details: {
        method,
        action: 'verify'
      }
    });

    if (!userId) {
      throw new ApiError(400, 'User ID is required');
    }

    if (!method || !Object.values(TwoFactorMethod).includes(method as TwoFactorMethod)) {
      throw new ApiError(400, 'Valid two-factor method is required');
    }

    if (!code) {
      throw new ApiError(400, 'Verification code is required');
    }

    // Verify two-factor code
    const isValid = await twoFactorService.verifyTwoFactorCode(userId, method as TwoFactorMethod, code);

    if (!isValid) {
      // Log security event - failure (invalid code)
      securityLogger.logSecurityEvent({
        type: SecurityEventType.AUTHENTICATION,
        outcome: SecurityOutcome.FAILURE,
        userId,
        ipAddress,
        userAgent,
        resourceType: 'two_factor_auth',
        details: {
          method,
          action: 'verify',
          reason: 'Invalid verification code'
        }
      });

      throw new ApiError(400, 'Invalid verification code');
    }

    // At this point, the user has successfully authenticated with 2FA
    // The actual token generation will be handled by the auth service

    // Log security event - success
    securityLogger.logSecurityEvent({
      type: SecurityEventType.AUTHENTICATION,
      outcome: SecurityOutcome.SUCCESS,
      userId,
      ipAddress,
      userAgent,
      resourceType: 'two_factor_auth',
      details: {
        method,
        action: 'verify'
      }
    });

    res.status(200).json({
      success: true,
      message: 'Two-factor authentication successful.'
    });
  } catch (error) {
    const { userId, method } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    // Log security event - failure
    if (userId) {
      securityLogger.logSecurityEvent({
        type: SecurityEventType.AUTHENTICATION,
        outcome: SecurityOutcome.FAILURE,
        userId,
        ipAddress,
        userAgent,
        resourceType: 'two_factor_auth',
        details: {
          method,
          action: 'verify',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }

    logger.error(`Error verifying two-factor code: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to verify two-factor code');
  }
};

/**
 * Verify backup code for login
 * @route POST /api/auth/2fa/verify-backup
 * @access Public (with session token)
 */
export const verifyBackupCode = async (req: Request, res: Response) => {
  try {
    const { userId, method, code } = req.body;

    if (!userId) {
      throw new ApiError(400, 'User ID is required');
    }

    if (!method || !Object.values(TwoFactorMethod).includes(method as TwoFactorMethod)) {
      throw new ApiError(400, 'Valid two-factor method is required');
    }

    if (!code) {
      throw new ApiError(400, 'Backup code is required');
    }

    // Verify backup code
    const isValid = await twoFactorService.verifyTwoFactorBackupCode(userId, method as TwoFactorMethod, code);

    if (!isValid) {
      throw new ApiError(400, 'Invalid backup code');
    }

    // At this point, the user has successfully authenticated with a backup code
    // The actual token generation will be handled by the auth service

    res.status(200).json({
      success: true,
      message: 'Backup code verification successful.'
    });
  } catch (error) {
    logger.error(`Error verifying backup code: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to verify backup code');
  }
};

export default {
  getTwoFactorSettingsHandler,
  setupTOTP,
  verifyTOTP,
  setupSMS,
  verifySMS,
  setupEmail,
  verifyEmail,
  disableTwoFactor,
  sendVerificationCode,
  verifyTwoFactorCode,
  verifyBackupCode
};

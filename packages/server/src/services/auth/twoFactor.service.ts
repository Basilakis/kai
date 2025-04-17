/**
 * Two-Factor Authentication Service
 * 
 * This service provides functionality for managing two-factor authentication,
 * including TOTP generation and validation, SMS code sending, and email code sending.
 */

import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { logger } from '../../utils/logger';
import { 
  TwoFactorMethod, 
  TwoFactorSetting,
  createTwoFactorSetting,
  updateTwoFactorSetting,
  getTwoFactorSettingByMethod,
  createVerificationCode,
  verifyCode,
  generateBackupCodes,
  verifyBackupCode
} from '../../models/twoFactor.model';
import { emailService } from '../email/email.service';
import { smsService } from '../sms/sms.service';

/**
 * Generate a new TOTP secret
 * @param userId User ID
 * @param appName Application name for TOTP
 * @returns TOTP secret and QR code URL
 */
export async function generateTOTPSecret(userId: string, appName: string = 'KAI'): Promise<{ secret: string; qrCodeUrl: string }> {
  try {
    // Generate a new secret
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `${appName}:${userId}`
    });

    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url || '');

    return {
      secret: secret.base32,
      qrCodeUrl
    };
  } catch (error) {
    logger.error(`Failed to generate TOTP secret: ${error}`);
    throw error;
  }
}

/**
 * Verify a TOTP token
 * @param secret TOTP secret
 * @param token TOTP token
 * @returns Whether the token is valid
 */
export function verifyTOTPToken(secret: string, token: string): boolean {
  try {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1 // Allow 1 step before and after for time drift
    });
  } catch (error) {
    logger.error(`Failed to verify TOTP token: ${error}`);
    return false;
  }
}

/**
 * Setup TOTP for a user
 * @param userId User ID
 * @param appName Application name for TOTP
 * @returns TOTP setup information
 */
export async function setupTOTP(userId: string, appName: string = 'KAI'): Promise<{ secret: string; qrCodeUrl: string; backupCodes: string[] }> {
  try {
    // Check if TOTP is already set up
    const existingSetting = await getTwoFactorSettingByMethod(userId, TwoFactorMethod.TOTP);
    
    if (existingSetting && existingSetting.isVerified) {
      throw new Error('TOTP is already set up for this user');
    }

    // Generate a new secret
    const { secret, qrCodeUrl } = await generateTOTPSecret(userId, appName);
    
    // Generate backup codes
    const backupCodes = generateBackupCodes();

    // Create or update the TOTP setting
    if (existingSetting) {
      await updateTwoFactorSetting(existingSetting.id, {
        secret,
        backupCodes,
        isVerified: false
      });
    } else {
      await createTwoFactorSetting({
        userId,
        method: TwoFactorMethod.TOTP,
        secret,
        backupCodes,
        isVerified: false,
        isEnabled: false
      });
    }

    return {
      secret,
      qrCodeUrl,
      backupCodes
    };
  } catch (error) {
    logger.error(`Failed to setup TOTP: ${error}`);
    throw error;
  }
}

/**
 * Verify and enable TOTP for a user
 * @param userId User ID
 * @param token TOTP token
 * @returns Whether TOTP was successfully enabled
 */
export async function verifyAndEnableTOTP(userId: string, token: string): Promise<boolean> {
  try {
    // Get the TOTP setting
    const setting = await getTwoFactorSettingByMethod(userId, TwoFactorMethod.TOTP);
    
    if (!setting || !setting.secret) {
      throw new Error('TOTP is not set up for this user');
    }

    // Verify the token
    const isValid = verifyTOTPToken(setting.secret, token);
    
    if (!isValid) {
      return false;
    }

    // Update the setting
    await updateTwoFactorSetting(setting.id, {
      isVerified: true,
      isEnabled: true,
      lastUsedAt: new Date()
    });

    return true;
  } catch (error) {
    logger.error(`Failed to verify and enable TOTP: ${error}`);
    throw error;
  }
}

/**
 * Setup SMS verification for a user
 * @param userId User ID
 * @param phoneNumber Phone number for SMS verification
 * @returns Whether SMS verification was successfully set up
 */
export async function setupSMS(userId: string, phoneNumber: string): Promise<boolean> {
  try {
    // Check if SMS is already set up
    const existingSetting = await getTwoFactorSettingByMethod(userId, TwoFactorMethod.SMS);
    
    // Generate backup codes
    const backupCodes = generateBackupCodes();

    // Create or update the SMS setting
    if (existingSetting) {
      await updateTwoFactorSetting(existingSetting.id, {
        phoneNumber,
        backupCodes,
        isVerified: false
      });
    } else {
      await createTwoFactorSetting({
        userId,
        method: TwoFactorMethod.SMS,
        phoneNumber,
        backupCodes,
        isVerified: false,
        isEnabled: false
      });
    }

    // Send a verification code
    const verification = await createVerificationCode(userId, TwoFactorMethod.SMS);
    
    // Send the code via SMS
    await smsService.sendSMS(
      phoneNumber,
      `Your verification code is: ${verification.code}. It will expire in 10 minutes.`
    );

    return true;
  } catch (error) {
    logger.error(`Failed to setup SMS verification: ${error}`);
    throw error;
  }
}

/**
 * Verify and enable SMS verification for a user
 * @param userId User ID
 * @param code Verification code
 * @returns Whether SMS verification was successfully enabled
 */
export async function verifyAndEnableSMS(userId: string, code: string): Promise<boolean> {
  try {
    // Verify the code
    const isValid = await verifyCode(userId, TwoFactorMethod.SMS, code);
    
    if (!isValid) {
      return false;
    }

    // Get the SMS setting
    const setting = await getTwoFactorSettingByMethod(userId, TwoFactorMethod.SMS);
    
    if (!setting) {
      throw new Error('SMS verification is not set up for this user');
    }

    // Update the setting
    await updateTwoFactorSetting(setting.id, {
      isVerified: true,
      isEnabled: true,
      lastUsedAt: new Date()
    });

    return true;
  } catch (error) {
    logger.error(`Failed to verify and enable SMS verification: ${error}`);
    throw error;
  }
}

/**
 * Setup email verification for a user
 * @param userId User ID
 * @param email Email address for verification
 * @returns Whether email verification was successfully set up
 */
export async function setupEmail(userId: string, email: string): Promise<boolean> {
  try {
    // Check if email verification is already set up
    const existingSetting = await getTwoFactorSettingByMethod(userId, TwoFactorMethod.EMAIL);
    
    // Generate backup codes
    const backupCodes = generateBackupCodes();

    // Create or update the email setting
    if (existingSetting) {
      await updateTwoFactorSetting(existingSetting.id, {
        email,
        backupCodes,
        isVerified: false
      });
    } else {
      await createTwoFactorSetting({
        userId,
        method: TwoFactorMethod.EMAIL,
        email,
        backupCodes,
        isVerified: false,
        isEnabled: false
      });
    }

    // Send a verification code
    const verification = await createVerificationCode(userId, TwoFactorMethod.EMAIL);
    
    // Send the code via email
    await emailService.sendEmail({
      to: email,
      subject: 'Your verification code',
      text: `Your verification code is: ${verification.code}. It will expire in 10 minutes.`,
      html: `<p>Your verification code is: <strong>${verification.code}</strong>. It will expire in 10 minutes.</p>`
    });

    return true;
  } catch (error) {
    logger.error(`Failed to setup email verification: ${error}`);
    throw error;
  }
}

/**
 * Verify and enable email verification for a user
 * @param userId User ID
 * @param code Verification code
 * @returns Whether email verification was successfully enabled
 */
export async function verifyAndEnableEmail(userId: string, code: string): Promise<boolean> {
  try {
    // Verify the code
    const isValid = await verifyCode(userId, TwoFactorMethod.EMAIL, code);
    
    if (!isValid) {
      return false;
    }

    // Get the email setting
    const setting = await getTwoFactorSettingByMethod(userId, TwoFactorMethod.EMAIL);
    
    if (!setting) {
      throw new Error('Email verification is not set up for this user');
    }

    // Update the setting
    await updateTwoFactorSetting(setting.id, {
      isVerified: true,
      isEnabled: true,
      lastUsedAt: new Date()
    });

    return true;
  } catch (error) {
    logger.error(`Failed to verify and enable email verification: ${error}`);
    throw error;
  }
}

/**
 * Send a verification code for login
 * @param userId User ID
 * @param method Two-factor method
 * @returns Whether the code was sent successfully
 */
export async function sendVerificationCode(userId: string, method: TwoFactorMethod): Promise<boolean> {
  try {
    // Get the two-factor setting
    const setting = await getTwoFactorSettingByMethod(userId, method);
    
    if (!setting || !setting.isVerified || !setting.isEnabled) {
      throw new Error(`${method} verification is not enabled for this user`);
    }

    // Create a verification code
    const verification = await createVerificationCode(userId, method);
    
    // Send the code based on the method
    switch (method) {
      case TwoFactorMethod.SMS:
        if (!setting.phoneNumber) {
          throw new Error('Phone number is not set for SMS verification');
        }
        
        await smsService.sendSMS(
          setting.phoneNumber,
          `Your login verification code is: ${verification.code}. It will expire in 10 minutes.`
        );
        break;
        
      case TwoFactorMethod.EMAIL:
        if (!setting.email) {
          throw new Error('Email is not set for email verification');
        }
        
        await emailService.sendEmail({
          to: setting.email,
          subject: 'Your login verification code',
          text: `Your login verification code is: ${verification.code}. It will expire in 10 minutes.`,
          html: `<p>Your login verification code is: <strong>${verification.code}</strong>. It will expire in 10 minutes.</p>`
        });
        break;
        
      case TwoFactorMethod.TOTP:
        // No need to send a code for TOTP
        return true;
        
      default:
        throw new Error(`Unsupported two-factor method: ${method}`);
    }

    return true;
  } catch (error) {
    logger.error(`Failed to send verification code: ${error}`);
    throw error;
  }
}

/**
 * Verify a two-factor code for login
 * @param userId User ID
 * @param method Two-factor method
 * @param code Verification code
 * @returns Whether the code is valid
 */
export async function verifyTwoFactorCode(userId: string, method: TwoFactorMethod, code: string): Promise<boolean> {
  try {
    // Get the two-factor setting
    const setting = await getTwoFactorSettingByMethod(userId, method);
    
    if (!setting || !setting.isVerified || !setting.isEnabled) {
      throw new Error(`${method} verification is not enabled for this user`);
    }

    // Verify the code based on the method
    let isValid = false;
    
    switch (method) {
      case TwoFactorMethod.TOTP:
        if (!setting.secret) {
          throw new Error('TOTP secret is not set');
        }
        
        isValid = verifyTOTPToken(setting.secret, code);
        break;
        
      case TwoFactorMethod.SMS:
      case TwoFactorMethod.EMAIL:
        isValid = await verifyCode(userId, method, code);
        break;
        
      default:
        throw new Error(`Unsupported two-factor method: ${method}`);
    }

    if (isValid) {
      // Update the last used timestamp
      await updateTwoFactorSetting(setting.id, {
        lastUsedAt: new Date()
      });
    }

    return isValid;
  } catch (error) {
    logger.error(`Failed to verify two-factor code: ${error}`);
    throw error;
  }
}

/**
 * Verify a backup code
 * @param userId User ID
 * @param method Two-factor method
 * @param code Backup code
 * @returns Whether the code is valid
 */
export async function verifyTwoFactorBackupCode(userId: string, method: TwoFactorMethod, code: string): Promise<boolean> {
  try {
    return await verifyBackupCode(userId, method, code);
  } catch (error) {
    logger.error(`Failed to verify backup code: ${error}`);
    throw error;
  }
}

/**
 * Disable two-factor authentication for a user
 * @param userId User ID
 * @param method Two-factor method
 * @returns Whether two-factor authentication was successfully disabled
 */
export async function disableTwoFactor(userId: string, method: TwoFactorMethod): Promise<boolean> {
  try {
    // Get the two-factor setting
    const setting = await getTwoFactorSettingByMethod(userId, method);
    
    if (!setting) {
      throw new Error(`${method} verification is not set up for this user`);
    }

    // Update the setting
    await updateTwoFactorSetting(setting.id, {
      isEnabled: false
    });

    return true;
  } catch (error) {
    logger.error(`Failed to disable two-factor authentication: ${error}`);
    throw error;
  }
}

export default {
  generateTOTPSecret,
  verifyTOTPToken,
  setupTOTP,
  verifyAndEnableTOTP,
  setupSMS,
  verifyAndEnableSMS,
  setupEmail,
  verifyAndEnableEmail,
  sendVerificationCode,
  verifyTwoFactorCode,
  verifyTwoFactorBackupCode,
  disableTwoFactor
};

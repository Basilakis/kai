/**
 * Two-Factor Authentication Service
 * 
 * This service provides client-side functionality for managing two-factor authentication,
 * including setup, verification, and management.
 */

import api from './api';
import { TwoFactorMethod, TwoFactorSetting } from '../types/auth';

/**
 * Get two-factor settings for the current user
 */
export const getTwoFactorSettings = async (): Promise<TwoFactorSetting[]> => {
  const response = await api.get('/auth/2fa/settings');
  return response.data.data;
};

/**
 * Setup TOTP two-factor authentication
 * @param appName Application name for TOTP
 */
export const setupTOTP = async (appName?: string): Promise<{ secret: string; qrCodeUrl: string; backupCodes: string[] }> => {
  const response = await api.post('/auth/2fa/totp/setup', { appName });
  return response.data.data;
};

/**
 * Verify and enable TOTP two-factor authentication
 * @param token TOTP token
 */
export const verifyTOTP = async (token: string): Promise<void> => {
  await api.post('/auth/2fa/totp/verify', { token });
};

/**
 * Setup SMS two-factor authentication
 * @param phoneNumber Phone number for SMS verification
 */
export const setupSMS = async (phoneNumber: string): Promise<void> => {
  await api.post('/auth/2fa/sms/setup', { phoneNumber });
};

/**
 * Verify and enable SMS two-factor authentication
 * @param code Verification code
 */
export const verifySMS = async (code: string): Promise<{ backupCodes: string[] }> => {
  const response = await api.post('/auth/2fa/sms/verify', { code });
  return response.data.data;
};

/**
 * Setup email two-factor authentication
 * @param email Email address for verification
 */
export const setupEmail = async (email: string): Promise<void> => {
  await api.post('/auth/2fa/email/setup', { email });
};

/**
 * Verify and enable email two-factor authentication
 * @param code Verification code
 */
export const verifyEmail = async (code: string): Promise<{ backupCodes: string[] }> => {
  const response = await api.post('/auth/2fa/email/verify', { code });
  return response.data.data;
};

/**
 * Disable two-factor authentication
 * @param method Two-factor method
 */
export const disableTwoFactor = async (method: TwoFactorMethod): Promise<void> => {
  await api.post('/auth/2fa/disable', { method });
};

/**
 * Send verification code for login
 * @param userId User ID
 * @param method Two-factor method
 */
export const sendVerificationCode = async (userId: string, method: TwoFactorMethod): Promise<void> => {
  await api.post('/auth/2fa/send-code', { userId, method });
};

/**
 * Verify two-factor code for login
 * @param userId User ID
 * @param method Two-factor method
 * @param code Verification code
 */
export const verifyTwoFactorCode = async (userId: string, method: TwoFactorMethod, code: string): Promise<void> => {
  await api.post('/auth/2fa/verify-code', { userId, method, code });
};

/**
 * Verify backup code for login
 * @param userId User ID
 * @param method Two-factor method
 * @param code Backup code
 */
export const verifyBackupCode = async (userId: string, method: TwoFactorMethod, code: string): Promise<void> => {
  await api.post('/auth/2fa/verify-backup', { userId, method, code });
};

export default {
  getTwoFactorSettings,
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

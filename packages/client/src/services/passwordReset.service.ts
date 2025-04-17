/**
 * Password Reset Service
 * 
 * This service provides client-side functionality for password reset,
 * including requesting a reset token and resetting the password.
 */

import api from './api';
import { PasswordResetRequest, PasswordResetConfirmation } from '../types/auth';

/**
 * Request a password reset
 * @param email User's email address
 */
export const requestPasswordReset = async (email: string): Promise<void> => {
  await api.post('/auth/password-reset/request', { email });
};

/**
 * Validate a password reset token
 * @param token Reset token
 * @returns Whether the token is valid
 */
export const validateResetToken = async (token: string): Promise<boolean> => {
  try {
    await api.get(`/auth/password-reset/validate/${token}`);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Reset password with token
 * @param token Reset token
 * @param newPassword New password
 */
export const resetPassword = async (token: string, newPassword: string): Promise<void> => {
  await api.post('/auth/password-reset/reset', { token, newPassword });
};

/**
 * Change password (for authenticated users)
 * @param currentPassword Current password
 * @param newPassword New password
 */
export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  await api.post('/auth/change-password', { currentPassword, newPassword });
};

export default {
  requestPasswordReset,
  validateResetToken,
  resetPassword,
  changePassword
};

/**
 * Authentication Types
 * 
 * This file defines types related to authentication, including
 * user authentication, two-factor authentication, and sessions.
 */

/**
 * User authentication credentials
 */
export interface AuthCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * User registration data
 */
export interface RegistrationData {
  email: string;
  password: string;
  fullName?: string;
  username?: string;
}

/**
 * User profile
 */
export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  fullName?: string;
  avatarUrl?: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Authentication error
 */
export interface AuthError {
  message: string;
  code?: string;
}

/**
 * Authentication response
 */
export interface AuthResponse {
  user: UserProfile;
  token: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Two-factor authentication method
 */
export enum TwoFactorMethod {
  TOTP = 'totp',
  SMS = 'sms',
  EMAIL = 'email'
}

/**
 * Two-factor authentication setting
 */
export interface TwoFactorSetting {
  id: string;
  method: TwoFactorMethod;
  isVerified: boolean;
  isEnabled: boolean;
  phoneNumber?: string;
  email?: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Two-factor authentication verification
 */
export interface TwoFactorVerification {
  userId: string;
  method: TwoFactorMethod;
  code: string;
}

/**
 * User session
 */
export interface UserSession {
  id: string;
  userId: string;
  deviceInfo: {
    browser: string;
    os: string;
    device: string;
    ip: string;
  };
  isActive: boolean;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
}

/**
 * API key
 */
export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  key: string;
  scopes: string[];
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Password reset confirmation
 */
export interface PasswordResetConfirmation {
  token: string;
  newPassword: string;
}

/**
 * Password change request
 */
export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

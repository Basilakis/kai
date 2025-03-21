/**
 * Type definitions for user and authentication-related entities
 */

/**
 * Represents a user in the system
 */
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  role: UserRole;
  permissions: Permission[];
  organization?: Organization;
  preferences?: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  status: UserStatus;
  metadata?: Record<string, any>;
}

/**
 * Represents the role of a user
 */
export type UserRole = 
  | 'admin'
  | 'manager'
  | 'user'
  | 'guest';

/**
 * Represents the status of a user
 */
export type UserStatus = 
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'pending';

/**
 * Represents a permission in the system
 */
export interface Permission {
  id: string;
  name: string;
  description?: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'manage';
}

/**
 * Represents an organization in the system
 */
export interface Organization {
  id: string;
  name: string;
  description?: string;
  type?: string;
  website?: string;
  logo?: string;
  address?: Address;
  contactEmail?: string;
  contactPhone?: string;
  members: string[]; // Array of user IDs
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'inactive';
  subscription?: Subscription;
  metadata?: Record<string, any>;
}

/**
 * Represents an address
 */
export interface Address {
  street: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

/**
 * Represents a subscription
 */
export interface Subscription {
  id: string;
  plan: 'free' | 'basic' | 'premium' | 'enterprise';
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'inactive' | 'trial' | 'expired';
  paymentMethod?: string;
  autoRenew: boolean;
  price?: number;
  currency?: string;
  features?: string[];
}

/**
 * Represents user preferences
 */
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: {
    email: boolean;
    push: boolean;
    inApp: boolean;
  };
  displayDensity?: 'compact' | 'comfortable' | 'spacious';
  defaultView?: string;
  savedSearches?: SavedSearch[];
  favoriteItems?: string[]; // Array of item IDs (tiles, materials, etc.)
}

/**
 * Represents a saved search
 */
export interface SavedSearch {
  id: string;
  name: string;
  query: Record<string, any>;
  createdAt: Date;
  lastUsedAt?: Date;
}

/**
 * Represents an authentication token
 */
export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/**
 * Represents an authentication request
 */
export interface AuthRequest {
  email: string;
  password?: string;
  provider?: 'email' | 'google' | 'microsoft' | 'apple';
  token?: string; // OAuth token
  code?: string; // OAuth code
  redirectUri?: string;
}

/**
 * Represents a password reset request
 */
export interface PasswordResetRequest {
  email: string;
  token?: string;
  newPassword?: string;
}

/**
 * Represents a multi-factor authentication request
 */
export interface MfaRequest {
  userId: string;
  method: 'app' | 'sms' | 'email';
  code?: string;
}

/**
 * Represents an audit log entry
 */
export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
  status: 'success' | 'failure';
}
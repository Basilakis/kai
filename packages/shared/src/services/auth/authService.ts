/**
 * Unified Authentication Service
 * 
 * This service provides a unified interface for authentication operations across different providers.
 * It supports multiple authentication methods including Supabase Auth, JWT, and API keys.
 * 
 * Features:
 * - Provider-agnostic interface for authentication operations
 * - Support for multiple authentication methods
 * - Token management and refresh
 * - Role-based access control
 * - Secure credential storage
 */

import { createLogger } from '../../utils/unified-logger';

const logger = createLogger('AuthService');

/**
 * Authentication provider interface
 * All authentication providers must implement this interface
 */
export interface AuthProvider {
  // Core authentication methods
  login(credentials: LoginCredentials): Promise<AuthResult>;
  register(credentials: RegisterCredentials): Promise<AuthResult>;
  logout(): Promise<void>;
  refreshToken(): Promise<AuthResult>;
  
  // User management
  getUser(): Promise<User | null>;
  updateUser(data: Partial<User>): Promise<User>;
  
  // Token management
  getToken(): Promise<string | null>;
  setToken(token: string): void;
  
  // Role-based access control
  hasRole(role: string): Promise<boolean>;
  hasPermission(permission: string): Promise<boolean>;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  provider?: 'email' | 'google' | 'facebook' | 'twitter' | 'github' | 'apple';
  rememberMe?: boolean;
}

/**
 * Registration credentials
 */
export interface RegisterCredentials {
  email: string;
  password: string;
  username?: string;
  fullName?: string;
  metadata?: Record<string, any>;
}

/**
 * Authentication result
 */
export interface AuthResult {
  user: User;
  token: string;
  refreshToken?: string;
  expiresAt?: number;
  error?: Error;
}

/**
 * User interface
 */
export interface User {
  id: string;
  email?: string;
  username?: string;
  fullName?: string;
  avatarUrl?: string;
  roles?: string[];
  permissions?: string[];
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Authentication credentials
 */
export interface AuthCredentials {
  token: string;
  refreshToken?: string;
  expiresAt?: number;
  userId?: string;
}

/**
 * Unified Authentication Service
 */
export class AuthService {
  private static instance: AuthService;
  private provider?: AuthProvider;
  private credentials?: AuthCredentials;
  
  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    logger.info('AuthService initialized');
    this.loadCredentials();
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }
  
  /**
   * Set the authentication provider
   */
  public setProvider(provider: AuthProvider): void {
    this.provider = provider;
    logger.info('Authentication provider set');
  }
  
  /**
   * Get the current provider
   */
  private getProvider(): AuthProvider {
    if (!this.provider) {
      throw new Error('Authentication provider not set. Call setProvider() first.');
    }
    return this.provider;
  }
  
  /**
   * Login with credentials
   */
  public async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      const provider = this.getProvider();
      const result = await provider.login(credentials);
      
      if (result.token) {
        this.setCredentials({
          token: result.token,
          refreshToken: result.refreshToken,
          expiresAt: result.expiresAt,
          userId: result.user.id
        });
      }
      
      return result;
    } catch (error) {
      logger.error('Login failed', error);
      return {
        user: { id: '' },
        token: '',
        error: error as Error
      };
    }
  }
  
  /**
   * Register a new user
   */
  public async register(credentials: RegisterCredentials): Promise<AuthResult> {
    try {
      const provider = this.getProvider();
      const result = await provider.register(credentials);
      
      if (result.token) {
        this.setCredentials({
          token: result.token,
          refreshToken: result.refreshToken,
          expiresAt: result.expiresAt,
          userId: result.user.id
        });
      }
      
      return result;
    } catch (error) {
      logger.error('Registration failed', error);
      return {
        user: { id: '' },
        token: '',
        error: error as Error
      };
    }
  }
  
  /**
   * Logout the current user
   */
  public async logout(): Promise<void> {
    try {
      const provider = this.getProvider();
      await provider.logout();
      this.clearCredentials();
    } catch (error) {
      logger.error('Logout failed', error);
      throw error;
    }
  }
  
  /**
   * Refresh the authentication token
   */
  public async refreshToken(): Promise<AuthResult> {
    try {
      const provider = this.getProvider();
      const result = await provider.refreshToken();
      
      if (result.token) {
        this.setCredentials({
          token: result.token,
          refreshToken: result.refreshToken,
          expiresAt: result.expiresAt,
          userId: result.user.id
        });
      }
      
      return result;
    } catch (error) {
      logger.error('Token refresh failed', error);
      return {
        user: { id: '' },
        token: '',
        error: error as Error
      };
    }
  }
  
  /**
   * Get the current user
   */
  public async getUser(): Promise<User | null> {
    try {
      const provider = this.getProvider();
      return await provider.getUser();
    } catch (error) {
      logger.error('Failed to get user', error);
      return null;
    }
  }
  
  /**
   * Update the current user
   */
  public async updateUser(data: Partial<User>): Promise<User> {
    try {
      const provider = this.getProvider();
      return await provider.updateUser(data);
    } catch (error) {
      logger.error('Failed to update user', error);
      throw error;
    }
  }
  
  /**
   * Check if the current user has a specific role
   */
  public async hasRole(role: string): Promise<boolean> {
    try {
      const provider = this.getProvider();
      return await provider.hasRole(role);
    } catch (error) {
      logger.error(`Failed to check role: ${role}`, error);
      return false;
    }
  }
  
  /**
   * Check if the current user has a specific permission
   */
  public async hasPermission(permission: string): Promise<boolean> {
    try {
      const provider = this.getProvider();
      return await provider.hasPermission(permission);
    } catch (error) {
      logger.error(`Failed to check permission: ${permission}`, error);
      return false;
    }
  }
  
  /**
   * Get the authentication token
   */
  public async getToken(): Promise<string | null> {
    // If we have credentials and the token is not expired, return it
    if (this.credentials?.token && this.credentials.expiresAt && this.credentials.expiresAt > Date.now()) {
      return this.credentials.token;
    }
    
    // If we have a refresh token, try to refresh
    if (this.credentials?.refreshToken) {
      try {
        const result = await this.refreshToken();
        return result.token;
      } catch (error) {
        logger.error('Failed to refresh token', error);
      }
    }
    
    // If we have a provider, try to get the token from it
    try {
      const provider = this.getProvider();
      return await provider.getToken();
    } catch (error) {
      logger.error('Failed to get token from provider', error);
    }
    
    return null;
  }
  
  /**
   * Set the authentication token
   */
  public setToken(token: string, refreshToken?: string, expiresAt?: number): void {
    this.setCredentials({
      token,
      refreshToken,
      expiresAt
    });
    
    try {
      const provider = this.getProvider();
      provider.setToken(token);
    } catch (error) {
      logger.error('Failed to set token on provider', error);
    }
  }
  
  /**
   * Check if the user is authenticated
   */
  public isAuthenticated(): boolean {
    return !!(this.credentials?.token && (!this.credentials.expiresAt || this.credentials.expiresAt > Date.now()));
  }
  
  /**
   * Set authentication credentials
   */
  private setCredentials(credentials: AuthCredentials): void {
    this.credentials = credentials;
    this.saveCredentials(credentials);
  }
  
  /**
   * Clear authentication credentials
   */
  private clearCredentials(): void {
    this.credentials = undefined;
    this.removeCredentials();
  }
  
  // Memory storage for credentials in Node.js environment
  private static memoryCredentialStorage: Record<string, string> = {};
  
  /**
   * Save credentials to secure storage
   */
  private saveCredentials(credentials: AuthCredentials): void {
    try {
      const serializedCredentials = JSON.stringify(credentials);
      
      // Use localStorage in browser environments
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('kai_auth_credentials', serializedCredentials);
      } 
      // Use memory storage in Node.js environment
      else {
        AuthService.memoryCredentialStorage['kai_auth_credentials'] = serializedCredentials;
      }
      
      logger.debug('Credentials saved to storage');
    } catch (error) {
      logger.error('Failed to save credentials', error);
    }
  }
  
  /**
   * Load credentials from secure storage
   */
  private loadCredentials(): void {
    try {
      let serializedCredentials: string | null = null;
      
      // Use localStorage in browser environments
      if (typeof window !== 'undefined' && window.localStorage) {
        serializedCredentials = window.localStorage.getItem('kai_auth_credentials');
      } 
      // Use memory storage in Node.js environment
      else if (AuthService.memoryCredentialStorage['kai_auth_credentials']) {
        serializedCredentials = AuthService.memoryCredentialStorage['kai_auth_credentials'];
      }
      
      if (serializedCredentials) {
        this.credentials = JSON.parse(serializedCredentials);
        logger.debug('Credentials loaded from storage');
      }
    } catch (error) {
      logger.error('Failed to load credentials', error);
    }
  }
  
  /**
   * Remove credentials from secure storage
   */
  private removeCredentials(): void {
    try {
      // Use localStorage in browser environments
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('kai_auth_credentials');
      } 
      // Use memory storage in Node.js environment
      else {
        delete AuthService.memoryCredentialStorage['kai_auth_credentials'];
      }
      
      logger.debug('Credentials removed from storage');
    } catch (error) {
      logger.error('Failed to remove credentials', error);
    }
  }
}

// Export singleton instance
export const auth = AuthService.getInstance();

// Export default for convenience
export default auth;

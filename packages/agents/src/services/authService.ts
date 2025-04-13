/**
 * Authentication Service
 * 
 * Manages authentication with KAI APIs, including token management,
 * renewal, and secure storage. Used by all service connectors to
 * authenticate requests.
 */

import { BaseService, ServiceConfig, ApiError } from './baseService';
import { env } from '../../../shared/src/utils/environment';
import { createLogger } from '../utils/logger';

const logger = createLogger('AuthService');

/**
 * Authentication credentials
 */
export interface AuthCredentials {
  token: string;
  refreshToken: string;
  expiresAt: number;
  userId?: string;
  scope?: string[];
}

/**
 * Authentication service for managing KAI API access
 */
export class AuthService extends BaseService {
  private credentials: AuthCredentials | null = null;
  private refreshPromise: Promise<AuthCredentials> | null = null;
  
  /**
   * Create a new AuthService instance
   */
  constructor(config?: Partial<ServiceConfig>) {
    super({
      baseURL: config?.baseURL || env.services.kaiApiUrl,
      timeout: config?.timeout || 30000,
      headers: config?.headers || {},
    });
    logger.info('AuthService initialized');
    
    // Load credentials from secure storage if available
    this.loadCredentials();
  }
  
  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    if (!this.credentials) {
      return false;
    }
    
    // Allow a 30-second buffer to prevent token expiration during request
    return this.credentials.expiresAt > (Date.now() + 30000);
  }
  
  /**
   * Get the authentication token
   * Will attempt to refresh if the token is expired
   */
  async getToken(): Promise<string | null> {
    if (!this.credentials) {
      return null;
    }
    
    // If token is expired or about to expire, refresh it
    if (this.credentials.expiresAt < (Date.now() + 60000)) {
      try {
        await this.refreshTokenIfNeeded();
      } catch (error) {
        logger.error(`Failed to refresh token: ${error}`);
        return null;
      }
    }
    
    return this.credentials.token;
  }
  
  /**
   * Refresh the token if needed
   */
  async refreshTokenIfNeeded(): Promise<AuthCredentials> {
    // If already refreshing, return the existing promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    
    // If not authenticated or no refresh token, throw error
    if (!this.credentials || !this.credentials.refreshToken) {
      throw new Error('Not authenticated or missing refresh token');
    }
    
    // If token is not expired or about to expire, return credentials
    if (this.credentials.expiresAt > (Date.now() + 60000)) {
      return this.credentials;
    }
    
    // Start the refresh process
    logger.info('Refreshing authentication token');
    this.refreshPromise = this.refreshToken();
    
    try {
      // Wait for the refresh to complete
      const refreshedCredentials = await this.refreshPromise;
      return refreshedCredentials;
    } finally {
      // Clear the refresh promise
      this.refreshPromise = null;
    }
  }
  
  /**
   * Refresh the authentication token
   */
  private async refreshToken(): Promise<AuthCredentials> {
    if (!this.credentials || !this.credentials.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    try {
      const response = await this.post<AuthCredentials>('/auth/refresh', {
        refreshToken: this.credentials.refreshToken,
      });
      
      this.setCredentials(response);
      logger.info('Token refreshed successfully');
      
      return response;
    } catch (error) {
      logger.error(`Token refresh failed: ${error}`);
      this.clearCredentials();
      throw error;
    }
  }
  
  /**
   * Authenticate with API key
   */
  async authenticateWithApiKey(apiKey: string): Promise<AuthCredentials> {
    logger.info('Authenticating with API key');
    
    try {
      const response = await this.post<AuthCredentials>('/auth/api-key', {
        apiKey,
      });
      
      this.setCredentials(response);
      logger.info('Authentication successful');
      
      return response;
    } catch (error) {
      logger.error(`Authentication failed: ${error}`);
      throw error;
    }
  }
  
  /**
   * Authenticate with username and password
   */
  async authenticateWithCredentials(username: string, password: string): Promise<AuthCredentials> {
    logger.info(`Authenticating with username: ${username}`);
    
    try {
      const response = await this.post<AuthCredentials>('/auth/login', {
        username,
        password,
      });
      
      this.setCredentials(response);
      logger.info('Authentication successful');
      
      return response;
    } catch (error) {
      logger.error(`Authentication failed: ${error}`);
      throw error;
    }
  }
  
  /**
   * Set authentication credentials
   */
  setCredentials(credentials: AuthCredentials): void {
    this.credentials = credentials;
    
    // Save credentials to secure storage
    this.saveCredentials(credentials);
    
    logger.info('Authentication credentials set');
  }
  
  /**
   * Clear authentication credentials
   */
  clearCredentials(): void {
    this.credentials = null;
    
    // Clear credentials from secure storage
    this.clearSavedCredentials();
    
    logger.info('Authentication credentials cleared');
  }
  
  /**
   * Log out the current user
   */
  async logout(): Promise<void> {
    if (!this.credentials) {
      return;
    }
    
    try {
      await this.post('/auth/logout', {
        refreshToken: this.credentials.refreshToken,
      });
      
      logger.info('Logged out successfully');
    } catch (error) {
      logger.error(`Logout failed: ${error}`);
    } finally {
      this.clearCredentials();
    }
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
      logger.error(`Failed to save credentials: ${error}`);
    }
  }
  
  /**
   * Load credentials from secure storage
   */
  private loadCredentials(): void {
    try {
      let savedCredentials: string | null = null;
      
      // Try to load from localStorage in browser environments
      if (typeof window !== 'undefined' && window.localStorage) {
        savedCredentials = window.localStorage.getItem('kai_auth_credentials');
      }
      // Try to load from memory storage in Node.js environment
      else if (AuthService.memoryCredentialStorage['kai_auth_credentials']) {
        savedCredentials = AuthService.memoryCredentialStorage['kai_auth_credentials'];
      }
      
      if (savedCredentials) {
        this.credentials = JSON.parse(savedCredentials);
        logger.info('Loaded authentication credentials from storage');
      }
    } catch (error) {
      logger.error(`Failed to load credentials: ${error}`);
    }
  }
  
  /**
   * Clear saved credentials from secure storage
   */
  private clearSavedCredentials(): void {
    try {
      // Clear from localStorage in browser environments
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('kai_auth_credentials');
      }
      
      // Clear from memory storage in Node.js environment
      if ('kai_auth_credentials' in AuthService.memoryCredentialStorage) {
        delete AuthService.memoryCredentialStorage['kai_auth_credentials'];
      }
      
      logger.debug('Credentials cleared from storage');
    } catch (error) {
      logger.error(`Failed to clear saved credentials: ${error}`);
    }
  }
  
  /**
   * Get current token for use in other services
   * This is used by the BaseService to authenticate requests
   */
  getCurrentToken(): string | null {
    return this.credentials?.token || null;
  }
}

// Create singleton instance
export const authService = new AuthService();

export default authService;
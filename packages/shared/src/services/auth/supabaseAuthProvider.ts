/**
 * Supabase Authentication Provider
 * 
 * This provider implements the AuthProvider interface using Supabase Auth.
 * It handles all authentication operations through the Supabase client.
 */

import { supabase } from '../supabase/supabaseClient';
import { createLogger } from '../../utils/unified-logger';
import { 
  AuthProvider, 
  LoginCredentials, 
  RegisterCredentials, 
  AuthResult,
  User
} from './authService';

const logger = createLogger('SupabaseAuthProvider');

/**
 * Convert Supabase user to our User interface
 */
function convertSupabaseUser(supabaseUser: any): User {
  if (!supabaseUser) {
    return { id: '' };
  }
  
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    username: supabaseUser.user_metadata?.username,
    fullName: supabaseUser.user_metadata?.full_name,
    avatarUrl: supabaseUser.user_metadata?.avatar_url,
    roles: supabaseUser.app_metadata?.roles || [],
    permissions: supabaseUser.app_metadata?.permissions || [],
    metadata: {
      ...supabaseUser.user_metadata,
      provider: supabaseUser.app_metadata?.provider,
      userType: supabaseUser.app_metadata?.user_type
    },
    createdAt: supabaseUser.created_at ? new Date(supabaseUser.created_at) : undefined,
    updatedAt: supabaseUser.updated_at ? new Date(supabaseUser.updated_at) : undefined
  };
}

/**
 * Supabase Authentication Provider implementation
 */
export class SupabaseAuthProvider implements AuthProvider {
  private token: string | null = null;
  
  /**
   * Create a new SupabaseAuthProvider
   */
  constructor() {
    logger.info('SupabaseAuthProvider initialized');
    
    // Set up auth state change listener
    if (typeof window !== 'undefined') {
      supabase.getClient().auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          this.token = session.access_token;
          logger.debug('User signed in');
        } else if (event === 'SIGNED_OUT') {
          this.token = null;
          logger.debug('User signed out');
        } else if (event === 'TOKEN_REFRESHED' && session) {
          this.token = session.access_token;
          logger.debug('Token refreshed');
        }
      });
    }
  }
  
  /**
   * Login with credentials
   */
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      let result;
      
      // Handle different login methods
      if (credentials.email && credentials.password) {
        // Email/password login
        result = await supabase.getClient().auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
          options: {
            persistSession: credentials.rememberMe ?? true
          }
        });
      } else if (credentials.provider) {
        // OAuth login
        result = await supabase.getClient().auth.signInWithOAuth({
          provider: credentials.provider,
          options: {
            redirectTo: window.location.origin,
            scopes: 'email profile'
          }
        });
        
        // OAuth sign-in initiates a redirect, so we don't have a session yet
        // Return a partial result
        return {
          user: { id: '' },
          token: '',
          // No error means success for OAuth initiation
        };
      } else if (credentials.apiKey) {
        // API key login is not directly supported by Supabase Auth
        // We would need a custom endpoint for this
        throw new Error('API key authentication not supported by Supabase provider');
      } else {
        throw new Error('Invalid credentials');
      }
      
      // Handle errors
      if (result.error) {
        throw result.error;
      }
      
      // No session means something went wrong
      if (!result.data.session) {
        throw new Error('No session returned from Supabase');
      }
      
      // Store the token
      this.token = result.data.session.access_token;
      
      // Return the result
      return {
        user: convertSupabaseUser(result.data.user),
        token: result.data.session.access_token,
        refreshToken: result.data.session.refresh_token,
        expiresAt: new Date(result.data.session.expires_at).getTime()
      };
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
  async register(credentials: RegisterCredentials): Promise<AuthResult> {
    try {
      // Register with Supabase
      const result = await supabase.getClient().auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            username: credentials.username,
            full_name: credentials.fullName,
            ...credentials.metadata
          }
        }
      });
      
      // Handle errors
      if (result.error) {
        throw result.error;
      }
      
      // No user means something went wrong
      if (!result.data.user) {
        throw new Error('No user returned from Supabase');
      }
      
      // Store the token if we have a session
      if (result.data.session) {
        this.token = result.data.session.access_token;
        
        // Return the result with session
        return {
          user: convertSupabaseUser(result.data.user),
          token: result.data.session.access_token,
          refreshToken: result.data.session.refresh_token,
          expiresAt: new Date(result.data.session.expires_at).getTime()
        };
      }
      
      // If we don't have a session, the user might need to confirm their email
      return {
        user: convertSupabaseUser(result.data.user),
        token: '',
        // No error but no token means email confirmation is required
      };
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
  async logout(): Promise<void> {
    try {
      const { error } = await supabase.getClient().auth.signOut();
      
      if (error) {
        throw error;
      }
      
      this.token = null;
    } catch (error) {
      logger.error('Logout failed', error);
      throw error;
    }
  }
  
  /**
   * Refresh the authentication token
   */
  async refreshToken(): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.getClient().auth.refreshSession();
      
      if (error) {
        throw error;
      }
      
      if (!data.session) {
        throw new Error('No session returned from Supabase');
      }
      
      // Store the token
      this.token = data.session.access_token;
      
      // Return the result
      return {
        user: convertSupabaseUser(data.user),
        token: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: new Date(data.session.expires_at).getTime()
      };
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
  async getUser(): Promise<User | null> {
    try {
      const { data, error } = await supabase.getClient().auth.getUser();
      
      if (error) {
        throw error;
      }
      
      if (!data.user) {
        return null;
      }
      
      return convertSupabaseUser(data.user);
    } catch (error) {
      logger.error('Failed to get user', error);
      return null;
    }
  }
  
  /**
   * Update the current user
   */
  async updateUser(data: Partial<User>): Promise<User> {
    try {
      // Convert our User interface to Supabase update data
      const updateData: any = {};
      
      if (data.email) {
        updateData.email = data.email;
      }
      
      if (data.password) {
        updateData.password = data.password;
      }
      
      // User metadata
      const userData: any = {};
      
      if (data.username) {
        userData.username = data.username;
      }
      
      if (data.fullName) {
        userData.full_name = data.fullName;
      }
      
      if (data.avatarUrl) {
        userData.avatar_url = data.avatarUrl;
      }
      
      // Add any additional metadata
      if (data.metadata) {
        Object.assign(userData, data.metadata);
      }
      
      // Only set data if we have any
      if (Object.keys(userData).length > 0) {
        updateData.data = userData;
      }
      
      // Update the user
      const { data: updatedUser, error } = await supabase.getClient().auth.updateUser(updateData);
      
      if (error) {
        throw error;
      }
      
      if (!updatedUser.user) {
        throw new Error('No user returned from Supabase');
      }
      
      return convertSupabaseUser(updatedUser.user);
    } catch (error) {
      logger.error('Failed to update user', error);
      throw error;
    }
  }
  
  /**
   * Get the authentication token
   */
  async getToken(): Promise<string | null> {
    try {
      // If we already have a token, return it
      if (this.token) {
        return this.token;
      }
      
      // Otherwise, get the session
      const { data, error } = await supabase.getClient().auth.getSession();
      
      if (error) {
        throw error;
      }
      
      if (!data.session) {
        return null;
      }
      
      // Store and return the token
      this.token = data.session.access_token;
      return this.token;
    } catch (error) {
      logger.error('Failed to get token', error);
      return null;
    }
  }
  
  /**
   * Set the authentication token
   */
  setToken(token: string): void {
    this.token = token;
  }
  
  /**
   * Check if the current user has a specific role
   */
  async hasRole(role: string): Promise<boolean> {
    try {
      const user = await this.getUser();
      
      if (!user) {
        return false;
      }
      
      // Special case for admin
      if (user.email === 'basiliskan@gmail.com') {
        return true;
      }
      
      return user.roles?.includes(role) || false;
    } catch (error) {
      logger.error(`Failed to check role: ${role}`, error);
      return false;
    }
  }
  
  /**
   * Check if the current user has a specific permission
   */
  async hasPermission(permission: string): Promise<boolean> {
    try {
      const user = await this.getUser();
      
      if (!user) {
        return false;
      }
      
      // Special case for admin
      if (user.email === 'basiliskan@gmail.com') {
        return true;
      }
      
      return user.permissions?.includes(permission) || false;
    } catch (error) {
      logger.error(`Failed to check permission: ${permission}`, error);
      return false;
    }
  }
}

// Export the provider class
export default SupabaseAuthProvider;

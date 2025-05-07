/**
 * Authentication Service Initializer
 * 
 * This module provides functions to initialize the unified authentication service
 * with different authentication providers based on configuration.
 */

import { createLogger } from '../../utils/unified-logger';
import { auth } from './authService';
import SupabaseAuthProvider from './supabaseAuthProvider';

const logger = createLogger('AuthInitializer');

/**
 * Initialize authentication with Supabase provider
 */
export function initializeSupabaseAuth(): void {
  try {
    logger.info('Initializing Supabase authentication');
    
    // Create Supabase auth provider
    const provider = new SupabaseAuthProvider();
    
    // Set provider
    auth.setProvider(provider);
    
    logger.info('Supabase authentication initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Supabase authentication', error);
    throw new Error('Supabase authentication initialization failed');
  }
}

/**
 * Initialize authentication based on environment configuration
 */
export function initializeAuth(): void {
  try {
    logger.info('Initializing authentication service based on environment configuration');
    
    // For now, we only support Supabase authentication
    // In the future, we can add more providers based on environment variables
    initializeSupabaseAuth();
    
    logger.info('Authentication service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize authentication service', error);
    throw new Error('Authentication service initialization failed');
  }
}

// Export default for convenience
export default initializeAuth;

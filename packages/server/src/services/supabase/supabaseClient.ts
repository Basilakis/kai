/**
 * Supabase Client Manager
 * 
 * This service provides a centralized Supabase client instance and configuration.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';

// Configuration interface
interface SupabaseConfig {
  url: string;
  key: string;
  options?: {
    auth?: {
      autoRefreshToken?: boolean;
      persistSession?: boolean;
    };
    global?: {
      headers?: Record<string, string>;
    };
    db?: {
      schema?: string;
    };
  };
}

/**
 * Supabase Client Manager
 * Handles the configuration and initialization of the Supabase client
 */
class SupabaseClientManager {
  private config: SupabaseConfig;
  private client: SupabaseClient | null = null;
  private initialized = false;

  constructor() {
    // Default configuration (override via init)
    this.config = {
      url: process.env.SUPABASE_URL || '',
      key: process.env.SUPABASE_KEY || '',
      options: {
        auth: {
          autoRefreshToken: true,
          persistSession: true
        }
      }
    };
  }

  /**
   * Initialize the Supabase client with configuration
   * @param config Supabase configuration
   */
  init(config: SupabaseConfig): void {
    if (this.initialized) {
      logger.warn('Supabase client already initialized');
      return;
    }

    this.config = {
      ...this.config,
      ...config
    };

    this.initialized = true;
    logger.info('Supabase client configuration initialized');
  }

  /**
   * Get the Supabase client instance
   * Initializes the client if it doesn't exist
   * @returns Supabase client
   */
  getClient(): SupabaseClient {
    if (!this.client) {
      if (!this.config.url || !this.config.key) {
        throw new Error('Supabase URL and key are required. Call init() first or set SUPABASE_URL and SUPABASE_KEY environment variables.');
      }

      // Create the client
      this.client = createClient(
        this.config.url,
        this.config.key,
        this.config.options
      );
      
      logger.info('Supabase client initialized');
    }

    return this.client;
  }

  /**
   * Check if the Supabase client is initialized
   * @returns True if initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.client !== null;
  }

  /**
   * Reset the Supabase client
   * Useful for testing or reconfiguration
   */
  reset(): void {
    this.client = null;
    this.initialized = false;
    logger.info('Supabase client reset');
  }
}

// Export a singleton instance
export const supabaseClient = new SupabaseClientManager();
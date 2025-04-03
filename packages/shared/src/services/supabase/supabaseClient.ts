import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { config } from '../../utils/config';

/**
 * Configuration options for the Supabase client
 */
export interface SupabaseConfig {
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
 * Unified Supabase client manager that handles:
 * - Client initialization
 * - Connection management
 * - Error handling
 * - Configuration
 */
export class SupabaseManager {
  private static instance: SupabaseManager;
  private client: SupabaseClient | null = null;
  private config: SupabaseConfig;
  private initialized = false;

  private constructor() {
    // Default configuration (override via init)
    this.config = {
      url: config.get('SUPABASE_URL') || '',
      key: config.get('SUPABASE_KEY') || '',
      options: {
        auth: {
          autoRefreshToken: true,
          persistSession: true
        }
      }
    };
  }

  public static getInstance(): SupabaseManager {
    if (!SupabaseManager.instance) {
      SupabaseManager.instance = new SupabaseManager();
    }
    return SupabaseManager.instance;
  }

  /**
   * Initialize the Supabase client with configuration
   */
  public init(config: SupabaseConfig): void {
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
   */
  public getClient(): SupabaseClient {
    if (!this.client) {
      if (!this.config.url || !this.config.key) {
        throw new Error('Supabase URL and key are required. Call init() first or set SUPABASE_URL and SUPABASE_KEY environment variables.');
      }

      try {
        this.client = createClient(
          this.config.url,
          this.config.key,
          this.config.options
        );
        logger.info('Supabase client initialized');
      } catch (error) {
        logger.error('Failed to initialize Supabase client', { error });
        throw error;
      }
    }

    return this.client;
  }

  /**
   * Check if the Supabase client is initialized
   */
  public isInitialized(): boolean {
    return this.initialized && this.client !== null;
  }

  /**
   * Get current configuration
   */
  public getConfig(): SupabaseConfig | null {
    return this.config;
  }

  /**
   * Reset the Supabase client
   * Useful for testing or reconfiguration
   */
  public reset(): void {
    this.client = null;
    this.initialized = false;
    logger.info('Supabase client reset');
  }

  /**
   * Create a new client instance with the same configuration
   * Useful when you need a fresh client
   */
  public createNewClient(): SupabaseClient {
    if (!this.config) {
      const error = new Error('Cannot create new client: configuration not set');
      logger.error(error.message);
      throw error;
    }

    try {
      return createClient(this.config.url, this.config.key, this.config.options);
    } catch (error) {
      logger.error('Failed to create new Supabase client', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const supabase = SupabaseManager.getInstance();

// Export default for convenience
export default supabase;
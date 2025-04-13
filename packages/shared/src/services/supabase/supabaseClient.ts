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
      detectSessionInUrl?: boolean;
    };
    global?: {
      headers?: Record<string, string>;
    };
    db?: {
      schema?: string;
    };
    realtime?: {
      endpoint?: string;
      eventsPerSecond?: number;
      headers?: Record<string, string>;
    };
  };
}

/**
 * Unified Supabase client manager that handles:
 * - Client initialization
 * - Connection management
 * - Error handling
 * - Configuration
 *
 * This is the central implementation that should be used across all packages
 * (client, server, shared) to ensure consistent behavior and configuration.
 */
export class SupabaseManager {
  private static instance: SupabaseManager;
  private client: SupabaseClient | null = null;
  private config: SupabaseConfig;
  private initialized = false;

  private constructor() {
    // Default configuration (override via init)
    // Try different environment variable patterns to support various packages
    const url = config.get('SUPABASE_URL') ||
               process.env?.SUPABASE_URL ||
               process.env?.GATSBY_SUPABASE_URL ||
               process.env?.NEXT_PUBLIC_SUPABASE_URL ||
               '';

    const key = config.get('SUPABASE_KEY') ||
               process.env?.SUPABASE_KEY ||
               process.env?.GATSBY_SUPABASE_ANON_KEY ||
               process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
               '';

    this.config = {
      url,
      key,
      options: {
        auth: {
          autoRefreshToken: true,
          persistSession: true
        }
      }
    };

    // Log configuration status but not the actual keys
    if (url && key) {
      logger.debug('Supabase configuration found in environment');
    } else {
      logger.warn('Supabase URL or key not found in environment variables');
    }
  }

  public static getInstance(): SupabaseManager {
    if (!SupabaseManager.instance) {
      SupabaseManager.instance = new SupabaseManager();
    }
    return SupabaseManager.instance;
  }

  /**
   * Initialize the Supabase client with configuration
   * @param config Supabase configuration to override defaults
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
   * @returns The Supabase client instance
   * @throws Error if URL or key are not configured
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
   * @returns True if the client is initialized and ready to use
   */
  public isInitialized(): boolean {
    return this.initialized && this.client !== null;
  }

  /**
   * Get current configuration
   * @returns The current Supabase configuration (without sensitive keys)
   */
  public getConfig(): Omit<SupabaseConfig, 'key'> {
    // Return configuration without the key for security
    const { key, ...safeConfig } = this.config;
    return {
      ...safeConfig,
      key: key ? '[REDACTED]' : ''
    };
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

/**
 * Singleton instance of the Supabase manager
 * This should be the only instance used throughout the application
 */
export const supabase = SupabaseManager.getInstance();

/**
 * Alias for backward compatibility with existing code
 * @deprecated Use `supabase` instead
 */
export const supabaseClient = supabase;

// Export default for convenience
export default supabase;
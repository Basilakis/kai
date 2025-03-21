/**
 * Supabase Client Service
 * 
 * Provides a singleton Supabase client for the application with
 * connection management, error handling, and real-time capabilities.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';

// Supabase client configuration options with default values
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
  };
}

// Default Supabase configuration using environment variables
const DEFAULT_CONFIG: SupabaseConfig = {
  url: process.env.SUPABASE_URL || '',
  key: process.env.SUPABASE_KEY || '',
  options: {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  }
};

/**
 * Supabase Client Manager
 */
export class SupabaseClientManager {
  private static instance: SupabaseClientManager;
  private client: SupabaseClient | null = null;
  private config: SupabaseConfig;
  
  /**
   * Create a new Supabase Client Manager
   * @param config Supabase configuration
   */
  private constructor(config: Partial<SupabaseConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Validate configuration
    if (!this.config.url || !this.config.key) {
      logger.warn('Supabase URL or key is not configured. Please set SUPABASE_URL and SUPABASE_KEY environment variables.');
    }
  }
  
  /**
   * Get the Supabase Client Manager singleton instance
   * @param config Optional Supabase configuration
   * @returns Supabase Client Manager instance
   */
  public static getInstance(config?: Partial<SupabaseConfig>): SupabaseClientManager {
    if (!SupabaseClientManager.instance) {
      SupabaseClientManager.instance = new SupabaseClientManager(config);
    } else if (config) {
      // If config is provided, update the existing instance's config
      SupabaseClientManager.instance.config = { 
        ...SupabaseClientManager.instance.config, 
        ...config 
      };
    }
    
    return SupabaseClientManager.instance;
  }
  
  /**
   * Get the Supabase client, initializing if necessary
   * @returns Supabase client
   */
  public getClient(): SupabaseClient {
    if (!this.client) {
      if (!this.config.url || !this.config.key) {
        throw new Error('Supabase URL and key must be configured');
      }
      
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
   * Update the Supabase configuration
   * @param config New Supabase configuration
   */
  public updateConfig(config: Partial<SupabaseConfig>): void {
    this.config = { ...this.config, ...config };
    
    // If the client already exists and URL or key changed, reset it
    if (this.client && (config.url || config.key)) {
      this.client = null;
      logger.info('Supabase client reset due to configuration change');
    }
  }
}

// Export a default instance
export const supabaseClient = SupabaseClientManager.getInstance();
export default supabaseClient;
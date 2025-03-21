/**
 * Supabase Client Service
 * 
 * Provides a singleton Supabase client for the frontend application with
 * connection management and real-time capabilities.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default configuration
const SUPABASE_URL = process.env.GATSBY_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.GATSBY_SUPABASE_ANON_KEY || '';

/**
 * Supabase Client Service
 */
class SupabaseService {
  private static instance: SupabaseService;
  private client: SupabaseClient | null = null;
  
  /**
   * Create a new Supabase Service
   */
  private constructor() {
    // Private constructor for singleton pattern
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.warn('Supabase URL or key not configured. Real-time features may not work.');
    }
  }
  
  /**
   * Get the singleton instance
   * @returns Supabase service instance
   */
  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }
  
  /**
   * Get the Supabase client
   * @returns Supabase client
   */
  public getClient(): SupabaseClient {
    if (!this.client) {
      if (!SUPABASE_URL || !SUPABASE_KEY) {
        throw new Error('Supabase URL and key must be configured');
      }
      
      this.client = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true
        }
      });
      
      console.info('Supabase client initialized');
    }
    
    return this.client;
  }
}

// Export singleton instance
export const supabaseClient = SupabaseService.getInstance();
export default supabaseClient;
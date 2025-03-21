/**
 * Supabase Utility Service
 * 
 * Provides general utilities for working with Supabase data.
 */

import { supabaseClient } from './supabaseClient';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Supabase Utility Service
 * 
 * Provides helper methods for working with Supabase
 */
export class SupabaseUtilityService {
  private static instance: SupabaseUtilityService;

  private constructor() {
    logger.info('Supabase Utility Service initialized');
  }

  /**
   * Get the singleton instance
   * @returns The SupabaseUtilityService instance
   */
  public static getInstance(): SupabaseUtilityService {
    if (!SupabaseUtilityService.instance) {
      SupabaseUtilityService.instance = new SupabaseUtilityService();
    }
    return SupabaseUtilityService.instance;
  }

  /**
   * Check Supabase connection and table access
   * @returns Connection status
   */
  public async checkConnection(): Promise<{ success: boolean; tables: string[]; message: string }> {
    try {
      const client = supabaseClient.getClient();
      
      // Try to access some tables to verify connection and permissions
      const { data: tablesData, error: tablesError } = await client
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .limit(20);
      
      if (tablesError) {
        throw tablesError;
      }
      
      const tables = tablesData.map((row: any) => row.table_name);
      
      return {
        success: true,
        tables,
        message: 'Successfully connected to Supabase'
      };
    } catch (error) {
      logger.error(`Failed to check Supabase connection: ${error}`);
      return {
        success: false,
        tables: [],
        message: `Connection error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Perform basic database health check
   * @returns Health check results
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    try {
      const client = supabaseClient.getClient();
      const startTime = Date.now();
      
      // Check database connection
      const { data, error } = await client
        .from('materials')
        .select('id')
        .limit(1);
      
      const latency = Date.now() - startTime;
      
      if (error) {
        return {
          status: 'unhealthy',
          details: {
            error: error.message,
            code: error.code,
            hint: error.hint
          }
        };
      }
      
      // Check pgvector extension
      const { data: pgvectorData, error: pgvectorError } = await client
        .from('pg_extension')
        .select('extname')
        .eq('extname', 'vector')
        .limit(1)
        .single();
      
      return {
        status: 'healthy',
        details: {
          latency,
          pgvector: pgvectorError ? 'not installed' : 'installed',
          connection: 'established'
        }
      };
    } catch (error) {
      logger.error(`Health check failed: ${error}`);
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
}

// Export singleton instance
export const supabaseUtility = SupabaseUtilityService.getInstance();
export default supabaseUtility;
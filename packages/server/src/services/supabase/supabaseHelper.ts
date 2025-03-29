/**
 * Supabase Helper Utility
 * 
 * Provides type-safe wrappers around Supabase database operations to avoid TypeScript errors
 * with method chaining. This utility serves as a bridge between our application and the
 * Supabase client, handling the proper typing and query construction.
 */

// Removed import that causes TypeScript errors
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { supabaseClient } from './supabaseClient';

/**
 * Type-safe Supabase database helper
 */
export class SupabaseHelper {
  private client: SupabaseClient;

  constructor() {
    this.client = supabaseClient.getClient();
  }

  /**
   * Get a fresh client instance
   */
  public refreshClient(): void {
    this.client = supabaseClient.getClient();
  }

  /**
   * Perform a simple query to check connection status
   */
  public async checkConnection(): Promise<{ connected: boolean, error?: any }> {
    try {
      // Use a simple query to check connection
      // Use type assertion to bypass TypeScript errors with method chaining
      const result = await (this.client
        .from('message_broker_status')
        .select('status') as any)
        .limit(1)
        .maybeSingle();
      
      return { connected: !result.error, error: result.error };
    } catch (err) {
      logger.error(`Error checking connection: ${err}`);
      return { connected: false, error: err };
    }
  }

  /**
   * Select a record by ID
   */
  public async getById<T>(
    table: string,
    id: string,
    columns: string = '*'
  ): Promise<{ data: T | null, error: any }> {
    try {
      // Use type assertion to bypass TypeScript errors with method chaining
      const result = await (this.client
        .from(table)
        .select(columns) as any)
        .eq('id', id)
        .maybeSingle();
      
      return { data: result.data as T, error: result.error };
    } catch (err) {
      logger.error(`Error getting record by ID: ${err}`);
      return { data: null, error: err };
    }
  }

  /**
   * Insert a record
   */
  public async insert<T>(
    table: string,
    data: any
  ): Promise<{ data: T | null, error: any }> {
    try {
      // Use type assertion to bypass TypeScript errors with method chaining
      const result = await (this.client
        .from(table)
        .insert(data) as any)
        .select();
      
      return { 
        data: result.data?.[0] as T || null, 
        error: result.error 
      };
    } catch (err) {
      logger.error(`Error inserting record: ${err}`);
      return { data: null, error: err };
    }
  }

  /**
   * Update a record by ID
   */
  public async updateById<T>(
    table: string,
    id: string,
    data: any
  ): Promise<{ success: boolean, error: any }> {
    try {
      // Use type assertion to bypass TypeScript errors with method chaining
      const result = await (this.client
        .from(table)
        .update(data) as any)
        .eq('id', id);
      
      return { success: !result.error, error: result.error };
    } catch (err) {
      logger.error(`Error updating record: ${err}`);
      return { success: false, error: err };
    }
  }

  /**
   * Delete a record by ID
   */
  public async deleteById(
    table: string,
    id: string
  ): Promise<{ success: boolean, error: any }> {
    try {
      // Use type assertion to bypass TypeScript errors with method chaining
      const result = await (this.client
        .from(table)
        .delete() as any)
        .eq('id', id);
      
      return { success: !result.error, error: result.error };
    } catch (err) {
      logger.error(`Error deleting record: ${err}`);
      return { success: false, error: err };
    }
  }

  /**
   * Delete records based on a condition
   */
  public async deleteWhere(
    table: string,
    field: string,
    operator: string,
    value: any
  ): Promise<{ success: boolean, error: any }> {
    try {
      // Use appropriate filter based on operator
      // Use type assertion to bypass TypeScript errors with method chaining
      let query = this.client.from(table).delete() as any;
      
      if (operator === 'eq') {
        query = query.eq(field, value);
      } else if (operator === 'lt') {
        query = query.lt(field, value);
      } else if (operator === 'gt') {
        query = query.gt(field, value);
      } else if (operator === 'lte') {
        query = query.lte(field, value);
      } else if (operator === 'gte') {
        query = query.gte(field, value);
      } else if (operator === 'neq') {
        query = query.neq(field, value);
      } else {
        return { 
          success: false, 
          error: `Unsupported operator: ${operator}` 
        };
      }
      
      const result = await query;
      return { success: !result.error, error: result.error };
    } catch (err) {
      logger.error(`Error deleting records: ${err}`);
      return { success: false, error: err };
    }
  }

  /**
   * Get records with filtering
   */
  public async getWhere<T>(
    table: string,
    filters: Array<{ field: string, operator: string, value: any }>,
    columns: string = '*'
  ): Promise<{ data: T[] | null, error: any }> {
    try {
      // Use type assertion to bypass TypeScript errors with method chaining
      let query = this.client.from(table).select(columns) as any;
      
      // Apply each filter
      for (const filter of filters) {
        if (filter.operator === 'eq') {
          query = query.eq(filter.field, filter.value);
        } else if (filter.operator === 'lt') {
          query = query.lt(filter.field, filter.value);
        } else if (filter.operator === 'gt') {
          query = query.gt(filter.field, filter.value);
        } else if (filter.operator === 'lte') {
          query = query.lte(filter.field, filter.value);
        } else if (filter.operator === 'gte') {
          query = query.gte(filter.field, filter.value);
        } else if (filter.operator === 'neq') {
          query = query.neq(filter.field, filter.value);
        } else if (filter.operator === 'in') {
          query = query.in(filter.field, filter.value);
        } else {
          logger.warn(`Unsupported operator: ${filter.operator}`);
        }
      }
      
      const result = await query;
      return { data: result.data as T[], error: result.error };
    } catch (err) {
      logger.error(`Error getting records: ${err}`);
      return { data: null, error: err };
    }
  }

  /**
   * Get all records from a table
   */
  public async getAll<T>(
    table: string,
    columns: string = '*'
  ): Promise<{ data: T[] | null, error: any }> {
    try {
      const result = await this.client
        .from(table)
        .select(columns);
      
      return { data: result.data as T[], error: result.error };
    } catch (err) {
      logger.error(`Error getting all records: ${err}`);
      return { data: null, error: err };
    }
  }

  /**
   * Update records based on a condition
   */
  public async updateWhere<T>(
    table: string,
    data: any,
    filters: Array<{ field: string, operator: string, value: any }>
  ): Promise<{ success: boolean, error: any }> {
    try {
      // Use type assertion to bypass TypeScript errors with method chaining
      let query = this.client.from(table).update(data) as any;
      
      // Apply each filter
      for (const filter of filters) {
        if (filter.operator === 'eq') {
          query = query.eq(filter.field, filter.value);
        } else if (filter.operator === 'lt') {
          query = query.lt(filter.field, filter.value);
        } else if (filter.operator === 'gt') {
          query = query.gt(filter.field, filter.value);
        } else if (filter.operator === 'lte') {
          query = query.lte(filter.field, filter.value);
        } else if (filter.operator === 'gte') {
          query = query.gte(filter.field, filter.value);
        } else if (filter.operator === 'neq') {
          query = query.neq(filter.field, filter.value);
        } else {
          logger.warn(`Unsupported operator: ${filter.operator}`);
        }
      }
      
      const result = await query;
      return { success: !result.error, error: result.error };
    } catch (err) {
      logger.error(`Error updating records: ${err}`);
      return { success: false, error: err };
    }
  }

  /**
   * Insert multiple records in a batch
   */
  public async insertBatch<T>(
    table: string,
    records: any[]
  ): Promise<{ success: boolean, count: number, error: any }> {
    try {
      if (records.length === 0) {
        return { success: true, count: 0, error: null };
      }
      
      const result = await this.client
        .from(table)
        .insert(records);
      
      return { 
        success: !result.error, 
        count: records.length,
        error: result.error 
      };
    } catch (err) {
      logger.error(`Error inserting batch: ${err}`);
      return { success: false, count: 0, error: err };
    }
  }
}

// Create singleton instance
export const supabaseHelper = new SupabaseHelper();
export default supabaseHelper;
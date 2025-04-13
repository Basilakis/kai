/**
 * Supabase Helper Utility
 *
 * Provides type-safe wrappers around Supabase database operations to avoid TypeScript errors
 * with method chaining. This utility serves as a bridge between our application and the
 * Supabase client, handling the proper typing and query construction.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger, LogMetadata } from '../../utils/logger';
import { supabase } from './supabaseClient';
import { handleSupabaseError } from '../../../shared/src/utils/supabaseErrorHandler';

/**
 * Query filter operator type
 */
type FilterOperator = 'eq' | 'lt' | 'gt' | 'lte' | 'gte' | 'neq' | 'in';

/**
 * Filter definition for database queries
 */
interface QueryFilter<T = unknown> {
  field: string;
  operator: FilterOperator;
  value: T;
}

/**
 * Error type for Supabase errors with proper typing
 */
export interface SupabaseError extends Error {
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Interface for PostgrestResponse from Supabase
 */
interface PostgrestResponse<T> {
  data: T[] | null;
  error: SupabaseError | null;
  count?: number;
  status: number;
  statusText: string;
}

/**
 * Interface for single row response
 */
interface PostgrestSingleResponse<T> {
  data: T | null;
  error: SupabaseError | null;
  status: number;
  statusText: string;
}

/**
 * Custom builder interface for Supabase operations
 */
interface SupabaseFilterBuilder<T> {
  eq(column: string, value: unknown): SupabaseFilterBuilder<T>;
  neq(column: string, value: unknown): SupabaseFilterBuilder<T>;
  gt(column: string, value: unknown): SupabaseFilterBuilder<T>;
  gte(column: string, value: unknown): SupabaseFilterBuilder<T>;
  lt(column: string, value: unknown): SupabaseFilterBuilder<T>;
  lte(column: string, value: unknown): SupabaseFilterBuilder<T>;
  like(column: string, pattern: string): SupabaseFilterBuilder<T>;
  ilike(column: string, pattern: string): SupabaseFilterBuilder<T>;
  is(column: string, value: unknown): SupabaseFilterBuilder<T>;
  in(column: string, values: unknown[]): SupabaseFilterBuilder<T>;
  contains(column: string, value: unknown): SupabaseFilterBuilder<T>;
  limit(count: number): SupabaseFilterBuilder<T>;
  order(column: string, options?: Record<string, unknown>): SupabaseFilterBuilder<T>;
  select(columns?: string): SupabaseFilterBuilder<T>;
  maybeSingle(): Promise<PostgrestSingleResponse<T>>;
  single(): Promise<PostgrestSingleResponse<T>>;
  then<TResult>(
    onfulfilled?: (value: PostgrestResponse<T>) => TResult | Promise<TResult>,
    onrejected?: (reason: Error | SupabaseError) => TResult | Promise<TResult>
  ): Promise<TResult>;
}

/**
 * Type-safe Supabase database helper
 */
export class SupabaseHelper {
  private client: SupabaseClient;

  constructor() {
    this.client = supabase.getClient();
  }

  /**
   * Get a fresh client instance
   */
  public refreshClient(): void {
    this.client = supabase.getClient();
  }

  /**
   * Perform a simple query to check connection status
   */
  public async checkConnection(): Promise<{ connected: boolean, error?: SupabaseError }> {
    try {
      // Use a type-safe approach with method chaining
      const result = await (this.client
        .from('message_broker_status')
        .select('status') as unknown as SupabaseFilterBuilder<{ status: string }>)
        .limit(1)
        .maybeSingle();

      return { connected: !result.error, error: result.error as SupabaseError };
    } catch (err) {
      const error = handleSupabaseError(err, 'checkConnection', {
        service: 'SupabaseHelper',
        table: 'message_broker_status'
      });

      return { connected: false, error: error as SupabaseError };
    }
  }

  /**
   * Select a record by ID
   */
  public async getById<T extends Record<string, unknown>>(
    table: string,
    id: string,
    columns: string = '*'
  ): Promise<{ data: T | null, error: SupabaseError | null }> {
    try {
      // Use type-safe method chaining
      const result = await (this.client
        .from(table)
        .select(columns) as unknown as SupabaseFilterBuilder<T>)
        .eq('id', id)
        .maybeSingle();

      return {
        data: result.data,
        error: result.error as SupabaseError
      };
    } catch (err) {
      const error = handleSupabaseError(err, 'getById', {
        service: 'SupabaseHelper',
        table,
        id
      });

      return { data: null, error: error as SupabaseError };
    }
  }

  /**
   * Insert a record
   */
  public async insert<T extends Record<string, unknown>, R = T>(
    table: string,
    data: T
  ): Promise<{ data: R | null, error: SupabaseError | null }> {
    try {
      // Use type-safe method chaining
      const result = await (this.client
        .from(table)
        .insert(data) as unknown as SupabaseFilterBuilder<R>)
        .select();

      // TypeScript-safe access to first array element that avoids undefined type
      let firstItem: R | null = null;
      if (Array.isArray(result.data) && result.data.length > 0) {
        firstItem = result.data[0] as R;
      }

      return {
        data: firstItem,
        error: result.error as SupabaseError
      };
    } catch (err) {
      const error = handleSupabaseError(err, 'insert', {
        service: 'SupabaseHelper',
        table
      });

      return { data: null, error: error as SupabaseError };
    }
  }

  /**
   * Update a record by ID
   */
  public async updateById<T extends Record<string, unknown>>(
    table: string,
    id: string,
    data: Partial<T>
  ): Promise<{ success: boolean, error: SupabaseError | null }> {
    try {
      // Use type-safe method chaining
      const result = await (this.client
        .from(table)
        .update(data) as unknown as SupabaseFilterBuilder<T>)
        .eq('id', id);

      return { success: !result.error, error: result.error as SupabaseError };
    } catch (err) {
      const error = handleSupabaseError(err, 'updateById', {
        service: 'SupabaseHelper',
        table,
        id
      });

      return { success: false, error: error as SupabaseError };
    }
  }

  /**
   * Delete a record by ID
   */
  public async deleteById(
    table: string,
    id: string
  ): Promise<{ success: boolean, error: SupabaseError | null }> {
    try {
      // Use type-safe method chaining
      const result = await (this.client
        .from(table)
        .delete() as unknown as SupabaseFilterBuilder<unknown>)
        .eq('id', id);

      return { success: !result.error, error: result.error as SupabaseError };
    } catch (err) {
      const error = handleSupabaseError(err, 'deleteById', {
        service: 'SupabaseHelper',
        table,
        id
      });

      return { success: false, error: error as SupabaseError };
    }
  }

  /**
   * Delete records based on a condition
   */
  public async deleteWhere<T = unknown>(
    table: string,
    field: string,
    operator: FilterOperator,
    value: T
  ): Promise<{ success: boolean, error: SupabaseError | null }> {
    try {
      // Use type-safe method chaining
      let query = this.client.from(table).delete() as unknown as SupabaseFilterBuilder<unknown>;

      // Apply the filter based on the operator
      switch (operator) {
        case 'eq':
          query = query.eq(field, value);
          break;
        case 'lt':
          query = query.lt(field, value);
          break;
        case 'gt':
          query = query.gt(field, value);
          break;
        case 'lte':
          query = query.lte(field, value);
          break;
        case 'gte':
          query = query.gte(field, value);
          break;
        case 'neq':
          query = query.neq(field, value);
          break;
        case 'in':
          if (Array.isArray(value)) {
            query = query.in(field, value);
          } else {
            return {
              success: false,
              error: new Error(`Value must be an array for 'in' operator`) as SupabaseError
            };
          }
          break;
        default:
          return {
            success: false,
            error: new Error(`Unsupported operator: ${operator}`) as SupabaseError
          };
      }

      const result = await query;
      return { success: !result.error, error: result.error as SupabaseError };
    } catch (err) {
      const error = handleSupabaseError(err, 'deleteWhere', {
        service: 'SupabaseHelper',
        table,
        field,
        operator
      });

      return { success: false, error: error as SupabaseError };
    }
  }

  /**
   * Get records with filtering
   */
  public async getWhere<T extends Record<string, unknown>>(
    table: string,
    filters: Array<QueryFilter>,
    columns: string = '*'
  ): Promise<{ data: T[] | null, error: SupabaseError | null }> {
    try {
      // Use type-safe method chaining
      let query = this.client.from(table).select(columns) as unknown as SupabaseFilterBuilder<T>;

      // Apply each filter
      for (const filter of filters) {
        switch (filter.operator) {
          case 'eq':
            query = query.eq(filter.field, filter.value);
            break;
          case 'lt':
            query = query.lt(filter.field, filter.value);
            break;
          case 'gt':
            query = query.gt(filter.field, filter.value);
            break;
          case 'lte':
            query = query.lte(filter.field, filter.value);
            break;
          case 'gte':
            query = query.gte(filter.field, filter.value);
            break;
          case 'neq':
            query = query.neq(filter.field, filter.value);
            break;
          case 'in':
            if (Array.isArray(filter.value)) {
              query = query.in(filter.field, filter.value);
            } else {
              logger.warn(`Value must be an array for 'in' operator. Skipping filter.`);
            }
            break;
          default:
            logger.warn(`Unsupported operator: ${filter.operator}`);
        }
      }

      const result = await query;
      return { data: result.data as T[], error: result.error as SupabaseError };
    } catch (err) {
      const error = handleSupabaseError(err, 'getWhere', {
        service: 'SupabaseHelper',
        table,
        filterCount: filters.length
      });

      return { data: null, error: error as SupabaseError };
    }
  }

  /**
   * Get all records from a table
   */
  public async getAll<T extends Record<string, unknown>>(
    table: string,
    columns: string = '*'
  ): Promise<{ data: T[] | null, error: SupabaseError | null }> {
    try {
      const result = await this.client
        .from(table)
        .select(columns);

      return { data: result.data as T[], error: result.error as SupabaseError };
    } catch (err) {
      const error = handleSupabaseError(err, 'getAll', {
        service: 'SupabaseHelper',
        table
      });

      return { data: null, error: error as SupabaseError };
    }
  }

  /**
   * Update records based on a condition
   */
  public async updateWhere<T extends Record<string, unknown>>(
    table: string,
    data: Partial<T>,
    filters: Array<QueryFilter>
  ): Promise<{ success: boolean, error: SupabaseError | null }> {
    try {
      // Use type-safe method chaining
      let query = this.client.from(table).update(data) as unknown as SupabaseFilterBuilder<T>;

      // Apply each filter
      for (const filter of filters) {
        switch (filter.operator) {
          case 'eq':
            query = query.eq(filter.field, filter.value);
            break;
          case 'lt':
            query = query.lt(filter.field, filter.value);
            break;
          case 'gt':
            query = query.gt(filter.field, filter.value);
            break;
          case 'lte':
            query = query.lte(filter.field, filter.value);
            break;
          case 'gte':
            query = query.gte(filter.field, filter.value);
            break;
          case 'neq':
            query = query.neq(filter.field, filter.value);
            break;
          case 'in':
            if (Array.isArray(filter.value)) {
              query = query.in(filter.field, filter.value);
            } else {
              logger.warn(`Value must be an array for 'in' operator. Skipping filter.`);
            }
            break;
          default:
            logger.warn(`Unsupported operator: ${filter.operator}`);
        }
      }

      const result = await query;
      return { success: !result.error, error: result.error as SupabaseError };
    } catch (err) {
      const error = handleSupabaseError(err, 'updateWhere', {
        service: 'SupabaseHelper',
        table,
        filterCount: filters.length
      });

      return { success: false, error: error as SupabaseError };
    }
  }

  /**
   * Insert multiple records in a batch
   */
  public async insertBatch<T extends Record<string, unknown>>(
    table: string,
    records: T[]
  ): Promise<{ success: boolean, count: number, error: SupabaseError | null }> {
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
        error: result.error as SupabaseError
      };
    } catch (err) {
      const error = handleSupabaseError(err, 'insertBatch', {
        service: 'SupabaseHelper',
        table,
        recordCount: records.length
      });

      return { success: false, count: 0, error: error as SupabaseError };
    }
  }
}

// Create singleton instance
export const supabaseHelper = new SupabaseHelper();
export default supabaseHelper;
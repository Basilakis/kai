/**
 * Optimized Supabase Client
 * 
 * This service provides an optimized Supabase client with connection pooling,
 * query caching, and performance optimizations.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { connectionPool, withConnection } from './connectionPool';
import { queryCache, withCache } from './queryCache';
import { logger } from '../../utils/logger';
import { handleSupabaseError } from '../../utils/supabaseErrorHandler';

/**
 * Query options
 */
export interface QueryOptions {
  cacheEnabled?: boolean;
  cacheTtlMs?: number;
  useConnectionPool?: boolean;
  retryCount?: number;
  retryDelayMs?: number;
}

/**
 * Default query options
 */
const DEFAULT_OPTIONS: QueryOptions = {
  cacheEnabled: true,
  cacheTtlMs: 60000, // 1 minute
  useConnectionPool: true,
  retryCount: 1,
  retryDelayMs: 500
};

/**
 * Execute a query with optimizations
 */
export async function executeQuery<T>(
  table: string,
  operation: string,
  params: Record<string, any>,
  queryFn: (client: SupabaseClient) => Promise<{ data: T | null; error: any }>,
  options: QueryOptions = {}
): Promise<T> {
  // Merge options with defaults
  const mergedOptions: QueryOptions = { ...DEFAULT_OPTIONS, ...options };
  
  // Define the query execution function
  const executeQueryFn = async (): Promise<T> => {
    // Use connection pool if enabled
    if (mergedOptions.useConnectionPool) {
      return withConnection(async (client) => {
        return executeQueryWithRetry(client, queryFn, mergedOptions);
      });
    } else {
      // Get client from the main Supabase instance
      const { supabase } = await import('./supabaseClient');
      return executeQueryWithRetry(supabase.getClient(), queryFn, mergedOptions);
    }
  };
  
  // Use cache if enabled
  if (mergedOptions.cacheEnabled) {
    return withCache(
      table,
      operation,
      params,
      executeQueryFn,
      mergedOptions.cacheTtlMs
    );
  } else {
    return executeQueryFn();
  }
}

/**
 * Execute a query with retry logic
 */
async function executeQueryWithRetry<T>(
  client: SupabaseClient,
  queryFn: (client: SupabaseClient) => Promise<{ data: T | null; error: any }>,
  options: QueryOptions
): Promise<T> {
  let lastError: any = null;
  
  // Try the query with retries
  for (let attempt = 0; attempt <= (options.retryCount || 0); attempt++) {
    try {
      const startTime = Date.now();
      const { data, error } = await queryFn(client);
      const duration = Date.now() - startTime;
      
      // Log slow queries (over 500ms)
      if (duration > 500) {
        logger.warn('Slow Supabase query detected', {
          duration,
          attempt
        });
      }
      
      if (error) {
        throw error;
      }
      
      if (data === null) {
        throw new Error('Query returned null data');
      }
      
      return data;
    } catch (error) {
      lastError = error;
      
      // If this is not the last attempt, wait before retrying
      if (attempt < (options.retryCount || 0)) {
        const delay = (options.retryDelayMs || 500) * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If we get here, all attempts failed
  throw handleSupabaseError(
    lastError,
    'executeQuery',
    { retryCount: options.retryCount }
  );
}

/**
 * Optimized select query
 */
export async function select<T>(
  table: string,
  params: {
    columns?: string;
    filters?: Record<string, any>;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  } = {},
  options: QueryOptions = {}
): Promise<T[]> {
  const { columns = '*', filters = {}, limit, offset, orderBy, orderDirection } = params;
  
  return executeQuery<T[]>(
    table,
    'select',
    params,
    async (client) => {
      let query = client.from(table).select(columns);
      
      // Apply filters
      for (const [key, value] of Object.entries(filters)) {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else if (value === null) {
          query = query.is(key, null);
        } else {
          query = query.eq(key, value);
        }
      }
      
      // Apply ordering
      if (orderBy) {
        query = query.order(orderBy, { ascending: orderDirection === 'asc' });
      }
      
      // Apply pagination
      if (limit !== undefined) {
        query = query.limit(limit);
      }
      
      if (offset !== undefined) {
        query = query.range(offset, offset + (limit || 10) - 1);
      }
      
      return query;
    },
    options
  );
}

/**
 * Optimized select single record
 */
export async function selectSingle<T>(
  table: string,
  params: {
    columns?: string;
    filters?: Record<string, any>;
  } = {},
  options: QueryOptions = {}
): Promise<T> {
  const { columns = '*', filters = {} } = params;
  
  return executeQuery<T>(
    table,
    'selectSingle',
    params,
    async (client) => {
      let query = client.from(table).select(columns);
      
      // Apply filters
      for (const [key, value] of Object.entries(filters)) {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else if (value === null) {
          query = query.is(key, null);
        } else {
          query = query.eq(key, value);
        }
      }
      
      return query.single();
    },
    options
  );
}

/**
 * Optimized insert query
 */
export async function insert<T>(
  table: string,
  data: Partial<T> | Partial<T>[],
  options: QueryOptions & { returning?: string } = {}
): Promise<T | T[]> {
  const { returning = '*', ...queryOptions } = options;
  
  return executeQuery<T | T[]>(
    table,
    'insert',
    { data },
    async (client) => {
      return client.from(table).insert(data).select(returning);
    },
    {
      ...queryOptions,
      cacheEnabled: false // Don't cache insert operations
    }
  );
}

/**
 * Optimized update query
 */
export async function update<T>(
  table: string,
  params: {
    data: Partial<T>;
    filters: Record<string, any>;
  },
  options: QueryOptions & { returning?: string } = {}
): Promise<T> {
  const { returning = '*', ...queryOptions } = options;
  const { data, filters } = params;
  
  return executeQuery<T>(
    table,
    'update',
    params,
    async (client) => {
      let query = client.from(table).update(data);
      
      // Apply filters
      for (const [key, value] of Object.entries(filters)) {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else if (value === null) {
          query = query.is(key, null);
        } else {
          query = query.eq(key, value);
        }
      }
      
      return query.select(returning).single();
    },
    {
      ...queryOptions,
      cacheEnabled: false // Don't cache update operations
    }
  );
}

/**
 * Optimized delete query
 */
export async function remove<T>(
  table: string,
  params: {
    filters: Record<string, any>;
  },
  options: QueryOptions & { returning?: string } = {}
): Promise<T> {
  const { returning = '*', ...queryOptions } = options;
  const { filters } = params;
  
  return executeQuery<T>(
    table,
    'delete',
    params,
    async (client) => {
      let query = client.from(table).delete();
      
      // Apply filters
      for (const [key, value] of Object.entries(filters)) {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else if (value === null) {
          query = query.is(key, null);
        } else {
          query = query.eq(key, value);
        }
      }
      
      return query.select(returning).single();
    },
    {
      ...queryOptions,
      cacheEnabled: false // Don't cache delete operations
    }
  );
}

/**
 * Optimized upsert query
 */
export async function upsert<T>(
  table: string,
  data: Partial<T> | Partial<T>[],
  options: QueryOptions & { 
    returning?: string;
    onConflict?: string;
  } = {}
): Promise<T | T[]> {
  const { returning = '*', onConflict, ...queryOptions } = options;
  
  return executeQuery<T | T[]>(
    table,
    'upsert',
    { data, onConflict },
    async (client) => {
      const query = client.from(table).upsert(data, { 
        onConflict,
        returning: true
      });
      
      return query.select(returning);
    },
    {
      ...queryOptions,
      cacheEnabled: false // Don't cache upsert operations
    }
  );
}

/**
 * Invalidate cache for a table
 */
export function invalidateCache(table: string): void {
  queryCache.invalidateTable(table);
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return queryCache.getStats();
}

/**
 * Get connection pool statistics
 */
export function getConnectionStats() {
  return connectionPool.getStats();
}

export default {
  select,
  selectSingle,
  insert,
  update,
  remove,
  upsert,
  executeQuery,
  invalidateCache,
  getCacheStats,
  getConnectionStats
};

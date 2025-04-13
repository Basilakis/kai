/**
 * Supabase Helpers
 * 
 * This utility provides helper functions for common Supabase operations
 * to ensure consistent usage patterns across the application.
 */

import { PostgrestFilterBuilder, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../services/supabase/supabaseClient';
import { safeSupabaseOperation, retrySupabaseOperation } from './supabaseErrorHandler';

/**
 * Pagination options for list operations
 */
export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

/**
 * Result of a paginated query
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Get a single record by ID
 * 
 * @param table Table name
 * @param id Record ID
 * @param columns Columns to select
 * @returns The record or null if not found
 */
export async function getById<T>(
  table: string,
  id: string | number,
  columns: string = '*'
): Promise<T | null> {
  return safeSupabaseOperation(
    () => supabase.getClient()
      .from(table)
      .select(columns)
      .eq('id', id)
      .single(),
    `getById:${table}`,
    { id, columns }
  );
}

/**
 * Get multiple records by IDs
 * 
 * @param table Table name
 * @param ids Array of record IDs
 * @param columns Columns to select
 * @returns Array of records
 */
export async function getByIds<T>(
  table: string,
  ids: (string | number)[],
  columns: string = '*'
): Promise<T[]> {
  return safeSupabaseOperation(
    () => supabase.getClient()
      .from(table)
      .select(columns)
      .in('id', ids),
    `getByIds:${table}`,
    { ids: ids.length, columns }
  );
}

/**
 * Get records with pagination
 * 
 * @param table Table name
 * @param options Pagination options
 * @param columns Columns to select
 * @returns Paginated result
 */
export async function getPaginated<T>(
  table: string,
  options: PaginationOptions = {},
  columns: string = '*'
): Promise<PaginatedResult<T>> {
  const {
    page = 1,
    pageSize = 20,
    orderBy = 'created_at',
    orderDirection = 'desc'
  } = options;
  
  // Calculate range for pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  
  // Get total count and data in one query
  const result = await safeSupabaseOperation(
    () => supabase.getClient()
      .from(table)
      .select(columns, { count: 'exact' })
      .order(orderBy, { ascending: orderDirection === 'asc' })
      .range(from, to),
    `getPaginated:${table}`,
    { page, pageSize, orderBy, orderDirection }
  );
  
  // Calculate total pages
  const total = result.count || 0;
  const totalPages = Math.ceil(total / pageSize);
  
  return {
    data: result.data as T[],
    total,
    page,
    pageSize,
    totalPages
  };
}

/**
 * Create a new record
 * 
 * @param table Table name
 * @param data Record data
 * @param returning Columns to return
 * @returns The created record
 */
export async function create<T>(
  table: string,
  data: Partial<T>,
  returning: string = '*'
): Promise<T> {
  return safeSupabaseOperation(
    () => supabase.getClient()
      .from(table)
      .insert(data)
      .select(returning)
      .single(),
    `create:${table}`,
    { dataKeys: Object.keys(data) }
  );
}

/**
 * Update an existing record
 * 
 * @param table Table name
 * @param id Record ID
 * @param data Record data
 * @param returning Columns to return
 * @returns The updated record
 */
export async function update<T>(
  table: string,
  id: string | number,
  data: Partial<T>,
  returning: string = '*'
): Promise<T> {
  return safeSupabaseOperation(
    () => supabase.getClient()
      .from(table)
      .update(data)
      .eq('id', id)
      .select(returning)
      .single(),
    `update:${table}`,
    { id, dataKeys: Object.keys(data) }
  );
}

/**
 * Delete a record
 * 
 * @param table Table name
 * @param id Record ID
 * @param returning Columns to return
 * @returns The deleted record
 */
export async function remove<T>(
  table: string,
  id: string | number,
  returning: string = '*'
): Promise<T> {
  return safeSupabaseOperation(
    () => supabase.getClient()
      .from(table)
      .delete()
      .eq('id', id)
      .select(returning)
      .single(),
    `remove:${table}`,
    { id }
  );
}

/**
 * Upsert a record (insert if not exists, update if exists)
 * 
 * @param table Table name
 * @param data Record data
 * @param onConflict Column to check for conflicts
 * @param returning Columns to return
 * @returns The upserted record
 */
export async function upsert<T>(
  table: string,
  data: Partial<T>,
  onConflict: string = 'id',
  returning: string = '*'
): Promise<T> {
  return safeSupabaseOperation(
    () => supabase.getClient()
      .from(table)
      .upsert(data, { onConflict })
      .select(returning)
      .single(),
    `upsert:${table}`,
    { dataKeys: Object.keys(data), onConflict }
  );
}

/**
 * Execute a custom query with retry capability
 * 
 * @param queryBuilder Function that builds and returns a query
 * @param operationName Name of the operation for logging
 * @returns Query result
 */
export async function executeQuery<T>(
  queryBuilder: (client: SupabaseClient) => PostgrestFilterBuilder<T>,
  operationName: string
): Promise<T> {
  return retrySupabaseOperation(
    () => queryBuilder(supabase.getClient()),
    operationName
  );
}

/**
 * Upload a file to Supabase storage
 * 
 * @param bucket Storage bucket name
 * @param path File path in the bucket
 * @param file File to upload (File, Blob, or ArrayBuffer)
 * @param options Upload options
 * @returns Public URL of the uploaded file
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Blob | ArrayBuffer,
  options: { contentType?: string; upsert?: boolean } = {}
): Promise<string> {
  const { contentType, upsert = true } = options;
  
  await safeSupabaseOperation(
    () => supabase.getClient()
      .storage
      .from(bucket)
      .upload(path, file, { contentType, upsert }),
    `uploadFile:${bucket}`,
    { path, contentType, upsert }
  );
  
  // Get public URL
  const { data } = supabase.getClient()
    .storage
    .from(bucket)
    .getPublicUrl(path);
  
  return data.publicUrl;
}

/**
 * Download a file from Supabase storage
 * 
 * @param bucket Storage bucket name
 * @param path File path in the bucket
 * @returns File data
 */
export async function downloadFile(
  bucket: string,
  path: string
): Promise<Blob> {
  const result = await safeSupabaseOperation(
    () => supabase.getClient()
      .storage
      .from(bucket)
      .download(path),
    `downloadFile:${bucket}`,
    { path }
  );
  
  return result.data;
}

export default {
  getById,
  getByIds,
  getPaginated,
  create,
  update,
  remove,
  upsert,
  executeQuery,
  uploadFile,
  downloadFile
};

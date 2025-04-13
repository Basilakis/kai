/**
 * Supabase Error Handler
 * 
 * This utility provides standardized error handling for Supabase operations
 * with consistent logging, error transformation, and recovery strategies.
 */

import { PostgrestError } from '@supabase/supabase-js';
import { logger } from './logger';

/**
 * Error types for categorization
 */
export enum ErrorType {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  NOT_FOUND = 'not_found',
  CONFLICT = 'conflict',
  RATE_LIMIT = 'rate_limit',
  SERVER_ERROR = 'server_error',
  NETWORK_ERROR = 'network_error',
  UNKNOWN = 'unknown'
}

/**
 * Enhanced error with additional context
 */
export interface EnhancedError extends Error {
  type: ErrorType;
  originalError?: any;
  code?: string;
  details?: string;
  hint?: string;
  statusCode?: number;
}

/**
 * Create an enhanced error from a Supabase error
 * 
 * @param error The original Supabase error
 * @param operation The operation that caused the error
 * @returns Enhanced error with additional context
 */
export function createEnhancedError(error: PostgrestError | Error | any, operation: string): EnhancedError {
  // Default values
  let type = ErrorType.UNKNOWN;
  let message = error?.message || 'Unknown error';
  let code = error?.code;
  let details = error?.details;
  let hint = error?.hint;
  let statusCode = error?.status;
  
  // Categorize PostgrestError
  if (error && 'code' in error) {
    // Handle PostgreSQL error codes
    if (code?.startsWith('22')) {
      type = ErrorType.VALIDATION;
    } else if (code?.startsWith('23')) {
      type = ErrorType.CONFLICT;
    } else if (code?.startsWith('28')) {
      type = ErrorType.AUTHORIZATION;
    } else if (code?.startsWith('42')) {
      type = ErrorType.VALIDATION;
    } else if (code === '404') {
      type = ErrorType.NOT_FOUND;
    } else if (code === '429') {
      type = ErrorType.RATE_LIMIT;
    } else if (code?.startsWith('5')) {
      type = ErrorType.SERVER_ERROR;
    }
  } else if (error instanceof Error) {
    // Handle standard Error objects
    if (error.message.includes('network') || error.message.includes('connection')) {
      type = ErrorType.NETWORK_ERROR;
    } else if (error.message.includes('authentication') || error.message.includes('auth')) {
      type = ErrorType.AUTHENTICATION;
    } else if (error.message.includes('permission') || error.message.includes('access')) {
      type = ErrorType.AUTHORIZATION;
    } else if (error.message.includes('not found') || error.message.includes('404')) {
      type = ErrorType.NOT_FOUND;
    } else if (error.message.includes('conflict') || error.message.includes('duplicate')) {
      type = ErrorType.CONFLICT;
    }
  }
  
  // Create enhanced error
  const enhancedError = new Error(message) as EnhancedError;
  enhancedError.name = 'SupabaseError';
  enhancedError.type = type;
  enhancedError.originalError = error;
  enhancedError.code = code;
  enhancedError.details = details;
  enhancedError.hint = hint;
  enhancedError.statusCode = statusCode;
  
  return enhancedError;
}

/**
 * Handle a Supabase error with standardized logging and error transformation
 * 
 * @param error The original Supabase error
 * @param operation The operation that caused the error
 * @param context Additional context for logging
 * @returns Enhanced error with additional context
 */
export function handleSupabaseError(
  error: PostgrestError | Error | any,
  operation: string,
  context: Record<string, any> = {}
): EnhancedError {
  const enhancedError = createEnhancedError(error, operation);
  
  // Log the error with appropriate level based on type
  const logContext = {
    operation,
    errorType: enhancedError.type,
    errorCode: enhancedError.code,
    ...context
  };
  
  switch (enhancedError.type) {
    case ErrorType.VALIDATION:
    case ErrorType.NOT_FOUND:
    case ErrorType.CONFLICT:
      logger.warn(`Supabase operation failed: ${operation}`, {
        error: enhancedError.message,
        ...logContext
      });
      break;
    
    case ErrorType.AUTHENTICATION:
    case ErrorType.AUTHORIZATION:
      logger.error(`Supabase authentication/authorization error: ${operation}`, {
        error: enhancedError.message,
        ...logContext
      });
      break;
    
    case ErrorType.RATE_LIMIT:
      logger.warn(`Supabase rate limit exceeded: ${operation}`, {
        error: enhancedError.message,
        ...logContext
      });
      break;
    
    case ErrorType.SERVER_ERROR:
    case ErrorType.NETWORK_ERROR:
    case ErrorType.UNKNOWN:
    default:
      logger.error(`Supabase error: ${operation}`, {
        error: enhancedError.message,
        details: enhancedError.details,
        hint: enhancedError.hint,
        ...logContext
      });
      break;
  }
  
  return enhancedError;
}

/**
 * Safely execute a Supabase operation with standardized error handling
 * 
 * @param operation Function that performs a Supabase operation
 * @param operationName Name of the operation for logging
 * @param context Additional context for logging
 * @returns Result of the operation or throws an enhanced error
 */
export async function safeSupabaseOperation<T>(
  operation: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  operationName: string,
  context: Record<string, any> = {}
): Promise<T> {
  try {
    const { data, error } = await operation();
    
    if (error) {
      throw handleSupabaseError(error, operationName, context);
    }
    
    if (data === null) {
      const notFoundError = new Error(`No data found for operation: ${operationName}`);
      throw handleSupabaseError(notFoundError, operationName, { ...context, reason: 'null_data' });
    }
    
    return data;
  } catch (error) {
    if ((error as EnhancedError).type) {
      // Already an enhanced error, just rethrow
      throw error;
    }
    
    // Transform and throw
    throw handleSupabaseError(error, operationName, context);
  }
}

/**
 * Retry a Supabase operation with exponential backoff
 * 
 * @param operation Function that performs a Supabase operation
 * @param operationName Name of the operation for logging
 * @param options Retry options
 * @param context Additional context for logging
 * @returns Result of the operation or throws an enhanced error
 */
export async function retrySupabaseOperation<T>(
  operation: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  operationName: string,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    retryableErrorTypes?: ErrorType[];
  } = {},
  context: Record<string, any> = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 500,
    maxDelayMs = 5000,
    retryableErrorTypes = [
      ErrorType.NETWORK_ERROR,
      ErrorType.RATE_LIMIT,
      ErrorType.SERVER_ERROR
    ]
  } = options;
  
  let lastError: EnhancedError | null = null;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const { data, error } = await operation();
      
      if (error) {
        lastError = handleSupabaseError(error, operationName, { ...context, attempt });
        
        // Check if this error type is retryable
        if (!retryableErrorTypes.includes(lastError.type)) {
          throw lastError;
        }
        
        // If this is the last attempt, throw the error
        if (attempt > maxRetries) {
          throw lastError;
        }
        
        // Calculate backoff delay with jitter
        const delay = Math.min(
          maxDelayMs,
          initialDelayMs * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5)
        );
        
        logger.warn(`Retrying Supabase operation: ${operationName} (attempt ${attempt}/${maxRetries})`, {
          error: lastError.message,
          delay,
          ...context
        });
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      if (data === null) {
        const notFoundError = new Error(`No data found for operation: ${operationName}`);
        throw handleSupabaseError(notFoundError, operationName, { ...context, reason: 'null_data', attempt });
      }
      
      // If we got here, the operation succeeded
      if (attempt > 1) {
        logger.info(`Supabase operation succeeded after ${attempt - 1} retries: ${operationName}`);
      }
      
      return data;
    } catch (error) {
      if ((error as EnhancedError).type) {
        // Already an enhanced error
        lastError = error as EnhancedError;
      } else {
        // Transform the error
        lastError = handleSupabaseError(error, operationName, { ...context, attempt });
      }
      
      // Check if this error type is retryable
      if (!retryableErrorTypes.includes(lastError.type)) {
        throw lastError;
      }
      
      // If this is the last attempt, throw the error
      if (attempt > maxRetries) {
        throw lastError;
      }
      
      // Calculate backoff delay with jitter
      const delay = Math.min(
        maxDelayMs,
        initialDelayMs * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5)
      );
      
      logger.warn(`Retrying Supabase operation: ${operationName} (attempt ${attempt}/${maxRetries})`, {
        error: lastError.message,
        delay,
        ...context
      });
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // This should never happen, but TypeScript needs it
  throw lastError || new Error(`Unknown error in retrySupabaseOperation: ${operationName}`);
}

export default {
  handleSupabaseError,
  safeSupabaseOperation,
  retrySupabaseOperation,
  ErrorType
};

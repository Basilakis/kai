/**
 * Error Handling Utilities
 * 
 * Provides standardized error handling, logging, and reporting across the application.
 * This centralized approach ensures consistent error messages and makes debugging easier.
 */

// Define error categories for better classification
export enum ErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  WEBSOCKET = 'websocket',
  AGENT = 'agent',
  RESOURCE = 'resource',
  UNEXPECTED = 'unexpected'
}

// Enhanced error interface with additional context
export interface EnhancedError extends Error {
  category: ErrorCategory;
  timestamp: Date;
  statusCode?: number | undefined;
  context?: Record<string, any> | undefined;
  originalError?: Error | undefined;
}

/**
 * Create a standardized application error
 */
export function createError(
  message: string, 
  category: ErrorCategory = ErrorCategory.UNEXPECTED, 
  options?: {
    statusCode?: number | undefined;
    context?: Record<string, any> | undefined;
    originalError?: Error | undefined;
  }
): EnhancedError {
  const error = new Error(message) as EnhancedError;
  error.name = `${category.charAt(0).toUpperCase() + category.slice(1)}Error`;
  error.category = category;
  error.timestamp = new Date();
  
  // Set optional properties only if they're provided
  if (options) {
    if (options.statusCode !== undefined) {
      error.statusCode = options.statusCode;
    }
    
    if (options.context !== undefined) {
      error.context = options.context;
    }
    
    if (options.originalError !== undefined) {
      error.originalError = options.originalError;
      
      // Preserve original stack trace if available
      if (options.originalError.stack) {
        error.stack = `${error.stack}\nCaused by: ${options.originalError.stack}`;
      }
    }
  }
  
  return error;
}

/**
 * Convert any error to an enhanced error
 */
export function enhanceError(error: unknown, defaultMessage = 'An unexpected error occurred'): EnhancedError {
  if (error instanceof Error) {
    // If it's already an EnhancedError, return it
    if ('category' in error && 'timestamp' in error) {
      return error as EnhancedError;
    }
    
    // Convert standard error to EnhancedError
    return createError(error.message, ErrorCategory.UNEXPECTED, {
      originalError: error
    });
  }
  
  // Create a new error for non-Error objects
  if (typeof error === 'string') {
    return createError(error);
  }
  
  // For other values (null, undefined, objects), create a generic error
  return createError(
    defaultMessage,
    ErrorCategory.UNEXPECTED, 
    { context: { originalValue: error } }
  );
}

/**
 * Network-specific error creation
 */
export function createNetworkError(
  message: string,
  statusCode?: number,
  context?: Record<string, any>,
  originalError?: Error
): EnhancedError {
  return createError(message, ErrorCategory.NETWORK, {
    statusCode,
    context,
    originalError
  });
}

/**
 * WebSocket-specific error creation
 */
export function createWebSocketError(
  message: string,
  context?: Record<string, any>,
  originalError?: Error
): EnhancedError {
  return createError(message, ErrorCategory.WEBSOCKET, {
    context,
    originalError
  });
}

/**
 * Authentication-specific error creation
 */
export function createAuthError(
  message: string,
  statusCode?: number,
  context?: Record<string, any>
): EnhancedError {
  return createError(message, ErrorCategory.AUTHENTICATION, {
    statusCode,
    context
  });
}

/**
 * Agent-specific error creation
 */
export function createAgentError(
  message: string,
  context?: Record<string, any>,
  originalError?: Error
): EnhancedError {
  return createError(message, ErrorCategory.AGENT, {
    context,
    originalError
  });
}

/**
 * Standard error reporter function
 * Can be extended to report to monitoring services
 */
export function reportError(error: EnhancedError, additionalContext?: Record<string, any>): void {
  const context = {
    ...(error.context || {}),
    ...(additionalContext || {})
  };
  
  // Log to console in development
  console.error(
    `[${error.category.toUpperCase()}] ${error.name}: ${error.message}`,
    {
      timestamp: error.timestamp,
      statusCode: error.statusCode,
      context
    }
  );
  
  // TODO: Add reporting to monitoring services in production
  // Example: if (process.env.NODE_ENV === 'production') { sendToMonitoring(error); }
}

/**
 * Convert HTTP request errors to enhanced errors
 */
export function handleHttpError(error: unknown, defaultMessage = 'Network request failed'): EnhancedError {
  // Handle axios errors
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const axiosError = error as any;
    const statusCode = axiosError.response?.status;
    const responseData = axiosError.response?.data;
    
    return createNetworkError(
      axiosError.response?.data?.message || axiosError.message || defaultMessage,
      statusCode,
      { responseData, config: axiosError.config },
      axiosError
    );
  }
  
  // Handle fetch errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return createNetworkError(
      error.message,
      undefined,
      { type: 'fetch' },
      error
    );
  }
  
  // Handle general errors
  return enhanceError(error, defaultMessage);
}

/**
 * Try-catch wrapper for async functions to standardize error handling
 */
export async function tryCatchAsync<T>(
  fn: () => Promise<T>,
  errorHandler?: (error: EnhancedError) => void,
  defaultMessage = 'Operation failed'
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const enhancedErr = enhanceError(error, defaultMessage);
    
    if (errorHandler) {
      errorHandler(enhancedErr);
    } else {
      reportError(enhancedErr);
    }
    
    return null;
  }
}

/**
 * Try-catch wrapper for synchronous functions
 */
export function tryCatchSync<T>(
  fn: () => T,
  errorHandler?: (error: EnhancedError) => void,
  defaultMessage = 'Operation failed'
): T | null {
  try {
    return fn();
  } catch (error) {
    const enhancedErr = enhanceError(error, defaultMessage);
    
    if (errorHandler) {
      errorHandler(enhancedErr);
    } else {
      reportError(enhancedErr);
    }
    
    return null;
  }
}

/**
 * Usage examples:
 * 
 * // Create specific error
 * const authError = createAuthError('User not authorized', 401, { userId: '123' });
 * 
 * // Handle and report error
 * try {
 *   // Some operation
 * } catch (error) {
 *   const enhancedError = enhanceError(error, 'Failed to load user data');
 *   reportError(enhancedError, { component: 'UserProfile' });
 * }
 * 
 * // Using try-catch wrapper
 * const userData = await tryCatchAsync(
 *   () => fetchUserData(userId),
 *   (error) => showErrorToast(error.message),
 *   'Failed to load user profile'
 * );
 */
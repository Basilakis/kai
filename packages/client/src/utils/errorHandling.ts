/**
 * Error Handling Utilities
 * 
 * Provides standardized error handling, logging, and reporting across the application.
 * This centralized approach ensures consistent error messages and makes debugging easier.
 */

// --- Monitoring Service Integration (Example: Sentry) ---
// TODO: Install the chosen SDK: npm install --save @sentry/browser @sentry/react (or others)
// import * as Sentry from "@sentry/browser"; 
// import { BrowserTracing } from "@sentry/tracing"; // If using tracing

// TODO: Initialize the SDK early in your application lifecycle (e.g., index.tsx or App.tsx)
/*
if (process.env.NODE_ENV === 'production' && process.env.REACT_APP_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    integrations: [
      // new BrowserTracing(), // Example: Add performance tracing
      // Add other integrations as needed
    ],
    environment: process.env.NODE_ENV,
    release: process.env.REACT_APP_VERSION || 'unknown-release', // Use your app version
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 0.2, // Adjust as needed
  });
  console.log("Sentry SDK initialized for production.");
} else {
  console.log("Sentry SDK not initialized (not in production or DSN missing).");
}
*/
// --- End Monitoring Service Integration ---


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
 * Reports to console and integrates with monitoring service in production.
 */
export function reportError(error: EnhancedError, additionalContext?: Record<string, any>): void {
  const context = {
    ...(error.context || {}),
    ...(additionalContext || {})
  };
  
  // Always log to console for visibility during development/debugging
  console.error(
    `[${error.category.toUpperCase()}] ${error.name}: ${error.message}`,
    {
      timestamp: error.timestamp.toISOString(), // Use ISO string for consistency
      statusCode: error.statusCode,
      context,
      stack: error.stack // Include stack trace in console log
    }
  );
  
  // Report errors to monitoring services ONLY in production
  if (process.env.NODE_ENV === 'production') {
    try {
      // --- Actual Monitoring Service Call ---
      // TODO: Ensure the SDK (e.g., Sentry) is imported and initialized above.
      // TODO: Replace 'Sentry' with your actual SDK object if different.
      
      // Check if the SDK object and capture method exist (good practice)
      // if (typeof Sentry !== 'undefined' && typeof Sentry.captureException === 'function') {
        
        // Prepare context for the monitoring service
        const reportContext = {
          tags: { 
            category: error.category,
            statusCode: error.statusCode?.toString() // Tags usually need to be strings
          },
          extra: {
            timestamp: error.timestamp.toISOString(), 
            // Include original error details if present
            originalError: error.originalError ? { name: error.originalError.name, message: error.originalError.message } : undefined,
            ...context // Spread the combined context
          },
          // Optionally add user context if available and SDK supports it
          // user: { id: userId, email: userEmail } // Get user info from auth context/state
        };

        // Send the error to the monitoring service (Example: Sentry)
        // Sentry.captureException(error, reportContext); 
        
        console.log("SIMULATING: Error reported to monitoring service.", { error: error.message, context: reportContext }); 
        
      // } else {
      //   console.warn("Monitoring SDK (e.g., Sentry) not found or not initialized. Cannot report error.");
      // }
      // --- End Actual Monitoring Service Call ---

    } catch (monitoringError) {
      // Avoid infinite loop if monitoring service reporting itself fails
      console.error('CRITICAL: Error reporting to monitoring service failed:', monitoringError);
    }
  }
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
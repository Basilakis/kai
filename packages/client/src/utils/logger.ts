import { Logger as SharedLogger, LogLevel as SharedLogLevel, LoggerConfig as SharedLoggerConfig } from '@kai/shared/utils/logger';
import { EnhancedError, ErrorCategory, reportError } from './errorHandling';

export type { SharedLogLevel as LogLevel };

// Extended log entry with client-specific fields
export interface ClientLogEntry {
  tags?: string[];
  error?: Error;
  component?: string;
}

// Extended logger config with client-specific options
export interface ClientLoggerConfig extends SharedLoggerConfig {
  component?: string;
  defaultTags?: string[];
}

/**
 * Client-specific logger extending the shared implementation
 * with additional features for browser environment
 */
export class ClientLogger extends SharedLogger {
  protected component: string | undefined;
  protected defaultTags: string[] = [];
  protected currentConfig: SharedLoggerConfig;

  constructor(config?: Partial<ClientLoggerConfig>) {
    const loggerConfig = {
      minLevel: config?.minLevel || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      enableConsole: config?.enableConsole ?? true,
      environment: process.env.NODE_ENV as 'development' | 'production' | 'test'
    };
    
    super(loggerConfig);
    this.currentConfig = loggerConfig;
    this.component = config?.component;
    this.defaultTags = config?.defaultTags || [];
  }

  /**
   * Create a child logger with inherited settings plus additional context
   */
  createChild(component: string, defaultTags?: string[]): ClientLogger {
    const childConfig: Partial<ClientLoggerConfig> = {
      minLevel: this.currentConfig.minLevel,
      enableConsole: this.currentConfig.enableConsole ?? true,
      environment: this.currentConfig.environment || 'production',
      component,
      defaultTags: [...this.defaultTags, ...(defaultTags || [])]
    };

    return new ClientLogger(childConfig);
  }

  /**
   * Log at ERROR level with enhanced error handling
   */
  override error(message: string, error?: Error, context?: Record<string, any>, tags?: string[]): void {
    const enhancedContext = {
      ...context,
      component: this.component,
      tags: [...this.defaultTags, ...(tags || [])]
    };

    super.error(message, enhancedContext);

    // Additional error reporting for enhanced errors
    if (error && 'category' in error && 'timestamp' in error) {
      reportError(error as EnhancedError, context);
    }
  }

  /**
   * Log and throw an error
   */
  errorAndThrow(message: string, category: ErrorCategory, context?: Record<string, any>): never {
    const error = new Error(message) as EnhancedError;
    error.category = category;
    error.timestamp = new Date();
    error.context = context;
    
    this.error(message, error, context);
    throw error;
  }

  /**
   * Time an operation and log its duration
   */
  time<T>(
    operationName: string,
    operation: () => T,
    level: SharedLogLevel = 'debug'
  ): T {
    const start = performance.now();
    try {
      return operation();
    } finally {
      const duration = performance.now() - start;
      const message = `Operation "${operationName}" completed in ${duration.toFixed(2)}ms`;
      
      switch (level) {
        case 'debug':
          this.debug(message, { duration });
          break;
        case 'info':
          this.info(message, { duration });
          break;
        case 'warn':
          this.warn(message, { duration });
          break;
        case 'error':
          this.error(message, undefined, { duration });
          break;
      }
    }
  }

  /**
   * Time an async operation and log its duration
   */
  async timeAsync<T>(
    operationName: string,
    operation: () => Promise<T>,
    level: SharedLogLevel = 'debug'
  ): Promise<T> {
    const start = performance.now();
    try {
      return await operation();
    } finally {
      const duration = performance.now() - start;
      const message = `Async operation "${operationName}" completed in ${duration.toFixed(2)}ms`;
      
      switch (level) {
        case 'debug':
          this.debug(message, { duration });
          break;
        case 'info':
          this.info(message, { duration });
          break;
        case 'warn':
          this.warn(message, { duration });
          break;
        case 'error':
          this.error(message, undefined, { duration });
          break;
      }
    }
  }
}

// Create and export default logger instance
export const logger = new ClientLogger();

// Create component-specific loggers
export const apiLogger = logger.createChild('API');
export const authLogger = logger.createChild('Auth');
export const uiLogger = logger.createChild('UI');
export const wsLogger = logger.createChild('WebSocket');

/**
 * Usage examples:
 * 
 * // Basic usage
 * logger.info('User logged in', { userId: '123' });
 * logger.error('Failed to load data', new Error('API Error'), { endpoint: '/api/data' });
 * 
 * // Component-specific logger
 * const componentLogger = logger.createChild('UserProfile');
 * componentLogger.debug('Component mounted', { props });
 * 
 * // Performance timing
 * const result = logger.time('complexCalculation', () => {
 *   // expensive operation
 *   return calculateResult();
 * });
 * 
 * // Async timing
 * const data = await logger.timeAsync('fetchData', async () => {
 *   return await api.getData();
 * }, 'info');
 */
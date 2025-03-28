/**
 * Structured Logging System
 * 
 * Provides consistent log formatting, filtering, and handling across the application.
 * This makes debugging easier and enables potential integration with external logging services.
 */

import { EnhancedError, ErrorCategory, reportError } from './errorHandling';

// Log levels in order of severity
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  SILENT = 'silent'  // Special level to disable all logging
}

// Log entry structure for consistent formatting
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, any> | undefined;
  error?: Error | undefined;
  component?: string | undefined;
  tags?: string[] | undefined;
}

// Logger configuration
export interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  component?: string | undefined;
  defaultTags?: string[] | undefined;
  environment?: 'development' | 'test' | 'production' | undefined;
}

// Default config based on environment
const defaultConfig: LoggerConfig = {
  minLevel: (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') 
    ? LogLevel.INFO 
    : LogLevel.DEBUG,
  enableConsole: true,
  environment: typeof process !== 'undefined' ? process.env?.NODE_ENV as any : 'development'
};

/**
 * Logger class for structured logging
 */
export class Logger {
  private config: LoggerConfig;
  private handlers: Array<(entry: LogEntry) => void> = [];

  constructor(config?: Partial<LoggerConfig>) {
    this.config = { ...defaultConfig, ...config };
    
    // Add console logger by default if enabled
    if (this.config.enableConsole) {
      this.addHandler(this.consoleHandler);
    }
  }

  /**
   * Set minimum log level
   */
  setMinLevel(level: LogLevel): Logger {
    this.config.minLevel = level;
    return this;
  }

  /**
   * Create a child logger with inherited settings plus additional context
   */
  createChild(component: string, defaultTags?: string[]): Logger {
    const childConfig = { 
      ...this.config,
      component,
      defaultTags: [...(this.config.defaultTags || []), ...(defaultTags || [])]
    };
    
    const childLogger = new Logger(childConfig);
    
    // Add all parent handlers to child
    this.handlers.forEach(handler => {
      // Skip default console handler which is already added
      if (handler !== this.consoleHandler) {
        childLogger.addHandler(handler);
      }
    });
    
    return childLogger;
  }

  /**
   * Add a custom log handler
   */
  addHandler(handler: (entry: LogEntry) => void): Logger {
    this.handlers.push(handler);
    return this;
  }

  /**
   * Remove a custom log handler
   */
  removeHandler(handler: (entry: LogEntry) => void): Logger {
    this.handlers = this.handlers.filter(h => h !== handler);
    return this;
  }

  /**
   * Default console handler
   */
  private consoleHandler = (entry: LogEntry): void => {
    if (typeof console === 'undefined') return;
    
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase();
    const component = entry.component ? `[${entry.component}]` : '';
    const tags = entry.tags && entry.tags.length 
      ? `[${entry.tags.join(', ')}]` 
      : '';
    
    const logPrefix = `${timestamp} ${level} ${component} ${tags}`;
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(`${logPrefix} ${entry.message}`, entry.context || '');
        break;
      case LogLevel.INFO:
        console.info(`${logPrefix} ${entry.message}`, entry.context || '');
        break;
      case LogLevel.WARN:
        console.warn(`${logPrefix} ${entry.message}`, entry.context || '');
        break;
      case LogLevel.ERROR:
        console.error(`${logPrefix} ${entry.message}`, entry.context || '', entry.error || '');
        break;
      default:
        console.log(`${logPrefix} ${entry.message}`, entry.context || '');
    }
  };

  /**
   * Check if a given log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    if (this.config.minLevel === LogLevel.SILENT) return false;
    
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const configLevelIndex = levels.indexOf(this.config.minLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= configLevelIndex;
  }

  /**
   * Create a log entry
   */
  private createEntry(
    level: LogLevel, 
    message: string, 
    context?: Record<string, any>,
    error?: Error,
    tags?: string[]
  ): LogEntry {
    return {
      timestamp: new Date(),
      level,
      message,
      context,
      error,
      component: this.config.component,
      tags: [...(this.config.defaultTags || []), ...(tags || [])]
    };
  }

  /**
   * Process a log entry
   */
  private processEntry(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;
    
    // Execute all handlers
    this.handlers.forEach(handler => {
      try {
        handler(entry);
      } catch (err) {
        // Fallback to console if handler fails
        console.error('Logger: Handler failed', err);
      }
    });
  }

  /**
   * Log at DEBUG level
   */
  debug(message: string, context?: Record<string, any>, tags?: string[]): void {
    const entry = this.createEntry(LogLevel.DEBUG, message, context, undefined, tags);
    this.processEntry(entry);
  }

  /**
   * Log at INFO level
   */
  info(message: string, context?: Record<string, any>, tags?: string[]): void {
    const entry = this.createEntry(LogLevel.INFO, message, context, undefined, tags);
    this.processEntry(entry);
  }

  /**
   * Log at WARN level
   */
  warn(message: string, context?: Record<string, any>, tags?: string[]): void {
    const entry = this.createEntry(LogLevel.WARN, message, context, undefined, tags);
    this.processEntry(entry);
  }

  /**
   * Log at ERROR level
   */
  error(message: string, error?: Error, context?: Record<string, any>, tags?: string[]): void {
    const entry = this.createEntry(LogLevel.ERROR, message, context, error, tags);
    this.processEntry(entry);
    
    // If the error is an EnhancedError, also report it using our error reporting
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
    level: LogLevel = LogLevel.DEBUG
  ): T {
    const start = performance.now();
    try {
      return operation();
    } finally {
      const duration = performance.now() - start;
      const entry = this.createEntry(
        level, 
        `Operation "${operationName}" completed in ${duration.toFixed(2)}ms`,
        { duration }
      );
      this.processEntry(entry);
    }
  }
  
  /**
   * Time an async operation and log its duration
   */
  async timeAsync<T>(
    operationName: string, 
    operation: () => Promise<T>,
    level: LogLevel = LogLevel.DEBUG
  ): Promise<T> {
    const start = performance.now();
    try {
      return await operation();
    } finally {
      const duration = performance.now() - start;
      const entry = this.createEntry(
        level, 
        `Async operation "${operationName}" completed in ${duration.toFixed(2)}ms`,
        { duration }
      );
      this.processEntry(entry);
    }
  }
}

// Create and export a default logger instance
export const logger = new Logger();

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
 * }, LogLevel.INFO);
 * 
 * // Setting minimum level (e.g., in production)
 * if (process.env.NODE_ENV === 'production') {
 *   logger.setMinLevel(LogLevel.WARN);
 * }
 */
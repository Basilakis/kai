/**
 * Logger Utility
 * 
 * This utility provides a consistent logging interface for the application.
 * It wraps the console logging functions with additional features like
 * timestamps, log levels, and formatting.
 */

// Define log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Set the current log level based on environment
const currentLogLevel = (() => {
  const envLogLevel = process.env.LOG_LEVEL?.toLowerCase();
  
  if (envLogLevel === 'debug') return LogLevel.DEBUG;
  if (envLogLevel === 'info') return LogLevel.INFO;
  if (envLogLevel === 'warn') return LogLevel.WARN;
  if (envLogLevel === 'error') return LogLevel.ERROR;
  
  // Default to INFO in production, DEBUG in development
  return process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
})();

/**
 * Format a log message with timestamp and additional context
 * 
 * @param level Log level
 * @param message Message to log
 * @param meta Additional metadata
 * @returns Formatted log message
 */
function formatLogMessage(level: string, message: string, meta?: any): string {
  const timestamp = new Date().toISOString();
  let formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  if (meta) {
    try {
      const metaString = typeof meta === 'object' 
        ? JSON.stringify(meta, null, 2) 
        : meta.toString();
      formattedMessage += `\n${metaString}`;
    } catch (err) {
      formattedMessage += `\n[Error serializing metadata: ${err}]`;
    }
  }
  
  return formattedMessage;
}

/**
 * Logger interface
 */
export const logger = {
  /**
   * Log an error message
   * 
   * @param message Message to log
   * @param meta Additional metadata
   */
  error(message: string, meta?: any): void {
    if (currentLogLevel >= LogLevel.ERROR) {
      console.error(formatLogMessage('error', message, meta));
    }
  },
  
  /**
   * Log a warning message
   * 
   * @param message Message to log
   * @param meta Additional metadata
   */
  warn(message: string, meta?: any): void {
    if (currentLogLevel >= LogLevel.WARN) {
      console.warn(formatLogMessage('warn', message, meta));
    }
  },
  
  /**
   * Log an info message
   * 
   * @param message Message to log
   * @param meta Additional metadata
   */
  info(message: string, meta?: any): void {
    if (currentLogLevel >= LogLevel.INFO) {
      console.info(formatLogMessage('info', message, meta));
    }
  },
  
  /**
   * Log a debug message
   * 
   * @param message Message to log
   * @param meta Additional metadata
   */
  debug(message: string, meta?: any): void {
    if (currentLogLevel >= LogLevel.DEBUG) {
      console.debug(formatLogMessage('debug', message, meta));
    }
  },
  
  /**
   * Log a message with a custom level
   * 
   * @param level Log level
   * @param message Message to log
   * @param meta Additional metadata
   */
  log(level: string, message: string, meta?: any): void {
    console.log(formatLogMessage(level, message, meta));
  },
  
  /**
   * Create a child logger with additional context
   * 
   * @param context Context for the child logger
   * @returns Child logger
   */
  child(context: Record<string, any>): typeof logger {
    return {
      error: (message: string, meta?: any) => 
        logger.error(message, { ...context, ...meta }),
      warn: (message: string, meta?: any) => 
        logger.warn(message, { ...context, ...meta }),
      info: (message: string, meta?: any) => 
        logger.info(message, { ...context, ...meta }),
      debug: (message: string, meta?: any) => 
        logger.debug(message, { ...context, ...meta }),
      log: (level: string, message: string, meta?: any) => 
        logger.log(level, message, { ...context, ...meta }),
      child: (childContext: Record<string, any>) => 
        logger.child({ ...context, ...childContext })
    };
  }
};

/**
 * Create a logger for a specific module
 * 
 * @param moduleName Name of the module
 * @returns Module-specific logger
 */
export function createModuleLogger(moduleName: string): typeof logger {
  return logger.child({ module: moduleName });
}

export default logger;
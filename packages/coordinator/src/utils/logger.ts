import winston from 'winston';

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /**
   * Service name for identifying the log source
   */
  service: string;
  
  /**
   * Log level (error, warn, info, http, verbose, debug, silly)
   */
  level?: string;
  
  /**
   * Optional additional metadata to include with all logs
   */
  defaultMeta?: Record<string, any>;
}

/**
 * Creates a configured logger instance for services
 * @param options Logger configuration options
 * @returns Winston logger instance
 */
export function createLogger(options: LoggerOptions): winston.Logger {
  const { service, level = 'info', defaultMeta = {} } = options;
  
  // Create custom format that includes service name, timestamp, and request context
  const customFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf(({ level, message, timestamp, ...rest }) => {
      // Base log info
      const logInfo = {
        timestamp,
        level,
        service,
        message,
        ...defaultMeta,
        ...rest
      };
      
      // Convert to JSON string
      return JSON.stringify(logInfo);
    })
  );
  
  // Create logger with console transport
  const logger = winston.createLogger({
    level,
    format: customFormat,
    defaultMeta: { service },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, ...rest }) => {
            // Clean up the metadata for console output
            const meta = { ...rest };
            delete meta.service; // Already included in the prefix
            
            const metaStr = Object.keys(meta).length > 0 
              ? ` ${JSON.stringify(meta)}` 
              : '';
            
            return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
          })
        )
      })
    ]
  });
  
  // Add production settings when in production
  if (process.env.NODE_ENV === 'production') {
    // Add file transport for production
    logger.add(
      new winston.transports.File({ 
        filename: `logs/${service}.log`,
        maxsize: 10485760, // 10MB
        maxFiles: 5,
        tailable: true
      })
    );
  }
  
  return logger;
}

/**
 * Global logger instance for general use
 */
export const logger = createLogger({
  service: 'coordinator',
  level: process.env.LOG_LEVEL || 'info'
});

/**
 * Create a child logger for a specific context
 * @param context Context object to include with logs
 * @returns Child logger with context
 */
export function createContextLogger(context: Record<string, any>): winston.Logger {
  // Create a new logger with the context added to defaultMeta
  return createLogger({
    service: 'coordinator',
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: context
  });
}

/**
 * Error handler that logs errors and optionally wraps them
 * @param err The error to handle
 * @param message Optional message to include with the error
 * @param metadata Optional metadata to include with the log
 * @returns The original or wrapped error
 */
export function handleError(
  err: unknown, 
  message?: string, 
  metadata: Record<string, any> = {}
): Error {
  // Ensure we have an Error object
  const error = err instanceof Error ? err : new Error(String(err));
  
  // Add custom message if provided
  const logMessage = message ? `${message}: ${error.message}` : error.message;
  
  // Log the error
  logger.error(logMessage, {
    ...metadata,
    stack: error.stack
  });
  
  return error;
}
import { Logger } from '../../../shared/src/utils/logger';

/**
 * Interface for typed log metadata 
 * Replaces 'any' type with a more structured approach
 */
export interface LogMetadata {
  [key: string]: unknown;
}

/**
 * Environment configuration for the logger
 */
export type LogEnvironment = 'development' | 'production' | 'test';

/**
 * Valid log levels
 */
export type LogLevelType = 'debug' | 'info' | 'warn' | 'error';

/**
 * Type guard to check if a value is a valid metadata object
 */
function isLogMetadata(value: unknown): value is LogMetadata {
  return value !== null && typeof value === 'object';
}

/**
 * Safely converts an unknown value to a LogMetadata object
 * This prevents runtime errors when invalid metadata is provided
 * @param value - The value to convert to metadata
 * @returns A safe LogMetadata object
 */
function toSafeMetadata(value: unknown): LogMetadata {
  if (isLogMetadata(value)) {
    return value;
  }
  // If not a valid object, return an empty metadata object
  return {};
}

// Define log levels enum for backward compatibility
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

/**
 * Maps environment log level to shared logger level
 * @returns The appropriate log level based on environment variables
 */
function getLogLevel(): LogLevelType {
  const envLogLevel = process.env.LOG_LEVEL?.toLowerCase();
  
  if (envLogLevel === 'debug') return 'debug';
  if (envLogLevel === 'info') return 'info';
  if (envLogLevel === 'warn') return 'warn';
  if (envLogLevel === 'error') return 'error';
  
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

// Create server logger instance with environment-specific configuration
const serverLogger = new Logger({
  minLevel: getLogLevel(),
  environment: (process.env.NODE_ENV || 'development') as LogEnvironment,
  enableConsole: true
});

/**
 * Interface for child logger instance
 */
export interface ChildLogger {
  error: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  info: (message: string, meta?: unknown) => void;
  debug: (message: string, meta?: unknown) => void;
  log: (level: string, message: string, meta?: unknown) => void;
  child: (childContext: Record<string, unknown>) => ChildLogger;
}

/**
 * Interface for the main logger
 */
export interface AppLogger extends ChildLogger {
  createModuleLogger: (moduleName: string) => ChildLogger;
}

/**
 * Logger interface with improved type safety
 * - Replaces 'any' with specific LogMetadata type
 * - Uses type guards for safe type narrowing
 */
export const logger: AppLogger = {
  error: (message: string, meta?: unknown): void => 
    serverLogger.error(message, toSafeMetadata(meta)),
  
  warn: (message: string, meta?: unknown): void => 
    serverLogger.warn(message, toSafeMetadata(meta)),
  
  info: (message: string, meta?: unknown): void => 
    serverLogger.info(message, toSafeMetadata(meta)),
  
  debug: (message: string, meta?: unknown): void => 
    serverLogger.debug(message, toSafeMetadata(meta)),
    
  log: (level: string, message: string, meta?: unknown): void => {
    const safeMeta = toSafeMetadata(meta);
    switch (level.toLowerCase()) {
      case 'error': return serverLogger.error(message, safeMeta);
      case 'warn': return serverLogger.warn(message, safeMeta);
      case 'info': return serverLogger.info(message, safeMeta);
      case 'debug': return serverLogger.debug(message, safeMeta);
      default: return serverLogger.info(message, safeMeta);
    }
  },
  
  child: (context: Record<string, unknown>): ChildLogger => {
    const childLogger = serverLogger.child(Object.keys(context).join('.'));
    const childLoggerInstance: ChildLogger = {
      error: (message: string, meta?: unknown): void => 
        childLogger.error(message, { ...context, ...toSafeMetadata(meta) }),
        
      warn: (message: string, meta?: unknown): void => 
        childLogger.warn(message, { ...context, ...toSafeMetadata(meta) }),
        
      info: (message: string, meta?: unknown): void => 
        childLogger.info(message, { ...context, ...toSafeMetadata(meta) }),
        
      debug: (message: string, meta?: unknown): void => 
        childLogger.debug(message, { ...context, ...toSafeMetadata(meta) }),
        
      log: (level: string, message: string, meta?: unknown): void => {
        const safeMeta = toSafeMetadata(meta);
        switch (level.toLowerCase()) {
          case 'error': return childLogger.error(message, { ...context, ...safeMeta });
          case 'warn': return childLogger.warn(message, { ...context, ...safeMeta });
          case 'info': return childLogger.info(message, { ...context, ...safeMeta });
          case 'debug': return childLogger.debug(message, { ...context, ...safeMeta });
          default: return childLogger.info(message, { ...context, ...safeMeta });
        }
      },
      
      child: (childContext: Record<string, unknown>): ChildLogger => 
        logger.child({ ...context, ...childContext })
    };
    
    return childLoggerInstance;
  },
  
  createModuleLogger: (moduleName: string): ChildLogger => 
    logger.child({ module: moduleName })
};
export default logger;
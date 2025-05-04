/**
 * ML Package Logger
 * 
 * Provides logging functionality for the ML package.
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Define log levels
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// Define logger configuration
export interface LoggerConfig {
  minLevel?: LogLevel;
  enableConsole?: boolean;
  enableFileLogging?: boolean;
  logDirectory?: string;
  maxLogSize?: number;
  maxLogFiles?: number;
}

// Default configuration
const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  enableConsole: true,
  enableFileLogging: process.env.NODE_ENV === 'production',
  logDirectory: path.join(process.cwd(), 'logs'),
  maxLogSize: 10 * 1024 * 1024, // 10MB
  maxLogFiles: 5
};

// Create logs directory if it doesn't exist
if (DEFAULT_CONFIG.enableFileLogging && DEFAULT_CONFIG.logDirectory) {
  try {
    if (!fs.existsSync(DEFAULT_CONFIG.logDirectory)) {
      fs.mkdirSync(DEFAULT_CONFIG.logDirectory, { recursive: true });
    }
  } catch (err) {
    console.error('Failed to create log directory:', err);
  }
}

// Create Winston logger
const winstonLogger = winston.createLogger({
  level: DEFAULT_CONFIG.minLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ml-service' },
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
          
          return `${timestamp} [ml-service] ${level}: ${message}${metaStr}`;
        })
      ),
      silent: !DEFAULT_CONFIG.enableConsole
    })
  ]
});

// Add file transport if enabled
if (DEFAULT_CONFIG.enableFileLogging && DEFAULT_CONFIG.logDirectory) {
  winstonLogger.add(
    new winston.transports.File({ 
      filename: path.join(DEFAULT_CONFIG.logDirectory, 'ml-service.log'),
      maxsize: DEFAULT_CONFIG.maxLogSize || 10 * 1024 * 1024,
      maxFiles: DEFAULT_CONFIG.maxLogFiles || 5,
      tailable: true
    })
  );
  
  winstonLogger.add(
    new winston.transports.File({ 
      filename: path.join(DEFAULT_CONFIG.logDirectory, 'ml-service-error.log'),
      level: 'error',
      maxsize: DEFAULT_CONFIG.maxLogSize || 10 * 1024 * 1024,
      maxFiles: DEFAULT_CONFIG.maxLogFiles || 5
    })
  );
}

/**
 * Logger interface for ML package
 */
export const logger = {
  error: (message: string, meta?: any): void => {
    winstonLogger.error(message, meta);
  },
  
  warn: (message: string, meta?: any): void => {
    winstonLogger.warn(message, meta);
  },
  
  info: (message: string, meta?: any): void => {
    winstonLogger.info(message, meta);
  },
  
  debug: (message: string, meta?: any): void => {
    winstonLogger.debug(message, meta);
  },
  
  /**
   * Create a child logger with additional context
   */
  child: (context: Record<string, any>): typeof logger => {
    const childLogger = winstonLogger.child(context);
    
    return {
      error: (message: string, meta?: any): void => {
        childLogger.error(message, meta);
      },
      
      warn: (message: string, meta?: any): void => {
        childLogger.warn(message, meta);
      },
      
      info: (message: string, meta?: any): void => {
        childLogger.info(message, meta);
      },
      
      debug: (message: string, meta?: any): void => {
        childLogger.debug(message, meta);
      },
      
      child: (nestedContext: Record<string, any>): typeof logger => {
        return logger.child({ ...context, ...nestedContext });
      }
    };
  }
};

export default logger;

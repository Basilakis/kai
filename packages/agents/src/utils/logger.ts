/**
 * Logger Utility
 * 
 * Provides a consistent logging interface for agent operations
 * with configurable log levels, file output, and formatting.
 */

import winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

// Define logger interfaces for better type safety
interface LoggerOptions {
  level?: string;
  filePath?: string;
  silent?: boolean;
  consoleOutput?: boolean;
}

interface AgentActivity {
  action: string;
  status: 'start' | 'success' | 'error';
  details?: Record<string, any>;
  error?: Error;
}

interface ToolExecution {
  status: 'start' | 'success' | 'error';
  input?: Record<string, any>;
  output?: any;
  error?: Error;
  duration?: number;
}

// Ensure logs directory exists
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Default log file path
const DEFAULT_LOG_FILE = path.join(LOG_DIR, 'agent.log');

// Default log level (can be overridden by environment variable)
const DEFAULT_LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.splat(),
  winston.format.json()
);

// Console format (more human-readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, service, ...rest }) => {
    const restString = Object.keys(rest).length ? 
      '\n' + JSON.stringify(rest, null, 2) : '';
      
    return `[${timestamp}] ${level} ${service ? `[${service}]` : ''}: ${message}${restString}`;
  })
);

// Create the default logger
const defaultLogger = winston.createLogger({
  level: DEFAULT_LOG_LEVEL,
  format: logFormat,
  defaultMeta: { service: 'agent-system' },
  transports: [
    // Write to console
    new winston.transports.Console({
      format: consoleFormat
    }),
    // Write to log file
    new winston.transports.File({
      filename: DEFAULT_LOG_FILE,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
    // Write errors to separate file
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  ]
});

/**
 * Create a logger for a specific service or component
 */
export function createLogger(service: string): winston.Logger {
  return defaultLogger.child({ service }) as winston.Logger;
}

/**
 * Configure the logger with custom settings
 */
export function configureLogger(options: LoggerOptions): void {
  // Update log level if specified
  if (options.level) {
    defaultLogger.level = options.level;
  }
  
  // Update file path if specified
  if (options.filePath) {
    const fileTransport = new winston.transports.File({
      filename: options.filePath,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    });
    
    // Remove existing file transports
    const transports = defaultLogger.transports as winston.transport[];
    defaultLogger.configure({
      transports: transports.filter(
        transport => !(transport instanceof winston.transports.File)
      )
    });
    
    // Add new file transport
    defaultLogger.add(fileTransport);
    
    // Add error log transport
    const errorFilePath = options.filePath.replace(/\.log$/, '-error.log');
    defaultLogger.add(new winston.transports.File({
      filename: errorFilePath,
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    }));
  }
  
  // Set silent mode if specified
  if (options.silent !== undefined) {
    defaultLogger.silent = options.silent;
  }
  
  // Enable/disable console output if specified
  if (options.consoleOutput !== undefined) {
    if (!options.consoleOutput) {
      // Remove console transport
      const transports = defaultLogger.transports as winston.transport[];
      defaultLogger.configure({
        transports: transports.filter(
          transport => !(transport instanceof winston.transports.Console)
        )
      });
    } else {
      // Check if console transport exists
      const transports = defaultLogger.transports as winston.transport[];
      const hasConsole = transports.some(t => t instanceof winston.transports.Console);
      
      if (!hasConsole) {
        // Add console transport if it doesn't exist
        defaultLogger.add(new winston.transports.Console({
          format: consoleFormat
        }));
      }
    }
  }
}

/**
 * Log agent activity
 */
export function logAgentActivity(agentId: string, activity: AgentActivity): void {
  const logger = createLogger(`Agent:${agentId}`);
  
  const { action, status, details, error } = activity;
  
  switch (status) {
    case 'start':
      logger.info(`Starting ${action}`, { details });
      break;
    case 'success':
      logger.info(`Successfully completed ${action}`, { details });
      break;
    case 'error':
      logger.error(`Error in ${action}`, { 
        details, 
        error: error?.message,
        stack: error?.stack
      });
      break;
    default:
      logger.info(`${action} - ${status}`, { details });
  }
}

/**
 * Log tool execution
 */
export function logToolExecution(agentId: string, toolName: string, execution: ToolExecution): void {
  const logger = createLogger(`Agent:${agentId}:Tool:${toolName}`);
  
  const { status, input, output, error, duration } = execution;
  
  switch (status) {
    case 'start':
      logger.debug(`Executing tool`, { input });
      break;
    case 'success':
      logger.debug(`Tool execution successful`, { 
        input, 
        output: typeof output === 'string' && output.length > 1000 
          ? `${output.substring(0, 1000)}... [truncated]` 
          : output,
        duration
      });
      break;
    case 'error':
      logger.error(`Tool execution failed`, { 
        input, 
        error: error?.message,
        stack: error?.stack,
        duration
      });
      break;
  }
}

export default {
  createLogger,
  configureLogger,
  logAgentActivity,
  logToolExecution
};
/**
 * Logger Utility
 * 
 * Provides a consistent logging interface for agent operations
 * with configurable log levels, file output, and formatting.
 * Integrated with analytics service to track agent activities.
 */

import { Logger as SharedLogger, LogLevel } from '@kai/shared/utils/logger';
import * as path from 'path';
import * as process from 'process';
import * as fs from 'fs';
import winston from 'winston';
import type { Logger as WinstonLogger } from 'winston';
import { analyticsService, AnalyticsSourceType } from '../services/analyticsService';

// Define internal types for Winston transports
type WinstonTransport = {
  filename?: string;
  level?: string;
  [key: string]: any;
};

// Define logger interfaces for better type safety
export interface AgentLoggerOptions {
  level?: LogLevel;
  filePath?: string;
  silent?: boolean;
  consoleOutput?: boolean;
  service?: string;
}

export interface AgentActivity {
  action: string;
  status: 'start' | 'success' | 'error';
  details?: Record<string, any>;
  error?: Error;
}

export interface ToolExecution {
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

/**
 * Agent-specific logger extending the shared implementation
 * with additional features for agent operations
 */
export class AgentLogger extends SharedLogger {
  protected fileLogger: WinstonLogger;
  protected service: string;

  constructor(options: AgentLoggerOptions = {}) {
    const loggerConfig = {
      minLevel: options.level || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      enableConsole: options.consoleOutput ?? true,
      environment: process.env.NODE_ENV as 'development' | 'production' | 'test'
    };

    super(loggerConfig);
    this.service = options.service || 'agent-system';

    // Initialize Winston logger for file logging
    this.fileLogger = winston.createLogger({
      level: options.level || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
      ),
      defaultMeta: { service: this.service },
      silent: options.silent,
      transports: [
        new winston.transports.File({
          filename: options.filePath || DEFAULT_LOG_FILE,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true,
        }),
        new winston.transports.File({
          filename: path.join(LOG_DIR, 'error.log'),
          level: 'error',
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5
        })
      ]
    });
  }

  override debug(message: string, context?: Record<string, any>): void {
    super.debug(message, context);
    this.fileLogger.debug(message, context);
  }

  override info(message: string, context?: Record<string, any>): void {
    super.info(message, context);
    this.fileLogger.info(message, context);
  }

  override warn(message: string, context?: Record<string, any>): void {
    super.warn(message, context);
    this.fileLogger.warn(message, context);
  }

  override error(message: string, context?: Record<string, any>): void {
    super.error(message, context);
    this.fileLogger.error(message, context);
  }

  /**
   * Create a child logger with inherited settings plus additional context
   */
  createChildLogger(service: string): AgentLogger {
    const winstonLogger = this.fileLogger as unknown as { transports: WinstonTransport[] };
    const fileTransport = winstonLogger.transports.find(
      transport => transport instanceof winston.transports.File
    );
    
    return new AgentLogger({
      level: this.getLogLevel(),
      consoleOutput: true,
      service: `${this.service}:${service}`,
      filePath: fileTransport?.filename || DEFAULT_LOG_FILE
    });
  }

  /**
   * Get current log level
   */
  private getLogLevel(): LogLevel {
    return this.fileLogger.level as LogLevel;
  }

  /**
   * Configure logger settings
   */
  public configureLogger(options: AgentLoggerOptions): void {
    const wLogger = this.fileLogger as unknown as {
      clear(): void;
      add(transport: WinstonTransport): WinstonLogger;
      level: string;
      silent?: boolean;
    };

    if (wLogger) {
      wLogger.clear();
      
      if (options.filePath) {
        wLogger.add(new winston.transports.File({
          filename: options.filePath,
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5,
          tailable: true,
        }));

        wLogger.add(new winston.transports.File({
          filename: options.filePath.replace(/\.log$/, '-error.log'),
          level: 'error',
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5
        }));
      }

      if (options.level) {
        wLogger.level = options.level;
      }

      if (options.silent !== undefined) {
        wLogger.silent = options.silent;
      }
    }
  }

  /**
   * Log agent activity
   */
  public logActivity({ action, status, details, error }: AgentActivity): void {
    switch (status) {
      case 'start':
        this.info(`Starting ${action}`, details);
        break;
      case 'success':
        this.info(`Successfully completed ${action}`, details);
        break;
      case 'error':
        this.error(`Error in ${action}`, { ...details, error: error?.message, stack: error?.stack });
        break;
    }
  }

  /**
   * Log tool execution
   */
  public logToolExecution(toolName: string, { status, input, output, error, duration }: ToolExecution): void {
    const context = {
      tool: toolName,
      input,
      duration,
      ...(output && {
        output: typeof output === 'string' && output.length > 1000 
          ? `${output.substring(0, 1000)}... [truncated]` 
          : output
      })
    };
    
    switch (status) {
      case 'start':
        this.debug(`Executing tool ${toolName}`, context);
        break;
      case 'success':
        this.debug(`Tool ${toolName} execution successful`, context);
        break;
      case 'error':
        this.error(`Tool ${toolName} execution failed`, { ...context, error: error?.message, stack: error?.stack });
        break;
    }
  }
}

// Create default logger instance
const defaultLogger = new AgentLogger();

/**
 * Create a logger for a specific service or component
 */
export function createLogger(service: string): AgentLogger {
  return defaultLogger.createChildLogger(service);
}

/**
 * Configure the logger with custom settings
 */
export function configureLogger(options: AgentLoggerOptions): void {
  defaultLogger.configureLogger(options);
}

/**
 * Helper functions for common logging patterns
 */
export function logAgentActivity(agentId: string, activity: AgentActivity): void {
  const logger = createLogger(`Agent:${agentId}`);
  logger.logActivity(activity);
  
  // Also track in analytics service
  try {
    // Extract agent type from agentId or details
    const agentType = activity.details?.type || 'unknown';
    
    // Track the agent activity in analytics
    analyticsService.trackCrewAIAgentActivity(
      agentId,
      agentType,
      activity.action,
      activity.status,
      {
        ...activity.details,
        error: activity.error ? activity.error.message : undefined
      }
    ).catch((err: unknown) => {
      logger.error(`Failed to track agent activity in analytics: ${err instanceof Error ? err.message : String(err)}`);
    });
  } catch (err: unknown) {
    logger.error(`Error tracking agent activity in analytics: ${err instanceof Error ? err.message : String(err)}`);
    // Don't break agent operations if analytics tracking fails
  }
}

export function logToolExecution(agentId: string, toolName: string, execution: ToolExecution): void {
  const logger = createLogger(`Agent:${agentId}`);
  logger.logToolExecution(toolName, execution);
  
  // Also track tool executions in analytics for agent performance analysis
  try {
    if (execution.status === 'success' || execution.status === 'error') {
      analyticsService.trackCrewAIAgentActivity(
        agentId,
        'tool-execution',
        `tool:${toolName}`,
        execution.status,
        {
          input: execution.input,
          output: typeof execution.output === 'string' ? 
            (execution.output.length > 1000 ? `${execution.output.substring(0, 1000)}... [truncated]` : execution.output) : 
            'complex-output',
          error: execution.error ? execution.error.message : undefined,
          duration: execution.duration
        }
      ).catch((err: unknown) => {
        logger.error(`Failed to track tool execution in analytics: ${err instanceof Error ? err.message : String(err)}`);
      });
    }
  } catch (err: unknown) {
    logger.error(`Error tracking tool execution in analytics: ${err instanceof Error ? err.message : String(err)}`);
    // Don't break tool operations if analytics tracking fails
  }
}

export default {
  createLogger,
  configureLogger,
  logAgentActivity,
  logToolExecution
} as const;
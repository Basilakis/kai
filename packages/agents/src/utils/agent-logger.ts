/**
 * Agent-Specific Logger
 * 
 * Extends the unified logger with agent-specific functionality
 * such as agent activity tracking and tool execution logging.
 */

import { 
  UnifiedLogger,
  LoggerConfig,
  LogLevel
} from '../../../shared/src/utils/unified-logger';
import { analyticsService, AnalyticsSourceType } from '../services/analyticsService';

/**
 * Agent-specific logger options extending the base logger config
 */
export interface AgentLoggerOptions extends LoggerConfig {
  service?: string;
  trackInAnalytics?: boolean;
}

/**
 * Agent activity information for logging
 */
export interface AgentActivity {
  action: string;
  status: 'start' | 'success' | 'error';
  details?: Record<string, any>;
  error?: Error;
}

/**
 * Tool execution information for logging
 */
export interface ToolExecution {
  status: 'start' | 'success' | 'error';
  input?: Record<string, any>;
  output?: any;
  error?: Error;
  duration?: number;
}

/**
 * Agent-specific logger that extends the unified logger base
 * with specialized functionality for agent operations
 */
export class AgentLogger extends UnifiedLogger {
  private service: string;
  private trackInAnalytics: boolean;

  constructor(options: AgentLoggerOptions = { minLevel: 'info' }) {
    // Initialize the base logger
    super({
      minLevel: options.minLevel || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      enableConsole: options.enableConsole ?? true,
      environment: process.env.NODE_ENV as 'development' | 'production' | 'test',
      logDirectory: options.logDirectory,
      maxLogSize: options.maxLogSize,
      maxLogFiles: options.maxLogFiles,
      enableFileLogging: options.enableFileLogging
    });
    
    this.service = options.service || 'agent-system';
    this.trackInAnalytics = options.trackInAnalytics ?? true;
    
    // Update module for better context
    this.module = this.service;
  }

  /**
   * Create a child logger with inherited settings plus additional context
   */
  public createChildLogger(service: string): AgentLogger {
    return new AgentLogger({
      ...this.config,
      service: `${this.service}:${service}`,
      trackInAnalytics: this.trackInAnalytics
    });
  }

  /**
   * Configure logger settings
   */
  public configureLogger(options: AgentLoggerOptions): void {
    // Update base logger config
    this.config = {
      ...this.config,
      minLevel: options.minLevel || this.config.minLevel,
      enableConsole: options.enableConsole ?? this.config.enableConsole,
      environment: options.environment || this.config.environment,
      logDirectory: options.logDirectory || this.config.logDirectory,
      maxLogSize: options.maxLogSize || this.config.maxLogSize,
      maxLogFiles: options.maxLogFiles || this.config.maxLogFiles,
      enableFileLogging: options.enableFileLogging ?? this.config.enableFileLogging
    };
    
    // Update agent-specific settings
    if (options.service) {
      this.service = options.service;
      this.module = options.service;
    }
    
    if (options.trackInAnalytics !== undefined) {
      this.trackInAnalytics = options.trackInAnalytics;
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
    
    // Track in analytics if enabled
    if (this.trackInAnalytics) {
      this.trackActivityInAnalytics(this.service, action, status, details, error);
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
    
    // Track in analytics if enabled and not a start event
    if (this.trackInAnalytics && status !== 'start') {
      this.trackToolExecutionInAnalytics(this.service, toolName, status, context, error);
    }
  }
  
  /**
   * Track agent activity in analytics service
   * @private
   */
  private trackActivityInAnalytics(
    service: string,
    action: string,
    status: string,
    details?: Record<string, any>,
    error?: Error
  ): void {
    try {
      // Extract agent type from service or details
      const agentType = details?.type || service.split(':')[0] || 'unknown';
      
      // Track the agent activity in analytics
      analyticsService.trackCrewAIAgentActivity(
        service,
        agentType,
        action,
        status as any,
        {
          ...details,
          error: error ? error.message : undefined
        }
      ).catch((err: unknown) => {
        this.error(`Failed to track agent activity in analytics: ${err instanceof Error ? err.message : String(err)}`);
      });
    } catch (err: unknown) {
      this.error(`Error tracking agent activity in analytics: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  
  /**
   * Track tool execution in analytics service
   * @private
   */
  private trackToolExecutionInAnalytics(
    service: string,
    toolName: string,
    status: string,
    context?: Record<string, any>,
    error?: Error
  ): void {
    try {
      analyticsService.trackCrewAIAgentActivity(
        service,
        'tool-execution',
        `tool:${toolName}`,
        status as any,
        {
          ...context,
          error: error ? error.message : undefined
        }
      ).catch((err: unknown) => {
        this.error(`Failed to track tool execution in analytics: ${err instanceof Error ? err.message : String(err)}`);
      });
    } catch (err: unknown) {
      this.error(`Error tracking tool execution in analytics: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// Create default logger instance
const defaultAgentLogger = new AgentLogger();

/**
 * Create a logger for a specific service or component
 */
export function createLogger(service: string): AgentLogger {
  return defaultAgentLogger.createChildLogger(service);
}

/**
 * Configure the logger with custom settings
 */
export function configureLogger(options: AgentLoggerOptions): void {
  defaultAgentLogger.configureLogger(options);
}

/**
 * Helper functions for common logging patterns
 */
export function logAgentActivity(agentId: string, activity: AgentActivity): void {
  const logger = createLogger(`Agent:${agentId}`);
  logger.logActivity(activity);
}

export function logToolExecution(agentId: string, toolName: string, execution: ToolExecution): void {
  const logger = createLogger(`Agent:${agentId}`);
  logger.logToolExecution(toolName, execution);
}

export default {
  createLogger,
  configureLogger,
  logAgentActivity,
  logToolExecution
} as const;
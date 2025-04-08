/**
 * Agent System Error Handling
 * 
 * Provides specialized error types and utilities for consistent error handling
 * across the agent system components.
 */

import { createLogger } from '../utils/logger';

// Create a dedicated logger for error handling
const logger = createLogger('AgentErrors');

/**
 * Base error class for all agent system errors
 */
export class AgentSystemError extends Error {
  public readonly code: string;
  public data?: Record<string, any>; // Removed readonly to allow updates in error handler
  public readonly timestamp: number;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';

  constructor(
    message: string,
    options: {
      code?: string;
      data?: Record<string, any>;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      cause?: Error;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = this.constructor.name;
    this.code = options.code || 'AGENT_SYSTEM_ERROR';
    this.data = options.data;
    this.timestamp = Date.now();
    this.severity = options.severity || 'medium';
    
    // Capture stack trace - using type assertion for Node.js V8 engine
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get a structured representation of the error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      data: this.data,
      timestamp: this.timestamp,
      severity: this.severity,
      stack: this.stack
    };
  }
}

/**
 * Error thrown when agent initialization fails
 */
export class AgentInitializationError extends AgentSystemError {
  constructor(
    message: string,
    options: {
      agentId?: string;
      agentType?: string;
      data?: Record<string, any>;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      cause?: Error;
    } = {}
  ) {
    super(message, {
      code: 'AGENT_INITIALIZATION_FAILED',
      data: {
        agentId: options.agentId,
        agentType: options.agentType,
        ...options.data
      },
      severity: options.severity || 'high',
      cause: options.cause
    });
  }
}

/**
 * Error thrown when task execution fails
 */
export class TaskExecutionError extends AgentSystemError {
  constructor(
    message: string,
    options: {
      taskId?: string;
      agentId?: string;
      taskDescription?: string;
      data?: Record<string, any>;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      cause?: Error;
    } = {}
  ) {
    super(message, {
      code: 'TASK_EXECUTION_FAILED',
      data: {
        taskId: options.taskId,
        agentId: options.agentId,
        taskDescription: options.taskDescription,
        ...options.data
      },
      severity: options.severity || 'medium',
      cause: options.cause
    });
  }
}

/**
 * Error thrown when a service connection fails
 */
export class ServiceConnectionError extends AgentSystemError {
  constructor(
    serviceName: string,
    operation: string,
    options: {
      data?: Record<string, any>;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      cause?: Error;
    } = {}
  ) {
    super(
      `Failed to connect to service ${serviceName} during ${operation}`,
      {
        code: 'SERVICE_CONNECTION_FAILED',
        data: {
          serviceName,
          operation,
          ...options.data
        },
        severity: options.severity || 'high',
        cause: options.cause
      }
    );
  }
}

/**
 * Error thrown when a resource is not found
 */
export class ResourceNotFoundError extends AgentSystemError {
  constructor(
    resourceType: string,
    resourceId: string,
    options: {
      data?: Record<string, any>;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      cause?: Error;
    } = {}
  ) {
    super(
      `Resource not found: ${resourceType} with ID ${resourceId}`,
      {
        code: 'RESOURCE_NOT_FOUND',
        data: {
          resourceType,
          resourceId,
          ...options.data
        },
        severity: options.severity || 'medium',
        cause: options.cause
      }
    );
  }
}

/**
 * Error thrown when a task times out
 */
export class TaskTimeoutError extends AgentSystemError {
  constructor(
    taskId: string,
    timeoutMs: number,
    options: {
      agentId?: string;
      data?: Record<string, any>;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      cause?: Error;
    } = {}
  ) {
    super(
      `Task ${taskId} timed out after ${timeoutMs}ms`,
      {
        code: 'TASK_TIMEOUT',
        data: {
          taskId,
          timeoutMs,
          agentId: options.agentId,
          ...options.data
        },
        severity: options.severity || 'high',
        cause: options.cause
      }
    );
  }
}

/**
 * Error thrown when a validation fails
 */
export class ValidationError extends AgentSystemError {
  constructor(
    message: string,
    options: {
      validationErrors?: Record<string, string>;
      data?: Record<string, any>;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      cause?: Error;
    } = {}
  ) {
    super(message, {
      code: 'VALIDATION_FAILED',
      data: {
        validationErrors: options.validationErrors,
        ...options.data
      },
      severity: options.severity || 'medium',
      cause: options.cause
    });
  }
}

/**
 * Error thrown when a resource is exhausted (e.g., rate limit reached)
 */
export class ResourceExhaustedError extends AgentSystemError {
  constructor(
    resource: string,
    options: {
      limit?: number;
      resetTime?: number;
      data?: Record<string, any>;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      cause?: Error;
    } = {}
  ) {
    super(
      `Resource exhausted: ${resource}${options.limit ? ` (limit: ${options.limit})` : ''}`,
      {
        code: 'RESOURCE_EXHAUSTED',
        data: {
          resource,
          limit: options.limit,
          resetTime: options.resetTime,
          ...options.data
        },
        severity: options.severity || 'high',
        cause: options.cause
      }
    );
  }
}

/**
 * A utility class for handling errors consistently
 */
export class ErrorHandler {
  /**
   * Handles an error by converting it to an appropriate agent system error type
   * and logging it based on severity
   */
  static handleError(error: unknown, context?: Record<string, any>): AgentSystemError {
    // If it's already an AgentSystemError, just add context if provided
    if (error instanceof AgentSystemError) {
      if (context) {
        error.data = { ...error.data, ...context };
      }
      
      // Log based on severity
      this.logError(error);
      
      return error;
    }
    
    // Convert to string for pattern matching
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Try to determine the appropriate error type based on the message
    let agentError: AgentSystemError;
    
    // Extract resource type and ID if this is a not found error
    const notFoundMatch = errorMessage.match(/([A-Za-z]+) with ID ([A-Za-z0-9_-]+) not found/i);
    if (notFoundMatch) {
      const resourceType = notFoundMatch[1] || 'Resource';
      const resourceId = notFoundMatch[2] || 'unknown';
      agentError = new ResourceNotFoundError(resourceType, resourceId, { 
        cause: error instanceof Error ? error : undefined,
        data: context
      });
    }
    // Check for timeout errors
    else if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
      agentError = new TaskTimeoutError('unknown', 0, {
        cause: error instanceof Error ? error : undefined,
        data: context
      });
    }
    // Check for service connection errors
    else if (
      errorMessage.includes('connection') || 
      errorMessage.includes('network') ||
      errorMessage.includes('unreachable')
    ) {
      agentError = new ServiceConnectionError('unknown', 'unknown', {
        cause: error instanceof Error ? error : undefined,
        data: context
      });
    }
    // Default to generic error
    else {
      agentError = new AgentSystemError(errorMessage, {
        cause: error instanceof Error ? error : undefined,
        data: context
      });
    }
    
    // Log the error based on severity
    this.logError(agentError);
    
    return agentError;
  }
  
  /**
   * Log an error based on its severity
   */
  private static logError(error: AgentSystemError): void {
    const errorData = {
      code: error.code,
      data: error.data,
      timestamp: error.timestamp,
      stack: error.stack
    };
    
    switch (error.severity) {
      case 'critical':
        logger.error(`CRITICAL: ${error.message}`, errorData);
        break;
      case 'high':
        logger.error(`${error.message}`, errorData);
        break;
      case 'medium':
        logger.warn(`${error.message}`, errorData);
        break;
      case 'low':
        logger.info(`${error.message}`, errorData);
        break;
      default:
        logger.warn(`${error.message}`, errorData);
    }
  }
  
  /**
   * Wraps an async function with consistent error handling
   */
  static async withErrorHandling<T>(
    fn: () => Promise<T>, 
    context?: Record<string, any>
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw this.handleError(error, context);
    }
  }
}

export default ErrorHandler;
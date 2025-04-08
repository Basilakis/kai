/**
 * Knowledge Base Error Classes
 * 
 * Provides specialized error types for knowledge base operations
 * to improve error handling, debugging, and user feedback.
 */

/**
 * Base error class for all knowledge base errors
 */
export class KnowledgeBaseError extends Error {
  /** HTTP status code to use when responding to client */
  public statusCode: number;
  
  /** Error code for client-side error handling */
  public errorCode: string;
  
  /** Additional context for debugging */
  public context?: Record<string, any>;

  constructor(
    message: string, 
    statusCode = 500, 
    errorCode = 'KNOWLEDGE_BASE_ERROR',
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.context = context;
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, KnowledgeBaseError.prototype);
  }
}

/**
 * Error for when a requested entity is not found
 */
export class NotFoundError extends KnowledgeBaseError {
  constructor(
    entity: string, 
    id: string, 
    context?: Record<string, any>
  ) {
    super(
      `${entity} not found: ${id}`, 
      404, 
      'ENTITY_NOT_FOUND',
      { entity, id, ...context }
    );
    
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends KnowledgeBaseError {
  constructor(
    message: string, 
    field?: string, 
    context?: Record<string, any>
  ) {
    super(
      message, 
      400, 
      'VALIDATION_ERROR',
      { field, ...context }
    );
    
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error for permission/authorization issues
 */
export class PermissionError extends KnowledgeBaseError {
  constructor(
    message: string, 
    userId?: string, 
    action?: string,
    resource?: string,
    context?: Record<string, any>
  ) {
    super(
      message, 
      403, 
      'PERMISSION_DENIED',
      { userId, action, resource, ...context }
    );
    
    Object.setPrototypeOf(this, PermissionError.prototype);
  }
}

/**
 * Error for indexing operation failures
 */
export class IndexingError extends KnowledgeBaseError {
  constructor(
    message: string, 
    indexId?: string,
    operation?: string,
    context?: Record<string, any>
  ) {
    super(
      message, 
      500, 
      'INDEXING_ERROR',
      { indexId, operation, ...context }
    );
    
    Object.setPrototypeOf(this, IndexingError.prototype);
  }
}

/**
 * Error for duplicate entity issues
 */
export class DuplicateError extends KnowledgeBaseError {
  constructor(
    entity: string,
    field: string,
    value: string,
    context?: Record<string, any>
  ) {
    super(
      `Duplicate ${entity} found with ${field}: ${value}`, 
      409, 
      'DUPLICATE_ENTITY',
      { entity, field, value, ...context }
    );
    
    Object.setPrototypeOf(this, DuplicateError.prototype);
  }
}

/**
 * Error for external service failures
 */
export class ExternalServiceError extends KnowledgeBaseError {
  constructor(
    service: string,
    operation: string,
    originalError: Error,
    context?: Record<string, any>
  ) {
    super(
      `External service error in ${service} during ${operation}: ${originalError.message}`, 
      502, 
      'EXTERNAL_SERVICE_ERROR',
      { service, operation, originalError: originalError.message, ...context }
    );
    
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}

/**
 * Error handler utility for Knowledge Base Service
 */
export class ErrorHandler {
  /**
   * Handle an error, converting unknown errors to knowledge base errors
   * @param error The error to handle
   * @returns A standardized KnowledgeBaseError
   */
  static handleError(error: unknown): KnowledgeBaseError {
    // If it's already a KnowledgeBaseError, return it
    if (error instanceof KnowledgeBaseError) {
      return error;
    }
    
    // Convert Error objects to KnowledgeBaseError
    if (error instanceof Error) {
      // Check for common error patterns
      const errorMessage = error.message.toLowerCase();
      
        // Not found errors
      if (errorMessage.includes('not found') || errorMessage.includes('no such')) {
        const entityMatch = errorMessage.match(/(\w+) not found/i);
        // Use type assertion to ensure TypeScript treats this as a string
        const entity = (entityMatch ? entityMatch[1] : 'Entity') as string;
        const idMatch = errorMessage.match(/not found:?\s*([^\s.]+)/i);
        // Use type assertion to ensure TypeScript treats this as a string
        const id = (idMatch ? idMatch[1] : 'unknown') as string;
        
        return new NotFoundError(entity, id);
      }
      
      // Validation errors
      if (
        errorMessage.includes('validation') || 
        errorMessage.includes('invalid') ||
        errorMessage.includes('required')
      ) {
        return new ValidationError(error.message);
      }
      
      // Duplicate errors
      if (
        errorMessage.includes('duplicate') || 
        errorMessage.includes('already exists')
      ) {
        return new DuplicateError('Entity', 'field', 'value', { originalMessage: error.message });
      }
      
      // Permission errors
      if (
        errorMessage.includes('permission') || 
        errorMessage.includes('not authorized') ||
        errorMessage.includes('forbidden')
      ) {
        return new PermissionError(error.message);
      }
      
      // Default to generic KnowledgeBaseError
      return new KnowledgeBaseError(error.message);
    }
    
    // Handle string errors
    if (typeof error === 'string') {
      return new KnowledgeBaseError(error);
    }
    
    // Handle other types
    return new KnowledgeBaseError(
      'Unknown error occurred', 
      500, 
      'UNKNOWN_ERROR', 
      { originalError: error }
    );
  }
  
  /**
   * Format error for API response
   * @param error The error to format
   * @returns Formatted error response
   */
  static formatErrorResponse(error: unknown): {
    statusCode: number;
    error: string;
    message: string;
    code: string;
    details?: Record<string, any>;
  } {
    const kbError = ErrorHandler.handleError(error);
    
    return {
      statusCode: kbError.statusCode,
      error: kbError.name,
      message: kbError.message,
      code: kbError.errorCode,
      details: kbError.context
    };
  }
  
  /**
   * Log an error with appropriate severity
   * @param error The error to log
   * @param logger The logger instance
   */
  static logError(error: unknown, logger: any): void {
    const kbError = ErrorHandler.handleError(error);
    
    // Determine log level based on status code
    if (kbError.statusCode >= 500) {
      logger.error(`[${kbError.errorCode}] ${kbError.message}`, kbError.context);
    } else if (kbError.statusCode >= 400) {
      logger.warn(`[${kbError.errorCode}] ${kbError.message}`, kbError.context);
    } else {
      logger.info(`[${kbError.errorCode}] ${kbError.message}`, kbError.context);
    }
  }
}
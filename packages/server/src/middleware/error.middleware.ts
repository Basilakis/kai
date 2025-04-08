/**
 * Error Handling Middleware
 * 
 * Provides centralized error handling for the entire application with
 * standardized error responses, custom error classes, and utility functions.
 */

import { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Note: Global type declarations moved to types/global.d.ts

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends ApiError {
  details: Record<string, any>;
  
  constructor(message: string, details: Record<string, any> = {}) {
    super(400, message, true);
    this.name = 'ValidationError';
    this.details = details;
  }
}

/**
 * Custom error class for authentication errors
 */
export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication failed') {
    super(401, message, true);
    this.name = 'AuthenticationError';
  }
}

/**
 * Custom error class for authorization errors
 */
export class AuthorizationError extends ApiError {
  constructor(message: string = 'Not authorized to access this resource') {
    super(403, message, true);
    this.name = 'AuthorizationError';
  }
}

/**
 * Custom error class for resource not found errors
 */
export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super(404, `${resource} not found`, true);
    this.name = 'NotFoundError';
  }
}

/**
 * Error handler middleware
 * Provides consistent error responses across the application
 */
export const errorHandler = (
  err: Error | ApiError,
  req: ExpressRequest,
  res: ExpressResponse,
  _next: NextFunction
): void => {
  // Log error with structured information
  logger.error('Error occurred during request processing', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId: req.headers['x-request-id'] || 'unknown',
    errorName: err.name
  });

  // Default error values
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errorDetails: Record<string, any> = {};
  let isOperational = false;
  let errorCode = 'INTERNAL_ERROR';

  // Handle ApiError instances and subclasses
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
    
    if (err instanceof ValidationError) {
      errorDetails = err.details;
      errorCode = 'VALIDATION_ERROR';
    } else if (err instanceof AuthenticationError) {
      errorCode = 'AUTHENTICATION_ERROR';
    } else if (err instanceof AuthorizationError) {
      errorCode = 'AUTHORIZATION_ERROR';
    } else if (err instanceof NotFoundError) {
      errorCode = 'NOT_FOUND';
    }
  }
  // Handle other known error types
  else if (err.name === 'ValidationError') {
    // Mongoose/DB validation error
    statusCode = 400;
    message = 'Validation Error';
    errorDetails = err as Record<string, any>;
    isOperational = true;
    errorCode = 'VALIDATION_ERROR';
  } else if (err.name === 'CastError') {
    // Mongoose/DB cast error
    statusCode = 400;
    message = 'Invalid ID format';
    isOperational = true;
    errorCode = 'INVALID_ID';
  } else if (err.name === 'JsonWebTokenError') {
    // JWT error
    statusCode = 401;
    message = 'Invalid token';
    isOperational = true;
    errorCode = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    // JWT expired
    statusCode = 401;
    message = 'Token expired';
    isOperational = true;
    errorCode = 'TOKEN_EXPIRED';
  } else if (err.name === 'SyntaxError' && (err as any).status === 400) {
    // JSON parsing error
    statusCode = 400;
    message = 'Invalid request syntax';
    isOperational = true;
    errorCode = 'INVALID_SYNTAX';
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      statusCode,
      ...(Object.keys(errorDetails).length > 0 && { details: errorDetails }),
      // Only include these fields in development mode
      ...((process.env.NODE_ENV === 'development') && {
        stack: err.stack,
        isOperational
      })
    }
  });
};

/**
 * Not found middleware
 */
export const notFound = (req: ExpressRequest, _res: ExpressResponse, next: NextFunction): void => {
  const error = new NotFoundError(`Resource at ${req.originalUrl}`);
  next(error);
};

/**
 * Async handler to catch async errors in route handlers
 * This utility prevents having to use try/catch in every async controller
 */
export const asyncHandler = (
  fn: (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => Promise<any>
): ((req: ExpressRequest, res: ExpressResponse, next: NextFunction) => void) => {
  return (req: ExpressRequest, res: ExpressResponse, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
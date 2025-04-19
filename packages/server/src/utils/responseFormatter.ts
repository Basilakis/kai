/**
 * Response Formatter Utility
 *
 * This utility provides standardized response formatting for API endpoints,
 * ensuring consistent response structures across the application.
 */

import { Response } from 'express';

/**
 * Standard success response format
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  metadata?: Record<string, any>;
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    details?: any;
  };
}

/**
 * Send a success response with standard format
 *
 * @param res Express response object
 * @param data Data to include in the response
 * @param metadata Optional metadata to include in the response
 * @param status HTTP status code (defaults to 200)
 */
export function sendSuccessResponse<T>(
  res: Response,
  data: T,
  metadata?: Record<string, any>,
  status: number = 200
): void {
  const response: SuccessResponse<T> = {
    success: true,
    data
  };

  if (metadata) {
    response.metadata = metadata;
  }

  res.status(status).json(response);
}

/**
 * Send an error response with standard format
 *
 * @param res Express response object
 * @param message Error message
 * @param status HTTP status code (defaults to 500)
 * @param code Error code (defaults to 'internal_error')
 * @param details Optional error details
 */
export function sendErrorResponse(
  res: Response,
  message: string,
  status: number = 500,
  code: string = 'internal_error',
  details?: any
): void {
  const response: ErrorResponse = {
    success: false,
    error: {
      message,
      code
    }
  };

  if (details) {
    response.error.details = details;
  }

  res.status(status).json(response);
}

/**
 * Common error response codes
 */
export const ErrorCodes = {
  BAD_REQUEST: 'bad_request',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  VALIDATION_FAILED: 'validation_failed',
  INSUFFICIENT_CREDITS: 'insufficient_credits',
  SERVICE_UNAVAILABLE: 'service_unavailable',
  INTERNAL_ERROR: 'internal_error'
};

/**
 * Send a validation error response
 *
 * @param res Express response object
 * @param message Validation error message
 * @param details Validation error details
 */
export function sendValidationErrorResponse(
  res: Response,
  message: string,
  details?: any
): void {
  sendErrorResponse(
    res,
    message,
    400,
    ErrorCodes.VALIDATION_FAILED,
    details
  );
}

/**
 * Send a not found error response
 *
 * @param res Express response object
 * @param message Not found error message
 * @param resourceType Type of resource that was not found
 * @param resourceId ID of the resource that was not found
 */
export function sendNotFoundResponse(
  res: Response,
  message: string,
  resourceType?: string,
  resourceId?: string
): void {
  const details = resourceType ? { resourceType, resourceId } : undefined;
  
  sendErrorResponse(
    res,
    message,
    404,
    ErrorCodes.NOT_FOUND,
    details
  );
}

/**
 * Send an insufficient credits error response
 *
 * @param res Express response object
 */
export function sendInsufficientCreditsResponse(
  res: Response
): void {
  sendErrorResponse(
    res,
    'You do not have enough credits to perform this action. Please purchase more credits.',
    402,
    ErrorCodes.INSUFFICIENT_CREDITS
  );
}

/**
 * Send a service unavailable error response
 *
 * @param res Express response object
 * @param service Name of the unavailable service
 * @param message Error message (defaults to a generic message)
 */
export function sendServiceUnavailableResponse(
  res: Response,
  service: string,
  message?: string
): void {
  sendErrorResponse(
    res,
    message || `The ${service} service is currently unavailable. Please try again later.`,
    503,
    ErrorCodes.SERVICE_UNAVAILABLE,
    { service }
  );
}
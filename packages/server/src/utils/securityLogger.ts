/**
 * Security Logger
 * 
 * Enhanced logging utility specifically for security-related events.
 * This logger adds additional context and formatting for security events
 * to make security auditing and monitoring easier.
 */

import { logger } from './logger';

// Security event types
export enum SecurityEventType {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
  TWO_FACTOR = 'TWO_FACTOR',
  SESSION = 'SESSION',
  API_KEY = 'API_KEY',
  RATE_LIMIT = 'RATE_LIMIT',
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  DATA_ACCESS = 'DATA_ACCESS'
}

// Security event outcomes
export enum SecurityOutcome {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  ATTEMPT = 'ATTEMPT',
  BLOCKED = 'BLOCKED'
}

// Security event interface
interface SecurityEvent {
  type: SecurityEventType;
  outcome: SecurityOutcome;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  resourceId?: string;
  resourceType?: string;
  details?: Record<string, any>;
}

/**
 * Log a security event
 * @param event Security event details
 */
export function logSecurityEvent(event: SecurityEvent): void {
  // Remove any sensitive information from details
  const sanitizedDetails = sanitizeDetails(event.details || {});
  
  // Format the log message
  const message = formatSecurityMessage(event);
  
  // Log at appropriate level based on outcome
  switch (event.outcome) {
    case SecurityOutcome.SUCCESS:
      logger.info(message, { 
        securityEvent: { ...event, details: sanitizedDetails } 
      });
      break;
    case SecurityOutcome.ATTEMPT:
      logger.info(message, { 
        securityEvent: { ...event, details: sanitizedDetails } 
      });
      break;
    case SecurityOutcome.FAILURE:
      logger.warn(message, { 
        securityEvent: { ...event, details: sanitizedDetails } 
      });
      break;
    case SecurityOutcome.BLOCKED:
      logger.warn(message, { 
        securityEvent: { ...event, details: sanitizedDetails } 
      });
      break;
    default:
      logger.info(message, { 
        securityEvent: { ...event, details: sanitizedDetails } 
      });
  }
}

/**
 * Format security message for logging
 * @param event Security event
 * @returns Formatted message
 */
function formatSecurityMessage(event: SecurityEvent): string {
  let message = `[SECURITY] [${event.type}] [${event.outcome}]`;
  
  if (event.userId) {
    message += ` User: ${event.userId}`;
  }
  
  if (event.resourceType && event.resourceId) {
    message += ` ${event.resourceType}: ${event.resourceId}`;
  }
  
  if (event.ipAddress) {
    message += ` IP: ${event.ipAddress}`;
  }
  
  return message;
}

/**
 * Sanitize details to remove sensitive information
 * @param details Event details
 * @returns Sanitized details
 */
function sanitizeDetails(details: Record<string, any>): Record<string, any> {
  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'apiKey', 'refreshToken', 
    'accessToken', 'credential', 'pin', 'code'
  ];
  
  const sanitized = { ...details };
  
  // Recursively sanitize nested objects
  for (const [key, value] of Object.entries(sanitized)) {
    // Check if this is a sensitive field
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      if (value) {
        sanitized[key] = '[REDACTED]';
      }
    } 
    // Recursively sanitize objects
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeDetails(value);
    }
  }
  
  return sanitized;
}

export default {
  logSecurityEvent,
  SecurityEventType,
  SecurityOutcome
};

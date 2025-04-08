/**
 * Rate Limiting Middleware
 * 
 * Provides various rate limiting configurations for different API endpoints
 * to prevent abuse and ensure system stability.
 * 
 * Features:
 * - Default rate limits for different endpoint categories
 * - Network source-based rate limiting with custom limits for specific networks
 * - Dynamic configuration through admin panel
 */

import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';
import { isInCIDR } from '../utils/network';
import { 
  RateLimit, 
  RateLimitSettings, 
  DEFAULT_RATE_LIMIT_SETTINGS,
  DEFAULT_CUSTOM_RATE_LIMITS
} from '../models/networkAccess.model';

// Define custom type for express-rate-limit
// This is needed because the express-rate-limit types don't fully support function-based limits
interface RateLimitOptions {
  windowMs: number;
  max: number | ((req: Request) => number);
  message?: any;
  statusCode?: number;
  headers?: boolean;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  requestPropertyName?: string;
  handler?: (req: Request, res: Response, next: NextFunction, options: RateLimitOptions) => void;
}

// Database service for getting stored rate limit configurations
// In a real implementation, this would fetch from the database
let rateLimitSettings: Partial<RateLimitSettings> = DEFAULT_RATE_LIMIT_SETTINGS;
let customRateLimits: Partial<RateLimit>[] = DEFAULT_CUSTOM_RATE_LIMITS;

// Function to refresh rate limit settings from database
// This would be called periodically or triggered by admin changes
export const refreshRateLimitSettings = async () => {
  try {
    // In a real implementation, fetch from database
    // Example: 
    // const settings = await db.getRateLimitSettings();
    // const customLimits = await db.getCustomRateLimits();
    // rateLimitSettings = settings;
    // customRateLimits = customLimits;
    
    logger.info('Rate limit settings refreshed');
  } catch (error) {
    logger.error('Failed to refresh rate limit settings', { error });
  }
};

// Helper function to get the appropriate rate limit for a request
const getRateLimitForRequest = (req: Request): number => {
  const clientIP = req.ip || req.socket.remoteAddress || '';
  
  // Check if this IP matches any custom rate limit
  for (const customLimit of customRateLimits) {
    if (!customLimit.network) continue;
    
    // Check if IP matches exactly or falls within CIDR range
    if (customLimit.network === clientIP || 
        (customLimit.network.includes('/') && isInCIDR(clientIP, customLimit.network))) {
      
      logger.debug('Using custom rate limit', {
        ip: clientIP,
        network: customLimit.network,
        description: customLimit.description,
        limit: customLimit.requestsPerMinute
      });
      
      return customLimit.requestsPerMinute || rateLimitSettings.defaultRateLimit || 30;
    }
  }
  
  // Use default rate limit if no custom limit matched
  return rateLimitSettings.defaultRateLimit || 30;
};

// Base rate limit configuration with dynamic limit based on source network
const createLimiter = (
  windowMs: number,
  maxFn: (req: Request) => number,
  message: string,
  skipSuccessfulRequests = false
) => {
  // Create options with proper typing
  const options: RateLimitOptions = {
    windowMs,
    max: maxFn, // Function that returns limit based on request
    message: { error: message },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false,  // Disable the `X-RateLimit-*` headers
    skipSuccessfulRequests,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        windowMs,
        maxAttempted: maxFn(req)
      });
      res.status(429).json({
        error: 'Too many requests',
        message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  };
  
  // Express-rate-limit types don't properly support function-based limits
  // so we use a type assertion to bypass the TypeScript error
  return rateLimit(options as any);
};

/**
 * Default API rate limit - 100 requests per minute
 */
export const defaultLimiter = createLimiter(
  60 * 1000, // 1 minute
  (req: Request) => {
    // Base limit is 100, but adjust based on source network
    const multiplier = getRateLimitForRequest(req) / rateLimitSettings.defaultRateLimit!;
    return Math.max(10, Math.round(100 * multiplier)); // Minimum 10 requests
  },
  'Too many requests, please try again later.'
);

/**
 * Authentication rate limit - 20 requests per minute
 * More strict to prevent brute force attacks
 */
export const authLimiter = createLimiter(
  60 * 1000, // 1 minute
  (req: Request) => {
    // Auth limits remain strict even for internal networks
    // but still provide some flexibility based on source
    const sourceLimit = getRateLimitForRequest(req);
    const isInternalRequest = sourceLimit > rateLimitSettings.defaultRateLimit!;
    
    // Internal requests get double the limit, but still capped for security
    return isInternalRequest ? 40 : 20;
  },
  'Too many authentication attempts, please try again later.'
);

/**
 * ML processing rate limit - 10 requests per minute
 * For resource-intensive operations like image recognition or ML model inference
 */
export const mlProcessingLimiter = createLimiter(
  60 * 1000, // 1 minute
  (req: Request) => {
    // ML processing is resource-intensive, so scale based on source
    const sourceLimit = getRateLimitForRequest(req);
    const baseLimit = 10;
    
    // Calculate limit relative to default rate limit
    const multiplier = sourceLimit / rateLimitSettings.defaultRateLimit!;
    return Math.max(5, Math.round(baseLimit * multiplier)); // Minimum 5 requests
  },
  'Processing limit reached, please try again later.'
);

/**
 * Agent API rate limit - 30 requests per minute
 * For AI agent interactions
 */
export const agentLimiter = createLimiter(
  60 * 1000, // 1 minute
  (req: Request) => {
    // Agent API limits scale based on source
    const sourceLimit = getRateLimitForRequest(req);
    const baseLimit = 30;
    
    // Calculate limit relative to default rate limit
    const multiplier = sourceLimit / rateLimitSettings.defaultRateLimit!;
    return Math.max(10, Math.round(baseLimit * multiplier)); // Minimum 10 requests
  },
  'Agent request limit reached, please try again later.'
);

/**
 * PDF processing rate limit - 5 requests per 10 minutes
 * For resource-intensive PDF processing operations
 */
export const pdfProcessingLimiter = createLimiter(
  10 * 60 * 1000, // 10 minutes
  (req: Request) => {
    // PDF processing is very resource-intensive, so be more conservative
    const sourceLimit = getRateLimitForRequest(req);
    const baseLimit = 5;
    
    // Calculate limit relative to default rate limit, but more conservative
    const multiplier = sourceLimit / rateLimitSettings.defaultRateLimit!;
    return Math.max(2, Math.min(20, Math.round(baseLimit * multiplier))); // Between 2-20 requests
  },
  'PDF processing limit reached, please try again later.'
);

// Initialize rate limit settings on module load
refreshRateLimitSettings();
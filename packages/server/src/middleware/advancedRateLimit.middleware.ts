/**
 * Advanced Rate Limiting Middleware
 * 
 * This middleware provides enhanced rate limiting functionality,
 * including tiered limits based on subscription, dynamic adjustments,
 * and IP-based and user-based rate limiting.
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory, RateLimiterAbstract } from 'rate-limiter-flexible';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/error.middleware';
import { isInCIDR } from '../utils/network';
import { getUserSubscription } from '../models/userSubscription.model';
import { redisClient } from '../services/redis/redisClient';

/**
 * Rate limit tiers
 */
export enum RateLimitTier {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
  INTERNAL = 'internal',
  API_KEY = 'api_key'
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  points: number; // Maximum number of requests
  duration: number; // Time window in seconds
  blockDuration?: number; // Block duration in seconds after limit is reached
}

/**
 * Default rate limit configurations by tier
 */
const DEFAULT_RATE_LIMITS: Record<RateLimitTier, RateLimitConfig> = {
  [RateLimitTier.FREE]: {
    points: 60, // 60 requests
    duration: 60, // per minute
    blockDuration: 60 // Block for 1 minute after limit is reached
  },
  [RateLimitTier.BASIC]: {
    points: 300, // 300 requests
    duration: 60, // per minute
    blockDuration: 30 // Block for 30 seconds after limit is reached
  },
  [RateLimitTier.PREMIUM]: {
    points: 1000, // 1000 requests
    duration: 60, // per minute
    blockDuration: 15 // Block for 15 seconds after limit is reached
  },
  [RateLimitTier.ENTERPRISE]: {
    points: 5000, // 5000 requests
    duration: 60, // per minute
    blockDuration: 0 // No block after limit is reached
  },
  [RateLimitTier.INTERNAL]: {
    points: 10000, // 10000 requests
    duration: 60, // per minute
    blockDuration: 0 // No block after limit is reached
  },
  [RateLimitTier.API_KEY]: {
    points: 500, // 500 requests
    duration: 60, // per minute
    blockDuration: 30 // Block for 30 seconds after limit is reached
  }
};

/**
 * Rate limit configurations by endpoint type
 */
const ENDPOINT_RATE_LIMITS: Record<string, Partial<Record<RateLimitTier, RateLimitConfig>>> = {
  'auth': {
    [RateLimitTier.FREE]: {
      points: 20, // 20 requests
      duration: 60, // per minute
      blockDuration: 300 // Block for 5 minutes after limit is reached
    },
    [RateLimitTier.BASIC]: {
      points: 30, // 30 requests
      duration: 60, // per minute
      blockDuration: 180 // Block for 3 minutes after limit is reached
    },
    [RateLimitTier.PREMIUM]: {
      points: 50, // 50 requests
      duration: 60, // per minute
      blockDuration: 60 // Block for 1 minute after limit is reached
    }
  },
  'ml': {
    [RateLimitTier.FREE]: {
      points: 10, // 10 requests
      duration: 60, // per minute
      blockDuration: 120 // Block for 2 minutes after limit is reached
    },
    [RateLimitTier.BASIC]: {
      points: 50, // 50 requests
      duration: 60, // per minute
      blockDuration: 60 // Block for 1 minute after limit is reached
    }
  },
  'pdf': {
    [RateLimitTier.FREE]: {
      points: 5, // 5 requests
      duration: 600, // per 10 minutes
      blockDuration: 600 // Block for 10 minutes after limit is reached
    },
    [RateLimitTier.BASIC]: {
      points: 20, // 20 requests
      duration: 600, // per 10 minutes
      blockDuration: 300 // Block for 5 minutes after limit is reached
    }
  }
};

/**
 * Internal network CIDR ranges
 */
const INTERNAL_NETWORKS = [
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '127.0.0.0/8'
];

/**
 * Rate limiter instances
 */
const rateLimiters: Record<string, RateLimiterAbstract> = {};

/**
 * Create a rate limiter
 * @param key Rate limiter key
 * @param config Rate limit configuration
 * @returns Rate limiter instance
 */
function createRateLimiter(key: string, config: RateLimitConfig): RateLimiterAbstract {
  // Use Redis if available, otherwise use memory
  if (redisClient.isConnected()) {
    return new RateLimiterRedis({
      storeClient: redisClient.getClient(),
      keyPrefix: `ratelimit:${key}`,
      points: config.points,
      duration: config.duration,
      blockDuration: config.blockDuration
    });
  } else {
    return new RateLimiterMemory({
      keyPrefix: `ratelimit:${key}`,
      points: config.points,
      duration: config.duration,
      blockDuration: config.blockDuration
    });
  }
}

/**
 * Get or create a rate limiter
 * @param key Rate limiter key
 * @param config Rate limit configuration
 * @returns Rate limiter instance
 */
function getRateLimiter(key: string, config: RateLimitConfig): RateLimiterAbstract {
  if (!rateLimiters[key]) {
    rateLimiters[key] = createRateLimiter(key, config);
  }
  return rateLimiters[key];
}

/**
 * Determine the rate limit tier for a request
 * @param req Express request
 * @returns Rate limit tier
 */
async function getRateLimitTier(req: Request): Promise<RateLimitTier> {
  // Check if request is from an internal network
  const ip = req.ip || req.socket.remoteAddress || '';
  const isInternal = INTERNAL_NETWORKS.some(cidr => isInCIDR(ip, cidr));
  
  if (isInternal) {
    return RateLimitTier.INTERNAL;
  }
  
  // Check if request is using an API key
  if (req.headers['x-api-key']) {
    return RateLimitTier.API_KEY;
  }
  
  // Check user subscription tier
  if (req.user?.id) {
    try {
      const subscription = await getUserSubscription(req.user.id);
      
      if (subscription) {
        // Map subscription tier to rate limit tier
        switch (subscription.tierId) {
          case 'premium':
          case 'pro':
            return RateLimitTier.PREMIUM;
          case 'enterprise':
          case 'business':
            return RateLimitTier.ENTERPRISE;
          case 'basic':
            return RateLimitTier.BASIC;
          default:
            return RateLimitTier.FREE;
        }
      }
    } catch (error) {
      logger.error(`Error getting user subscription for rate limiting: ${error}`);
    }
  }
  
  // Default to free tier
  return RateLimitTier.FREE;
}

/**
 * Get rate limit configuration for a request
 * @param req Express request
 * @param endpointType Endpoint type
 * @returns Rate limit configuration
 */
async function getRateLimitConfig(req: Request, endpointType?: string): Promise<RateLimitConfig> {
  const tier = await getRateLimitTier(req);
  
  // Get endpoint-specific rate limit if available
  if (endpointType && ENDPOINT_RATE_LIMITS[endpointType] && ENDPOINT_RATE_LIMITS[endpointType][tier]) {
    return ENDPOINT_RATE_LIMITS[endpointType][tier] as RateLimitConfig;
  }
  
  // Fall back to default rate limit for the tier
  return DEFAULT_RATE_LIMITS[tier];
}

/**
 * Advanced rate limiting middleware
 * @param options Rate limiting options
 * @returns Middleware function
 */
export function advancedRateLimit(options: { endpointType?: string } = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get rate limit configuration
      const config = await getRateLimitConfig(req, options.endpointType);
      
      // Determine the key for rate limiting
      let key: string;
      
      if (req.user?.id) {
        // User-based rate limiting
        key = `user:${req.user.id}`;
      } else if (req.headers['x-api-key']) {
        // API key-based rate limiting
        key = `apikey:${req.headers['x-api-key']}`;
      } else {
        // IP-based rate limiting
        key = `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
      }
      
      // Add endpoint type to key if specified
      if (options.endpointType) {
        key += `:${options.endpointType}`;
      }
      
      // Get rate limiter
      const rateLimiter = getRateLimiter(key, config);
      
      // Check rate limit
      const rateLimitResult = await rateLimiter.consume(key);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', config.points);
      res.setHeader('X-RateLimit-Remaining', rateLimitResult.remainingPoints);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimitResult.msBeforeNext).toISOString());
      
      next();
    } catch (error) {
      if (error.remainingPoints !== undefined) {
        // Rate limit exceeded
        const retryAfter = Math.ceil(error.msBeforeNext / 1000) || 60;
        
        res.setHeader('Retry-After', retryAfter);
        res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded, please try again later',
          retryAfter
        });
      } else {
        // Other error
        logger.error(`Error in rate limiting middleware: ${error}`);
        next(new ApiError(500, 'Internal server error'));
      }
    }
  };
}

/**
 * Auth rate limiting middleware
 */
export const authRateLimit = advancedRateLimit({ endpointType: 'auth' });

/**
 * ML rate limiting middleware
 */
export const mlRateLimit = advancedRateLimit({ endpointType: 'ml' });

/**
 * PDF rate limiting middleware
 */
export const pdfRateLimit = advancedRateLimit({ endpointType: 'pdf' });

/**
 * Default rate limiting middleware
 */
export const defaultRateLimit = advancedRateLimit();

export default {
  advancedRateLimit,
  authRateLimit,
  mlRateLimit,
  pdfRateLimit,
  defaultRateLimit
};

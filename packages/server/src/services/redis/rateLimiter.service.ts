/**
 * Redis-based Rate Limiter Service
 * 
 * This service provides Redis-based rate limiting functionality,
 * supporting distributed rate limiting across multiple server instances.
 */

import { redisClient } from './redisClient';
import { logger } from '../../utils/logger';

/**
 * Rate limit result
 */
export interface RateLimitResult {
  isAllowed: boolean;
  remaining: number;
  total: number;
  resetTime: Date;
}

/**
 * Rate limit options
 */
export interface RateLimitOptions {
  key: string;
  limit: number;
  windowSeconds: number;
  blockDurationSeconds?: number;
}

/**
 * Redis-based rate limiter
 */
class RedisRateLimiter {
  /**
   * Check if a request is allowed based on rate limits
   * @param options Rate limit options
   * @returns Rate limit result
   */
  public async checkLimit(options: RateLimitOptions): Promise<RateLimitResult> {
    try {
      const { key, limit, windowSeconds } = options;
      const now = Date.now();
      const windowMs = windowSeconds * 1000;
      const fullKey = `ratelimit:${key}`;
      
      // Get Redis client
      const client = redisClient.getClient();
      
      // Use Redis pipeline for atomic operations
      const pipeline = client.pipeline();
      
      // Remove expired entries (older than the window)
      pipeline.zremrangebyscore(fullKey, 0, now - windowMs);
      
      // Add current request timestamp
      pipeline.zadd(fullKey, now, `${now}-${Math.random().toString(36).substring(2, 10)}`);
      
      // Count requests in the current window
      pipeline.zcard(fullKey);
      
      // Set expiration on the key
      pipeline.expire(fullKey, windowSeconds * 2);
      
      // Execute pipeline
      const results = await pipeline.exec();
      
      // Get the count from the results
      const count = results ? results[2][1] as number : 0;
      
      // Calculate remaining requests
      const remaining = Math.max(0, limit - count);
      
      // Calculate reset time
      const oldestTimestamp = await this.getOldestTimestamp(fullKey);
      const resetTime = new Date(oldestTimestamp + windowMs);
      
      // Check if limit is exceeded
      const isAllowed = count <= limit;
      
      // If limit is exceeded and block duration is set, block the key
      if (!isAllowed && options.blockDurationSeconds) {
        await this.blockKey(key, options.blockDurationSeconds);
      }
      
      return {
        isAllowed,
        remaining,
        total: limit,
        resetTime
      };
    } catch (error) {
      logger.error(`Error checking rate limit: ${error}`);
      
      // Default to allowing the request in case of error
      return {
        isAllowed: true,
        remaining: 1,
        total: 1,
        resetTime: new Date(Date.now() + 60000)
      };
    }
  }
  
  /**
   * Get the oldest timestamp in the rate limit window
   * @param key Redis key
   * @returns Oldest timestamp or current time if no entries
   */
  private async getOldestTimestamp(key: string): Promise<number> {
    try {
      const client = redisClient.getClient();
      
      // Get the oldest entry
      const result = await client.zrange(key, 0, 0, 'WITHSCORES');
      
      if (result && result.length >= 2) {
        return parseInt(result[1], 10);
      }
      
      return Date.now();
    } catch (error) {
      logger.error(`Error getting oldest timestamp: ${error}`);
      return Date.now();
    }
  }
  
  /**
   * Block a key for a specified duration
   * @param key Key to block
   * @param durationSeconds Duration in seconds
   */
  private async blockKey(key: string, durationSeconds: number): Promise<void> {
    try {
      const client = redisClient.getClient();
      const blockKey = `ratelimit:blocked:${key}`;
      
      // Set block key with expiration
      await client.set(blockKey, '1', 'EX', durationSeconds);
    } catch (error) {
      logger.error(`Error blocking key: ${error}`);
    }
  }
  
  /**
   * Check if a key is blocked
   * @param key Key to check
   * @returns Whether the key is blocked
   */
  public async isBlocked(key: string): Promise<boolean> {
    try {
      const client = redisClient.getClient();
      const blockKey = `ratelimit:blocked:${key}`;
      
      // Check if block key exists
      const result = await client.exists(blockKey);
      
      return result === 1;
    } catch (error) {
      logger.error(`Error checking if key is blocked: ${error}`);
      return false;
    }
  }
  
  /**
   * Reset rate limit for a key
   * @param key Key to reset
   */
  public async resetLimit(key: string): Promise<void> {
    try {
      const client = redisClient.getClient();
      const fullKey = `ratelimit:${key}`;
      const blockKey = `ratelimit:blocked:${key}`;
      
      // Delete rate limit and block keys
      await client.del(fullKey, blockKey);
    } catch (error) {
      logger.error(`Error resetting rate limit: ${error}`);
    }
  }
}

export const redisRateLimiter = new RedisRateLimiter();

export default redisRateLimiter;

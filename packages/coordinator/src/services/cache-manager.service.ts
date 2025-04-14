import { Redis } from 'ioredis';
import { Logger } from 'winston';

/**
 * Cache result structure
 */
export interface CachedResult {
  workflowId: string;
  result: any;
  createdAt: number;
  expiresAt: number;
}

/**
 * Cache Manager Service
 * 
 * Manages caching of workflow results to improve performance
 * and reduce redundant processing.
 */
export class CacheManager {
  // Default cache TTL is 1 day (in seconds)
  private static readonly DEFAULT_TTL = 60 * 60 * 24;
  
  /**
   * Constructor
   * @param redis Redis client for caching
   * @param logger Logger instance
   */
  constructor(
    private redis: Redis,
    private logger: Logger
  ) {
    this.logger.info('Cache Manager service initialized');
  }
  
  /**
   * Generates a cache key from the request
   * @param request The request object to generate a key for
   * @returns Cache key string
   */
  public generateCacheKey(request: any): string {
    // Create a normalized version of the request for consistent key generation
    const normalizedRequest = {
      type: request.type,
      parameters: request.parameters || {},
      qualityTarget: request.qualityTarget || 'auto'
    };
    
    // Handle arrays in parameters correctly by sorting them
    Object.keys(normalizedRequest.parameters).forEach(key => {
      const value = normalizedRequest.parameters[key];
      if (Array.isArray(value)) {
        // Sort arrays to ensure consistent key generation
        normalizedRequest.parameters[key] = [...value].sort();
      }
    });
    
    // Create a hash of the normalized request
    const requestString = JSON.stringify(normalizedRequest);
    // Use a simple encoding approach instead of Buffer
    const encodedString = encodeURIComponent(requestString).replace(/%/g, '_');
    return `cache:workflow:${encodedString}`;
  }
  
  /**
   * Stores a result in the cache
   * @param key The cache key
   * @param workflowId The workflow ID
   * @param result The result to cache
   * @param ttl Time to live in seconds
   * @returns Success flag
   */
  public async set(key: string, workflowId: string, result: any, ttl = CacheManager.DEFAULT_TTL): Promise<boolean> {
    try {
      const now = Date.now();
      const expiresAt = now + (ttl * 1000);
      
      const cachedResult: CachedResult = {
        workflowId,
        result,
        createdAt: now,
        expiresAt
      };
      
      await this.redis.set(key, JSON.stringify(cachedResult), 'EX', ttl);
      
      this.logger.debug('Cached result stored', {
        key,
        workflowId,
        ttl
      });
      
      return true;
    } catch (error) {
      this.logger.error('Error storing cached result', {
        key,
        workflowId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return false;
    }
  }
  
  /**
   * Retrieves a result from the cache
   * @param key The cache key
   * @returns The cached result or null if not found
   */
  public async get(key: string): Promise<CachedResult | null> {
    try {
      const result = await this.redis.get(key);
      
      if (!result) {
        this.logger.debug('Cache miss', { key });
        return null;
      }
      
      const cachedResult = JSON.parse(result) as CachedResult;
      
      // Check if result has expired (additional safeguard beyond Redis TTL)
      const now = Date.now();
      if (cachedResult.expiresAt < now) {
        this.logger.debug('Cache result expired', { key });
        await this.redis.del(key);
        return null;
      }
      
      this.logger.debug('Cache hit', { key });
      return cachedResult;
    } catch (error) {
      this.logger.error('Error retrieving cached result', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return null;
    }
  }
  
  /**
   * Invalidates a cached result
   * @param key The cache key to invalidate
   * @returns Success flag
   */
  public async invalidate(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      
      this.logger.debug('Cache invalidated', { key });
      return true;
    } catch (error) {
      this.logger.error('Error invalidating cache', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return false;
    }
  }
  
  /**
   * Invalidates all cached results for a particular workflow type
   * @param type The workflow type
   * @returns Number of invalidated keys
   */
  public async invalidateByType(type: string): Promise<number> {
    try {
      // Find keys that match the workflow type
      // Using type assertion since keys() is available but not in type definitions
      const keys = await (this.redis as any).keys(`cache:workflow:*`);
      let invalidatedCount = 0;
      
      for (const key of keys) {
        const result = await this.redis.get(key);
        if (result) {
          try {
            const cachedResult = JSON.parse(result) as CachedResult;
            const data = cachedResult.result;
            
            // Check if this result is for the specified type
            if (data && data.type === type) {
              await this.redis.del(key);
              invalidatedCount++;
            }
          } catch (e) {
            // Skip invalid entries
            this.logger.warn('Found invalid cache entry', { key });
          }
        }
      }
      
      this.logger.info('Cache invalidated by type', {
        type,
        invalidatedCount
      });
      
      return invalidatedCount;
    } catch (error) {
      this.logger.error('Error invalidating cache by type', {
        type,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return 0;
    }
  }
  
  /**
   * Clears all cached results
   * @returns Number of cleared keys
   */
  public async clear(): Promise<number> {
    try {
      // Using type assertion since keys() is available but not in type definitions
      const keys = await (this.redis as any).keys('cache:workflow:*');
      
      if (keys.length === 0) {
        return 0;
      }
      
      // Handle batch deletion without spread operator
      // Either delete one by one or use a different approach
      let count = 0;
      if (keys.length > 0) {
        // For small batches, delete one by one
        if (keys.length < 20) {
          for (const key of keys) {
            const deleted = await this.redis.del(key);
            count += deleted;
          }
        } else {
          // For larger batches, use pipeline for better performance
          // Type assertion for pipeline method
          const pipeline = (this.redis as any).pipeline();
          keys.forEach((key: string) => pipeline.del(key));
          const results = await pipeline.exec();
          count = results ? results.reduce((sum: number, [err, res]: [Error | null, number]) => err ? sum : sum + res, 0) : 0;
        }
      }
      
      this.logger.info('Cache cleared', { count });
      return count;
    } catch (error) {
      this.logger.error('Error clearing cache', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return 0;
    }
  }
}
/**
 * Supabase Query Cache
 * 
 * This utility provides caching for Supabase queries to improve performance
 * and reduce database load for frequently accessed data.
 */

import { logger } from '../../utils/logger';

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  key: string;
}

/**
 * Cache configuration
 */
export interface QueryCacheConfig {
  defaultTtlMs: number;
  maxEntries: number;
  enabled: boolean;
}

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG: QueryCacheConfig = {
  defaultTtlMs: 60000, // 1 minute
  maxEntries: 100,
  enabled: true
};

/**
 * Supabase Query Cache
 */
export class SupabaseQueryCache {
  private static instance: SupabaseQueryCache;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private config: QueryCacheConfig;
  private maintenanceInterval: NodeJS.Timeout | null = null;
  private hitCount = 0;
  private missCount = 0;
  
  /**
   * Create a new query cache
   */
  private constructor(config: Partial<QueryCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Start maintenance routine
    this.startMaintenance();
    
    logger.debug('Supabase query cache initialized', {
      defaultTtl: this.config.defaultTtlMs,
      maxEntries: this.config.maxEntries,
      enabled: this.config.enabled
    });
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(config?: Partial<QueryCacheConfig>): SupabaseQueryCache {
    if (!SupabaseQueryCache.instance) {
      SupabaseQueryCache.instance = new SupabaseQueryCache(config);
    } else if (config) {
      // Update config if provided
      SupabaseQueryCache.instance.updateConfig(config);
    }
    
    return SupabaseQueryCache.instance;
  }
  
  /**
   * Update the cache configuration
   */
  public updateConfig(config: Partial<QueryCacheConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug('Supabase query cache configuration updated', this.config);
  }
  
  /**
   * Generate a cache key from query parameters
   */
  public generateKey(
    table: string,
    operation: string,
    params: Record<string, any> = {}
  ): string {
    // Sort params to ensure consistent key generation
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, any>);
    
    return `${table}:${operation}:${JSON.stringify(sortedParams)}`;
  }
  
  /**
   * Get a value from the cache
   */
  public get<T>(key: string): T | null {
    if (!this.config.enabled) {
      return null;
    }
    
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.missCount++;
      return null;
    }
    
    // Check if the entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }
    
    this.hitCount++;
    return entry.data;
  }
  
  /**
   * Set a value in the cache
   */
  public set<T>(key: string, data: T, ttlMs?: number): void {
    if (!this.config.enabled) {
      return;
    }
    
    // If we've reached the max entries, remove the oldest entry
    if (this.cache.size >= this.config.maxEntries) {
      const oldestKey = this.findOldestEntry();
      
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    const expiresAt = Date.now() + (ttlMs || this.config.defaultTtlMs);
    
    this.cache.set(key, {
      data,
      expiresAt,
      key
    });
  }
  
  /**
   * Find the oldest entry in the cache
   */
  private findOldestEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestExpiry = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < oldestExpiry) {
        oldestKey = key;
        oldestExpiry = entry.expiresAt;
      }
    }
    
    return oldestKey;
  }
  
  /**
   * Invalidate a specific cache entry
   */
  public invalidate(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * Invalidate all cache entries for a table
   */
  public invalidateTable(table: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (key.startsWith(`${table}:`)) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Clear the entire cache
   */
  public clear(): void {
    this.cache.clear();
    logger.debug('Supabase query cache cleared');
  }
  
  /**
   * Start the maintenance routine
   */
  private startMaintenance(): void {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
    }
    
    // Run maintenance every 30 seconds
    this.maintenanceInterval = setInterval(() => {
      this.performMaintenance();
    }, 30000);
  }
  
  /**
   * Perform maintenance on the cache
   */
  private performMaintenance(): void {
    const now = Date.now();
    let expiredCount = 0;
    
    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      logger.debug('Removed expired cache entries', {
        expired: expiredCount,
        remaining: this.cache.size
      });
    }
  }
  
  /**
   * Get cache statistics
   */
  public getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    hits: number;
    misses: number;
    enabled: boolean;
  } {
    const total = this.hitCount + this.missCount;
    const hitRate = total > 0 ? this.hitCount / total : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.config.maxEntries,
      hitRate,
      hits: this.hitCount,
      misses: this.missCount,
      enabled: this.config.enabled
    };
  }
  
  /**
   * Reset cache statistics
   */
  public resetStats(): void {
    this.hitCount = 0;
    this.missCount = 0;
  }
}

/**
 * Singleton instance of the query cache
 */
export const queryCache = SupabaseQueryCache.getInstance();

/**
 * Execute a function with caching
 */
export async function withCache<T>(
  table: string,
  operation: string,
  params: Record<string, any>,
  fn: () => Promise<T>,
  ttlMs?: number
): Promise<T> {
  const key = queryCache.generateKey(table, operation, params);
  
  // Try to get from cache first
  const cachedResult = queryCache.get<T>(key);
  
  if (cachedResult !== null) {
    return cachedResult;
  }
  
  // If not in cache, execute the function
  const result = await fn();
  
  // Cache the result
  queryCache.set(key, result, ttlMs);
  
  return result;
}

export default {
  queryCache,
  withCache
};

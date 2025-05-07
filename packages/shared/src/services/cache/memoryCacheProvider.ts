/**
 * Memory Cache Provider
 * 
 * This provider implements the CacheProvider interface using in-memory storage.
 * It's suitable for development and small-scale applications.
 */

import { CacheProvider, CacheOptions } from './cacheService';
import { createLogger } from '../../utils/unified-logger';

const logger = createLogger('MemoryCacheProvider');

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

/**
 * Memory cache provider
 */
export class MemoryCacheProvider implements CacheProvider {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  /**
   * Create a new memory cache provider
   * @param cleanupIntervalMs Cleanup interval in milliseconds
   */
  constructor(cleanupIntervalMs: number = 60000) {
    // Set up periodic cleanup of expired entries
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, cleanupIntervalMs);
    
    logger.info('Memory cache provider initialized');
  }
  
  /**
   * Clean up when the provider is no longer needed
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  
  /**
   * Get a value from the cache
   * @param key Cache key
   * @param options Cache options
   * @returns Cached value or null if not found
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if the entry has expired
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as T;
  }
  
  /**
   * Set a value in the cache
   * @param key Cache key
   * @param value Value to cache
   * @param options Cache options
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl || 0;
    const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
    
    this.cache.set(key, {
      value,
      expiresAt
    });
  }
  
  /**
   * Delete a value from the cache
   * @param key Cache key
   * @param options Cache options
   */
  async delete(key: string, options?: CacheOptions): Promise<void> {
    this.cache.delete(key);
  }
  
  /**
   * Clear all values from the cache
   * @param options Cache options
   */
  async clear(options?: CacheOptions): Promise<void> {
    // If namespace is provided, only clear keys in that namespace
    if (options?.namespace) {
      const prefix = `${options.namespace}:`;
      
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all keys
      this.cache.clear();
    }
  }
  
  /**
   * Check if a key exists in the cache
   * @param key Cache key
   * @param options Cache options
   * @returns Whether the key exists
   */
  async has(key: string, options?: CacheOptions): Promise<boolean> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if the entry has expired
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt !== null && entry.expiresAt < now) {
        this.cache.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      logger.debug(`Cleaned up ${expiredCount} expired cache entries`);
    }
  }
  
  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  getStats(): { size: number; memoryUsage: number } {
    // Estimate memory usage (very rough approximation)
    let memoryUsage = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      // Key size (2 bytes per character)
      memoryUsage += key.length * 2;
      
      // Value size (rough estimate)
      const valueStr = JSON.stringify(entry.value);
      memoryUsage += valueStr.length * 2;
      
      // Entry overhead
      memoryUsage += 16; // expiresAt (8 bytes) + object overhead
    }
    
    return {
      size: this.cache.size,
      memoryUsage
    };
  }
}

// Export default for convenience
export default MemoryCacheProvider;

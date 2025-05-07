/**
 * Cache Service
 * 
 * This module provides a unified caching interface for the application.
 * It supports different cache providers (memory, Redis, etc.) and provides
 * a consistent API for caching operations.
 */

import { createLogger } from '../../utils/unified-logger';

const logger = createLogger('CacheService');

/**
 * Cache options
 */
export interface CacheOptions {
  /** Time-to-live in seconds (0 = no expiration) */
  ttl?: number;
  /** Namespace for the cache key */
  namespace?: string;
}

/**
 * Cache provider interface
 */
export interface CacheProvider {
  /** Get a value from the cache */
  get<T>(key: string, options?: CacheOptions): Promise<T | null>;
  
  /** Set a value in the cache */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  
  /** Delete a value from the cache */
  delete(key: string, options?: CacheOptions): Promise<void>;
  
  /** Clear all values from the cache */
  clear(options?: CacheOptions): Promise<void>;
  
  /** Check if a key exists in the cache */
  has(key: string, options?: CacheOptions): Promise<boolean>;
}

/**
 * Cache service
 */
class CacheService {
  private provider: CacheProvider | null = null;
  private defaultNamespace: string = 'default';
  private defaultTtl: number = 3600; // 1 hour
  
  /**
   * Set the cache provider
   * @param provider Cache provider
   */
  setProvider(provider: CacheProvider): void {
    this.provider = provider;
    logger.info('Cache provider set');
  }
  
  /**
   * Set the default namespace
   * @param namespace Default namespace
   */
  setDefaultNamespace(namespace: string): void {
    this.defaultNamespace = namespace;
    logger.info(`Default namespace set to: ${namespace}`);
  }
  
  /**
   * Set the default TTL
   * @param ttl Default TTL in seconds
   */
  setDefaultTtl(ttl: number): void {
    this.defaultTtl = ttl;
    logger.info(`Default TTL set to: ${ttl} seconds`);
  }
  
  /**
   * Get a value from the cache
   * @param key Cache key
   * @param options Cache options
   * @returns Cached value or null if not found
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    if (!this.provider) {
      logger.warn('No cache provider set, returning null');
      return null;
    }
    
    try {
      const namespace = options?.namespace || this.defaultNamespace;
      const namespaceKey = this.getNamespacedKey(key, namespace);
      
      const result = await this.provider.get<T>(namespaceKey, options);
      
      if (result === null) {
        logger.debug(`Cache miss for key: ${namespaceKey}`);
      } else {
        logger.debug(`Cache hit for key: ${namespaceKey}`);
      }
      
      return result;
    } catch (error) {
      logger.error(`Error getting cache key: ${key}`, error as Error);
      return null;
    }
  }
  
  /**
   * Set a value in the cache
   * @param key Cache key
   * @param value Value to cache
   * @param options Cache options
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    if (!this.provider) {
      logger.warn('No cache provider set, skipping cache set');
      return;
    }
    
    try {
      const namespace = options?.namespace || this.defaultNamespace;
      const ttl = options?.ttl !== undefined ? options.ttl : this.defaultTtl;
      const namespaceKey = this.getNamespacedKey(key, namespace);
      
      await this.provider.set<T>(namespaceKey, value, { ...options, ttl });
      
      logger.debug(`Cache set for key: ${namespaceKey}, TTL: ${ttl}s`);
    } catch (error) {
      logger.error(`Error setting cache key: ${key}`, error as Error);
    }
  }
  
  /**
   * Delete a value from the cache
   * @param key Cache key
   * @param options Cache options
   */
  async delete(key: string, options?: CacheOptions): Promise<void> {
    if (!this.provider) {
      logger.warn('No cache provider set, skipping cache delete');
      return;
    }
    
    try {
      const namespace = options?.namespace || this.defaultNamespace;
      const namespaceKey = this.getNamespacedKey(key, namespace);
      
      await this.provider.delete(namespaceKey, options);
      
      logger.debug(`Cache deleted for key: ${namespaceKey}`);
    } catch (error) {
      logger.error(`Error deleting cache key: ${key}`, error as Error);
    }
  }
  
  /**
   * Clear all values from the cache
   * @param options Cache options
   */
  async clear(options?: CacheOptions): Promise<void> {
    if (!this.provider) {
      logger.warn('No cache provider set, skipping cache clear');
      return;
    }
    
    try {
      await this.provider.clear(options);
      
      logger.info('Cache cleared');
    } catch (error) {
      logger.error('Error clearing cache', error as Error);
    }
  }
  
  /**
   * Check if a key exists in the cache
   * @param key Cache key
   * @param options Cache options
   * @returns Whether the key exists
   */
  async has(key: string, options?: CacheOptions): Promise<boolean> {
    if (!this.provider) {
      logger.warn('No cache provider set, returning false');
      return false;
    }
    
    try {
      const namespace = options?.namespace || this.defaultNamespace;
      const namespaceKey = this.getNamespacedKey(key, namespace);
      
      return await this.provider.has(namespaceKey, options);
    } catch (error) {
      logger.error(`Error checking cache key: ${key}`, error as Error);
      return false;
    }
  }
  
  /**
   * Get a namespaced key
   * @param key Original key
   * @param namespace Namespace
   * @returns Namespaced key
   */
  private getNamespacedKey(key: string, namespace: string): string {
    return `${namespace}:${key}`;
  }
  
  /**
   * Cache a function result
   * @param fn Function to cache
   * @param keyFn Function to generate cache key
   * @param options Cache options
   * @returns Cached function
   */
  cached<T, Args extends any[]>(
    fn: (...args: Args) => Promise<T>,
    keyFn: (...args: Args) => string,
    options?: CacheOptions
  ): (...args: Args) => Promise<T> {
    return async (...args: Args): Promise<T> => {
      const key = keyFn(...args);
      
      // Try to get from cache
      const cached = await this.get<T>(key, options);
      if (cached !== null) {
        return cached;
      }
      
      // Execute the function
      const result = await fn(...args);
      
      // Cache the result
      await this.set<T>(key, result, options);
      
      return result;
    };
  }
}

// Create and export a singleton instance
export const cache = new CacheService();

// Export default for convenience
export default cache;

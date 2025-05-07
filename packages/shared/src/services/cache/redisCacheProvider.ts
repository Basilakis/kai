/**
 * Redis Cache Provider
 * 
 * This provider implements the CacheProvider interface using Redis.
 * It's suitable for production and distributed applications.
 */

import { createClient, RedisClientType } from 'redis';
import { CacheProvider, CacheOptions } from './cacheService';
import { createLogger } from '../../utils/unified-logger';

const logger = createLogger('RedisCacheProvider');

/**
 * Redis cache provider configuration
 */
export interface RedisCacheConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  tls?: boolean;
  connectTimeout?: number;
  reconnectStrategy?: boolean | number;
}

/**
 * Redis cache provider
 */
export class RedisCacheProvider implements CacheProvider {
  private client: RedisClientType;
  private connected: boolean = false;
  
  /**
   * Create a new Redis cache provider
   * @param config Redis configuration
   */
  constructor(config: RedisCacheConfig) {
    // Create Redis client
    this.client = createClient({
      url: config.url,
      socket: {
        host: config.host,
        port: config.port,
        tls: config.tls,
        connectTimeout: config.connectTimeout
      },
      password: config.password,
      database: config.db
    });
    
    // Set up event handlers
    this.client.on('error', (err) => {
      logger.error('Redis client error', err);
    });
    
    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.connected = true;
    });
    
    this.client.on('disconnect', () => {
      logger.info('Redis client disconnected');
      this.connected = false;
    });
    
    // Connect to Redis
    this.connect();
    
    logger.info('Redis cache provider initialized');
  }
  
  /**
   * Connect to Redis
   */
  private async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis', error as Error);
    }
  }
  
  /**
   * Clean up when the provider is no longer needed
   */
  async dispose(): Promise<void> {
    try {
      await this.client.quit();
    } catch (error) {
      logger.error('Error disconnecting from Redis', error as Error);
    }
  }
  
  /**
   * Get a value from the cache
   * @param key Cache key
   * @param options Cache options
   * @returns Cached value or null if not found
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    if (!this.connected) {
      logger.warn('Redis client not connected, returning null');
      return null;
    }
    
    try {
      const value = await this.client.get(key);
      
      if (!value) {
        return null;
      }
      
      return JSON.parse(value) as T;
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
    if (!this.connected) {
      logger.warn('Redis client not connected, skipping cache set');
      return;
    }
    
    try {
      const ttl = options?.ttl || 0;
      const serializedValue = JSON.stringify(value);
      
      if (ttl > 0) {
        await this.client.setEx(key, ttl, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
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
    if (!this.connected) {
      logger.warn('Redis client not connected, skipping cache delete');
      return;
    }
    
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error(`Error deleting cache key: ${key}`, error as Error);
    }
  }
  
  /**
   * Clear all values from the cache
   * @param options Cache options
   */
  async clear(options?: CacheOptions): Promise<void> {
    if (!this.connected) {
      logger.warn('Redis client not connected, skipping cache clear');
      return;
    }
    
    try {
      // If namespace is provided, only clear keys in that namespace
      if (options?.namespace) {
        const pattern = `${options.namespace}:*`;
        const keys = await this.client.keys(pattern);
        
        if (keys.length > 0) {
          await this.client.del(keys);
          logger.info(`Cleared ${keys.length} keys with pattern: ${pattern}`);
        }
      } else {
        // Clear all keys (DANGEROUS - only use in development)
        await this.client.flushDb();
        logger.warn('Flushed entire Redis database');
      }
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
    if (!this.connected) {
      logger.warn('Redis client not connected, returning false');
      return false;
    }
    
    try {
      return await this.client.exists(key) === 1;
    } catch (error) {
      logger.error(`Error checking cache key: ${key}`, error as Error);
      return false;
    }
  }
  
  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  async getStats(): Promise<{ size: number; memoryUsage: number }> {
    if (!this.connected) {
      logger.warn('Redis client not connected, returning empty stats');
      return { size: 0, memoryUsage: 0 };
    }
    
    try {
      const info = await this.client.info('memory');
      const keyCount = await this.client.dbSize();
      
      // Parse memory usage from info
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const memoryUsage = memoryMatch ? parseInt(memoryMatch[1], 10) : 0;
      
      return {
        size: keyCount,
        memoryUsage
      };
    } catch (error) {
      logger.error('Error getting cache stats', error as Error);
      return { size: 0, memoryUsage: 0 };
    }
  }
}

// Export default for convenience
export default RedisCacheProvider;

/**
 * Cache Service Initializer
 *
 * This module provides functions to initialize the unified cache service
 * with different cache providers based on configuration.
 */

import { createLogger } from '../../utils/unified-logger';
import { cache } from './cacheService';
import MemoryCacheProvider from './memoryCacheProvider';
import RedisCacheProvider, { RedisCacheConfig } from './redisCacheProvider';
import { cacheInvalidation } from './cacheInvalidation';
import { cacheWarming } from './cacheWarming';
import { config } from '../../utils/unified-config';

const logger = createLogger('CacheInitializer');

/**
 * Initialize cache with memory provider
 * @param namespace Default namespace
 * @param ttl Default TTL in seconds
 * @param cleanupIntervalMs Cleanup interval in milliseconds
 */
export function initializeMemoryCache(
  namespace: string = 'default',
  ttl: number = 3600,
  cleanupIntervalMs: number = 60000
): void {
  try {
    logger.info(`Initializing memory cache with namespace: ${namespace}`);

    // Create memory cache provider
    const provider = new MemoryCacheProvider(cleanupIntervalMs);

    // Set provider and defaults
    cache.setProvider(provider);
    cache.setDefaultNamespace(namespace);
    cache.setDefaultTtl(ttl);

    logger.info('Memory cache initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize memory cache', error as Error);
    throw new Error('Memory cache initialization failed');
  }
}

/**
 * Initialize cache with Redis provider
 * @param config Redis configuration
 * @param namespace Default namespace
 * @param ttl Default TTL in seconds
 */
export function initializeRedisCache(
  config: RedisCacheConfig,
  namespace: string = 'default',
  ttl: number = 3600
): void {
  try {
    logger.info(`Initializing Redis cache with namespace: ${namespace}`);

    // Create Redis cache provider
    const provider = new RedisCacheProvider(config);

    // Set provider and defaults
    cache.setProvider(provider);
    cache.setDefaultNamespace(namespace);
    cache.setDefaultTtl(ttl);

    logger.info('Redis cache initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Redis cache', error as Error);
    throw new Error('Redis cache initialization failed');
  }
}

/**
 * Initialize cache based on environment configuration
 */
export function initializeCache(): void {
  try {
    logger.info('Initializing cache service based on environment configuration');

    const cacheType = config.get('cache.type', 'memory');
    const namespace = config.get('cache.namespace', 'default');
    const ttl = config.get('cache.ttl', 3600);

    if (cacheType === 'redis') {
      // Initialize with Redis
      const redisConfig: RedisCacheConfig = {
        url: config.get('cache.redis.url'),
        host: config.get('cache.redis.host', 'localhost'),
        port: config.get('cache.redis.port', 6379),
        password: config.get('cache.redis.password'),
        db: config.get('cache.redis.db', 0),
        tls: config.get('cache.redis.tls', false),
        connectTimeout: config.get('cache.redis.connectTimeout', 10000)
      };

      initializeRedisCache(redisConfig, namespace, ttl);
    } else {
      // Initialize with memory
      const cleanupInterval = config.get('cache.memory.cleanupInterval', 60000);
      initializeMemoryCache(namespace, ttl, cleanupInterval);
    }

    // Initialize cache invalidation
    cacheInvalidation.initialize();

    // Add default invalidation rules
    const defaultRules = config.get('cache.invalidation.rules', []);
    if (defaultRules.length > 0) {
      cacheInvalidation.addRules(defaultRules);
      logger.info(`Added ${defaultRules.length} default cache invalidation rules`);
    }

    // Initialize cache warming
    cacheWarming.initialize();

    // Add default warming sources
    const defaultSources = config.get('cache.warming.sources', []);
    if (defaultSources.length > 0) {
      for (const source of defaultSources) {
        cacheWarming.addSource(source);
      }
      logger.info(`Added ${defaultSources.length} default cache warming sources`);
    }

    // Warm cache if configured
    const warmOnStartup = config.get('cache.warming.warmOnStartup', false);
    if (warmOnStartup) {
      // Warm cache in the background
      setTimeout(() => {
        cacheWarming.warmAll().catch((error) => {
          logger.error('Error warming cache on startup', error);
        });
      }, 1000);

      logger.info('Scheduled cache warming on startup');
    }

    logger.info('Cache service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize cache service', error as Error);

    // Fall back to memory cache
    logger.info('Falling back to memory cache');
    initializeMemoryCache();

    // Initialize cache invalidation
    cacheInvalidation.initialize();

    // Initialize cache warming
    cacheWarming.initialize();
  }
}

// Export default for convenience
export default initializeCache;

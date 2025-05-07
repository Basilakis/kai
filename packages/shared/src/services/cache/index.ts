/**
 * Cache Service Index
 *
 * This file exports all cache-related functionality.
 */

// Export cache service
export { cache, CacheOptions, CacheProvider } from './cacheService';

// Export cache providers
export { default as MemoryCacheProvider } from './memoryCacheProvider';
export { default as RedisCacheProvider, RedisCacheConfig } from './redisCacheProvider';

// Export cache initializer
export {
  initializeCache,
  initializeMemoryCache,
  initializeRedisCache
} from './cacheInitializer';

// Export cache invalidation
export {
  cacheInvalidation,
  CacheInvalidationRule,
  CacheTag
} from './cacheInvalidation';

// Export cache warming
export {
  cacheWarming,
  CacheWarmingStrategy,
  CacheWarmingSource,
  CachePrefetchOptions
} from './cacheWarming';

// Export default for convenience
export { cache as default } from './cacheService';

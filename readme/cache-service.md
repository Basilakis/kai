# Cache Service

This document describes the cache service implementation in the KAI platform. The cache service provides a unified interface for caching operations across the application, with support for different cache providers.

## Overview

The cache service is designed to improve performance by caching frequently accessed data. It provides a consistent API for caching operations, regardless of the underlying cache provider. The service supports both in-memory caching for development and Redis caching for production.

## Architecture

The cache service follows a provider pattern, allowing different cache implementations to be used interchangeably. The service consists of the following components:

1. **Cache Service**: The main service that provides a unified interface for caching operations.
2. **Cache Provider Interface**: An interface that defines the contract for cache providers.
3. **Memory Cache Provider**: A provider that implements in-memory caching.
4. **Redis Cache Provider**: A provider that implements Redis-based caching.
5. **Cache Initializer**: A utility for initializing the cache service with different providers.

## Usage

### Basic Usage

```typescript
import { cache } from '@kai/shared';

// Set a value in the cache
await cache.set('user:123', { name: 'John', email: 'john@example.com' });

// Get a value from the cache
const user = await cache.get<User>('user:123');

// Delete a value from the cache
await cache.delete('user:123');

// Check if a key exists in the cache
const exists = await cache.has('user:123');

// Clear all values from the cache
await cache.clear();
```

### Caching Function Results

```typescript
import { cache } from '@kai/shared';

// Define a function to cache
async function getUserById(id: string): Promise<User> {
  // Expensive operation to get user
  return db.users.findOne({ id });
}

// Create a cached version of the function
const getCachedUserById = cache.cached(
  getUserById,
  (id) => `user:${id}`,
  { ttl: 3600 } // Cache for 1 hour
);

// Use the cached function
const user = await getCachedUserById('123');
```

### Namespaces

```typescript
import { cache } from '@kai/shared';

// Set a value in a specific namespace
await cache.set('123', userData, { namespace: 'users' });

// Get a value from a specific namespace
const user = await cache.get<User>('123', { namespace: 'users' });

// Clear all values in a specific namespace
await cache.clear({ namespace: 'users' });
```

## Configuration

The cache service can be configured through environment variables or the unified configuration system. The following configuration options are available:

```typescript
// In .env file
CACHE_TYPE=redis
CACHE_NAMESPACE=default
CACHE_TTL=3600
CACHE_REDIS_URL=redis://localhost:6379
CACHE_REDIS_HOST=localhost
CACHE_REDIS_PORT=6379
CACHE_REDIS_PASSWORD=password
CACHE_REDIS_DB=0
CACHE_REDIS_TLS=false
CACHE_REDIS_CONNECT_TIMEOUT=10000
CACHE_MEMORY_CLEANUP_INTERVAL=60000
```

## Cache Providers

### Memory Cache Provider

The memory cache provider implements in-memory caching using a Map. It's suitable for development and small-scale applications. Features include:

- In-memory storage using a Map
- TTL support with automatic expiration
- Periodic cleanup of expired entries
- Namespace support
- Memory usage statistics

### Redis Cache Provider

The Redis cache provider implements Redis-based caching. It's suitable for production and distributed applications. Features include:

- Redis-based storage
- TTL support with automatic expiration
- Namespace support
- Connection management with automatic reconnection
- Error handling and logging
- Redis statistics

## Implementation Details

### Cache Service

The cache service provides a unified interface for caching operations. It delegates all operations to the configured provider and adds additional functionality like namespaced keys and function result caching.

```typescript
class CacheService {
  private provider: CacheProvider | null = null;
  private defaultNamespace: string = 'default';
  private defaultTtl: number = 3600; // 1 hour
  
  // Set the cache provider
  setProvider(provider: CacheProvider): void;
  
  // Set the default namespace
  setDefaultNamespace(namespace: string): void;
  
  // Set the default TTL
  setDefaultTtl(ttl: number): void;
  
  // Get a value from the cache
  async get<T>(key: string, options?: CacheOptions): Promise<T | null>;
  
  // Set a value in the cache
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  
  // Delete a value from the cache
  async delete(key: string, options?: CacheOptions): Promise<void>;
  
  // Clear all values from the cache
  async clear(options?: CacheOptions): Promise<void>;
  
  // Check if a key exists in the cache
  async has(key: string, options?: CacheOptions): Promise<boolean>;
  
  // Cache a function result
  cached<T, Args extends any[]>(
    fn: (...args: Args) => Promise<T>,
    keyFn: (...args: Args) => string,
    options?: CacheOptions
  ): (...args: Args) => Promise<T>;
}
```

### Cache Provider Interface

The cache provider interface defines the contract for cache providers. All providers must implement this interface.

```typescript
interface CacheProvider {
  // Get a value from the cache
  get<T>(key: string, options?: CacheOptions): Promise<T | null>;
  
  // Set a value in the cache
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  
  // Delete a value from the cache
  delete(key: string, options?: CacheOptions): Promise<void>;
  
  // Clear all values from the cache
  clear(options?: CacheOptions): Promise<void>;
  
  // Check if a key exists in the cache
  has(key: string, options?: CacheOptions): Promise<boolean>;
}
```

## Benefits

The cache service provides several benefits:

1. **Improved Performance**: Caching frequently accessed data reduces database load and improves response times.
2. **Consistent API**: The unified interface provides a consistent API for caching operations, regardless of the underlying provider.
3. **Provider Flexibility**: The provider pattern allows different cache implementations to be used interchangeably.
4. **Namespace Support**: Namespaces allow for logical separation of cached data.
5. **TTL Support**: Time-to-live support ensures that cached data doesn't become stale.
6. **Function Result Caching**: The `cached` method makes it easy to cache function results.

## Next Steps

The following steps are recommended to further improve the cache service:

1. **Add More Providers**: Add support for more cache providers (Memcached, DynamoDB, etc.).
2. **Add Cache Invalidation**: Add support for cache invalidation based on events or patterns.
3. **Add Cache Warming**: Add support for cache warming to pre-populate the cache.
4. **Add Cache Metrics**: Add support for cache metrics to monitor cache performance.
5. **Add Cache Compression**: Add support for cache compression to reduce memory usage.
6. **Add Cache Sharding**: Add support for cache sharding to distribute cache load.

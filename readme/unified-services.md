# Unified Services

This document describes the unified services architecture implemented to reduce code duplication and standardize service implementations across the KAI platform. The unified services architecture consolidates duplicate implementations of common functionality into a single, shared implementation to improve maintainability and ensure consistent behavior.

## Overview

The unified services architecture consolidates duplicate implementations of common functionality into a single, shared implementation. This reduces code duplication, improves maintainability, and ensures consistent behavior across the application.

The unified services are implemented in the `@kai/shared` package and can be used by all other packages in the monorepo.

## Unified Services

### Storage Service

The unified storage service provides a consistent interface for file storage operations across different storage backends (Supabase Storage, S3, etc.).

```typescript
import { storage, initializeStorage } from '@kai/shared';

// Initialize storage (done automatically by initializeServices)
initializeStorage();

// Upload a file
const result = await storage.uploadFile('/path/to/file.jpg', 'uploads/file.jpg', {
  isPublic: true,
  contentType: 'image/jpeg',
  metadata: {
    userId: '123',
    source: 'user-upload'
  }
});

// Get the URL
console.log(result.url);
```

### Authentication Service

The unified authentication service provides a consistent interface for authentication operations across different authentication providers (Supabase Auth, JWT, API keys, etc.).

```typescript
import { auth, initializeAuth } from '@kai/shared';

// Initialize auth (done automatically by initializeServices)
initializeAuth();

// Login
const result = await auth.login({
  email: 'user@example.com',
  password: 'password'
});

// Get the current user
const user = await auth.getUser();

// Check if the user has a role
const isAdmin = await auth.hasRole('admin');
```

### API Client

The unified API client provides a consistent interface for making HTTP requests with built-in error handling, authentication, retry logic, and caching.

```typescript
import { apiClient, createApiClient } from '@kai/shared';

// Use the default client
const result = await apiClient.get('/api/materials');

// Create a custom client
const customClient = createApiClient({
  baseURL: 'https://api.example.com',
  timeout: 60000,
  useAuth: false,
  useCache: true,
  cacheTtl: 300 // 5 minutes
});

// Make a request with the custom client
const result = await customClient.post('/api/materials', {
  name: 'New Material',
  type: 'ceramic'
});

// Clear the cache for a specific endpoint
await apiClient.clearCache('/api/materials');
```

### MCP Client

The unified MCP (Model Context Protocol) client provides a consistent interface for interacting with the MCP server.

```typescript
import { mcpClient, createMCPClient } from '@kai/shared';

// Use the default client
const result = await mcpClient.recognizeMaterial('/path/to/image.jpg', {
  modelType: 'hybrid',
  confidenceThreshold: 0.7
});

// Create a custom client
const customClient = createMCPClient({
  baseURL: 'http://localhost:8000',
  timeout: 60000
});

// Make a request with the custom client
const models = await customClient.listModels();
```

### Cache Service

The unified cache service provides a consistent interface for caching operations across different cache backends (Memory, Redis, etc.).

```typescript
import { cache, initializeCache } from '@kai/shared';

// Initialize cache (done automatically by initializeServices)
initializeCache();

// Set a value in the cache
await cache.set('user:123', { name: 'John', email: 'john@example.com' }, {
  ttl: 3600, // 1 hour
  namespace: 'users'
});

// Get a value from the cache
const user = await cache.get<User>('user:123', { namespace: 'users' });

// Delete a value from the cache
await cache.delete('user:123', { namespace: 'users' });

// Check if a key exists in the cache
const exists = await cache.has('user:123', { namespace: 'users' });

// Clear all values from a namespace
await cache.clear({ namespace: 'users' });

// Cache a function result
const getCachedUserById = cache.cached(
  getUserById,
  (id) => `user:${id}`,
  { ttl: 3600, namespace: 'users' }
);

// Use the cached function
const user = await getCachedUserById('123');
```

### Telemetry Service

The unified telemetry service provides a consistent interface for collecting metrics, traces, and logs across the application.

```typescript
import { telemetry, initializeTelemetry } from '@kai/shared';

// Initialize telemetry (done automatically by initializeServices)
await initializeTelemetry();

// Track an event
await telemetry.trackEvent({
  type: 'user',
  name: 'user_login',
  timestamp: Date.now(),
  status: 'success',
  properties: {
    userId: '123',
    method: 'password'
  }
});

// Track an error
await telemetry.trackEvent({
  type: 'error',
  name: 'api_error',
  timestamp: Date.now(),
  status: 'error',
  properties: {
    endpoint: '/api/users',
    method: 'GET'
  },
  error: {
    message: 'Failed to fetch users',
    stack: error.stack,
    name: error.name
  }
});

// Measure performance
const id = telemetry.startMeasurement('database_query', {
  query: 'SELECT * FROM users'
});

try {
  const result = await db.query('SELECT * FROM users');
  await telemetry.stopMeasurement(id, { success: true, count: result.length });
  return result;
} catch (error) {
  await telemetry.stopMeasurement(id, { success: false, error: error.message });
  throw error;
}

// Automatic measurement
const result = await telemetry.measure(
  'database_query',
  async () => {
    return await db.query('SELECT * FROM users');
  },
  { query: 'SELECT * FROM users' }
);
```

### Configuration

The unified configuration system provides a consistent interface for accessing configuration values across the application.

```typescript
import { config } from '@kai/shared';

// Initialize configuration (done automatically by initializeServices)
config.init({
  environment: 'development',
  envPath: '/path/to/env/files'
});

// Get a configuration value
const apiUrl = config.get('api').url;

// Set a configuration value
config.set('api', {
  url: 'https://api.example.com',
  timeout: 60000,
  version: '1.0.0'
});
```

### Logging

The unified logging system provides a consistent interface for logging across the application.

```typescript
import { createLogger } from '@kai/shared';

// Create a logger for a specific module
const logger = createLogger('MyModule');

// Log messages
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message', { error: new Error('Something went wrong') });
```

## Initialization

All unified services can be initialized at once using the `initializeServices` function:

```typescript
import { initializeServices } from '@kai/shared';

// Initialize all services
await initializeServices({
  environment: 'development',
  envPath: '/path/to/env/files',
  configOverrides: {
    api: {
      url: 'https://api.example.com'
    },
    cache: {
      type: 'memory',
      namespace: 'default',
      ttl: 3600
    },
    telemetry: {
      enabled: true,
      type: 'console'
    }
  }
});
```

The services are initialized in the following order:

1. Configuration (config)
2. Storage (storage)
3. Authentication (auth)
4. Cache (cache)
5. Telemetry (telemetry)

Each service can also be initialized individually if needed:

```typescript
import {
  config,
  initializeStorage,
  initializeAuth,
  initializeCache,
  initializeTelemetry
} from '@kai/shared';

// Initialize configuration
config.init({
  environment: 'development',
  envPath: '/path/to/env/files'
});

// Initialize storage
initializeStorage();

// Initialize authentication
initializeAuth();

// Initialize cache
initializeCache();

// Initialize telemetry
await initializeTelemetry();
```

## Migration Guide

To migrate from the old, duplicate implementations to the unified services:

1. **Storage Services**:
   - Replace `uploadToStorage`, `uploadBufferToStorage`, etc. with `storage.uploadFile`, `storage.uploadBuffer`, etc.
   - Replace `uploadToS3`, `uploadBufferToS3`, etc. with the same unified methods.

2. **Authentication Services**:
   - Replace package-specific auth services with `auth.login`, `auth.register`, etc.
   - Replace token management with `auth.getToken`, `auth.setToken`, etc.

3. **API Clients**:
   - Replace package-specific API clients with `apiClient.get`, `apiClient.post`, etc.
   - Replace MCP client implementations with `mcpClient.recognizeMaterial`, `mcpClient.listModels`, etc.

4. **Configuration**:
   - Replace package-specific configuration with `config.get`, `config.set`, etc.

5. **Logging**:
   - Replace package-specific loggers with `createLogger('ModuleName')`.

6. **Caching**:
   - Replace custom caching implementations with `cache.get`, `cache.set`, etc.
   - Use the `cache.cached` method to cache function results.

7. **Telemetry**:
   - Replace custom telemetry implementations with `telemetry.trackEvent`, etc.
   - Use the `telemetry.measure` method to measure function performance.

## Best Practices

1. **Always use the unified services** instead of creating new implementations.
2. **Initialize services early** in the application lifecycle.
3. **Use type-safe methods** provided by the unified services.
4. **Extend the unified services** if you need custom functionality, rather than creating new implementations.
5. **Contribute improvements** to the unified services rather than working around limitations.

## Consolidated Services

The following services have been consolidated into unified implementations:

### Storage Services
- `supabaseStorageService.ts` and `s3Service.ts` in the server package
- `storageService.ts` and `s3StorageAdapter.ts` in the shared package
- Various utility functions for file uploads in different modules

### Authentication Services
- `auth.middleware.ts` in the server package
- `authService.ts` in the agents package
- `supabaseAuth.service.ts` in the client package
- Duplicate token handling across different services

### Logging Implementations
- `logger.ts` in the server package
- `logger.ts` in the ml package
- `logger.ts` in the agents package
- `logger.ts` in the shared package

### Environment Configuration
- `environment.ts` in the agents package
- `environment.ts` in the shared package
- `config.ts` in the client package
- `config.ts` in the shared package
- Multiple .env files with overlapping variables

### API Clients
- `mcpClientService.ts` in the server package
- `mcp-integration.ts` in the ml package
- `apiClient.ts` in the client package
- `huggingFaceClient.ts` in the server package

### Supabase Integration
- `supabaseClient.ts` in the server package
- `supabaseClient.ts` in the client package
- `supabaseClient.ts` in the shared package
- `supabaseHelper.ts` in the server package
- `supabaseHelpers.ts` in the shared package

## Future Improvements

1. **Add more storage providers** (Google Cloud Storage, Azure Blob Storage, etc.)
2. **Enhance authentication**:
   - Add direct SAML support (if not already provided by Supabase)
   - Implement custom multi-factor authentication flows
   - Support passwordless authentication methods
   - Add biometric authentication options
   - Implement social login analytics and conversion tracking
3. **Improve error handling** and retry logic
4. **Enhance logging**:
   - Add more logging destinations (Elasticsearch, Datadog, etc.)
   - Implement structured logging
   - Add log rotation and archiving
5. **Enhance configuration**:
   - Add more configuration sources (environment variables, JSON files, etc.)
   - Implement configuration validation
   - Add support for dynamic configuration updates
6. **Expand API client capabilities**:
   - Add more specialized clients (GraphQL, WebSocket, etc.)
   - Implement request batching and deduplication
   - Add support for API versioning
7. **Add more database providers** beyond Supabase
8. **Enhance caching**:
   - Add more cache providers (Memcached, DynamoDB, etc.)
   - Implement cache invalidation based on events
   - Add cache warming and prefetching
   - Implement distributed caching
9. **Enhance telemetry**:
   - Add more telemetry providers (Application Insights, Datadog, etc.)
   - Implement distributed tracing
   - Add support for custom dimensions and metrics
   - Implement sampling and filtering
   - Add alerting based on telemetry data

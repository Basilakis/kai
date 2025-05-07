# Enhanced Cron Scheduling

This document describes the enhanced cron scheduling implementation for the cache warming service. The cache warming service provides a unified interface for warming and prefetching cache entries, improving performance by proactively populating the cache with frequently accessed data.

## Overview

The cache warming service now supports enhanced cron scheduling with the following features:

1. **Full Cron Syntax**: Support for the full cron syntax including step values, ranges, and lists
2. **Timezone Support**: Support for specifying the timezone for cron expressions
3. **Jitter**: Support for adding jitter to scheduled executions to prevent thundering herd problems
4. **Backoff Strategy**: Support for exponential backoff for failed executions
5. **Dependencies**: Support for defining dependencies between warming sources

## Enhanced Cron Parser

The enhanced cron parser supports the full cron syntax, including:

### Step Values

Step values allow you to specify a step for a range of values. For example, `*/5` means "every 5 units".

```
*/5 * * * *  # Every 5 minutes
* */2 * * *  # Every 2 hours
```

### Ranges

Ranges allow you to specify a range of values. For example, `1-5` means "1 through 5".

```
1-5 * * * *  # Minutes 1 through 5
* 9-17 * * *  # Hours 9 through 17 (9 AM to 5 PM)
```

### Lists

Lists allow you to specify a list of values. For example, `1,3,5` means "1, 3, and 5".

```
1,3,5 * * * *  # Minutes 1, 3, and 5
* * * * 1,3,5  # Monday, Wednesday, and Friday
```

### Ranges with Steps

Ranges with steps allow you to specify a step for a range of values. For example, `1-10/2` means "every 2 units from 1 through 10".

```
1-10/2 * * * *  # Minutes 1, 3, 5, 7, 9
* 9-17/2 * * *  # Hours 9, 11, 13, 15, 17 (9 AM, 11 AM, 1 PM, 3 PM, 5 PM)
```

## Timezone Support

The enhanced cron parser supports specifying the timezone for cron expressions. This allows you to schedule cache warming operations in a specific timezone, regardless of the server's timezone.

```typescript
import { TimezoneInfo } from '@kai/shared';

// Add a cache warming source with a timezone
cacheWarming.addSource({
  id: 'popular-products',
  name: 'Popular Products',
  namespace: 'products',
  strategy: CacheWarmingStrategy.SCHEDULED,
  schedule: '0 0 * * *', // Every day at midnight
  timezone: {
    name: 'America/New_York',
    offsetMinutes: -240 // -4 hours
  },
  fetch: async () => {
    // Fetch popular products
    const products = await fetchPopularProducts();
    
    // Return products as a record of key-value pairs
    return products.reduce((acc, product) => {
      acc[product.id] = product;
      return acc;
    }, {});
  }
});
```

## Jitter

The enhanced cron parser supports adding jitter to scheduled executions. Jitter helps prevent the "thundering herd" problem, where many clients try to access a resource at the same time.

```typescript
import { JitterOptions } from '@kai/shared';

// Add a cache warming source with jitter
cacheWarming.addSource({
  id: 'popular-products',
  name: 'Popular Products',
  namespace: 'products',
  strategy: CacheWarmingStrategy.SCHEDULED,
  schedule: '*/5 * * * *', // Every 5 minutes
  jitter: {
    enabled: true,
    maxPercent: 0.2 // Up to 20% jitter
  },
  fetch: async () => {
    // Fetch popular products
    const products = await fetchPopularProducts();
    
    // Return products as a record of key-value pairs
    return products.reduce((acc, product) => {
      acc[product.id] = product;
      return acc;
    }, {});
  }
});
```

## Backoff Strategy

The enhanced cache warming service supports exponential backoff for failed executions. This helps prevent overloading the system when a warming source is failing.

```typescript
import { BackoffStrategy } from '@kai/shared';

// Add a cache warming source with backoff
cacheWarming.addSource({
  id: 'popular-products',
  name: 'Popular Products',
  namespace: 'products',
  strategy: CacheWarmingStrategy.SCHEDULED,
  schedule: '*/5 * * * *', // Every 5 minutes
  backoff: {
    initialDelay: 1000, // 1 second
    maxDelay: 60000, // 1 minute
    factor: 2, // Double the delay each time
    maxRetries: 5 // Maximum 5 retries
  },
  fetch: async () => {
    // Fetch popular products
    const products = await fetchPopularProducts();
    
    // Return products as a record of key-value pairs
    return products.reduce((acc, product) => {
      acc[product.id] = product;
      return acc;
    }, {});
  }
});
```

## Dependencies

The enhanced cache warming service supports defining dependencies between warming sources. This ensures that dependent sources are warmed before the source itself.

```typescript
// Add a cache warming source with dependencies
cacheWarming.addSource({
  id: 'product-recommendations',
  name: 'Product Recommendations',
  namespace: 'recommendations',
  strategy: CacheWarmingStrategy.SCHEDULED,
  schedule: '*/10 * * * *', // Every 10 minutes
  dependencies: ['popular-products', 'user-preferences'],
  fetch: async () => {
    // Fetch product recommendations
    const recommendations = await fetchProductRecommendations();
    
    // Return recommendations as a record of key-value pairs
    return recommendations.reduce((acc, recommendation) => {
      acc[recommendation.id] = recommendation;
      return acc;
    }, {});
  }
});
```

## Improved Scheduling Algorithm

The enhanced cron parser uses a more sophisticated algorithm to determine the appropriate interval for a cron expression. It calculates the minimum interval based on the cron expression, taking into account all possible values.

For example, for the cron expression `*/5 * * * *` (every 5 minutes), the algorithm calculates that the minimum interval is 5 minutes.

For more complex expressions like `0,15,30,45 * * * *` (every 15 minutes), the algorithm calculates that the minimum interval is 15 minutes.

## Implementation Details

### Cron Parser

The enhanced cron parser provides the following functions:

#### parseCronToMs

Parses a cron expression into a millisecond interval, taking into account jitter.

```typescript
function parseCronToMs(expression: string, jitter?: JitterOptions): number;
```

#### getNextExecutionTime

Gets the next execution time for a cron expression, taking into account timezone and jitter.

```typescript
function getNextExecutionTime(
  expression: string,
  baseTime?: Date,
  timezone?: TimezoneInfo,
  jitter?: JitterOptions
): Date;
```

#### isValidCronExpression

Checks if a cron expression is valid.

```typescript
function isValidCronExpression(expression: string): boolean;
```

### Cache Warming Service

The cache warming service has been updated to use the enhanced cron parser. The following changes have been made:

#### CacheWarmingSource Interface

The `CacheWarmingSource` interface has been updated to include timezone, jitter, backoff, and dependencies.

```typescript
export interface CacheWarmingSource<T = any> {
  /** Source ID */
  id: string;
  /** Source name */
  name: string;
  /** Cache namespace */
  namespace: string;
  /** Cache TTL in seconds */
  ttl?: number;
  /** Warming strategy */
  strategy: CacheWarmingStrategy;
  /** Schedule (cron expression) for scheduled warming */
  schedule?: string;
  /** Timezone information for scheduled warming */
  timezone?: TimezoneInfo;
  /** Jitter options for scheduled warming */
  jitter?: JitterOptions;
  /** Backoff strategy for failed executions */
  backoff?: BackoffStrategy;
  /** Dependencies on other sources */
  dependencies?: string[];
  /** Function to fetch data */
  fetch: () => Promise<Record<string, T>>;
  /** Description of the source */
  description?: string;
}
```

#### scheduleWarming Method

The `scheduleWarming` method has been updated to use the enhanced cron parser and handle dependencies, jitter, and backoff.

#### warmDependencies Method

A new `warmDependencies` method has been added to warm dependencies for a source.

#### handleWarmingError Method

A new `handleWarmingError` method has been added to handle warming errors and implement backoff.

## Benefits

The implementation of enhanced cron scheduling provides several benefits:

1. **Flexibility**: Support for the full cron syntax allows for more flexible scheduling
2. **Precision**: Timezone support allows for more precise scheduling based on specific timezones
3. **Reliability**: Jitter helps prevent the "thundering herd" problem
4. **Resilience**: Backoff strategy helps prevent overloading the system when a warming source is failing
5. **Dependency Management**: Support for dependencies ensures that dependent sources are warmed before the source itself
6. **Efficiency**: Improved scheduling algorithm calculates the appropriate interval for a cron expression

## Next Steps

The following steps are recommended to further improve the cache warming service:

1. **Add Support for More Timezone Formats**: Add support for more timezone formats (e.g., IANA timezone names)
2. **Add Support for More Cron Features**: Add support for more cron features (e.g., L, W, #, ?)
3. **Add Support for Cron Validation**: Add support for validating cron expressions against specific constraints
4. **Add Support for Cron Expression Builder**: Add support for building cron expressions programmatically
5. **Add Support for Cron Expression Parser**: Add support for parsing cron expressions into human-readable descriptions
6. **Add Support for Cron Expression Optimizer**: Add support for optimizing cron expressions for better performance
7. **Add Support for Cron Expression Migrator**: Add support for migrating cron expressions between different formats

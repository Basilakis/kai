# Cache Warming Cron Scheduling

This document describes the implementation of proper cron scheduling for the cache warming service. The cache warming service provides a unified interface for warming and prefetching cache entries, improving performance by proactively populating the cache with frequently accessed data.

## Overview

The cache warming service now supports proper cron scheduling for warming sources. This allows for more flexible and precise scheduling of cache warming operations, enabling administrators to define when cache warming should occur based on application usage patterns.

## Cron Parser

A custom cron parser has been implemented to support cron expressions for scheduling cache warming operations. The parser supports a subset of the cron syntax and provides functions for parsing cron expressions, calculating the next execution time, and validating cron expressions.

### Cron Expression Format

The cron expression format is as follows:

```
* * * * *
| | | | |
| | | | +----- Day of week (0 - 6) (Sunday = 0)
| | | +-------- Month (1 - 12)
| | +----------- Day of month (1 - 31)
| +-------------- Hour (0 - 23)
+----------------- Minute (0 - 59)
```

### Special Expressions

The parser also supports special expressions for common scheduling patterns:

- **@yearly, @annually**: Run once a year at midnight on January 1st (0 0 1 1 *)
- **@monthly**: Run once a month at midnight on the first day (0 0 1 * *)
- **@weekly**: Run once a week at midnight on Sunday (0 0 * * 0)
- **@daily, @midnight**: Run once a day at midnight (0 0 * * *)
- **@hourly**: Run once an hour at the beginning of the hour (0 * * * *)
- **@every_minute**: Run once a minute (* * * * *)
- **@every_5_minutes**: Run every 5 minutes (*/5 * * * *)
- **@every_10_minutes**: Run every 10 minutes (*/10 * * * *)
- **@every_15_minutes**: Run every 15 minutes (*/15 * * * *)
- **@every_30_minutes**: Run every 30 minutes (*/30 * * * *)

### Cron Parser Functions

The cron parser provides the following functions:

#### parseCronToMs

Parses a cron expression into a millisecond interval.

```typescript
function parseCronToMs(expression: string): number;
```

#### getNextExecutionTime

Gets the next execution time for a cron expression.

```typescript
function getNextExecutionTime(expression: string, baseTime?: Date): Date;
```

#### isValidCronExpression

Checks if a cron expression is valid.

```typescript
function isValidCronExpression(expression: string): boolean;
```

## Cache Warming Service

The cache warming service has been updated to use the cron parser for scheduling cache warming operations. The following changes have been made:

### CacheWarmingSource Interface

The `CacheWarmingSource` interface has been updated to include a `schedule` property for defining when cache warming should occur.

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
  /** Function to fetch data */
  fetch: () => Promise<Record<string, T>>;
  /** Description of the source */
  description?: string;
}
```

### scheduleWarming Method

The `scheduleWarming` method has been updated to use the cron parser for scheduling cache warming operations. It now supports cron expressions for defining when cache warming should occur.

```typescript
private scheduleWarming(source: CacheWarmingSource): void {
  // Cancel existing schedule if any
  if (this.schedules.has(source.id)) {
    clearTimeout(this.schedules.get(source.id)!);
  }
  
  // Validate schedule
  if (!source.schedule) {
    logger.warn(`No schedule provided for source: ${source.id}, using default hourly schedule`);
    source.schedule = '@hourly';
  }
  
  if (!isValidCronExpression(source.schedule)) {
    logger.warn(`Invalid cron expression: ${source.schedule} for source: ${source.id}, using default hourly schedule`);
    source.schedule = '@hourly';
  }
  
  // Get the interval from the cron expression
  const interval = parseCronToMs(source.schedule);
  
  // Schedule the first execution
  const scheduleNextExecution = () => {
    const now = new Date();
    const nextExecutionTime = getNextExecutionTime(source.schedule!, now);
    const delay = nextExecutionTime.getTime() - now.getTime();
    
    logger.debug(`Scheduling next execution for source: ${source.id}`, {
      currentTime: now.toISOString(),
      nextExecutionTime: nextExecutionTime.toISOString(),
      delayMs: delay
    });
    
    // Schedule the next execution
    const timeout = setTimeout(() => {
      // Execute the warming
      this.warmSource(source.id)
        .catch((error) => {
          logger.error(`Error in scheduled warming for source: ${source.id}`, error);
        })
        .finally(() => {
          // Schedule the next execution
          scheduleNextExecution();
        });
    }, delay);
    
    // Store the timeout
    this.schedules.set(source.id, timeout);
  };
  
  // Start the scheduling
  scheduleNextExecution();
  
  // Log the scheduling
  logger.info(`Scheduled warming for source: ${source.id}`, {
    schedule: source.schedule,
    intervalMs: interval
  });
}
```

### initialize Method

The `initialize` method has been updated to handle existing schedules. It now cancels any existing schedules and re-schedules any existing sources.

```typescript
initialize(): void {
  if (this.initialized) {
    return;
  }
  
  this.initialized = true;
  this.enabled = config.get('cache.warming.enabled', true);
  
  // Cancel any existing schedules
  for (const timeout of this.schedules.values()) {
    clearTimeout(timeout);
  }
  this.schedules.clear();
  
  // Re-schedule any existing sources
  if (this.enabled) {
    for (const source of this.sources.values()) {
      if (source.strategy === CacheWarmingStrategy.SCHEDULED && source.schedule) {
        this.scheduleWarming(source);
      }
    }
  }
  
  // Track with telemetry
  telemetry.trackEvent({
    type: 'cache',
    name: 'cache_warming_initialized',
    timestamp: Date.now(),
    status: 'success',
    properties: {
      enabled: this.enabled,
      sourceCount: this.sources.size,
      scheduledCount: Array.from(this.sources.values()).filter(
        source => source.strategy === CacheWarmingStrategy.SCHEDULED && source.schedule
      ).length
    }
  });
  
  logger.info('Cache warming service initialized', {
    enabled: this.enabled,
    sourceCount: this.sources.size,
    scheduledCount: this.schedules.size
  });
}
```

### enable and disable Methods

The `enable` and `disable` methods have been updated to handle schedules. The `enable` method now re-schedules any existing sources, and the `disable` method now cancels all schedules.

```typescript
enable(): void {
  if (this.enabled) {
    return;
  }
  
  this.enabled = true;
  
  // Re-schedule any existing sources
  for (const source of this.sources.values()) {
    if (source.strategy === CacheWarmingStrategy.SCHEDULED && source.schedule) {
      this.scheduleWarming(source);
    }
  }
  
  // Track with telemetry
  telemetry.trackEvent({
    type: 'cache',
    name: 'cache_warming_enabled',
    timestamp: Date.now(),
    status: 'success',
    properties: {
      sourceCount: this.sources.size,
      scheduledCount: this.schedules.size
    }
  });
  
  logger.info('Cache warming enabled', {
    sourceCount: this.sources.size,
    scheduledCount: this.schedules.size
  });
}

disable(): void {
  if (!this.enabled) {
    return;
  }
  
  this.enabled = false;
  
  // Cancel all schedules
  for (const timeout of this.schedules.values()) {
    clearTimeout(timeout);
  }
  this.schedules.clear();
  
  // Track with telemetry
  telemetry.trackEvent({
    type: 'cache',
    name: 'cache_warming_disabled',
    timestamp: Date.now(),
    status: 'success',
    properties: {
      sourceCount: this.sources.size
    }
  });
  
  logger.info('Cache warming disabled', {
    sourceCount: this.sources.size
  });
}
```

## Usage

To use the cron scheduling feature, define a cache warming source with a cron expression for the schedule:

```typescript
import { cacheWarming, CacheWarmingStrategy } from '@kai/shared';

// Add a cache warming source with a cron schedule
cacheWarming.addSource({
  id: 'popular-products',
  name: 'Popular Products',
  namespace: 'products',
  strategy: CacheWarmingStrategy.SCHEDULED,
  schedule: '0 */2 * * *', // Every 2 hours
  fetch: async () => {
    // Fetch popular products
    const products = await fetchPopularProducts();
    
    // Return products as a record of key-value pairs
    return products.reduce((acc, product) => {
      acc[product.id] = product;
      return acc;
    }, {});
  },
  description: 'Warm cache for popular products'
});
```

## Benefits

The implementation of proper cron scheduling provides several benefits:

1. **Flexibility**: Support for cron expressions allows for more flexible scheduling
2. **Precision**: Cron expressions allow for more precise scheduling based on application usage patterns
3. **Efficiency**: Scheduling cache warming operations during off-peak hours reduces the impact on application performance
4. **Consistency**: Using a standard cron syntax makes it easier for administrators to define schedules
5. **Reliability**: The scheduling mechanism is more reliable and handles edge cases better

## Next Steps

The following steps are recommended to further improve the cache warming service:

1. **Add Support for More Cron Features**: Add support for more cron features (e.g., step values, ranges, lists)
2. **Add Support for Timezone**: Add support for specifying the timezone for cron expressions
3. **Add Support for Jitter**: Add support for adding jitter to scheduled executions to prevent thundering herd problems
4. **Add Support for Backoff**: Add support for exponential backoff for failed executions
5. **Add Support for Dependencies**: Add support for defining dependencies between warming sources

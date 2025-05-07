/**
 * Cache Warming
 *
 * This module provides functionality for warming and prefetching cache entries.
 * It helps improve performance by proactively populating the cache with frequently accessed data.
 */

import { createLogger } from '../../utils/unified-logger';
import { cache } from './cacheService';
import { telemetry } from '../telemetry';
import { tracing, SpanKind } from '../tracing';
import { config } from '../../utils/unified-config';
import {
  parseCronToMs,
  getNextExecutionTime,
  isValidCronExpression,
  TimezoneInfo,
  JitterOptions
} from '../../utils/cron-parser';

const logger = createLogger('CacheWarming');

/**
 * Cache warming strategy
 */
export enum CacheWarmingStrategy {
  /** Warm the cache on demand */
  ON_DEMAND = 'on_demand',
  /** Warm the cache on a schedule */
  SCHEDULED = 'scheduled',
  /** Warm the cache based on access patterns */
  ADAPTIVE = 'adaptive'
}

/**
 * Backoff strategy for failed executions
 */
export interface BackoffStrategy {
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Backoff factor */
  factor: number;
  /** Maximum retry count */
  maxRetries: number;
}

/**
 * Cache warming source
 */
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

/**
 * Cache prefetch options
 */
export interface CachePrefetchOptions {
  /** Whether to force prefetch even if the key exists */
  force?: boolean;
  /** Cache TTL in seconds */
  ttl?: number;
  /** Cache namespace */
  namespace?: string;
}

/**
 * Cache warming service
 */
class CacheWarming {
  private sources: Map<string, CacheWarmingSource> = new Map();
  private schedules: Map<string, NodeJS.Timeout> = new Map();
  private retryCounters: Map<string, number> = new Map();
  private initialized: boolean = false;
  private enabled: boolean = true;

  /**
   * Initialize the cache warming service
   */
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

  /**
   * Enable cache warming
   */
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

  /**
   * Disable cache warming
   */
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

  /**
   * Add a cache warming source
   * @param source Cache warming source
   */
  addSource<T = any>(source: CacheWarmingSource<T>): void {
    if (!this.enabled) {
      logger.warn('Cache warming is disabled, source will not be added');
      return;
    }

    this.sources.set(source.id, source);

    // Schedule warming if needed
    if (source.strategy === CacheWarmingStrategy.SCHEDULED && source.schedule) {
      this.scheduleWarming(source);
    }

    logger.info(`Added cache warming source: ${source.id}`, {
      name: source.name,
      namespace: source.namespace,
      strategy: source.strategy,
      schedule: source.schedule
    });
  }

  /**
   * Remove a cache warming source
   * @param sourceId Source ID
   */
  removeSource(sourceId: string): void {
    if (!this.sources.has(sourceId)) {
      return;
    }

    // Cancel schedule if exists
    if (this.schedules.has(sourceId)) {
      clearTimeout(this.schedules.get(sourceId)!);
      this.schedules.delete(sourceId);
    }

    this.sources.delete(sourceId);

    logger.info(`Removed cache warming source: ${sourceId}`);
  }

  /**
   * Clear all cache warming sources
   */
  clearSources(): void {
    // Cancel all schedules
    for (const timeout of this.schedules.values()) {
      clearTimeout(timeout);
    }

    this.schedules.clear();
    this.sources.clear();

    // Track with telemetry
    telemetry.trackEvent({
      type: 'cache',
      name: 'cache_warming_sources_cleared',
      timestamp: Date.now(),
      status: 'success'
    });

    logger.info('Cleared all cache warming sources');
  }

  /**
   * Get all cache warming sources
   * @returns Cache warming sources
   */
  getSources(): CacheWarmingSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Warm the cache for a specific source
   * @param sourceId Source ID
   */
  async warmSource(sourceId: string): Promise<void> {
    if (!this.enabled) {
      logger.warn('Cache warming is disabled');
      return;
    }

    if (!this.sources.has(sourceId)) {
      logger.warn(`Cache warming source not found: ${sourceId}`);
      return;
    }

    const source = this.sources.get(sourceId)!;

    // Use tracing to track the warming
    await tracing.withSpan(
      `CACHE_WARM ${source.id}`,
      async () => {
        // Get the current span
        const span = tracing.getCurrentSpan();

        if (span) {
          // Add attributes to the span
          tracing.addSpanAttributes(span, {
            'cache.source': source.id,
            'cache.namespace': source.namespace,
            'cache.strategy': source.strategy
          });
        }

        // Track with telemetry
        telemetry.trackEvent({
          type: 'cache',
          name: 'cache_warming_started',
          timestamp: Date.now(),
          status: 'info',
          properties: {
            sourceId: source.id,
            name: source.name,
            namespace: source.namespace,
            strategy: source.strategy
          }
        });

        try {
          // Fetch data
          const startTime = Date.now();
          const data = await source.fetch();
          const fetchTime = Date.now() - startTime;

          // Add fetch time to span
          if (span) {
            tracing.addSpanAttributes(span, {
              'cache.fetch_time_ms': fetchTime
            });
          }

          // Cache data
          const keys = Object.keys(data);
          for (const key of keys) {
            await cache.set(key, data[key], {
              namespace: source.namespace,
              ttl: source.ttl
            });
          }

          const totalTime = Date.now() - startTime;

          // Add total time to span
          if (span) {
            tracing.addSpanAttributes(span, {
              'cache.total_time_ms': totalTime,
              'cache.key_count': keys.length
            });
          }

          // Track with telemetry
          telemetry.trackEvent({
            type: 'cache',
            name: 'cache_warming_completed',
            timestamp: Date.now(),
            status: 'success',
            properties: {
              sourceId: source.id,
              name: source.name,
              namespace: source.namespace,
              strategy: source.strategy,
              keyCount: keys.length,
              fetchTimeMs: fetchTime,
              totalTimeMs: totalTime
            }
          });

          logger.info(`Warmed cache for source: ${source.id}`, {
            keyCount: keys.length,
            fetchTimeMs: fetchTime,
            totalTimeMs: totalTime
          });
        } catch (error) {
          logger.error(`Error warming cache for source: ${source.id}`, error as Error);

          // Track error with telemetry
          telemetry.trackEvent({
            type: 'error',
            name: 'cache_warming_error',
            timestamp: Date.now(),
            status: 'error',
            properties: {
              sourceId: source.id,
              name: source.name,
              namespace: source.namespace,
              strategy: source.strategy
            },
            error: {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              name: error instanceof Error ? error.name : undefined
            }
          });

          // Add error to span
          if (span) {
            tracing.setSpanStatus(
              span,
              1, // ERROR
              error instanceof Error ? error.message : String(error)
            );
          }
        }
      },
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          'cache.source': source.id,
          'cache.namespace': source.namespace,
          'cache.strategy': source.strategy
        }
      }
    );
  }

  /**
   * Warm all cache sources
   */
  async warmAll(): Promise<void> {
    if (!this.enabled) {
      logger.warn('Cache warming is disabled');
      return;
    }

    logger.info(`Warming all cache sources (${this.sources.size})`);

    const promises: Promise<void>[] = [];

    for (const sourceId of this.sources.keys()) {
      promises.push(this.warmSource(sourceId));
    }

    await Promise.all(promises);

    logger.info('Completed warming all cache sources');
  }

  /**
   * Prefetch a cache key
   * @param key Cache key
   * @param fetchFn Function to fetch data
   * @param options Prefetch options
   * @returns Fetched data
   */
  async prefetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options?: CachePrefetchOptions
  ): Promise<T> {
    if (!this.enabled) {
      // If warming is disabled, just fetch and return
      return await fetchFn();
    }

    const namespace = options?.namespace || 'default';
    const ttl = options?.ttl;
    const force = options?.force || false;

    // Check if key exists in cache
    if (!force && await cache.has(key, { namespace })) {
      // Key exists, return from cache
      const cachedValue = await cache.get<T>(key, { namespace });

      if (cachedValue !== null) {
        return cachedValue;
      }
    }

    // Use tracing to track the prefetch
    return await tracing.withSpan(
      `CACHE_PREFETCH ${key}`,
      async () => {
        // Get the current span
        const span = tracing.getCurrentSpan();

        if (span) {
          // Add attributes to the span
          tracing.addSpanAttributes(span, {
            'cache.key': key,
            'cache.namespace': namespace,
            'cache.force': force
          });
        }

        // Track with telemetry
        telemetry.trackEvent({
          type: 'cache',
          name: 'cache_prefetch',
          timestamp: Date.now(),
          status: 'info',
          properties: {
            key,
            namespace,
            force
          }
        });

        try {
          // Fetch data
          const startTime = Date.now();
          const data = await fetchFn();
          const fetchTime = Date.now() - startTime;

          // Add fetch time to span
          if (span) {
            tracing.addSpanAttributes(span, {
              'cache.fetch_time_ms': fetchTime
            });
          }

          // Cache data
          await cache.set(key, data, {
            namespace,
            ttl
          });

          // Track with telemetry
          telemetry.trackEvent({
            type: 'cache',
            name: 'cache_prefetch_completed',
            timestamp: Date.now(),
            status: 'success',
            properties: {
              key,
              namespace,
              force,
              fetchTimeMs: fetchTime
            }
          });

          logger.debug(`Prefetched cache key: ${key}`, {
            namespace,
            fetchTimeMs: fetchTime
          });

          return data;
        } catch (error) {
          logger.error(`Error prefetching cache key: ${key}`, error as Error);

          // Track error with telemetry
          telemetry.trackEvent({
            type: 'error',
            name: 'cache_prefetch_error',
            timestamp: Date.now(),
            status: 'error',
            properties: {
              key,
              namespace,
              force
            },
            error: {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              name: error instanceof Error ? error.name : undefined
            }
          });

          // Add error to span
          if (span) {
            tracing.setSpanStatus(
              span,
              1, // ERROR
              error instanceof Error ? error.message : String(error)
            );
          }

          throw error;
        }
      },
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          'cache.key': key,
          'cache.namespace': namespace,
          'cache.force': force
        }
      }
    );
  }

  /**
   * Schedule warming for a source
   * @param source Cache warming source
   */
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
    const interval = parseCronToMs(source.schedule, source.jitter);

    // Check dependencies
    const hasDependencies = source.dependencies && source.dependencies.length > 0;

    // Schedule the first execution
    const scheduleNextExecution = () => {
      const now = new Date();
      const nextExecutionTime = getNextExecutionTime(
        source.schedule!,
        now,
        source.timezone,
        source.jitter
      );
      const delay = nextExecutionTime.getTime() - now.getTime();

      logger.debug(`Scheduling next execution for source: ${source.id}`, {
        currentTime: now.toISOString(),
        nextExecutionTime: nextExecutionTime.toISOString(),
        delayMs: delay,
        hasDependencies,
        timezone: source.timezone?.name,
        jitterEnabled: source.jitter?.enabled
      });

      // Schedule the next execution
      const timeout = setTimeout(() => {
        // Check if dependencies need to be warmed first
        if (hasDependencies) {
          this.warmDependencies(source)
            .then(() => this.warmSource(source.id))
            .catch((error) => {
              logger.error(`Error in scheduled warming for source: ${source.id}`, error);
              this.handleWarmingError(source, error);
            })
            .finally(() => {
              // Schedule the next execution
              scheduleNextExecution();
            });
        } else {
          // Execute the warming
          this.warmSource(source.id)
            .catch((error) => {
              logger.error(`Error in scheduled warming for source: ${source.id}`, error);
              this.handleWarmingError(source, error);
            })
            .finally(() => {
              // Schedule the next execution
              scheduleNextExecution();
            });
        }
      }, delay);

      // Store the timeout
      this.schedules.set(source.id, timeout);
    };

    // Start the scheduling
    scheduleNextExecution();

    // Log the scheduling
    logger.info(`Scheduled warming for source: ${source.id}`, {
      schedule: source.schedule,
      intervalMs: interval,
      timezone: source.timezone?.name,
      jitterEnabled: source.jitter?.enabled,
      backoffEnabled: !!source.backoff,
      dependencies: source.dependencies
    });

    // Track with telemetry
    telemetry.trackEvent({
      type: 'cache',
      name: 'cache_warming_scheduled',
      timestamp: Date.now(),
      status: 'info',
      properties: {
        sourceId: source.id,
        name: source.name,
        namespace: source.namespace,
        schedule: source.schedule,
        intervalMs: interval,
        timezone: source.timezone?.name,
        jitterEnabled: source.jitter?.enabled,
        backoffEnabled: !!source.backoff,
        dependencies: source.dependencies?.join(',')
      }
    });
  }

  /**
   * Warm dependencies for a source
   * @param source Cache warming source
   */
  private async warmDependencies(source: CacheWarmingSource): Promise<void> {
    if (!source.dependencies || source.dependencies.length === 0) {
      return;
    }

    logger.debug(`Warming dependencies for source: ${source.id}`, {
      dependencies: source.dependencies
    });

    // Warm each dependency
    const promises = source.dependencies.map(dependencyId => {
      const dependency = this.sources.get(dependencyId);

      if (!dependency) {
        logger.warn(`Dependency not found: ${dependencyId} for source: ${source.id}`);
        return Promise.resolve();
      }

      return this.warmSource(dependencyId);
    });

    // Wait for all dependencies to be warmed
    await Promise.all(promises);

    logger.debug(`Finished warming dependencies for source: ${source.id}`);
  }

  /**
   * Handle warming error
   * @param source Cache warming source
   * @param error Error
   */
  private handleWarmingError(source: CacheWarmingSource, error: any): void {
    // Check if backoff is configured
    if (!source.backoff) {
      return;
    }

    // Get the current retry count
    const retryCount = this.getRetryCount(source.id);

    // Check if we've reached the maximum retry count
    if (retryCount >= source.backoff.maxRetries) {
      logger.warn(`Maximum retry count reached for source: ${source.id}`, {
        retryCount,
        maxRetries: source.backoff.maxRetries
      });

      // Reset retry count
      this.setRetryCount(source.id, 0);

      return;
    }

    // Calculate the backoff delay
    const delay = Math.min(
      source.backoff.initialDelay * Math.pow(source.backoff.factor, retryCount),
      source.backoff.maxDelay
    );

    logger.info(`Retrying warming for source: ${source.id}`, {
      retryCount,
      delayMs: delay
    });

    // Increment retry count
    this.setRetryCount(source.id, retryCount + 1);

    // Schedule retry
    setTimeout(() => {
      this.warmSource(source.id)
        .catch((retryError) => {
          logger.error(`Error in retry warming for source: ${source.id}`, retryError);
          this.handleWarmingError(source, retryError);
        });
    }, delay);
  }

  /**
   * Get retry count for a source
   * @param sourceId Source ID
   * @returns Retry count
   */
  private getRetryCount(sourceId: string): number {
    return this.retryCounters.get(sourceId) || 0;
  }

  /**
   * Set retry count for a source
   * @param sourceId Source ID
   * @param count Retry count
   */
  private setRetryCount(sourceId: string, count: number): void {
    this.retryCounters.set(sourceId, count);
  }
}

// Create and export a singleton instance
export const cacheWarming = new CacheWarming();

// Export default for convenience
export default cacheWarming;

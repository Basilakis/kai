/**
 * Cache Invalidation
 * 
 * This module provides functionality for invalidating cache entries based on events.
 * It integrates with the event bus to listen for events that should trigger cache invalidation.
 */

import { createLogger } from '../../utils/unified-logger';
import { cache } from './cacheService';
import { eventBus } from '../events';
import { telemetry } from '../telemetry';
import { tracing, SpanKind } from '../tracing';

const logger = createLogger('CacheInvalidation');

/**
 * Cache invalidation rule
 */
export interface CacheInvalidationRule {
  /** Event name to listen for */
  eventName: string;
  /** Cache namespace to invalidate */
  namespace: string;
  /** Cache key pattern to invalidate (exact key, prefix, or regex) */
  keyPattern?: string | RegExp;
  /** Whether to invalidate the entire namespace */
  invalidateNamespace?: boolean;
  /** Function to extract cache keys from the event */
  keyExtractor?: (event: any) => string | string[] | null;
  /** Description of the rule */
  description?: string;
}

/**
 * Cache tag
 */
export interface CacheTag {
  /** Tag name */
  name: string;
  /** Tag value */
  value?: string;
}

/**
 * Cache invalidation service
 */
class CacheInvalidation {
  private rules: CacheInvalidationRule[] = [];
  private taggedKeys: Map<string, Set<string>> = new Map();
  private initialized: boolean = false;
  
  /**
   * Initialize the cache invalidation service
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }
    
    this.initialized = true;
    logger.info('Cache invalidation service initialized');
  }
  
  /**
   * Add a cache invalidation rule
   * @param rule Cache invalidation rule
   */
  addRule(rule: CacheInvalidationRule): void {
    this.rules.push(rule);
    
    // Subscribe to the event
    eventBus.subscribe(rule.eventName, async (event) => {
      await this.handleEvent(rule, event);
    });
    
    logger.info(`Added cache invalidation rule for event: ${rule.eventName}`, {
      namespace: rule.namespace,
      keyPattern: rule.keyPattern,
      invalidateNamespace: rule.invalidateNamespace,
      description: rule.description
    });
  }
  
  /**
   * Add multiple cache invalidation rules
   * @param rules Cache invalidation rules
   */
  addRules(rules: CacheInvalidationRule[]): void {
    for (const rule of rules) {
      this.addRule(rule);
    }
  }
  
  /**
   * Remove a cache invalidation rule
   * @param eventName Event name
   * @param namespace Cache namespace
   */
  removeRule(eventName: string, namespace: string): void {
    this.rules = this.rules.filter(
      (rule) => !(rule.eventName === eventName && rule.namespace === namespace)
    );
    
    logger.info(`Removed cache invalidation rule for event: ${eventName}`, {
      namespace
    });
  }
  
  /**
   * Clear all cache invalidation rules
   */
  clearRules(): void {
    this.rules = [];
    logger.info('Cleared all cache invalidation rules');
  }
  
  /**
   * Get all cache invalidation rules
   * @returns Cache invalidation rules
   */
  getRules(): CacheInvalidationRule[] {
    return [...this.rules];
  }
  
  /**
   * Handle an event
   * @param rule Cache invalidation rule
   * @param event Event data
   */
  private async handleEvent(rule: CacheInvalidationRule, event: any): Promise<void> {
    // Use tracing to track the invalidation
    await tracing.withSpan(
      `CACHE_INVALIDATE ${rule.eventName}`,
      async () => {
        // Get the current span
        const span = tracing.getCurrentSpan();
        
        if (span) {
          // Add attributes to the span
          tracing.addSpanAttributes(span, {
            'cache.event': rule.eventName,
            'cache.namespace': rule.namespace,
            'cache.invalidate_namespace': rule.invalidateNamespace || false
          });
          
          if (rule.keyPattern) {
            tracing.addSpanAttributes(span, {
              'cache.key_pattern': rule.keyPattern instanceof RegExp ? 
                rule.keyPattern.toString() : rule.keyPattern
            });
          }
        }
        
        // Track with telemetry
        telemetry.trackEvent({
          type: 'cache',
          name: 'cache_invalidation',
          timestamp: Date.now(),
          status: 'info',
          properties: {
            event: rule.eventName,
            namespace: rule.namespace,
            keyPattern: rule.keyPattern instanceof RegExp ? 
              rule.keyPattern.toString() : rule.keyPattern,
            invalidateNamespace: rule.invalidateNamespace
          }
        });
        
        try {
          // Invalidate the entire namespace
          if (rule.invalidateNamespace) {
            await cache.clear({ namespace: rule.namespace });
            
            logger.info(`Invalidated entire namespace: ${rule.namespace} due to event: ${rule.eventName}`);
            return;
          }
          
          // Use key extractor if provided
          if (rule.keyExtractor) {
            const keys = rule.keyExtractor(event);
            
            if (!keys) {
              logger.debug(`Key extractor returned no keys for event: ${rule.eventName}`);
              return;
            }
            
            if (Array.isArray(keys)) {
              // Invalidate multiple keys
              for (const key of keys) {
                await cache.delete(key, { namespace: rule.namespace });
              }
              
              logger.info(`Invalidated ${keys.length} keys in namespace: ${rule.namespace} due to event: ${rule.eventName}`);
            } else {
              // Invalidate a single key
              await cache.delete(keys, { namespace: rule.namespace });
              
              logger.info(`Invalidated key: ${keys} in namespace: ${rule.namespace} due to event: ${rule.eventName}`);
            }
            
            return;
          }
          
          // Use key pattern if provided
          if (rule.keyPattern) {
            if (rule.keyPattern instanceof RegExp) {
              // TODO: Implement regex-based invalidation
              // This requires scanning all keys in the namespace, which is not efficient
              // For now, we'll just invalidate the entire namespace
              await cache.clear({ namespace: rule.namespace });
              
              logger.info(`Invalidated entire namespace: ${rule.namespace} due to regex pattern and event: ${rule.eventName}`);
            } else {
              // Invalidate by prefix
              // TODO: Implement prefix-based invalidation
              // This requires scanning all keys in the namespace, which is not efficient
              // For now, we'll just invalidate the entire namespace
              await cache.clear({ namespace: rule.namespace });
              
              logger.info(`Invalidated entire namespace: ${rule.namespace} due to prefix pattern and event: ${rule.eventName}`);
            }
            
            return;
          }
          
          // If no key pattern or extractor, invalidate the entire namespace
          await cache.clear({ namespace: rule.namespace });
          
          logger.info(`Invalidated entire namespace: ${rule.namespace} due to event: ${rule.eventName}`);
        } catch (error) {
          logger.error(`Error invalidating cache for event: ${rule.eventName}`, error as Error);
          
          // Track error with telemetry
          telemetry.trackEvent({
            type: 'error',
            name: 'cache_invalidation_error',
            timestamp: Date.now(),
            status: 'error',
            properties: {
              event: rule.eventName,
              namespace: rule.namespace
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
          'cache.event': rule.eventName,
          'cache.namespace': rule.namespace
        }
      }
    );
  }
  
  /**
   * Tag a cache key
   * @param key Cache key
   * @param namespace Cache namespace
   * @param tags Cache tags
   */
  tagKey(key: string, namespace: string, tags: CacheTag[]): void {
    for (const tag of tags) {
      const tagKey = this.getTagKey(tag);
      
      if (!this.taggedKeys.has(tagKey)) {
        this.taggedKeys.set(tagKey, new Set());
      }
      
      this.taggedKeys.get(tagKey)!.add(`${namespace}:${key}`);
    }
    
    logger.debug(`Tagged key: ${key} in namespace: ${namespace} with ${tags.length} tags`);
  }
  
  /**
   * Invalidate cache by tag
   * @param tag Cache tag
   */
  async invalidateByTag(tag: CacheTag): Promise<void> {
    const tagKey = this.getTagKey(tag);
    
    if (!this.taggedKeys.has(tagKey)) {
      logger.debug(`No keys found for tag: ${tagKey}`);
      return;
    }
    
    const keys = this.taggedKeys.get(tagKey)!;
    
    // Use tracing to track the invalidation
    await tracing.withSpan(
      `CACHE_INVALIDATE_TAG ${tagKey}`,
      async () => {
        // Get the current span
        const span = tracing.getCurrentSpan();
        
        if (span) {
          // Add attributes to the span
          tracing.addSpanAttributes(span, {
            'cache.tag': tagKey,
            'cache.key_count': keys.size
          });
        }
        
        // Track with telemetry
        telemetry.trackEvent({
          type: 'cache',
          name: 'cache_invalidation_by_tag',
          timestamp: Date.now(),
          status: 'info',
          properties: {
            tag: tagKey,
            keyCount: keys.size
          }
        });
        
        try {
          // Invalidate all keys with this tag
          for (const key of keys) {
            const [namespace, ...keyParts] = key.split(':');
            const actualKey = keyParts.join(':');
            
            await cache.delete(actualKey, { namespace });
          }
          
          // Clear the tag
          this.taggedKeys.delete(tagKey);
          
          logger.info(`Invalidated ${keys.size} keys with tag: ${tagKey}`);
        } catch (error) {
          logger.error(`Error invalidating cache by tag: ${tagKey}`, error as Error);
          
          // Track error with telemetry
          telemetry.trackEvent({
            type: 'error',
            name: 'cache_invalidation_by_tag_error',
            timestamp: Date.now(),
            status: 'error',
            properties: {
              tag: tagKey
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
          'cache.tag': tagKey,
          'cache.key_count': keys.size
        }
      }
    );
  }
  
  /**
   * Get a tag key
   * @param tag Cache tag
   * @returns Tag key
   */
  private getTagKey(tag: CacheTag): string {
    return tag.value ? `${tag.name}:${tag.value}` : tag.name;
  }
}

// Create and export a singleton instance
export const cacheInvalidation = new CacheInvalidation();

// Export default for convenience
export default cacheInvalidation;

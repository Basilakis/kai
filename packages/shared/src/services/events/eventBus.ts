/**
 * Event Bus
 * 
 * This module provides a simple event bus for publishing and subscribing to events.
 * It's used for communication between different parts of the application.
 */

import { createLogger } from '../../utils/unified-logger';
import { config } from '../../utils/unified-config';
import { telemetry } from '../telemetry';
import { tracing, SpanKind } from '../tracing';

const logger = createLogger('EventBus');

/**
 * Event handler function
 */
export type EventHandler<T = any> = (event: T) => void | Promise<void>;

/**
 * Event bus options
 */
export interface EventBusOptions {
  /** Whether to enable telemetry */
  enableTelemetry?: boolean;
  /** Whether to enable tracing */
  enableTracing?: boolean;
  /** Whether to catch errors in handlers */
  catchErrors?: boolean;
}

/**
 * Event bus
 */
class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private options: EventBusOptions;
  
  /**
   * Create a new event bus
   * @param options Event bus options
   */
  constructor(options?: EventBusOptions) {
    this.options = {
      enableTelemetry: options?.enableTelemetry !== undefined ? options.enableTelemetry : true,
      enableTracing: options?.enableTracing !== undefined ? options.enableTracing : true,
      catchErrors: options?.catchErrors !== undefined ? options.catchErrors : true
    };
    
    logger.info('Event bus created', this.options);
  }
  
  /**
   * Subscribe to an event
   * @param eventName Event name
   * @param handler Event handler
   * @returns Unsubscribe function
   */
  subscribe<T = any>(eventName: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    
    this.handlers.get(eventName)!.add(handler as EventHandler);
    
    logger.debug(`Subscribed to event: ${eventName}`);
    
    // Return unsubscribe function
    return () => {
      this.unsubscribe(eventName, handler);
    };
  }
  
  /**
   * Unsubscribe from an event
   * @param eventName Event name
   * @param handler Event handler
   */
  unsubscribe<T = any>(eventName: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventName)) {
      return;
    }
    
    this.handlers.get(eventName)!.delete(handler as EventHandler);
    
    // Remove the set if it's empty
    if (this.handlers.get(eventName)!.size === 0) {
      this.handlers.delete(eventName);
    }
    
    logger.debug(`Unsubscribed from event: ${eventName}`);
  }
  
  /**
   * Publish an event
   * @param eventName Event name
   * @param event Event data
   */
  async publish<T = any>(eventName: string, event: T): Promise<void> {
    if (!this.handlers.has(eventName)) {
      logger.debug(`No handlers for event: ${eventName}`);
      return;
    }
    
    const handlers = this.handlers.get(eventName)!;
    
    logger.debug(`Publishing event: ${eventName} to ${handlers.size} handlers`);
    
    // Track with telemetry if enabled
    if (this.options.enableTelemetry) {
      telemetry.trackEvent({
        type: 'custom',
        name: `event_published`,
        timestamp: Date.now(),
        status: 'success',
        properties: {
          eventName,
          handlerCount: handlers.size,
          event: typeof event === 'object' ? JSON.stringify(event) : String(event)
        }
      });
    }
    
    // Create a span for the event if tracing is enabled
    if (this.options.enableTracing) {
      await tracing.withSpan(
        `EVENT ${eventName}`,
        async () => {
          // Get the current span
          const span = tracing.getCurrentSpan();
          
          if (span) {
            // Add attributes to the span
            tracing.addSpanAttributes(span, {
              'event.name': eventName,
              'event.handler_count': handlers.size
            });
            
            // Add event data as attributes if it's an object
            if (typeof event === 'object' && event !== null) {
              try {
                const eventData = JSON.stringify(event);
                tracing.addSpanAttributes(span, {
                  'event.data': eventData
                });
              } catch (e) {
                // Ignore serialization errors
              }
            }
          }
          
          // Call all handlers
          const promises: Promise<void>[] = [];
          
          for (const handler of handlers) {
            try {
              const result = handler(event);
              
              if (result instanceof Promise) {
                promises.push(
                  result.catch((error) => {
                    this.handleError(eventName, error);
                  })
                );
              }
            } catch (error) {
              this.handleError(eventName, error);
            }
          }
          
          // Wait for all promises to resolve
          if (promises.length > 0) {
            await Promise.all(promises);
          }
        },
        {
          kind: SpanKind.PRODUCER,
          attributes: {
            'event.name': eventName,
            'event.handler_count': handlers.size
          }
        }
      );
    } else {
      // Call all handlers without tracing
      const promises: Promise<void>[] = [];
      
      for (const handler of handlers) {
        try {
          const result = handler(event);
          
          if (result instanceof Promise) {
            promises.push(
              result.catch((error) => {
                this.handleError(eventName, error);
              })
            );
          }
        } catch (error) {
          this.handleError(eventName, error);
        }
      }
      
      // Wait for all promises to resolve
      if (promises.length > 0) {
        await Promise.all(promises);
      }
    }
  }
  
  /**
   * Handle an error in an event handler
   * @param eventName Event name
   * @param error Error
   */
  private handleError(eventName: string, error: any): void {
    if (!this.options.catchErrors) {
      throw error;
    }
    
    logger.error(`Error in event handler for ${eventName}`, error);
    
    // Track with telemetry if enabled
    if (this.options.enableTelemetry) {
      telemetry.trackEvent({
        type: 'error',
        name: 'event_handler_error',
        timestamp: Date.now(),
        status: 'error',
        properties: {
          eventName
        },
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : undefined
        }
      });
    }
  }
  
  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
    logger.info('All event handlers cleared');
  }
  
  /**
   * Get the number of handlers for an event
   * @param eventName Event name
   * @returns Number of handlers
   */
  getHandlerCount(eventName: string): number {
    if (!this.handlers.has(eventName)) {
      return 0;
    }
    
    return this.handlers.get(eventName)!.size;
  }
  
  /**
   * Get all event names
   * @returns Event names
   */
  getEventNames(): string[] {
    return Array.from(this.handlers.keys());
  }
}

// Create and export a singleton instance
export const eventBus = new EventBus({
  enableTelemetry: config.get('events.enableTelemetry', true),
  enableTracing: config.get('events.enableTracing', true),
  catchErrors: config.get('events.catchErrors', true)
});

// Export default for convenience
export default eventBus;

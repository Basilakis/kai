/**
 * Telemetry Service
 *
 * This module provides a unified telemetry service for collecting metrics,
 * traces, and logs across the application.
 */

import { createLogger } from '../../utils/unified-logger';
import { config } from '../../utils/unified-config';
import { alerting } from '../alerting/alertingService';

const logger = createLogger('TelemetryService');

/**
 * Telemetry event type
 */
export type TelemetryEventType =
  | 'request'
  | 'response'
  | 'error'
  | 'cache'
  | 'auth'
  | 'storage'
  | 'performance'
  | 'user'
  | 'custom';

/**
 * Telemetry event
 */
export interface TelemetryEvent {
  /** Event type */
  type: TelemetryEventType;
  /** Event name */
  name: string;
  /** Event timestamp */
  timestamp: number;
  /** Event duration in milliseconds (if applicable) */
  duration?: number;
  /** Event status (success, error, etc.) */
  status?: 'success' | 'error' | 'warning' | 'info';
  /** Event properties */
  properties?: Record<string, any>;
  /** Event measurements */
  measurements?: Record<string, number>;
  /** Error information (if applicable) */
  error?: {
    message: string;
    stack?: string;
    code?: string;
    name?: string;
  };
}

/**
 * Telemetry sampling strategy
 */
export enum TelemetrySamplingStrategy {
  /** Sample all events */
  ALL = 'all',
  /** Sample a percentage of events */
  PERCENTAGE = 'percentage',
  /** Sample based on event type */
  BY_TYPE = 'by_type',
  /** Sample based on event name */
  BY_NAME = 'by_name',
  /** Sample based on custom logic */
  CUSTOM = 'custom'
}

/**
 * Telemetry sampling configuration
 */
export interface TelemetrySamplingConfig {
  /** Sampling strategy */
  strategy: TelemetrySamplingStrategy;
  /** Sampling rate (0-1) for percentage strategy */
  rate?: number;
  /** Event types to sample for by_type strategy */
  types?: TelemetryEventType[];
  /** Event names to sample for by_name strategy */
  names?: string[];
  /** Custom sampling function */
  sampler?: (event: TelemetryEvent) => boolean;
}

/**
 * Telemetry filter configuration
 */
export interface TelemetryFilterConfig {
  /** Event types to include (if empty, all types are included) */
  includeTypes?: TelemetryEventType[];
  /** Event types to exclude */
  excludeTypes?: TelemetryEventType[];
  /** Event names to include (if empty, all names are included) */
  includeNames?: string[];
  /** Event names to exclude */
  excludeNames?: string[];
  /** Custom filter function */
  filter?: (event: TelemetryEvent) => boolean;
}

/**
 * Telemetry provider interface
 */
export interface TelemetryProvider {
  /** Initialize the provider */
  initialize(): Promise<void>;
  /** Track an event */
  trackEvent(event: TelemetryEvent): Promise<void>;
  /** Start a performance measurement */
  startMeasurement(name: string, properties?: Record<string, any>): string;
  /** Stop a performance measurement */
  stopMeasurement(id: string, additionalProperties?: Record<string, any>): Promise<void>;
  /** Flush all pending telemetry */
  flush(): Promise<void>;
}

/**
 * Console telemetry provider
 *
 * This provider logs telemetry events to the console.
 * It's suitable for development and debugging.
 */
export class ConsoleTelemetryProvider implements TelemetryProvider {
  private measurements: Map<string, { start: number; name: string; properties?: Record<string, any> }> = new Map();

  /**
   * Initialize the provider
   */
  async initialize(): Promise<void> {
    logger.info('Console telemetry provider initialized');
  }

  /**
   * Track an event
   */
  async trackEvent(event: TelemetryEvent): Promise<void> {
    const logLevel = event.status === 'error' ? 'error' :
                    event.status === 'warning' ? 'warn' : 'info';

    const logMessage = `[${event.type}] ${event.name}`;
    const logContext = {
      duration: event.duration,
      properties: event.properties,
      measurements: event.measurements,
      error: event.error
    };

    if (logLevel === 'error') {
      logger.error(logMessage, event.error, logContext);
    } else if (logLevel === 'warn') {
      logger.warn(logMessage, logContext);
    } else {
      logger.info(logMessage, logContext);
    }
  }

  /**
   * Start a performance measurement
   */
  startMeasurement(name: string, properties?: Record<string, any>): string {
    const id = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.measurements.set(id, {
      start: performance.now(),
      name,
      properties
    });

    return id;
  }

  /**
   * Stop a performance measurement
   */
  async stopMeasurement(id: string, additionalProperties?: Record<string, any>): Promise<void> {
    const measurement = this.measurements.get(id);

    if (!measurement) {
      logger.warn(`Measurement not found: ${id}`);
      return;
    }

    const duration = performance.now() - measurement.start;
    this.measurements.delete(id);

    await this.trackEvent({
      type: 'performance',
      name: measurement.name,
      timestamp: Date.now(),
      duration,
      status: 'success',
      properties: {
        ...measurement.properties,
        ...additionalProperties
      },
      measurements: {
        duration
      }
    });
  }

  /**
   * Flush all pending telemetry
   */
  async flush(): Promise<void> {
    // Nothing to flush for console provider
  }
}

/**
 * Telemetry service
 */
class TelemetryService {
  private provider: TelemetryProvider | null = null;
  private enabled: boolean = false;
  private buffer: TelemetryEvent[] = [];
  private bufferSize: number = 100;
  private flushInterval: NodeJS.Timeout | null = null;
  private samplingConfig: TelemetrySamplingConfig | null = null;
  private filterConfig: TelemetryFilterConfig | null = null;

  /**
   * Set the telemetry provider
   */
  setProvider(provider: TelemetryProvider): void {
    this.provider = provider;
    logger.info('Telemetry provider set');
  }

  /**
   * Enable telemetry
   */
  async enable(): Promise<void> {
    if (this.enabled) {
      return;
    }

    this.enabled = true;

    if (this.provider) {
      await this.provider.initialize();

      // Set up flush interval
      this.flushInterval = setInterval(() => {
        this.flush().catch(error => {
          logger.error('Error flushing telemetry', error);
        });
      }, 30000); // Flush every 30 seconds

      logger.info('Telemetry enabled');
    } else {
      logger.warn('No telemetry provider set, telemetry will be buffered');
    }
  }

  /**
   * Disable telemetry
   */
  async disable(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    this.enabled = false;

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Flush any remaining events
    await this.flush();

    logger.info('Telemetry disabled');
  }

  /**
   * Configure sampling
   * @param config Sampling configuration
   */
  configureSampling(config: TelemetrySamplingConfig): void {
    this.samplingConfig = config;

    logger.info('Telemetry sampling configured', {
      strategy: config.strategy,
      rate: config.rate,
      types: config.types,
      names: config.names
    });
  }

  /**
   * Configure filtering
   * @param config Filter configuration
   */
  configureFiltering(config: TelemetryFilterConfig): void {
    this.filterConfig = config;

    logger.info('Telemetry filtering configured', {
      includeTypes: config.includeTypes,
      excludeTypes: config.excludeTypes,
      includeNames: config.includeNames,
      excludeNames: config.excludeNames
    });
  }

  /**
   * Clear sampling configuration
   */
  clearSampling(): void {
    this.samplingConfig = null;
    logger.info('Telemetry sampling configuration cleared');
  }

  /**
   * Clear filtering configuration
   */
  clearFiltering(): void {
    this.filterConfig = null;
    logger.info('Telemetry filtering configuration cleared');
  }

  /**
   * Track an event
   */
  async trackEvent(event: TelemetryEvent): Promise<void> {
    if (!this.enabled) {
      return;
    }

    // Add timestamp if not provided
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }

    // Apply filtering
    if (!this.shouldTrackEvent(event)) {
      logger.debug('Event filtered out', {
        type: event.type,
        name: event.name
      });
      return;
    }

    // Apply sampling
    if (!this.shouldSampleEvent(event)) {
      logger.debug('Event sampled out', {
        type: event.type,
        name: event.name
      });
      return;
    }

    // Forward to alerting service if enabled
    const forwardToAlerting = config.get('telemetry.forwardToAlerting', true);
    if (forwardToAlerting) {
      try {
        alerting.processEvent(event);
      } catch (error) {
        logger.error('Error forwarding event to alerting service', error as Error);
      }
    }

    if (this.provider) {
      try {
        await this.provider.trackEvent(event);
      } catch (error) {
        logger.error('Error tracking event', error as Error);

        // Buffer the event if tracking fails
        this.bufferEvent(event);
      }
    } else {
      // Buffer the event if no provider is set
      this.bufferEvent(event);
    }
  }

  /**
   * Check if an event should be tracked based on filtering
   * @param event Event to check
   * @returns Whether the event should be tracked
   */
  private shouldTrackEvent(event: TelemetryEvent): boolean {
    // If no filter config, track all events
    if (!this.filterConfig) {
      return true;
    }

    // Use custom filter if provided
    if (this.filterConfig.filter) {
      return this.filterConfig.filter(event);
    }

    // Check exclude types
    if (this.filterConfig.excludeTypes && this.filterConfig.excludeTypes.includes(event.type)) {
      return false;
    }

    // Check exclude names
    if (this.filterConfig.excludeNames && this.filterConfig.excludeNames.includes(event.name)) {
      return false;
    }

    // Check include types
    if (this.filterConfig.includeTypes && this.filterConfig.includeTypes.length > 0) {
      return this.filterConfig.includeTypes.includes(event.type);
    }

    // Check include names
    if (this.filterConfig.includeNames && this.filterConfig.includeNames.length > 0) {
      return this.filterConfig.includeNames.includes(event.name);
    }

    // If we get here, track the event
    return true;
  }

  /**
   * Check if an event should be sampled
   * @param event Event to check
   * @returns Whether the event should be sampled
   */
  private shouldSampleEvent(event: TelemetryEvent): boolean {
    // If no sampling config, sample all events
    if (!this.samplingConfig) {
      return true;
    }

    // Use custom sampler if provided
    if (this.samplingConfig.sampler) {
      return this.samplingConfig.sampler(event);
    }

    // Apply sampling strategy
    switch (this.samplingConfig.strategy) {
      case TelemetrySamplingStrategy.ALL:
        return true;

      case TelemetrySamplingStrategy.PERCENTAGE:
        const rate = this.samplingConfig.rate || 1.0;
        return Math.random() < rate;

      case TelemetrySamplingStrategy.BY_TYPE:
        if (!this.samplingConfig.types || this.samplingConfig.types.length === 0) {
          return true;
        }
        return this.samplingConfig.types.includes(event.type);

      case TelemetrySamplingStrategy.BY_NAME:
        if (!this.samplingConfig.names || this.samplingConfig.names.length === 0) {
          return true;
        }
        return this.samplingConfig.names.includes(event.name);

      default:
        return true;
    }
  }

  /**
   * Start a performance measurement
   */
  startMeasurement(name: string, properties?: Record<string, any>): string {
    if (!this.enabled || !this.provider) {
      // Generate a dummy ID if telemetry is disabled
      return `${name}-${Date.now()}-disabled`;
    }

    return this.provider.startMeasurement(name, properties);
  }

  /**
   * Stop a performance measurement
   */
  async stopMeasurement(id: string, additionalProperties?: Record<string, any>): Promise<void> {
    if (!this.enabled || !this.provider || id.endsWith('-disabled')) {
      return;
    }

    await this.provider.stopMeasurement(id, additionalProperties);
  }

  /**
   * Measure the execution time of a function
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T> | T,
    properties?: Record<string, any>
  ): Promise<T> {
    const id = this.startMeasurement(name, properties);

    try {
      const result = await fn();
      await this.stopMeasurement(id, { success: true });
      return result;
    } catch (error) {
      await this.stopMeasurement(id, {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Buffer an event
   */
  private bufferEvent(event: TelemetryEvent): void {
    this.buffer.push(event);

    // Trim buffer if it exceeds the maximum size
    if (this.buffer.length > this.bufferSize) {
      this.buffer = this.buffer.slice(-this.bufferSize);
    }
  }

  /**
   * Flush all pending telemetry
   */
  async flush(): Promise<void> {
    if (!this.provider || this.buffer.length === 0) {
      return;
    }

    try {
      // Process all buffered events
      const events = [...this.buffer];
      this.buffer = [];

      for (const event of events) {
        await this.provider.trackEvent(event);
      }

      // Flush the provider
      await this.provider.flush();

      logger.debug(`Flushed ${events.length} telemetry events`);
    } catch (error) {
      logger.error('Error flushing telemetry', error as Error);

      // Put events back in the buffer
      this.buffer = [...this.buffer, ...this.buffer];

      // Trim buffer if it exceeds the maximum size
      if (this.buffer.length > this.bufferSize) {
        this.buffer = this.buffer.slice(-this.bufferSize);
      }
    }
  }
}

// Create and export a singleton instance
export const telemetry = new TelemetryService();

// Export default for convenience
export default telemetry;

/**
 * Tracing Service Initializer
 * 
 * This module provides functions to initialize the unified tracing service
 * with different tracing providers based on configuration.
 */

import { createLogger } from '../../utils/unified-logger';
import { config } from '../../utils/unified-config';
import { tracing, OpenTelemetryProvider } from './tracingService';

const logger = createLogger('TracingInitializer');

/**
 * Initialize tracing with OpenTelemetry provider
 */
export async function initializeOpenTelemetryTracing(): Promise<void> {
  try {
    logger.info('Initializing OpenTelemetry tracing');
    
    // Create OpenTelemetry tracing provider
    const provider = new OpenTelemetryProvider();
    
    // Set provider and enable tracing
    tracing.setProvider(provider);
    await tracing.enable();
    
    logger.info('OpenTelemetry tracing initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize OpenTelemetry tracing', error as Error);
    throw new Error('OpenTelemetry tracing initialization failed');
  }
}

/**
 * Initialize tracing based on environment configuration
 */
export async function initializeTracing(): Promise<void> {
  try {
    logger.info('Initializing tracing service based on environment configuration');
    
    const tracingEnabled = config.get('tracing.enabled', true);
    
    if (!tracingEnabled) {
      logger.info('Tracing is disabled by configuration');
      return;
    }
    
    const tracingType = config.get('tracing.type', 'opentelemetry');
    
    if (tracingType === 'opentelemetry') {
      await initializeOpenTelemetryTracing();
    } else {
      // Default to OpenTelemetry tracing
      logger.warn(`Unknown tracing type: ${tracingType}, falling back to OpenTelemetry tracing`);
      await initializeOpenTelemetryTracing();
    }
    
    logger.info('Tracing service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize tracing service', error as Error);
    
    // Fall back to OpenTelemetry tracing
    logger.info('Falling back to OpenTelemetry tracing');
    await initializeOpenTelemetryTracing();
  }
}

// Export default for convenience
export default initializeTracing;

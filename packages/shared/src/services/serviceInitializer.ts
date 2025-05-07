/**
 * Service Initializer
 *
 * This module provides a function to initialize all shared services.
 * It ensures that services are initialized in the correct order and with the proper configuration.
 */

import { createLogger } from '../utils/unified-logger';
import { config } from '../utils/unified-config';
import { initializeStorage } from './storage/storageInitializer';
import { initializeAuth } from './auth/authInitializer';
import { initializeCache } from './cache/cacheInitializer';
import { initializeTelemetry } from './telemetry/telemetryInitializer';
import { initializeTracing } from './tracing/tracingInitializer';
import { initializeAlerting } from './alerting/alertingInitializer';

const logger = createLogger('ServiceInitializer');

/**
 * Initialize all shared services
 */
export async function initializeServices(options: {
  envPath?: string;
  environment?: 'development' | 'production' | 'test';
  configOverrides?: any;
} = {}): Promise<void> {
  try {
    logger.info('Initializing shared services');

    // Initialize configuration first
    config.init({
      envPath: options.envPath,
      environment: options.environment,
      overrides: options.configOverrides
    });

    // Initialize storage service
    initializeStorage();

    // Initialize authentication service
    initializeAuth();

    // Initialize cache service
    initializeCache();

    // Initialize telemetry service
    await initializeTelemetry();

    // Initialize tracing service
    await initializeTracing();

    // Initialize alerting service
    initializeAlerting();

    logger.info('All shared services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize shared services', error);
    throw error;
  }
}

// Export default for convenience
export default initializeServices;

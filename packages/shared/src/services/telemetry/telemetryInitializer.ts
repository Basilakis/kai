/**
 * Telemetry Service Initializer
 *
 * This module provides functions to initialize the unified telemetry service
 * with different telemetry providers based on configuration.
 */

import { createLogger } from '../../utils/unified-logger';
import { config } from '../../utils/unified-config';
import {
  telemetry,
  ConsoleTelemetryProvider,
  TelemetrySamplingStrategy,
  TelemetrySamplingConfig,
  TelemetryFilterConfig
} from './telemetryService';

const logger = createLogger('TelemetryInitializer');

/**
 * Initialize telemetry with console provider
 */
export async function initializeConsoleTelemetry(): Promise<void> {
  try {
    logger.info('Initializing console telemetry');

    // Create console telemetry provider
    const provider = new ConsoleTelemetryProvider();

    // Set provider and enable telemetry
    telemetry.setProvider(provider);
    await telemetry.enable();

    logger.info('Console telemetry initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize console telemetry', error as Error);
    throw new Error('Console telemetry initialization failed');
  }
}

/**
 * Initialize telemetry based on environment configuration
 */
export async function initializeTelemetry(): Promise<void> {
  try {
    logger.info('Initializing telemetry service based on environment configuration');

    const telemetryEnabled = config.get('telemetry.enabled', true);

    if (!telemetryEnabled) {
      logger.info('Telemetry is disabled by configuration');
      return;
    }

    const telemetryType = config.get('telemetry.type', 'console');

    if (telemetryType === 'console') {
      await initializeConsoleTelemetry();
    } else {
      // Default to console telemetry
      logger.warn(`Unknown telemetry type: ${telemetryType}, falling back to console telemetry`);
      await initializeConsoleTelemetry();
    }

    // Configure sampling if enabled
    const samplingEnabled = config.get('telemetry.sampling.enabled', false);
    if (samplingEnabled) {
      const samplingStrategy = config.get('telemetry.sampling.strategy', TelemetrySamplingStrategy.ALL);
      const samplingConfig: TelemetrySamplingConfig = {
        strategy: samplingStrategy
      };

      // Configure strategy-specific options
      switch (samplingStrategy) {
        case TelemetrySamplingStrategy.PERCENTAGE:
          samplingConfig.rate = config.get('telemetry.sampling.rate', 0.1);
          break;

        case TelemetrySamplingStrategy.BY_TYPE:
          samplingConfig.types = config.get('telemetry.sampling.types', []);
          break;

        case TelemetrySamplingStrategy.BY_NAME:
          samplingConfig.names = config.get('telemetry.sampling.names', []);
          break;
      }

      telemetry.configureSampling(samplingConfig);
      logger.info('Telemetry sampling configured', samplingConfig);
    }

    // Configure filtering if enabled
    const filteringEnabled = config.get('telemetry.filtering.enabled', false);
    if (filteringEnabled) {
      const filterConfig: TelemetryFilterConfig = {
        includeTypes: config.get('telemetry.filtering.includeTypes', []),
        excludeTypes: config.get('telemetry.filtering.excludeTypes', []),
        includeNames: config.get('telemetry.filtering.includeNames', []),
        excludeNames: config.get('telemetry.filtering.excludeNames', [])
      };

      telemetry.configureFiltering(filterConfig);
      logger.info('Telemetry filtering configured', filterConfig);
    }

    logger.info('Telemetry service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize telemetry service', error as Error);

    // Fall back to console telemetry
    logger.info('Falling back to console telemetry');
    await initializeConsoleTelemetry();
  }
}

// Export default for convenience
export default initializeTelemetry;

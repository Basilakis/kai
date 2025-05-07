/**
 * Telemetry Service Index
 *
 * This file exports all telemetry-related functionality.
 */

// Export telemetry service
export {
  telemetry,
  TelemetryEvent,
  TelemetryEventType,
  TelemetryProvider,
  ConsoleTelemetryProvider,
  TelemetrySamplingStrategy,
  TelemetrySamplingConfig,
  TelemetryFilterConfig
} from './telemetryService';

// Export telemetry initializer
export {
  initializeTelemetry,
  initializeConsoleTelemetry
} from './telemetryInitializer';

// Export default for convenience
export { telemetry as default } from './telemetryService';

/**
 * Tracing Service Index
 * 
 * This file exports all tracing-related functionality.
 */

// Export tracing service
export { 
  tracing, 
  SpanOptions, 
  SpanResult, 
  TraceContext, 
  TracingProvider,
  OpenTelemetryProvider,
  generateTraceId,
  generateSpanId
} from './tracingService';

// Export tracing initializer
export { 
  initializeTracing, 
  initializeOpenTelemetryTracing 
} from './tracingInitializer';

// Export OpenTelemetry types
export { 
  SpanKind, 
  SpanStatusCode 
} from '@opentelemetry/api';

// Export default for convenience
export { tracing as default } from './tracingService';

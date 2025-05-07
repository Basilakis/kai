# Distributed Tracing Service

This document describes the distributed tracing service implementation in the KAI platform. The tracing service provides a unified interface for tracking requests across services, enabling end-to-end visibility into request flows.

## Overview

The distributed tracing service is designed to track requests as they flow through different services and components of the application. It provides a consistent API for tracing operations, regardless of the underlying tracing provider. The service supports OpenTelemetry for distributed tracing and integrates with the telemetry service.

## Architecture

The tracing service follows a provider pattern, allowing different tracing implementations to be used interchangeably. The service consists of the following components:

1. **Tracing Service**: The main service that provides a unified interface for tracing operations.
2. **Tracing Provider Interface**: An interface that defines the contract for tracing providers.
3. **OpenTelemetry Provider**: A provider that implements distributed tracing using OpenTelemetry.
4. **Tracing Initializer**: A utility for initializing the tracing service with different providers.

## Usage

### Basic Usage

```typescript
import { tracing, SpanKind, SpanStatusCode } from '@kai/shared';

// Start a span
const spanResult = tracing.startSpan('operation_name', {
  kind: SpanKind.SERVER,
  attributes: {
    'service.name': 'my-service',
    'operation.name': 'process-request'
  }
});

// Get the current span
const span = tracing.getCurrentSpan();

// Add attributes to the span
tracing.addSpanAttributes(span, {
  'user.id': '123',
  'request.id': 'abc-123'
});

// Add events to the span
tracing.addSpanEvent(span, 'processing_started', {
  'timestamp': Date.now()
});

// Set span status
tracing.setSpanStatus(span, SpanStatusCode.OK);

// End the span
tracing.endSpan(span);
```

### Automatic Span Management

```typescript
import { tracing, SpanKind } from '@kai/shared';

// Automatically manage span lifecycle
const result = await tracing.withSpan(
  'database_query',
  async () => {
    // This code is executed within the span
    return await db.query('SELECT * FROM users');
  },
  {
    kind: SpanKind.CLIENT,
    attributes: {
      'db.system': 'postgresql',
      'db.statement': 'SELECT * FROM users'
    }
  }
);
```

### Trace Context Propagation

```typescript
import { tracing } from '@kai/shared';

// Extract trace context from incoming request
const headers = request.headers;
const traceContext = tracing.extractContext(headers);

// Create a child span
const spanResult = tracing.startSpan('child_operation', {
  parent: traceContext
});

// Inject trace context into outgoing request
const outgoingHeaders = {};
tracing.injectContext(spanResult.traceContext, outgoingHeaders);

// Make request with trace context
const response = await fetch('https://api.example.com', {
  headers: outgoingHeaders
});
```

## Configuration

The tracing service can be configured through environment variables or the unified configuration system. The following configuration options are available:

```typescript
// In .env file
TRACING_ENABLED=true
TRACING_TYPE=opentelemetry
```

## Tracing Providers

### OpenTelemetry Provider

The OpenTelemetry provider implements distributed tracing using OpenTelemetry. It's suitable for production and distributed applications. Features include:

- OpenTelemetry-based tracing
- W3C Trace Context propagation
- Span attributes and events
- Span status and error handling
- Trace context extraction and injection

## Integration with API Client

The API client has been integrated with the tracing service to automatically trace HTTP requests. Features include:

- Automatic span creation for HTTP requests
- Trace context propagation in request headers
- Span attributes for request and response details
- Span events for retries and errors
- Span status based on response status

```typescript
import { apiClient } from '@kai/shared';

// Tracing is enabled by default
const result = await apiClient.get('/api/users');

// Disable tracing for specific client
const customClient = createApiClient({
  useTracing: false
});

// Add custom tracing attributes
const customClient = createApiClient({
  tracingAttributes: {
    'service.name': 'custom-service',
    'client.version': '1.0.0'
  }
});
```

## Implementation Details

### Tracing Service

The tracing service provides a unified interface for tracing operations. It delegates all operations to the configured provider and adds additional functionality like automatic span management and integration with the telemetry service.

```typescript
class TracingService {
  private provider: TracingProvider | null = null;
  private enabled: boolean = false;
  
  // Set the tracing provider
  setProvider(provider: TracingProvider): void;
  
  // Enable tracing
  async enable(): Promise<void>;
  
  // Disable tracing
  async disable(): Promise<void>;
  
  // Start a span
  startSpan(name: string, options?: SpanOptions): SpanResult | undefined;
  
  // End a span
  endSpan(span: Span, endTime?: number): void;
  
  // Set span status
  setSpanStatus(span: Span, code: SpanStatusCode, message?: string): void;
  
  // Add span attributes
  addSpanAttributes(span: Span, attributes: Record<string, string | number | boolean | string[] | number[] | boolean[]>): void;
  
  // Add span events
  addSpanEvent(span: Span, name: string, attributes?: Record<string, string | number | boolean>, timestamp?: number): void;
  
  // Get current span
  getCurrentSpan(): Span | undefined;
  
  // Run with span
  async withSpan<T>(name: string, fn: () => Promise<T> | T, options?: SpanOptions): Promise<T>;
  
  // Extract trace context from carrier
  extractContext(carrier: Record<string, string>): TraceContext | undefined;
  
  // Inject trace context into carrier
  injectContext(traceContext: TraceContext, carrier: Record<string, string>): void;
}
```

### Tracing Provider Interface

The tracing provider interface defines the contract for tracing providers. All providers must implement this interface.

```typescript
interface TracingProvider {
  // Initialize the provider
  initialize(): Promise<void>;
  
  // Start a span
  startSpan(name: string, options?: SpanOptions): Span;
  
  // End a span
  endSpan(span: Span, endTime?: number): void;
  
  // Set span status
  setSpanStatus(span: Span, code: SpanStatusCode, message?: string): void;
  
  // Add span attributes
  addSpanAttributes(span: Span, attributes: Record<string, string | number | boolean | string[] | number[] | boolean[]>): void;
  
  // Add span events
  addSpanEvent(span: Span, name: string, attributes?: Record<string, string | number | boolean>, timestamp?: number): void;
  
  // Get current span
  getCurrentSpan(): Span | undefined;
  
  // Run with span
  withSpan<T>(span: Span, fn: () => Promise<T> | T): Promise<T>;
  
  // Extract trace context from carrier
  extractContext(carrier: Record<string, string>): TraceContext | undefined;
  
  // Inject trace context into carrier
  injectContext(traceContext: TraceContext, carrier: Record<string, string>): void;
}
```

## Benefits

The distributed tracing service provides several benefits:

1. **End-to-End Visibility**: Track requests as they flow through different services and components.
2. **Performance Monitoring**: Identify bottlenecks and performance issues in the application.
3. **Error Diagnosis**: Quickly identify the root cause of errors and failures.
4. **Dependency Analysis**: Understand the dependencies between different services and components.
5. **Service Level Objectives**: Monitor and enforce service level objectives based on trace data.
6. **Consistent API**: The unified interface provides a consistent API for tracing operations, regardless of the underlying provider.
7. **Provider Flexibility**: The provider pattern allows different tracing implementations to be used interchangeably.

## Next Steps

The following steps are recommended to further improve the distributed tracing service:

1. **Add More Providers**: Add support for more tracing providers (Jaeger, Zipkin, etc.).
2. **Add Sampling Strategies**: Add support for different sampling strategies to reduce the volume of trace data.
3. **Add Trace Analytics**: Add support for analyzing trace data to identify patterns and trends.
4. **Add Trace Visualization**: Add support for visualizing trace data to understand request flows.
5. **Add Trace Alerting**: Add support for alerting based on trace data to proactively identify issues.
6. **Add Trace Retention**: Add support for configuring trace data retention to manage storage costs.

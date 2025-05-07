/**
 * Distributed Tracing Service
 * 
 * This module provides a unified tracing service for tracking requests across services.
 * It uses OpenTelemetry for distributed tracing and integrates with the telemetry service.
 */

import { createLogger } from '../../utils/unified-logger';
import { config } from '../../utils/unified-config';
import { telemetry } from '../telemetry';
import {
  context,
  trace,
  SpanKind,
  SpanStatusCode,
  Span,
  Tracer,
  Context,
  propagation,
  ROOT_CONTEXT,
  SpanContext,
  TraceFlags
} from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { randomUUID } from 'crypto';

const logger = createLogger('TracingService');

/**
 * Trace context
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags?: number;
}

/**
 * Span options
 */
export interface SpanOptions {
  kind?: SpanKind;
  attributes?: Record<string, string | number | boolean | string[] | number[] | boolean[]>;
  links?: { context: TraceContext; attributes?: Record<string, string | number | boolean> }[];
  startTime?: number;
  parent?: TraceContext | Span;
}

/**
 * Span result
 */
export interface SpanResult {
  traceId: string;
  spanId: string;
  traceContext: TraceContext;
}

/**
 * Tracing provider interface
 */
export interface TracingProvider {
  /** Initialize the provider */
  initialize(): Promise<void>;
  
  /** Start a span */
  startSpan(name: string, options?: SpanOptions): Span;
  
  /** End a span */
  endSpan(span: Span, endTime?: number): void;
  
  /** Set span status */
  setSpanStatus(span: Span, code: SpanStatusCode, message?: string): void;
  
  /** Add span attributes */
  addSpanAttributes(span: Span, attributes: Record<string, string | number | boolean | string[] | number[] | boolean[]>): void;
  
  /** Add span events */
  addSpanEvent(span: Span, name: string, attributes?: Record<string, string | number | boolean>, timestamp?: number): void;
  
  /** Get current span */
  getCurrentSpan(): Span | undefined;
  
  /** Run with span */
  withSpan<T>(span: Span, fn: () => Promise<T> | T): Promise<T>;
  
  /** Get trace context from carrier */
  extractContext(carrier: Record<string, string>): TraceContext | undefined;
  
  /** Inject trace context into carrier */
  injectContext(traceContext: TraceContext, carrier: Record<string, string>): void;
}

/**
 * OpenTelemetry tracing provider
 */
export class OpenTelemetryProvider implements TracingProvider {
  private tracer: Tracer;
  private propagator: W3CTraceContextPropagator;
  private serviceName: string;
  private serviceVersion: string;
  private environment: string;
  
  /**
   * Create a new OpenTelemetry provider
   */
  constructor() {
    this.tracer = trace.getTracer('default');
    this.propagator = new W3CTraceContextPropagator();
    this.serviceName = config.get('app.name', 'kai-service');
    this.serviceVersion = config.get('app.version', '1.0.0');
    this.environment = config.get('app.environment', 'development');
    
    // Set global propagator
    propagation.setGlobalPropagator(this.propagator);
  }
  
  /**
   * Initialize the provider
   */
  async initialize(): Promise<void> {
    // Configure resource
    const resource = Resource.default().merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: this.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: this.serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.environment
      })
    );
    
    logger.info('OpenTelemetry tracing provider initialized', {
      serviceName: this.serviceName,
      serviceVersion: this.serviceVersion,
      environment: this.environment
    });
  }
  
  /**
   * Start a span
   */
  startSpan(name: string, options?: SpanOptions): Span {
    const kind = options?.kind || SpanKind.INTERNAL;
    const attributes = options?.attributes || {};
    const startTime = options?.startTime || Date.now();
    
    let ctx: Context = ROOT_CONTEXT;
    
    // Set parent context
    if (options?.parent) {
      if (isSpan(options.parent)) {
        ctx = trace.setSpan(ctx, options.parent as Span);
      } else {
        const parentContext = options.parent as TraceContext;
        const spanContext: SpanContext = {
          traceId: parentContext.traceId,
          spanId: parentContext.spanId,
          traceFlags: parentContext.traceFlags || TraceFlags.SAMPLED,
          isRemote: true
        };
        
        ctx = trace.setSpanContext(ctx, spanContext);
      }
    }
    
    // Create span
    const span = this.tracer.startSpan(name, {
      kind,
      attributes,
      startTime
    }, ctx);
    
    // Log span creation
    logger.debug(`Started span: ${name}`, {
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      kind,
      attributes
    });
    
    return span;
  }
  
  /**
   * End a span
   */
  endSpan(span: Span, endTime?: number): void {
    span.end(endTime);
    
    // Log span completion
    logger.debug(`Ended span: ${span.name}`, {
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId
    });
  }
  
  /**
   * Set span status
   */
  setSpanStatus(span: Span, code: SpanStatusCode, message?: string): void {
    span.setStatus({ code, message });
  }
  
  /**
   * Add span attributes
   */
  addSpanAttributes(span: Span, attributes: Record<string, string | number | boolean | string[] | number[] | boolean[]>): void {
    span.setAttributes(attributes);
  }
  
  /**
   * Add span events
   */
  addSpanEvent(span: Span, name: string, attributes?: Record<string, string | number | boolean>, timestamp?: number): void {
    span.addEvent(name, attributes, timestamp);
  }
  
  /**
   * Get current span
   */
  getCurrentSpan(): Span | undefined {
    return trace.getSpan(context.active());
  }
  
  /**
   * Run with span
   */
  async withSpan<T>(span: Span, fn: () => Promise<T> | T): Promise<T> {
    return await context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const result = await fn();
        this.setSpanStatus(span, SpanStatusCode.OK);
        return result;
      } catch (error) {
        this.setSpanStatus(
          span,
          SpanStatusCode.ERROR,
          error instanceof Error ? error.message : String(error)
        );
        
        this.addSpanEvent(span, 'exception', {
          'exception.message': error instanceof Error ? error.message : String(error),
          'exception.stacktrace': error instanceof Error && error.stack ? error.stack : ''
        });
        
        throw error;
      } finally {
        this.endSpan(span);
      }
    });
  }
  
  /**
   * Extract trace context from carrier
   */
  extractContext(carrier: Record<string, string>): TraceContext | undefined {
    const ctx = this.propagator.extract(ROOT_CONTEXT, carrier);
    const spanContext = trace.getSpanContext(ctx);
    
    if (!spanContext) {
      return undefined;
    }
    
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags
    };
  }
  
  /**
   * Inject trace context into carrier
   */
  injectContext(traceContext: TraceContext, carrier: Record<string, string>): void {
    const spanContext: SpanContext = {
      traceId: traceContext.traceId,
      spanId: traceContext.spanId,
      traceFlags: traceContext.traceFlags || TraceFlags.SAMPLED,
      isRemote: true
    };
    
    const ctx = trace.setSpanContext(ROOT_CONTEXT, spanContext);
    this.propagator.inject(ctx, carrier);
  }
}

/**
 * Check if an object is a Span
 */
function isSpan(obj: any): boolean {
  return obj && typeof obj.spanContext === 'function';
}

/**
 * Generate a trace ID
 */
export function generateTraceId(): string {
  return randomUUID().replace(/-/g, '');
}

/**
 * Generate a span ID
 */
export function generateSpanId(): string {
  return randomUUID().replace(/-/g, '').substring(0, 16);
}

/**
 * Tracing service
 */
class TracingService {
  private provider: TracingProvider | null = null;
  private enabled: boolean = false;
  
  /**
   * Set the tracing provider
   */
  setProvider(provider: TracingProvider): void {
    this.provider = provider;
    logger.info('Tracing provider set');
  }
  
  /**
   * Enable tracing
   */
  async enable(): Promise<void> {
    if (this.enabled) {
      return;
    }
    
    this.enabled = true;
    
    if (this.provider) {
      await this.provider.initialize();
      logger.info('Tracing enabled');
    } else {
      logger.warn('No tracing provider set, tracing will be disabled');
    }
  }
  
  /**
   * Disable tracing
   */
  async disable(): Promise<void> {
    if (!this.enabled) {
      return;
    }
    
    this.enabled = false;
    logger.info('Tracing disabled');
  }
  
  /**
   * Start a span
   */
  startSpan(name: string, options?: SpanOptions): SpanResult | undefined {
    if (!this.enabled || !this.provider) {
      return undefined;
    }
    
    const span = this.provider.startSpan(name, options);
    const context = span.spanContext();
    
    return {
      traceId: context.traceId,
      spanId: context.spanId,
      traceContext: {
        traceId: context.traceId,
        spanId: context.spanId,
        traceFlags: context.traceFlags
      }
    };
  }
  
  /**
   * End a span
   */
  endSpan(span: Span, endTime?: number): void {
    if (!this.enabled || !this.provider) {
      return;
    }
    
    this.provider.endSpan(span, endTime);
  }
  
  /**
   * Set span status
   */
  setSpanStatus(span: Span, code: SpanStatusCode, message?: string): void {
    if (!this.enabled || !this.provider) {
      return;
    }
    
    this.provider.setSpanStatus(span, code, message);
  }
  
  /**
   * Add span attributes
   */
  addSpanAttributes(span: Span, attributes: Record<string, string | number | boolean | string[] | number[] | boolean[]>): void {
    if (!this.enabled || !this.provider) {
      return;
    }
    
    this.provider.addSpanAttributes(span, attributes);
  }
  
  /**
   * Add span events
   */
  addSpanEvent(span: Span, name: string, attributes?: Record<string, string | number | boolean>, timestamp?: number): void {
    if (!this.enabled || !this.provider) {
      return;
    }
    
    this.provider.addSpanEvent(span, name, attributes, timestamp);
  }
  
  /**
   * Get current span
   */
  getCurrentSpan(): Span | undefined {
    if (!this.enabled || !this.provider) {
      return undefined;
    }
    
    return this.provider.getCurrentSpan();
  }
  
  /**
   * Run with span
   */
  async withSpan<T>(name: string, fn: () => Promise<T> | T, options?: SpanOptions): Promise<T> {
    if (!this.enabled || !this.provider) {
      return await fn();
    }
    
    const span = this.provider.startSpan(name, options);
    
    try {
      // Also track with telemetry
      const telemetryId = telemetry.startMeasurement(name, {
        ...options?.attributes,
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId
      });
      
      try {
        return await this.provider.withSpan(span, fn);
      } finally {
        await telemetry.stopMeasurement(telemetryId, {
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId
        });
      }
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Extract trace context from carrier
   */
  extractContext(carrier: Record<string, string>): TraceContext | undefined {
    if (!this.enabled || !this.provider) {
      return undefined;
    }
    
    return this.provider.extractContext(carrier);
  }
  
  /**
   * Inject trace context into carrier
   */
  injectContext(traceContext: TraceContext, carrier: Record<string, string>): void {
    if (!this.enabled || !this.provider) {
      return;
    }
    
    this.provider.injectContext(traceContext, carrier);
  }
}

// Create and export a singleton instance
export const tracing = new TracingService();

// Export default for convenience
export default tracing;

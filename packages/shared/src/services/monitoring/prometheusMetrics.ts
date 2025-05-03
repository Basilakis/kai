/**
 * Prometheus Metrics Integration
 * 
 * This module provides a simple interface for recording metrics to Prometheus.
 * It can be used with or without the actual Prometheus client library.
 */

import { logger } from '../../utils/logger';

// Flag to determine if we're using the actual Prometheus client
// This would typically be set based on environment variables
const USE_PROMETHEUS_CLIENT = process.env.USE_PROMETHEUS_CLIENT === 'true';

// Lazy-loaded Prometheus client
let prometheusClient: any;

// Cached metrics to avoid recreating them
const metricsCache: Record<string, any> = {};

/**
 * Initialize the Prometheus client if it's available
 */
function initPrometheusClient(): void {
  if (USE_PROMETHEUS_CLIENT && !prometheusClient) {
    try {
      // Try to load the Prometheus client
      // This is a dynamic import to avoid requiring the library if it's not used
      prometheusClient = require('prom-client');
      
      // Create a registry
      const Registry = prometheusClient.Registry;
      prometheusClient.registry = new Registry();
      
      // Add default metrics
      prometheusClient.collectDefaultMetrics({ register: prometheusClient.registry });
      
      logger.info('Prometheus client initialized');
    } catch (error) {
      logger.warn('Failed to initialize Prometheus client, falling back to mock implementation', { error });
      USE_PROMETHEUS_CLIENT = false;
    }
  }
}

/**
 * Record a gauge metric
 * @param name The metric name
 * @param value The metric value
 * @param labels Optional labels
 */
export function recordGauge(name: string, value: number, labels: Record<string, string> = {}): void {
  if (USE_PROMETHEUS_CLIENT) {
    // Initialize client if needed
    if (!prometheusClient) {
      initPrometheusClient();
    }
    
    // If we have a client, use it
    if (prometheusClient) {
      const metricName = `kai_${name}`;
      
      // Create the gauge if it doesn't exist
      if (!metricsCache[metricName]) {
        metricsCache[metricName] = new prometheusClient.Gauge({
          name: metricName,
          help: `Gauge metric for ${name}`,
          labelNames: Object.keys(labels),
          registers: [prometheusClient.registry]
        });
      }
      
      // Set the gauge value
      metricsCache[metricName].set(labels, value);
      return;
    }
  }
  
  // If we're not using the client or it failed to initialize, just log
  logger.debug('Prometheus gauge metric (mock)', {
    name: `kai_${name}`,
    value,
    labels
  });
}

/**
 * Record a counter metric
 * @param name The metric name
 * @param value The increment value
 * @param labels Optional labels
 */
export function recordCounter(name: string, value: number = 1, labels: Record<string, string> = {}): void {
  if (USE_PROMETHEUS_CLIENT) {
    // Initialize client if needed
    if (!prometheusClient) {
      initPrometheusClient();
    }
    
    // If we have a client, use it
    if (prometheusClient) {
      const metricName = `kai_${name}`;
      
      // Create the counter if it doesn't exist
      if (!metricsCache[metricName]) {
        metricsCache[metricName] = new prometheusClient.Counter({
          name: metricName,
          help: `Counter metric for ${name}`,
          labelNames: Object.keys(labels),
          registers: [prometheusClient.registry]
        });
      }
      
      // Increment the counter
      metricsCache[metricName].inc(labels, value);
      return;
    }
  }
  
  // If we're not using the client or it failed to initialize, just log
  logger.debug('Prometheus counter metric (mock)', {
    name: `kai_${name}`,
    value,
    labels
  });
}

/**
 * Record a histogram metric
 * @param name The metric name
 * @param value The metric value
 * @param labels Optional labels
 */
export function recordHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
  if (USE_PROMETHEUS_CLIENT) {
    // Initialize client if needed
    if (!prometheusClient) {
      initPrometheusClient();
    }
    
    // If we have a client, use it
    if (prometheusClient) {
      const metricName = `kai_${name}`;
      
      // Create the histogram if it doesn't exist
      if (!metricsCache[metricName]) {
        metricsCache[metricName] = new prometheusClient.Histogram({
          name: metricName,
          help: `Histogram metric for ${name}`,
          labelNames: Object.keys(labels),
          registers: [prometheusClient.registry]
        });
      }
      
      // Observe the histogram value
      metricsCache[metricName].observe(labels, value);
      return;
    }
  }
  
  // If we're not using the client or it failed to initialize, just log
  logger.debug('Prometheus histogram metric (mock)', {
    name: `kai_${name}`,
    value,
    labels
  });
}

/**
 * Get the Prometheus registry
 * @returns The Prometheus registry or null if not using Prometheus
 */
export function getRegistry(): any {
  if (USE_PROMETHEUS_CLIENT) {
    // Initialize client if needed
    if (!prometheusClient) {
      initPrometheusClient();
    }
    
    return prometheusClient?.registry || null;
  }
  
  return null;
}

export default {
  recordGauge,
  recordCounter,
  recordHistogram,
  getRegistry
};

/**
 * Metrics Service
 * 
 * Provides metrics collection and export for the Coordinator service.
 * Exposes metrics in Prometheus format for scraping.
 */

import { Logger } from 'winston';
import { createLogger } from '../utils/logger';
import { QueueService } from './queue.service';
import { WorkflowService } from './workflow.service';

// Mock implementation of Prometheus client
// In production, this would be replaced with the actual Prometheus client
interface PrometheusMetric {
  name: string;
  help: string;
  labelNames: string[];
  type: 'gauge' | 'counter' | 'histogram';
  values: Map<string, number>;
}

class MockPrometheusClient {
  private metrics: Map<string, PrometheusMetric> = new Map();

  public gauge(config: { name: string; help: string; labelNames: string[] }): any {
    const metric: PrometheusMetric = {
      name: config.name,
      help: config.help,
      labelNames: config.labelNames,
      type: 'gauge',
      values: new Map()
    };
    this.metrics.set(config.name, metric);
    
    return {
      set: (labels: Record<string, string>, value: number) => {
        const labelKey = this.getLabelKey(labels);
        metric.values.set(labelKey, value);
      },
      inc: (labels: Record<string, string>, value: number = 1) => {
        const labelKey = this.getLabelKey(labels);
        const currentValue = metric.values.get(labelKey) || 0;
        metric.values.set(labelKey, currentValue + value);
      },
      dec: (labels: Record<string, string>, value: number = 1) => {
        const labelKey = this.getLabelKey(labels);
        const currentValue = metric.values.get(labelKey) || 0;
        metric.values.set(labelKey, Math.max(0, currentValue - value));
      }
    };
  }
  
  public counter(config: { name: string; help: string; labelNames: string[] }): any {
    const metric: PrometheusMetric = {
      name: config.name,
      help: config.help,
      labelNames: config.labelNames,
      type: 'counter',
      values: new Map()
    };
    this.metrics.set(config.name, metric);
    
    return {
      inc: (labels: Record<string, string>, value: number = 1) => {
        const labelKey = this.getLabelKey(labels);
        const currentValue = metric.values.get(labelKey) || 0;
        metric.values.set(labelKey, currentValue + value);
      }
    };
  }
  
  public histogram(config: { name: string; help: string; labelNames: string[]; buckets?: number[] }): any {
    const metric: PrometheusMetric = {
      name: config.name,
      help: config.help,
      labelNames: config.labelNames,
      type: 'histogram',
      values: new Map()
    };
    this.metrics.set(config.name, metric);
    
    return {
      observe: (labels: Record<string, string>, value: number) => {
        const labelKey = this.getLabelKey(labels);
        metric.values.set(labelKey, value);
      }
    };
  }
  
  private getLabelKey(labels: Record<string, string>): string {
    return Object.entries(labels)
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join(',');
  }
  
  public getMetricsAsText(): string {
    let output = '';
    
    for (const [name, metric] of this.metrics.entries()) {
      output += `# HELP ${name} ${metric.help}\n`;
      output += `# TYPE ${name} ${metric.type}\n`;
      
      for (const [labelKey, value] of metric.values.entries()) {
        if (labelKey === '') {
          output += `${name} ${value}\n`;
        } else {
          output += `${name}{${labelKey}} ${value}\n`;
        }
      }
      
      output += '\n';
    }
    
    return output;
  }
}

// Use actual Prometheus client if available, otherwise use mock
let prometheusClient: any;
try {
  // Try to load the actual Prometheus client
  prometheusClient = require('prom-client');
  
  // Create a registry
  const Registry = prometheusClient.Registry;
  prometheusClient.register = new Registry();
  
  // Add default metrics
  prometheusClient.collectDefaultMetrics({ register: prometheusClient.register });
} catch (error) {
  // Fall back to mock implementation
  prometheusClient = new MockPrometheusClient();
}

/**
 * Metrics Service for the Coordinator
 */
export class MetricsService {
  private logger: Logger;
  private queueDepthGauge: any;
  private activeWorkflowsGauge: any;
  private workflowDurationHistogram: any;
  private workflowCompletedCounter: any;
  private workflowErrorCounter: any;
  private resourceUtilizationGauge: any;
  private metricsInterval: NodeJS.Timeout | null = null;
  
  constructor(
    private queueService: QueueService,
    private workflowService: WorkflowService
  ) {
    this.logger = createLogger('MetricsService');
    
    // Initialize metrics
    this.initializeMetrics();
    
    // Start metrics collection
    this.startMetricsCollection();
  }
  
  /**
   * Initialize metrics
   */
  private initializeMetrics(): void {
    // Queue depth gauge
    this.queueDepthGauge = prometheusClient.gauge({
      name: 'kai_coordinator_queue_depth',
      help: 'Current depth of workflow queues',
      labelNames: ['queue_name', 'priority']
    });
    
    // Active workflows gauge
    this.activeWorkflowsGauge = prometheusClient.gauge({
      name: 'kai_coordinator_active_workflows',
      help: 'Number of active workflows',
      labelNames: ['type', 'status']
    });
    
    // Workflow duration histogram
    this.workflowDurationHistogram = prometheusClient.histogram({
      name: 'kai_coordinator_workflow_duration_seconds',
      help: 'Duration of workflow execution in seconds',
      labelNames: ['type', 'success'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600]
    });
    
    // Workflow completed counter
    this.workflowCompletedCounter = prometheusClient.counter({
      name: 'kai_coordinator_workflow_completed_total',
      help: 'Total number of completed workflows',
      labelNames: ['type', 'success']
    });
    
    // Workflow error counter
    this.workflowErrorCounter = prometheusClient.counter({
      name: 'kai_coordinator_workflow_error_total',
      help: 'Total number of workflow errors',
      labelNames: ['type', 'error_type']
    });
    
    // Resource utilization gauge
    this.resourceUtilizationGauge = prometheusClient.gauge({
      name: 'kai_coordinator_resource_utilization',
      help: 'Resource utilization percentage',
      labelNames: ['resource_type']
    });
  }
  
  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    // Collect metrics every 15 seconds
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 15000);
    
    this.logger.info('Started metrics collection');
  }
  
  /**
   * Stop metrics collection
   */
  public stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
      this.logger.info('Stopped metrics collection');
    }
  }
  
  /**
   * Collect metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      // Collect queue metrics
      await this.collectQueueMetrics();
      
      // Collect workflow metrics
      await this.collectWorkflowMetrics();
      
      // Collect resource metrics
      this.collectResourceMetrics();
    } catch (error) {
      this.logger.error('Error collecting metrics', { error });
    }
  }
  
  /**
   * Collect queue metrics
   */
  private async collectQueueMetrics(): Promise<void> {
    try {
      // Get queue depths
      const queues = await this.queueService.getQueueStats();
      
      // Update queue depth gauge
      for (const queue of queues) {
        this.queueDepthGauge.set(
          { queue_name: queue.name, priority: queue.priority },
          queue.depth
        );
      }
    } catch (error) {
      this.logger.error('Error collecting queue metrics', { error });
    }
  }
  
  /**
   * Collect workflow metrics
   */
  private async collectWorkflowMetrics(): Promise<void> {
    try {
      // Get active workflows
      const activeWorkflows = await this.workflowService.getActiveWorkflows();
      
      // Group by type and status
      const workflowsByTypeAndStatus = new Map<string, number>();
      
      for (const workflow of activeWorkflows) {
        const key = `${workflow.type}:${workflow.status}`;
        const count = workflowsByTypeAndStatus.get(key) || 0;
        workflowsByTypeAndStatus.set(key, count + 1);
      }
      
      // Update active workflows gauge
      for (const [key, count] of workflowsByTypeAndStatus.entries()) {
        const [type, status] = key.split(':');
        this.activeWorkflowsGauge.set({ type, status }, count);
      }
    } catch (error) {
      this.logger.error('Error collecting workflow metrics', { error });
    }
  }
  
  /**
   * Collect resource metrics
   */
  private collectResourceMetrics(): void {
    try {
      // Get CPU usage
      const cpuUsage = process.cpuUsage();
      const cpuUsagePercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
      
      // Get memory usage
      const memoryUsage = process.memoryUsage();
      const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      
      // Update resource utilization gauge
      this.resourceUtilizationGauge.set({ resource_type: 'cpu' }, cpuUsagePercent);
      this.resourceUtilizationGauge.set({ resource_type: 'memory' }, memoryUsagePercent);
    } catch (error) {
      this.logger.error('Error collecting resource metrics', { error });
    }
  }
  
  /**
   * Record workflow start
   */
  public recordWorkflowStart(workflowId: string, type: string): void {
    try {
      // Increment active workflows gauge
      this.activeWorkflowsGauge.inc({ type, status: 'running' });
    } catch (error) {
      this.logger.error('Error recording workflow start', { error, workflowId });
    }
  }
  
  /**
   * Record workflow completion
   */
  public recordWorkflowCompletion(
    workflowId: string,
    type: string,
    success: boolean,
    durationMs: number
  ): void {
    try {
      // Convert duration to seconds
      const durationSeconds = durationMs / 1000;
      
      // Record workflow duration
      this.workflowDurationHistogram.observe(
        { type, success: String(success) },
        durationSeconds
      );
      
      // Increment completed counter
      this.workflowCompletedCounter.inc(
        { type, success: String(success) },
        1
      );
      
      // Decrement active workflows gauge
      this.activeWorkflowsGauge.dec({ type, status: 'running' });
    } catch (error) {
      this.logger.error('Error recording workflow completion', { error, workflowId });
    }
  }
  
  /**
   * Record workflow error
   */
  public recordWorkflowError(workflowId: string, type: string, errorType: string): void {
    try {
      // Increment error counter
      this.workflowErrorCounter.inc({ type, error_type: errorType }, 1);
    } catch (error) {
      this.logger.error('Error recording workflow error', { error, workflowId });
    }
  }
  
  /**
   * Get metrics in Prometheus format
   */
  public getMetrics(): string {
    if (typeof prometheusClient.register?.metrics === 'function') {
      return prometheusClient.register.metrics();
    } else if (typeof (prometheusClient as MockPrometheusClient).getMetricsAsText === 'function') {
      return (prometheusClient as MockPrometheusClient).getMetricsAsText();
    }
    
    return '# No metrics available';
  }
}

export default MetricsService;

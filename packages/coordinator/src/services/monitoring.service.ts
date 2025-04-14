import { Logger } from 'winston';
import { WorkflowRequest, QualityLevel } from '../types';

/**
 * Monitoring Service
 * 
 * Provides metrics collection and performance tracking for ML workflows.
 * Integrates with Prometheus for metrics export and distributed tracing.
 */
export class MonitoringService {
  // Custom metrics tracking
  private workflowCounts: Record<string, number> = {};
  private processingTimes: Record<string, number[]> = {};
  private cacheHits: Record<string, number> = {};
  private errors: Record<string, number> = {};
  
  // Active workflow tracking
  private activeWorkflows: Map<string, {
    startTime: number;
    request: WorkflowRequest;
    stages: Map<string, { startTime: number; endTime?: number }>;
  }> = new Map();
  
  constructor(private logger: Logger) {
    this.logger.info('Monitoring service initialized');
    
    // Initialize counters
    this.resetCounters();
  }
  
  /**
   * Resets all counters
   */
  private resetCounters(): void {
    this.workflowCounts = {};
    this.processingTimes = {};
    this.cacheHits = {};
    this.errors = {};
  }
  
  /**
   * Records the start of a workflow
   * @param workflowId The workflow ID
   * @param request The workflow request
   */
  public startWorkflow(workflowId: string, request: WorkflowRequest): void {
    const startTime = Date.now();
    
    // Track workflow in active workflows
    this.activeWorkflows.set(workflowId, {
      startTime,
      request,
      stages: new Map()
    });
    
    // Increment workflow count for this type
    const type = request.type;
    this.workflowCounts[type] = (this.workflowCounts[type] || 0) + 1;
    
    this.logger.debug('Workflow started', {
      workflowId,
      type,
      startTime
    });
    
    // Record Prometheus metric
    this.recordPrometheusMetic('workflow_started_total', 1, {
      type,
      userId: request.userId,
      subscriptionTier: request.subscriptionTier || 'standard'
    });
  }
  
  /**
   * Records a workflow completion
   * @param workflowId The workflow ID
   * @param success Whether the workflow completed successfully
   * @param result The workflow result (optional)
   */
  public recordWorkflowCompletion(workflowId: string, success: boolean, result?: any): void {
    const workflow = this.activeWorkflows.get(workflowId);
    
    if (!workflow) {
      this.logger.warn('Attempted to record completion for unknown workflow', { workflowId });
      return;
    }
    
    const endTime = Date.now();
    const duration = endTime - workflow.startTime;
    const type = workflow.request.type;
    
    // Record processing time
    if (!this.processingTimes[type]) {
      this.processingTimes[type] = [];
    }
    this.processingTimes[type].push(duration);
    
    // Keep only the last 100 processing times
    if (this.processingTimes[type].length > 100) {
      this.processingTimes[type].shift();
    }
    
    this.logger.debug('Workflow completed', {
      workflowId,
      type,
      success,
      duration
    });
    
    // Record Prometheus metrics
    this.recordPrometheusMetic('workflow_completed_total', 1, {
      type,
      success: String(success),
      userId: workflow.request.userId,
      subscriptionTier: workflow.request.subscriptionTier || 'standard'
    });
    
    this.recordPrometheusMetic('workflow_duration_seconds', duration / 1000, {
      type,
      success: String(success)
    });
    
    // Clean up active workflow tracking
    this.activeWorkflows.delete(workflowId);
  }
  
  /**
   * Records a workflow error
   * @param workflowId The workflow ID
   * @param type The workflow type
   * @param errorMessage The error message
   */
  public recordWorkflowError(workflowId: string, type: string, errorMessage: string): void {
    // Increment error count for this type
    this.errors[type] = (this.errors[type] || 0) + 1;
    
    this.logger.debug('Workflow error recorded', {
      workflowId,
      type,
      errorMessage
    });
    
    // Record Prometheus metric
    this.recordPrometheusMetic('workflow_error_total', 1, {
      type,
      errorType: this.categorizeError(errorMessage)
    });
    
    // Mark any active workflow as completed with error
    const workflow = this.activeWorkflows.get(workflowId);
    if (workflow) {
      const duration = Date.now() - workflow.startTime;
      
      this.recordPrometheusMetic('workflow_duration_seconds', duration / 1000, {
        type,
        success: 'false'
      });
      
      // Clean up active workflow tracking
      this.activeWorkflows.delete(workflowId);
    }
  }
  
  /**
   * Records a workflow creation event
   * @param workflowId The workflow ID
   * @param type The workflow type
   * @param duration The time taken to create the workflow
   */
  public recordWorkflowCreation(workflowId: string, type: string, duration: number): void {
    this.logger.debug('Workflow creation recorded', {
      workflowId,
      type,
      duration
    });
    
    // Record Prometheus metric
    this.recordPrometheusMetic('workflow_creation_seconds', duration / 1000, {
      type
    });
  }
  
  /**
   * Records a workflow stage start
   * @param workflowId The workflow ID
   * @param stage The processing stage
   */
  public recordStageStart(workflowId: string, stage: string): void {
    const workflow = this.activeWorkflows.get(workflowId);
    
    if (!workflow) {
      this.logger.warn('Attempted to record stage start for unknown workflow', { workflowId, stage });
      return;
    }
    
    const startTime = Date.now();
    
    // Record stage start time
    workflow.stages.set(stage, {
      startTime,
      endTime: undefined
    });
    
    this.logger.debug('Workflow stage started', {
      workflowId,
      stage,
      startTime
    });
    
    // Record Prometheus metric
    this.recordPrometheusMetic('workflow_stage_started_total', 1, {
      stage,
      type: workflow.request.type
    });
  }
  
  /**
   * Records a workflow stage completion
   * @param workflowId The workflow ID
   * @param stage The processing stage
   * @param success Whether the stage completed successfully
   */
  public recordStageCompletion(workflowId: string, stage: string, success: boolean): void {
    const workflow = this.activeWorkflows.get(workflowId);
    
    if (!workflow) {
      this.logger.warn('Attempted to record stage completion for unknown workflow', { workflowId, stage });
      return;
    }
    
    const stageInfo = workflow.stages.get(stage);
    
    if (!stageInfo) {
      this.logger.warn('Attempted to record completion for unstarted stage', { workflowId, stage });
      return;
    }
    
    const endTime = Date.now();
    stageInfo.endTime = endTime;
    
    const duration = endTime - stageInfo.startTime;
    
    this.logger.debug('Workflow stage completed', {
      workflowId,
      stage,
      success,
      duration
    });
    
    // Record Prometheus metrics
    this.recordPrometheusMetic('workflow_stage_completed_total', 1, {
      stage,
      type: workflow.request.type,
      success: String(success)
    });
    
    this.recordPrometheusMetic('workflow_stage_duration_seconds', duration / 1000, {
      stage,
      type: workflow.request.type,
      success: String(success)
    });
  }
  
  /**
   * Records a cache hit event
   * @param workflowId The workflow ID
   * @param type The workflow type
   */
  public recordCacheHit(workflowId: string, type: string): void {
    // Increment cache hit count for this type
    this.cacheHits[type] = (this.cacheHits[type] || 0) + 1;
    
    this.logger.debug('Cache hit recorded', {
      workflowId,
      type
    });
    
    // Record Prometheus metric
    this.recordPrometheusMetic('workflow_cache_hit_total', 1, {
      type
    });
  }
  
  /**
   * Records a workflow cancellation event
   * @param workflowId The workflow ID
   */
  public recordWorkflowCancellation(workflowId: string): void {
    const workflow = this.activeWorkflows.get(workflowId);
    
    if (!workflow) {
      this.logger.warn('Attempted to record cancellation for unknown workflow', { workflowId });
      return;
    }
    
    const type = workflow.request.type;
    
    this.logger.debug('Workflow cancellation recorded', {
      workflowId,
      type
    });
    
    // Record Prometheus metric
    this.recordPrometheusMetic('workflow_cancelled_total', 1, {
      type
    });
    
    // Clean up active workflow tracking
    this.activeWorkflows.delete(workflowId);
  }
  
  /**
   * Records resource usage for a workflow
   * @param workflowId The workflow ID
   * @param resources The resource usage information
   */
  public recordResourceUsage(workflowId: string, resources: {
    cpu: number;
    memory: number;
    gpu?: number;
    duration: number;
  }): void {
    const workflow = this.activeWorkflows.get(workflowId);
    
    if (!workflow) {
      this.logger.warn('Attempted to record resource usage for unknown workflow', { workflowId });
      return;
    }
    
    const type = workflow.request.type;
    
    this.logger.debug('Resource usage recorded', {
      workflowId,
      type,
      resources
    });
    
    // Record Prometheus metrics
    this.recordPrometheusMetic('workflow_cpu_usage_cores', resources.cpu, {
      type
    });
    
    this.recordPrometheusMetic('workflow_memory_usage_bytes', resources.memory, {
      type
    });
    
    if (resources.gpu !== undefined) {
      this.recordPrometheusMetic('workflow_gpu_usage_percent', resources.gpu, {
        type
      });
    }
  }
  
  /**
   * Gets statistics about workflow processing
   * @returns Processing statistics
   */
  public getStats(): {
    counts: Record<string, number>;
    averageTimes: Record<string, number>;
    cacheHitRates: Record<string, number>;
    errorRates: Record<string, number>;
    activeCount: number;
  } {
    const averageTimes: Record<string, number> = {};
    const cacheHitRates: Record<string, number> = {};
    const errorRates: Record<string, number> = {};
    
    // Calculate average processing times
    for (const [type, times] of Object.entries(this.processingTimes)) {
      if (times.length > 0) {
        const sum = times.reduce((a, b) => a + b, 0);
        averageTimes[type] = sum / times.length;
      }
    }
    
    // Calculate cache hit rates
    for (const [type, count] of Object.entries(this.workflowCounts)) {
      const hits = this.cacheHits[type] || 0;
      cacheHitRates[type] = count > 0 ? hits / count : 0;
    }
    
    // Calculate error rates
    for (const [type, count] of Object.entries(this.workflowCounts)) {
      const errors = this.errors[type] || 0;
      errorRates[type] = count > 0 ? errors / count : 0;
    }
    
    return {
      counts: { ...this.workflowCounts },
      averageTimes,
      cacheHitRates,
      errorRates,
      activeCount: this.activeWorkflows.size
    };
  }
  
  /**
   * Records a Prometheus metric (placeholder for actual implementation)
   * @param name The metric name
   * @param value The metric value
   * @param labels The metric labels
   */
  private recordPrometheusMetic(name: string, value: number, labels: Record<string, string>): void {
    // In a real implementation, this would use the Prometheus client library
    // For now, we just log the metric
    this.logger.debug('Prometheus metric', {
      name,
      value,
      labels
    });
    
    // Example of real implementation with prom-client:
    // if (!this.metrics[name]) {
    //   this.metrics[name] = new client.Gauge({
    //     name: `kai_${name}`,
    //     help: `Metric for ${name}`,
    //     labelNames: Object.keys(labels)
    //   });
    // }
    // this.metrics[name].set(labels, value);
  }
  
  /**
   * Categorizes an error message to standardize error reporting
   * @param errorMessage The error message
   * @returns The error category
   */
  private categorizeError(errorMessage: string): string {
    const lowerMessage = errorMessage.toLowerCase();
    
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return 'timeout';
    } else if (lowerMessage.includes('resource') && (lowerMessage.includes('unavailable') || lowerMessage.includes('exceeded'))) {
      return 'resource_limit';
    } else if (lowerMessage.includes('permission') || lowerMessage.includes('unauthorized')) {
      return 'permission';
    } else if (lowerMessage.includes('not found')) {
      return 'not_found';
    } else if (lowerMessage.includes('invalid') || lowerMessage.includes('validation')) {
      return 'validation';
    } else {
      return 'unknown';
    }
  }
}
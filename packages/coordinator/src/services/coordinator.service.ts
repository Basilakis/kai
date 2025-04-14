import * as k8s from '@kubernetes/client-node';
import { Redis } from 'ioredis';
import { Logger } from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import { QualityManager } from './quality-manager.service';
import { ResourceManager } from './resource-manager.service';
import { CacheManager } from './cache-manager.service';
import { MonitoringService } from './monitoring.service';
import { WorkflowTemplate, WorkflowRequest, ProcessingStage, QualityLevel } from '../types';

/**
 * Coordinator Service
 * 
 * Central service for orchestrating ML processing workflows in Kubernetes.
 * Manages workflow creation, monitoring, resource allocation, and caching.
 */
export class CoordinatorService {
  private k8sApi: k8s.CustomObjectsApi;
  private coreApi: k8s.CoreV1Api;
  private redis: Redis;
  private logger: Logger;
  private qualityManager: QualityManager;
  private resourceManager: ResourceManager;
  private cacheManager: CacheManager;
  private monitoringService: MonitoringService;
  private namespace: string;

  /**
   * Creates a new CoordinatorService instance
   */
  constructor(
    options: {
      kubeConfig?: k8s.KubeConfig,
      redisUrl?: string,
      namespace?: string,
      logLevel?: string
    } = {}
  ) {
    // Initialize Kubernetes client
    const kubeConfig = options.kubeConfig || new k8s.KubeConfig();
    kubeConfig.loadFromDefault();
    
    this.k8sApi = kubeConfig.makeApiClient(k8s.CustomObjectsApi);
    this.coreApi = kubeConfig.makeApiClient(k8s.CoreV1Api);
    
    // Initialize Redis client
    this.redis = new Redis(options.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    
    // Set namespace
    this.namespace = options.namespace || process.env.KUBERNETES_NAMESPACE || 'kai-ml';
    
    // Initialize logger
    this.logger = createLogger({
      service: 'coordinator-service',
      level: options.logLevel || process.env.LOG_LEVEL || 'info'
    });
    
    // Initialize supporting services
    this.qualityManager = new QualityManager(this.redis, this.logger);
    this.resourceManager = new ResourceManager(this.redis, this.k8sApi, this.coreApi, this.namespace, this.logger);
    this.cacheManager = new CacheManager(this.redis, this.logger);
    this.monitoringService = new MonitoringService(this.logger);
    
    this.logger.info('Coordinator service initialized', { namespace: this.namespace });
  }

  /**
   * Creates a new workflow based on the request
   * @param request The workflow request
   * @returns The created workflow ID
   */
  public async createWorkflow(request: WorkflowRequest): Promise<string> {
    const workflowId = uuidv4();
    const startTime = Date.now();
    
    try {
      this.logger.info('Creating new workflow', { 
        workflowId, 
        type: request.type,
        userId: request.userId
      });
      
      // Start monitoring
      this.monitoringService.startWorkflow(workflowId, request);
      
      // Check for cached results
      if (request.enableCaching !== false) {
        const cacheKey = this.generateCacheKey(request);
        const cachedResult = await this.cacheManager.get(cacheKey);
        
        if (cachedResult) {
          this.logger.info('Found cached result, returning early', { workflowId, cacheKey });
          this.monitoringService.recordCacheHit(workflowId, request.type);
          return cachedResult.workflowId;
        }
      }
      
      // Determine quality level based on input, available resources, and user subscription
      const qualityAssessment = await this.assessQuality(request);
      
      // Allocate resources based on quality level and request priority
      const resourceAllocation = await this.allocateResources(request, qualityAssessment);
      
      // Create the workflow
      const workflow = await this.buildWorkflow(workflowId, request, qualityAssessment, resourceAllocation);
      
      // Submit the workflow to Kubernetes
      await this.submitWorkflow(workflow);
      
      // Record metrics
      const duration = Date.now() - startTime;
      this.monitoringService.recordWorkflowCreation(workflowId, request.type, duration);
      
      return workflowId;
    } catch (error) {
      this.logger.error('Error creating workflow', { 
        workflowId, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      this.monitoringService.recordWorkflowError(
        workflowId, 
        request.type, 
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * Gets the status of a workflow
   * @param workflowId The workflow ID
   * @returns The workflow status
   */
  public async getWorkflowStatus(workflowId: string): Promise<any> {
    try {
      const response = await this.k8sApi.getNamespacedCustomObject(
        'argoproj.io',
        'v1alpha1',
        this.namespace,
        'workflows',
        workflowId
      );
      
      return this.formatWorkflowStatus(response.body);
    } catch (error) {
      this.logger.error('Error getting workflow status', { 
        workflowId, 
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Cancels a workflow
   * @param workflowId The workflow ID
   * @returns Success status
   */
  public async cancelWorkflow(workflowId: string): Promise<boolean> {
    try {
      // Get current workflow to check if it's still running
      const workflow = await this.k8sApi.getNamespacedCustomObject(
        'argoproj.io',
        'v1alpha1',
        this.namespace,
        'workflows',
        workflowId
      );
      
      // Check if workflow is already completed or failed
      const status = workflow.body['status']?.phase;
      if (status === 'Succeeded' || status === 'Failed') {
        this.logger.info('Workflow already completed, cannot cancel', { workflowId, status });
        return false;
      }
      
      // Add termination label to the workflow
      const patch = [
        {
          op: 'add',
          path: '/metadata/labels/workflows.argoproj.io~1completed',
          value: 'true'
        },
        {
          op: 'add',
          path: '/spec/shutdown',
          value: 'Terminate'
        }
      ];
      
      await this.k8sApi.patchNamespacedCustomObject(
        'argoproj.io',
        'v1alpha1',
        this.namespace,
        'workflows',
        workflowId,
        patch,
        undefined,
        undefined,
        undefined,
        { headers: { 'Content-Type': 'application/json-patch+json' } }
      );
      
      this.logger.info('Workflow cancelled successfully', { workflowId });
      this.monitoringService.recordWorkflowCancellation(workflowId);
      
      return true;
    } catch (error) {
      this.logger.error('Error cancelling workflow', { 
        workflowId, 
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Lists active workflows
   * @param userId Optional user ID to filter by
   * @returns List of active workflows
   */
  public async listActiveWorkflows(userId?: string): Promise<any[]> {
    try {
      let labelSelector = 'workflows.argoproj.io/completed!=true';
      
      if (userId) {
        labelSelector += `,user-id=${userId}`;
      }
      
      const response = await this.k8sApi.listNamespacedCustomObject(
        'argoproj.io',
        'v1alpha1',
        this.namespace,
        'workflows',
        undefined,
        undefined,
        undefined,
        undefined,
        labelSelector
      );
      
      const workflows = response.body['items'] || [];
      return workflows.map((wf: any) => this.formatWorkflowStatus(wf));
    } catch (error) {
      this.logger.error('Error listing active workflows', { 
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Assesses the quality level for a workflow request
   * @param request The workflow request
   * @returns The assessed quality level
   */
  private async assessQuality(request: WorkflowRequest): Promise<{
    qualityLevel: QualityLevel,
    factors: Record<string, number>
  }> {
    // Start with the requested quality (if specified)
    let requestedQuality = request.qualityTarget || 'auto';
    
    // If auto quality is requested, determine the appropriate level
    if (requestedQuality === 'auto') {
      return this.qualityManager.assessQuality(request);
    }
    
    // Map requested quality to quality level
    const qualityLevel = requestedQuality as QualityLevel;
    
    // Check if the requested quality level is valid for the user's subscription tier
    const isAllowed = await this.resourceManager.validateQualityForSubscription(
      qualityLevel,
      request.subscriptionTier
    );
    
    if (!isAllowed) {
      this.logger.warn('Requested quality level not allowed for subscription tier', {
        requestedQuality,
        subscriptionTier: request.subscriptionTier
      });
      
      // Fall back to the highest quality allowed for this subscription
      const allowedQuality = await this.resourceManager.getHighestAllowedQuality(request.subscriptionTier);
      
      return {
        qualityLevel: allowedQuality,
        factors: {
          subscription: 1.0,
          requested: 0.0
        }
      };
    }
    
    return {
      qualityLevel,
      factors: {
        requested: 1.0
      }
    };
  }

  /**
   * Allocates resources for a workflow
   * @param request The workflow request
   * @param qualityAssessment The quality assessment
   * @returns Resource allocation
   */
  private async allocateResources(
    request: WorkflowRequest,
    qualityAssessment: { qualityLevel: QualityLevel, factors: Record<string, number> }
  ): Promise<{
    cpu: string,
    memory: string,
    gpu: string,
    nodeSelectors: Record<string, string>
  }> {
    const { qualityLevel } = qualityAssessment;
    
    // Determine priority based on request type and user subscription
    const priority = request.priority || this.getPriorityForRequest(request);
    
    // Get resource allocation based on quality level and priority
    const resources = await this.resourceManager.allocateResources(qualityLevel, priority, request.subscriptionTier);
    
    // Log resource allocation
    this.logger.info('Resources allocated for workflow', {
      workflowId: request.workflowId,
      qualityLevel,
      priority,
      resources
    });
    
    return resources;
  }

  /**
   * Builds a workflow object from a request
   * @param workflowId The workflow ID
   * @param request The workflow request
   * @param qualityAssessment The quality assessment
   * @param resourceAllocation The resource allocation
   * @returns The workflow object
   */
  private async buildWorkflow(
    workflowId: string,
    request: WorkflowRequest,
    qualityAssessment: { qualityLevel: QualityLevel, factors: Record<string, number> },
    resourceAllocation: {
      cpu: string,
      memory: string,
      gpu: string,
      nodeSelectors: Record<string, string>
    }
  ): Promise<any> {
    const { qualityLevel } = qualityAssessment;
    
    // Get the workflow template for the request type
    const template = await this.getWorkflowTemplate(request.type);
    
    if (!template) {
      throw new Error(`No workflow template found for type: ${request.type}`);
    }
    
    // Create workflow from template
    const workflow = {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Workflow',
      metadata: {
        name: workflowId,
        namespace: this.namespace,
        labels: {
          'app': 'kai-ml',
          'workflow-type': request.type,
          'quality-level': qualityLevel,
          'user-id': request.userId,
          'subscription-tier': request.subscriptionTier
        }
      },
      spec: {
        ...template.spec,
        serviceAccountName: 'workflow-runner',
        arguments: {
          parameters: []
        },
        nodeSelector: resourceAllocation.nodeSelectors,
        tolerations: [
          {
            key: 'node-type',
            operator: 'Exists',
            effect: 'NoSchedule'
          }
        ],
        // Apply priority class based on request priority
        priorityClassName: this.getPriorityClassName(request.priority),
        // Apply resource limits based on allocation
        podMetadata: {
          labels: {
            'app': 'kai-ml',
            'workflow-type': request.type,
            'quality-level': qualityLevel,
            'user-id': request.userId
          }
        }
      }
    };
    
    // Add workflow parameters
    const parameters = [
      {
        name: 'user-id',
        value: request.userId
      },
      {
        name: 'subscription-tier',
        value: request.subscriptionTier
      },
      {
        name: 'quality-target',
        value: qualityLevel
      }
    ];
    
    // Add request-specific parameters
    if (request.parameters) {
      for (const [key, value] of Object.entries(request.parameters)) {
        parameters.push({
          name: key,
          value: typeof value === 'string' ? value : JSON.stringify(value)
        });
      }
    }
    
    (workflow.spec.arguments.parameters as any[]) = parameters;
    
    return workflow;
  }

  /**
   * Submits a workflow to Kubernetes
   * @param workflow The workflow object
   * @returns The submitted workflow
   */
  private async submitWorkflow(workflow: any): Promise<any> {
    try {
      const response = await this.k8sApi.createNamespacedCustomObject(
        'argoproj.io',
        'v1alpha1',
        this.namespace,
        'workflows',
        workflow
      );
      
      this.logger.info('Workflow submitted successfully', {
        workflowId: workflow.metadata.name,
        type: workflow.metadata.labels['workflow-type']
      });
      
      return response.body;
    } catch (error) {
      this.logger.error('Error submitting workflow', {
        workflowId: workflow.metadata.name,
        error: error instanceof Error ? error.message : String(error),
        workflow: JSON.stringify(workflow)
      });
      
      throw error;
    }
  }

  /**
   * Gets a workflow template by type
   * @param type The workflow type
   * @returns The workflow template
   */
  private async getWorkflowTemplate(type: string): Promise<WorkflowTemplate> {
    try {
      const response = await this.k8sApi.getNamespacedCustomObject(
        'argoproj.io',
        'v1alpha1',
        this.namespace,
        'workflowtemplates',
        type
      );
      
      return response.body as WorkflowTemplate;
    } catch (error) {
      this.logger.error('Error getting workflow template', {
        type,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Formats a workflow status response
   * @param workflow The workflow object
   * @returns Formatted workflow status
   */
  private formatWorkflowStatus(workflow: any): any {
    if (!workflow) return null;
    
    const { metadata, spec, status } = workflow;
    
    return {
      id: metadata.name,
      type: metadata.labels['workflow-type'],
      userId: metadata.labels['user-id'],
      qualityLevel: metadata.labels['quality-level'],
      createdAt: metadata.creationTimestamp,
      status: status?.phase || 'Pending',
      progress: this.calculateProgress(status),
      estimatedCompletionTime: this.estimateCompletionTime(status),
      startedAt: status?.startedAt,
      finishedAt: status?.finishedAt,
      duration: status?.finishedAt ? 
        (new Date(status.finishedAt).getTime() - new Date(status.startedAt).getTime()) / 1000 : 
        undefined,
      nodes: this.formatNodes(status?.nodes)
    };
  }

  /**
   * Calculates workflow progress percentage
   * @param status The workflow status
   * @returns Progress percentage (0-100)
   */
  private calculateProgress(status: any): number {
    if (!status || !status.nodes) return 0;
    
    const nodes = Object.values(status.nodes) as any[];
    const totalNodes = nodes.length - 1; // Exclude the root node
    
    if (totalNodes === 0) return 0;
    
    const completedNodes = nodes.filter(node => 
      node.phase === 'Succeeded' || node.phase === 'Failed' || node.phase === 'Error' || node.phase === 'Skipped'
    ).length - 1; // Exclude the root node if completed
    
    return Math.round((completedNodes / totalNodes) * 100);
  }

  /**
   * Estimates workflow completion time
   * @param status The workflow status
   * @returns Estimated completion time
   */
  private estimateCompletionTime(status: any): string | null {
    if (!status || !status.startedAt || status.phase === 'Succeeded' || status.phase === 'Failed') {
      return null;
    }
    
    const progress = this.calculateProgress(status);
    
    if (progress === 0) return null;
    
    const startTime = new Date(status.startedAt).getTime();
    const currentTime = Date.now();
    const elapsedTime = currentTime - startTime;
    
    // Calculate estimated total time based on current progress
    const estimatedTotalTime = (elapsedTime / progress) * 100;
    const estimatedRemainingTime = estimatedTotalTime - elapsedTime;
    
    // Add remaining time to current time
    const estimatedCompletionTime = new Date(currentTime + estimatedRemainingTime);
    
    return estimatedCompletionTime.toISOString();
  }

  /**
   * Formats workflow nodes for status response
   * @param nodes The workflow nodes
   * @returns Formatted nodes
   */
  private formatNodes(nodes: Record<string, any> = {}): any[] {
    return Object.values(nodes)
      .filter(node => node.type !== 'DAG' && node.type !== 'StepGroup')
      .map(node => ({
        id: node.id,
        name: node.name,
        type: node.type,
        phase: node.phase,
        message: node.message,
        startedAt: node.startedAt,
        finishedAt: node.finishedAt,
        progress: node.progress || 0
      }));
  }

  /**
   * Generates a cache key for a workflow request
   * @param request The workflow request
   * @returns The cache key
   */
  private generateCacheKey(request: WorkflowRequest): string {
    // Create a normalized version of the request for consistent hashing
    const normalizedRequest = {
      type: request.type,
      qualityTarget: request.qualityTarget || 'auto',
      parameters: request.parameters || {}
    };
    
    // Create a hash of the normalized request
    const hash = require('crypto')
      .createHash('sha256')
      .update(JSON.stringify(normalizedRequest))
      .digest('hex');
    
    return `workflow:${request.type}:${hash}`;
  }

  /**
   * Gets priority class name based on priority
   * @param priority The priority
   * @returns The priority class name
   */
  private getPriorityClassName(priority?: string): string {
    switch (priority) {
      case 'critical':
        return 'system-critical';
      case 'high':
        return 'interactive';
      case 'medium':
        return 'medium-priority-batch';
      case 'low':
        return 'low-priority-batch';
      case 'background':
        return 'maintenance';
      default:
        return 'medium-priority-batch'; // Default priority
    }
  }

  /**
   * Determines priority for a request based on type and subscription
   * @param request The workflow request
   * @returns The priority
   */
  private getPriorityForRequest(request: WorkflowRequest): string {
    // Interactive types get higher priority
    const interactiveTypes = ['preview', 'quick-analysis', 'real-time'];
    if (interactiveTypes.includes(request.type)) {
      return 'high';
    }
    
    // Map subscription tier to priority
    switch (request.subscriptionTier) {
      case 'premium':
        return 'high';
      case 'standard':
        return 'medium';
      case 'free':
        return 'low';
      default:
        return 'medium';
    }
  }
}
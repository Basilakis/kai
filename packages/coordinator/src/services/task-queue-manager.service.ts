import * as k8s from '@kubernetes/client-node';
import { Redis } from 'ioredis';
import { Logger } from 'winston';
import { Kafka, Producer, Consumer } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import { QualityManager } from './quality-manager.service';
import { ResourceManager } from './resource-manager.service';
import { CacheManager } from './cache-manager.service';
import { MonitoringService } from './monitoring.service';

/**
 * Task status enum
 */
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Task priority enum
 */
export enum TaskPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  BATCH = 'batch'
}

/**
 * Task definition interface
 */
export interface Task {
  id: string;
  type: string;
  priority: TaskPriority;
  parameters: Record<string, any>;
  status: TaskStatus;
  workflowId?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  attempts: number;
  maxAttempts: number;
  userId?: string;
  subscriptionTier?: string;
  deadlineMs?: number;
}

/**
 * Queue configuration interface
 */
interface QueueConfig {
  concurrency: number;
  rateLimitPerSecond: number;
  maxRetries: number;
  retryBackoffMs: number;
}

/**
 * CircuitBreaker configuration
 */
interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  resetTimeoutSeconds: number;
}

/**
 * Task Queue Manager Service
 * 
 * Manages distributed task processing with priority queues, 
 * resilience features, and workflow orchestration.
 */
export class TaskQueueManager {
  private queueConfig: Record<TaskPriority, QueueConfig>;
  private processingTasks: Map<string, Task> = new Map();
  private circuitBreakers: Map<string, {
    failures: number;
    lastFailure: number;
    open: boolean;
  }> = new Map();
  private circuitBreakerConfig: CircuitBreakerConfig;
  private producer: Producer;
  private consumer: Consumer;
  private running: boolean = false;
  private k8sCustomObjectsApi: k8s.CustomObjectsApi;
  private namespace: string;
  
  /**
   * Constructor
   */
  constructor(
    private redis: Redis,
    private kafka: Kafka,
    private k8sConfig: k8s.KubeConfig,
    private qualityManager: QualityManager,
    private resourceManager: ResourceManager,
    private cacheManager: CacheManager,
    private monitoringService: MonitoringService,
    private logger: Logger = createLogger('TaskQueueManager')
  ) {
    this.namespace = process.env.KUBERNETES_NAMESPACE || 'kai-ml';
    this.k8sCustomObjectsApi = this.k8sConfig.makeApiClient(k8s.CustomObjectsApi);
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: 'task-queue-manager' });
    
    // Default queue configuration
    this.queueConfig = {
      [TaskPriority.HIGH]: {
        concurrency: 50,
        rateLimitPerSecond: 100,
        maxRetries: 3,
        retryBackoffMs: 1000
      },
      [TaskPriority.MEDIUM]: {
        concurrency: 30,
        rateLimitPerSecond: 50,
        maxRetries: 3,
        retryBackoffMs: 2000
      },
      [TaskPriority.LOW]: {
        concurrency: 20,
        rateLimitPerSecond: 25,
        maxRetries: 2,
        retryBackoffMs: 5000
      },
      [TaskPriority.BATCH]: {
        concurrency: 10,
        rateLimitPerSecond: 10,
        maxRetries: 1,
        retryBackoffMs: 10000
      }
    };
    
    // Default circuit breaker configuration
    this.circuitBreakerConfig = {
      enabled: true,
      failureThreshold: 5,
      resetTimeoutSeconds: 60
    };
    
    this.logger.info('Task Queue Manager initialized');
  }
  
  /**
   * Start the task queue manager
   */
  public async start(): Promise<void> {
    if (this.running) {
      return;
    }
    
    this.running = true;
    
    try {
      // Load configuration from ConfigMap
      await this.loadConfig();
      
      // Connect to Kafka
      await this.producer.connect();
      await this.consumer.connect();
      
      // Subscribe to task topics
      await this.consumer.subscribe({ 
        topics: [
          'task-submissions',
          'task-cancellations',
          'workflow-events'
        ] 
      });
      
      // Start consuming messages
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const value = message.value?.toString();
          if (!value) return;
          
          const data = JSON.parse(value);
          
          switch (topic) {
            case 'task-submissions':
              await this.handleTaskSubmission(data);
              break;
            case 'task-cancellations':
              await this.handleTaskCancellation(data);
              break;
            case 'workflow-events':
              await this.handleWorkflowEvent(data);
              break;
          }
        }
      });
      
      // Start task processing loops for each priority
      for (const priority of Object.values(TaskPriority)) {
        this.startTaskProcessingLoop(priority);
      }
      
      // Start task cleanup loop
      this.startTaskCleanupLoop();
      
      this.logger.info('Task Queue Manager started');
    } catch (error) {
      this.running = false;
      this.logger.error('Failed to start Task Queue Manager', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Stop the task queue manager
   */
  public async stop(): Promise<void> {
    if (!this.running) {
      return;
    }
    
    this.running = false;
    
    try {
      await this.consumer.disconnect();
      await this.producer.disconnect();
      
      this.logger.info('Task Queue Manager stopped');
    } catch (error) {
      this.logger.error('Error stopping Task Queue Manager', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Submit a new task
   * @param taskType Task type
   * @param parameters Task parameters
   * @param priority Task priority
   * @param userId User ID
   * @param subscriptionTier Subscription tier
   * @returns The task ID
   */
  public async submitTask(
    taskType: string,
    parameters: Record<string, any>,
    priority: TaskPriority = TaskPriority.MEDIUM,
    userId?: string,
    subscriptionTier?: string
  ): Promise<string> {
    const taskId = uuidv4();
    
    // Create task object
    const task: Task = {
      id: taskId,
      type: taskType,
      priority,
      parameters,
      status: TaskStatus.PENDING,
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: this.queueConfig[priority].maxRetries,
      userId,
      subscriptionTier
    };
    
    // Check for cached result
    if (taskType !== 'workflow') {
      const cacheKey = await this.generateCacheKey(taskType, parameters);
      const cachedResult = await this.cacheManager.get(cacheKey);
      
      if (cachedResult) {
        this.logger.debug('Cache hit for task', { taskId, taskType });
        this.monitoringService.recordCacheResult(taskId, true);
        return cachedResult.workflowId;
      }
      
      this.monitoringService.recordCacheResult(taskId, false);
    }
    
    // Save task to Redis
    await this.redis.set(`task:${taskId}`, JSON.stringify(task));
    
    // Add to priority queue
    await this.redis.zadd(`queue:${priority}`, Date.now(), taskId);
    
    // Publish task submission event
    await this.producer.send({
      topic: 'task-submissions',
      messages: [
        { 
          key: taskId, 
          value: JSON.stringify({
            taskId,
            taskType,
            priority,
            userId,
            subscriptionTier
          })
        }
      ]
    });
    
    this.logger.info('Task submitted', { taskId, taskType, priority });
    return taskId;
  }
  
  /**
   * Cancel a task
   * @param taskId Task ID
   * @returns Success flag
   */
  public async cancelTask(taskId: string): Promise<boolean> {
    const taskData = await this.redis.get(`task:${taskId}`);
    
    if (!taskData) {
      this.logger.warn('Task not found for cancellation', { taskId });
      return false;
    }
    
    const task = JSON.parse(taskData) as Task;
    
    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
      this.logger.warn('Cannot cancel completed or failed task', { taskId, status: task.status });
      return false;
    }
    
    // Update task status
    task.status = TaskStatus.CANCELLED;
    await this.redis.set(`task:${taskId}`, JSON.stringify(task));
    
    // Remove from priority queue
    await this.redis.zrem(`queue:${task.priority}`, taskId);
    
    // If task has workflowId, cancel the workflow
    if (task.workflowId) {
      try {
        await this.k8sCustomObjectsApi.deleteNamespacedCustomObject(
          'argoproj.io',
          'v1alpha1',
          this.namespace,
          'workflows',
          task.workflowId
        );
        
        this.logger.info('Workflow cancelled', { taskId, workflowId: task.workflowId });
      } catch (error) {
        this.logger.error('Error cancelling workflow', {
          taskId,
          workflowId: task.workflowId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Publish task cancellation event
    await this.producer.send({
      topic: 'task-cancellations',
      messages: [
        { 
          key: taskId, 
          value: JSON.stringify({ taskId })
        }
      ]
    });
    
    this.logger.info('Task cancelled', { taskId });
    return true;
  }
  
  /**
   * Get task status
   * @param taskId Task ID
   * @returns Task status
   */
  public async getTaskStatus(taskId: string): Promise<Task | null> {
    const taskData = await this.redis.get(`task:${taskId}`);
    
    if (!taskData) {
      return null;
    }
    
    return JSON.parse(taskData) as Task;
  }
  
  /**
   * Load configuration from ConfigMap
   * @private
   */
  private async loadConfig(): Promise<void> {
    try {
      const configMapResponse = await this.k8sCustomObjectsApi.getNamespacedCustomObject(
        'v1',
        'ConfigMap',
        this.namespace,
        'configmaps',
        'task-queue-manager-config'
      );
      
      const configMap = configMapResponse.body as any;
      const configData = JSON.parse(configMap.data['config.json']);
      
      // Update queue configuration
      if (configData.queues) {
        if (configData.queues.highPriority) {
          this.queueConfig[TaskPriority.HIGH] = configData.queues.highPriority;
        }
        if (configData.queues.mediumPriority) {
          this.queueConfig[TaskPriority.MEDIUM] = configData.queues.mediumPriority;
        }
        if (configData.queues.lowPriority) {
          this.queueConfig[TaskPriority.LOW] = configData.queues.lowPriority;
        }
        if (configData.queues.batchProcessing) {
          this.queueConfig[TaskPriority.BATCH] = configData.queues.batchProcessing;
        }
      }
      
      // Update circuit breaker configuration
      if (configData.faultTolerance?.circuitBreaker) {
        this.circuitBreakerConfig = configData.faultTolerance.circuitBreaker;
      }
      
      this.logger.info('Configuration loaded from ConfigMap');
    } catch (error) {
      this.logger.warn('Failed to load configuration from ConfigMap, using defaults', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Start task processing loop for a priority
   * @param priority Task priority
   * @private
   */
  private startTaskProcessingLoop(priority: TaskPriority): void {
    const config = this.queueConfig[priority];
    let running = 0;
    let lastRun = 0;
    
    const processNext = async (): Promise<void> => {
      if (!this.running) return;
      
      // Rate limiting
      const now = Date.now();
      const elapsed = now - lastRun;
      const minInterval = 1000 / config.rateLimitPerSecond;
      
      if (elapsed < minInterval) {
        setTimeout(processNext, minInterval - elapsed);
        return;
      }
      
      lastRun = now;
      
      // Check if we're at concurrency limit
      if (running >= config.concurrency) {
        setTimeout(processNext, 100);
        return;
      }
      
      // Get next task from queue
      const result = await this.redis.zpopmin(`queue:${priority}`);
      
      if (!result || result.length < 2) {
        setTimeout(processNext, 100);
        return;
      }
      
      const [taskId] = result;
      
      // Get task data
      const taskData = await this.redis.get(`task:${taskId}`);
      
      if (!taskData) {
        setTimeout(processNext, 10);
        return;
      }
      
      const task = JSON.parse(taskData) as Task;
      
      // Skip cancelled tasks
      if (task.status === TaskStatus.CANCELLED) {
        setTimeout(processNext, 10);
        return;
      }
      
      // Check circuit breaker
      if (this.circuitBreakerConfig.enabled) {
        const circuitBreaker = this.circuitBreakers.get(task.type) || {
          failures: 0,
          lastFailure: 0,
          open: false
        };
        
        if (circuitBreaker.open) {
          const elapsed = now - circuitBreaker.lastFailure;
          const resetTimeout = this.circuitBreakerConfig.resetTimeoutSeconds * 1000;
          
          if (elapsed < resetTimeout) {
            // Circuit is open, re-queue the task
            await this.redis.zadd(`queue:${priority}`, now + 1000, taskId);
            setTimeout(processNext, 10);
            return;
          }
          
          // Reset circuit breaker for a single try
          circuitBreaker.open = false;
          this.circuitBreakers.set(task.type, circuitBreaker);
        }
      }
      
      // Process the task
      running++;
      
      try {
        // Update task status
        task.status = TaskStatus.RUNNING;
        task.startedAt = now;
        task.attempts++;
        
        await this.redis.set(`task:${taskId}`, JSON.stringify(task));
        
        // Add to processing tasks
        this.processingTasks.set(taskId, task);
        
        // Process the task based on type
        await this.processTask(task);
        
        // Reset circuit breaker failures
        if (this.circuitBreakerConfig.enabled) {
          const circuitBreaker = this.circuitBreakers.get(task.type);
          if (circuitBreaker) {
            circuitBreaker.failures = 0;
            this.circuitBreakers.set(task.type, circuitBreaker);
          }
        }
      } catch (error) {
        this.logger.error('Error processing task', {
          taskId,
          taskType: task.type,
          attempt: task.attempts,
          error: error instanceof Error ? error.message : String(error)
        });
        
        // Update circuit breaker
        if (this.circuitBreakerConfig.enabled) {
          const circuitBreaker = this.circuitBreakers.get(task.type) || {
            failures: 0,
            lastFailure: 0,
            open: false
          };
          
          circuitBreaker.failures++;
          circuitBreaker.lastFailure = now;
          
          if (circuitBreaker.failures >= this.circuitBreakerConfig.failureThreshold) {
            circuitBreaker.open = true;
            this.logger.warn('Circuit breaker opened for task type', { taskType: task.type });
          }
          
          this.circuitBreakers.set(task.type, circuitBreaker);
        }
        
        // Check if we should retry
        if (task.attempts < task.maxAttempts) {
          // Calculate backoff time
          const backoff = config.retryBackoffMs * Math.pow(2, task.attempts - 1);
          const retryTime = now + backoff;
          
          // Re-queue the task with backoff
          await this.redis.zadd(`queue:${priority}`, retryTime, taskId);
          
          // Update task status
          task.status = TaskStatus.PENDING;
          await this.redis.set(`task:${taskId}`, JSON.stringify(task));
          
          this.logger.info('Task requeued for retry', {
            taskId,
            attempt: task.attempts,
            maxAttempts: task.maxAttempts,
            backoff
          });
        } else {
          // Mark task as failed
          task.status = TaskStatus.FAILED;
          task.completedAt = now;
          await this.redis.set(`task:${taskId}`, JSON.stringify(task));
          
          // Add to failed tasks set
          await this.redis.sadd('failed-tasks', taskId);
          
          this.logger.warn('Task failed after max attempts', {
            taskId,
            maxAttempts: task.maxAttempts
          });
          
          // Record task failure
          this.monitoringService.recordError(
            task.workflowId || taskId,
            'processing',
            `Task failed after ${task.maxAttempts} attempts`
          );
        }
      } finally {
        // Remove from processing tasks
        this.processingTasks.delete(taskId);
        running--;
        
        // Schedule next task
        setTimeout(processNext, 10);
      }
    };
    
    // Start processing loop with some concurrency
    for (let i = 0; i < config.concurrency; i++) {
      setTimeout(processNext, i * 100);
    }
    
    this.logger.info('Task processing loop started', { priority });
  }
  
  /**
   * Start task cleanup loop
   * @private
   */
  private startTaskCleanupLoop(): void {
    const cleanup = async (): Promise<void> => {
      if (!this.running) return;
      
      try {
        // Get all task keys
        const taskKeys = await this.redis.keys('task:*');
        const now = Date.now();
        const expirationTime = 7 * 24 * 60 * 60 * 1000; // 7 days
        
        for (const key of taskKeys) {
          const taskData = await this.redis.get(key);
          
          if (!taskData) continue;
          
          const task = JSON.parse(taskData) as Task;
          
          // Skip tasks that are still running
          if (task.status === TaskStatus.RUNNING || task.status === TaskStatus.PENDING) {
            continue;
          }
          
          // Check if task is older than expiration time
          const taskAge = now - (task.completedAt || task.createdAt);
          
          if (taskAge > expirationTime) {
            // Delete task data
            await this.redis.del(key);
            
            // Remove from failed tasks set if present
            if (task.status === TaskStatus.FAILED) {
              await this.redis.srem('failed-tasks', task.id);
            }
            
            this.logger.debug('Cleaned up expired task', { taskId: task.id });
          }
        }
      } catch (error) {
        this.logger.error('Error in task cleanup loop', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Schedule next cleanup in 1 hour
      setTimeout(cleanup, 60 * 60 * 1000);
    };
    
    // Start cleanup loop
    setTimeout(cleanup, 60 * 1000);
    
    this.logger.info('Task cleanup loop started');
  }
  
  /**
   * Handle task submission event
   * @param data Event data
   * @private
   */
  private async handleTaskSubmission(data: any): Promise<void> {
    this.logger.debug('Received task submission event', { data });
    
    // No action needed here, as the task is already in the queue
  }
  
  /**
   * Handle task cancellation event
   * @param data Event data
   * @private
   */
  private async handleTaskCancellation(data: any): Promise<void> {
    const { taskId } = data;
    
    this.logger.debug('Received task cancellation event', { taskId });
    
    // No action needed here if we're the one who cancelled the task
    // This is mainly for cancellations from other instances
  }
  
  /**
   * Handle workflow event
   * @param data Event data
   * @private
   */
  private async handleWorkflowEvent(data: any): Promise<void> {
    const { workflowId, status, taskId } = data;
    
    this.logger.debug('Received workflow event', { workflowId, status, taskId });
    
    if (!taskId) {
      return;
    }
    
    const taskData = await this.redis.get(`task:${taskId}`);
    
    if (!taskData) {
      this.logger.warn('Task not found for workflow event', { taskId, workflowId });
      return;
    }
    
    const task = JSON.parse(taskData) as Task;
    
    // Update task status based on workflow status
    switch (status) {
      case 'Succeeded':
        task.status = TaskStatus.COMPLETED;
        task.completedAt = Date.now();
        break;
      case 'Failed':
        task.status = TaskStatus.FAILED;
        task.completedAt = Date.now();
        break;
      case 'Error':
        task.status = TaskStatus.FAILED;
        task.completedAt = Date.now();
        break;
      case 'Cancelled':
        task.status = TaskStatus.CANCELLED;
        task.completedAt = Date.now();
        break;
    }
    
    // Update task in Redis
    await this.redis.set(`task:${taskId}`, JSON.stringify(task));
    
    // Record workflow completion
    if (status === 'Succeeded' || status === 'Failed' || status === 'Error' || status === 'Cancelled') {
      const duration = task.completedAt! - (task.startedAt || task.createdAt);
      this.monitoringService.recordWorkflowCompletion(
        workflowId,
        duration,
        status === 'Succeeded'
      );
    }
  }
  
  /**
   * Process a task
   * @param task Task to process
   * @private
   */
  private async processTask(task: Task): Promise<void> {
    this.logger.info('Processing task', {
      taskId: task.id,
      taskType: task.type,
      attempt: task.attempts
    });
    
    // Record task processing start
    this.monitoringService.recordWorkflowCreation(
      task.id,
      task.type,
      this.getPriorityString(task.priority)
    );
    
    // Handle task based on type
    if (task.type === 'workflow') {
      await this.processWorkflowTask(task);
    } else {
      throw new Error(`Unknown task type: ${task.type}`);
    }
  }
  
  /**
   * Process a workflow task
   * @param task Workflow task
   * @private
   */
  private async processWorkflowTask(task: Task): Promise<void> {
    const { workflowTemplate, parameters } = task.parameters;
    
    if (!workflowTemplate) {
      throw new Error('Missing workflow template');
    }
    
    // Determine quality level
    const qualityLevel = await this.determineQualityLevel(task);
    
    // Record quality level
    this.monitoringService.recordQualityLevel(task.id, qualityLevel);
    
    // Allocate resources based on quality level
    const resourceAllocation = await this.resourceManager.allocateResources(
      qualityLevel,
      this.getPriorityString(task.priority),
      task.subscriptionTier
    );
    
    // Record resource allocation
    this.monitoringService.recordResourceAllocation(
      task.id,
      resourceAllocation.cpu,
      resourceAllocation.memory,
      resourceAllocation.gpu
    );
    
    // Create workflow object
    const workflow = {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Workflow',
      metadata: {
        generateName: `${workflowTemplate}-`,
        labels: {
          'app.kubernetes.io/name': 'kai',
          'app.kubernetes.io/component': 'workflow',
          'kai.task-id': task.id,
          'kai.user-id': task.userId || 'anonymous',
          'kai.priority': task.priority
        },
        annotations: {
          'kai.task-type': task.type,
          'kai.quality-level': qualityLevel,
          'kai.subscription-tier': task.subscriptionTier || 'standard'
        }
      },
      spec: {
        workflowTemplateRef: {
          name: workflowTemplate
        },
        arguments: {
          parameters: Object.entries(parameters).map(([name, value]) => ({
            name,
            value: typeof value === 'string' ? value : JSON.stringify(value)
          }))
        },
        serviceAccountName: 'argo-workflow',
        nodeSelector: resourceAllocation.nodeSelectors,
        priorityClassName: this.getPriorityClassName(task.priority),
        ttlStrategy: {
          secondsAfterCompletion: 3600, // 1 hour
          secondsAfterSuccess: 3600,    // 1 hour
          secondsAfterFailure: 86400    // 1 day
        },
        podGC: {
          strategy: 'OnPodCompletion'
        },
        resources: {
          requests: {
            cpu: resourceAllocation.cpu,
            memory: resourceAllocation.memory
          }
        }
      }
    };
    
    // If GPU is allocated, add it to resources
    if (resourceAllocation.gpu) {
      workflow.spec.resources.requests['nvidia.com/gpu'] = resourceAllocation.gpu;
    }
    
    try {
      // Create the workflow
      const response = await this.k8sCustomObjectsApi.createNamespacedCustomObject(
        'argoproj.io',
        'v1alpha1',
        this.namespace,
        'workflows',
        workflow
      );
      
      const createdWorkflow = response.body as any;
      const workflowId = createdWorkflow.metadata.name;
      
      // Update task with workflow ID
      task.workflowId = workflowId;
      await this.redis.set(`task:${task.id}`, JSON.stringify(task));
      
      this.logger.info('Created workflow', {
        taskId: task.id,
        workflowId,
        template: workflowTemplate
      });
      
      // Create cache key for this task
      const cacheKey = await this.generateCacheKey(task.type, task.parameters);
      
      // Store task in cache with TTL
      await this.cacheManager.set(
        cacheKey,
        task.id,
        { id: task.id, workflowId },
        24 * 60 * 60 // 1 day TTL
      );
    } catch (error) {
      this.logger.error('Failed to create workflow', {
        taskId: task.id,
        template: workflowTemplate,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Record error
      this.monitoringService.recordError(
        task.id,
        'workflow-creation',
        error instanceof Error ? error.message : String(error)
      );
      
      throw error;
    }
  }
  
  /**
   * Determine quality level for a task
   * @param task Task
   * @returns Quality level
   * @private
   */
  private async determineQualityLevel(task: Task): Promise<string> {
    // If quality level is specified in parameters, use it
    if (task.parameters.qualityLevel) {
      return task.parameters.qualityLevel;
    }
    
    try {
      // Use QualityManager to assess quality
      const result = await this.qualityManager.assessQuality({
        type: task.type,
        parameters: task.parameters,
        subscriptionTier: task.subscriptionTier,
        qualityPreference: task.parameters.qualityPreference
      });
      
      return result.qualityLevel;
    } catch (error) {
      this.logger.error('Error determining quality level', {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Default to medium quality
      return 'medium';
    }
  }
  
  /**
   * Generate cache key for a task
   * @param taskType Task type
   * @param parameters Task parameters
   * @returns Cache key
   * @private
   */
  private async generateCacheKey(taskType: string, parameters: Record<string, any>): Promise<string> {
    // Normalize parameters for consistent keys
    const normalizedParams = { ...parameters };
    
    // Remove non-deterministic or user-specific parameters
    delete normalizedParams.userId;
    delete normalizedParams.timestamp;
    delete normalizedParams.requestId;
    delete normalizedParams.qualityPreference;
    
    // Ensure stable order for arrays
    Object.keys(normalizedParams).forEach(key => {
      const value = normalizedParams[key];
      if (Array.isArray(value)) {
        normalizedParams[key] = [...value].sort();
      }
    });
    
    // Create string representation
    const paramString = JSON.stringify({
      type: taskType,
      parameters: normalizedParams
    });
    
    // Use MD5 hash for shorter keys
    return `task:${taskType}:${this.hashString(paramString)}`;
  }
  
  /**
   * Get priority class name for Kubernetes
   * @param priority Task priority
   * @returns Priority class name
   * @private
   */
  private getPriorityClassName(priority: TaskPriority): string {
    switch (priority) {
      case TaskPriority.HIGH:
        return 'kai-high-priority';
      case TaskPriority.MEDIUM:
        return 'kai-medium-priority';
      case TaskPriority.LOW:
        return 'kai-low-priority';
      case TaskPriority.BATCH:
        return 'kai-batch-priority';
      default:
        return 'kai-medium-priority';
    }
  }
  
  /**
   * Get priority string
   * @param priority Task priority
   * @returns Priority string
   * @private
   */
  private getPriorityString(priority: TaskPriority): string {
    return priority.toLowerCase();
  }
  
  /**
   * Hash a string (simple implementation)
   * @param str String to hash
   * @returns Hashed string
   * @private
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}
</kodu_content>
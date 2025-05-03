/**
 * Workflow Service
 * 
 * Manages workflow execution and tracking for the Coordinator service.
 */

import { Redis } from 'ioredis';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';

/**
 * Workflow status
 */
export type WorkflowStatus = 'queued' | 'processing' | 'completed' | 'failed';

/**
 * Workflow type
 */
export type WorkflowType = 
  | 'image-processing'
  | 'model-training'
  | 'vector-search'
  | '3d-generation'
  | 'text-processing';

/**
 * Workflow data
 */
export interface Workflow {
  id: string;
  type: WorkflowType;
  status: WorkflowStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  data: any;
  result?: any;
  error?: string;
}

/**
 * Workflow Service for managing workflow execution
 */
export class WorkflowService {
  private redis: Redis;
  private logger: Logger;
  private workflowPrefix = 'workflow:';
  
  /**
   * Creates a new WorkflowService instance
   */
  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    this.logger = createLogger('workflow-service');
    
    this.logger.info('Workflow service initialized');
  }
  
  /**
   * Get a workflow by ID
   */
  public async getWorkflow(id: string): Promise<Workflow | null> {
    const workflowKey = `${this.workflowPrefix}${id}`;
    const data = await this.redis.hgetall(workflowKey);
    
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    
    return {
      id: data.id,
      type: data.type as WorkflowType,
      status: data.status as WorkflowStatus,
      createdAt: parseInt(data.createdAt, 10),
      startedAt: data.startedAt ? parseInt(data.startedAt, 10) : undefined,
      completedAt: data.completedAt ? parseInt(data.completedAt, 10) : undefined,
      data: JSON.parse(data.data || '{}'),
      result: data.result ? JSON.parse(data.result) : undefined,
      error: data.error
    };
  }
  
  /**
   * Update workflow status
   */
  public async updateWorkflowStatus(
    id: string,
    status: WorkflowStatus,
    result?: any,
    error?: string
  ): Promise<void> {
    const workflowKey = `${this.workflowPrefix}${id}`;
    const updates: Record<string, string> = { status };
    
    if (status === 'completed' || status === 'failed') {
      updates.completedAt = Date.now().toString();
    }
    
    if (result !== undefined) {
      updates.result = JSON.stringify(result);
    }
    
    if (error !== undefined) {
      updates.error = error;
    }
    
    await this.redis.hset(workflowKey, updates);
    
    this.logger.debug('Workflow status updated', {
      workflowId: id,
      status,
      hasResult: result !== undefined,
      hasError: error !== undefined
    });
  }
  
  /**
   * Get active workflows
   */
  public async getActiveWorkflows(): Promise<Workflow[]> {
    // Get all workflow keys
    const keys = await this.redis.keys(`${this.workflowPrefix}*`);
    
    if (keys.length === 0) {
      return [];
    }
    
    const activeWorkflows: Workflow[] = [];
    
    // Check each workflow
    for (const key of keys) {
      const data = await this.redis.hgetall(key);
      
      if (!data || Object.keys(data).length === 0) {
        continue;
      }
      
      // Only include active workflows
      if (data.status === 'queued' || data.status === 'processing') {
        activeWorkflows.push({
          id: data.id,
          type: data.type as WorkflowType,
          status: data.status as WorkflowStatus,
          createdAt: parseInt(data.createdAt, 10),
          startedAt: data.startedAt ? parseInt(data.startedAt, 10) : undefined,
          data: JSON.parse(data.data || '{}')
        });
      }
    }
    
    return activeWorkflows;
  }
  
  /**
   * Close the workflow service
   */
  public async close(): Promise<void> {
    await this.redis.quit();
    this.logger.info('Workflow service closed');
  }
}

export default WorkflowService;

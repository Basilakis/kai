/**
 * Queue Service
 * 
 * Manages workflow queues for the Coordinator service.
 */

import { Redis } from 'ioredis';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';
import { PriorityLevel } from '../types';

/**
 * Queue statistics
 */
export interface QueueStats {
  name: string;
  priority: PriorityLevel;
  depth: number;
  processingRate: number;
  averageWaitTime: number;
}

/**
 * Queue Service for managing workflow queues
 */
export class QueueService {
  private redis: Redis;
  private logger: Logger;
  private queuePrefix = 'workflow:queue:';
  private statsPrefix = 'workflow:stats:';
  
  /**
   * Creates a new QueueService instance
   */
  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    this.logger = createLogger('queue-service');
    
    this.logger.info('Queue service initialized');
  }
  
  /**
   * Enqueue a workflow
   */
  public async enqueue(
    workflowId: string,
    priority: PriorityLevel,
    data: any
  ): Promise<void> {
    const queueKey = `${this.queuePrefix}${priority}`;
    const timestamp = Date.now();
    
    // Store workflow data
    await this.redis.hset(
      `workflow:${workflowId}`,
      {
        id: workflowId,
        priority,
        data: JSON.stringify(data),
        enqueuedAt: timestamp,
        status: 'queued'
      }
    );
    
    // Add to priority queue
    await this.redis.zadd(queueKey, timestamp, workflowId);
    
    this.logger.debug('Workflow enqueued', {
      workflowId,
      priority,
      queueKey
    });
  }
  
  /**
   * Dequeue a workflow
   */
  public async dequeue(priority: PriorityLevel): Promise<string | null> {
    const queueKey = `${this.queuePrefix}${priority}`;
    
    // Get the oldest workflow ID from the queue
    const result = await this.redis.zpopmin(queueKey);
    
    if (!result || result.length === 0) {
      return null;
    }
    
    const workflowId = result[0];
    
    // Update workflow status
    await this.redis.hset(
      `workflow:${workflowId}`,
      'status',
      'processing',
      'startedAt',
      Date.now().toString()
    );
    
    this.logger.debug('Workflow dequeued', {
      workflowId,
      priority,
      queueKey
    });
    
    return workflowId;
  }
  
  /**
   * Get queue depth
   */
  public async getQueueDepth(priority: PriorityLevel): Promise<number> {
    const queueKey = `${this.queuePrefix}${priority}`;
    return await this.redis.zcard(queueKey);
  }
  
  /**
   * Get all queue stats
   */
  public async getQueueStats(): Promise<QueueStats[]> {
    const priorities: PriorityLevel[] = ['critical', 'high', 'medium', 'low', 'background'];
    const stats: QueueStats[] = [];
    
    for (const priority of priorities) {
      const queueKey = `${this.queuePrefix}${priority}`;
      const statsKey = `${this.statsPrefix}${priority}`;
      
      // Get queue depth
      const depth = await this.redis.zcard(queueKey);
      
      // Get processing rate (workflows processed per minute)
      const processingRateStr = await this.redis.get(`${statsKey}:rate`);
      const processingRate = processingRateStr ? parseFloat(processingRateStr) : 0;
      
      // Get average wait time
      const waitTimeStr = await this.redis.get(`${statsKey}:wait`);
      const averageWaitTime = waitTimeStr ? parseFloat(waitTimeStr) : 0;
      
      stats.push({
        name: priority,
        priority,
        depth,
        processingRate,
        averageWaitTime
      });
    }
    
    return stats;
  }
  
  /**
   * Update queue stats
   */
  public async updateQueueStats(
    priority: PriorityLevel,
    processedCount: number,
    waitTimeMs: number
  ): Promise<void> {
    const statsKey = `${this.statsPrefix}${priority}`;
    
    // Update processing rate (using exponential moving average)
    const currentRateStr = await this.redis.get(`${statsKey}:rate`);
    const currentRate = currentRateStr ? parseFloat(currentRateStr) : 0;
    const alpha = 0.3; // Smoothing factor
    const newRate = alpha * processedCount + (1 - alpha) * currentRate;
    
    await this.redis.set(`${statsKey}:rate`, newRate.toString());
    
    // Update average wait time (using exponential moving average)
    const currentWaitTimeStr = await this.redis.get(`${statsKey}:wait`);
    const currentWaitTime = currentWaitTimeStr ? parseFloat(currentWaitTimeStr) : 0;
    const newWaitTime = alpha * waitTimeMs + (1 - alpha) * currentWaitTime;
    
    await this.redis.set(`${statsKey}:wait`, newWaitTime.toString());
  }
  
  /**
   * Close the queue service
   */
  public async close(): Promise<void> {
    await this.redis.quit();
    this.logger.info('Queue service closed');
  }
}

export default QueueService;

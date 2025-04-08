import { Task } from 'crewai';
import { Redis } from 'redis';
import { createLogger } from '../utils/logger';
import { 
  ErrorHandler, 
  TaskExecutionError, 
  ServiceConnectionError,
  ResourceExhaustedError, 
  TaskTimeoutError
} from './errors';

export interface QueuedTask {
  id: string;
  task: Task;
  priority: number;
  agentId: string;
  dependencies: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  result?: any;
  error?: string;
  attemptCount?: number;
  timestamp: number;
}

interface TaskQueueConfig {
  redisConfig?: {
    host: string;
    port: number;
    password?: string;
  };
  maxConcurrentTasks?: number;
  taskTimeout?: number;  // in milliseconds
}

export class TaskQueueManager {
  private logger = createLogger('TaskQueueManager');
  private redisClient: Redis | null = null;
  private taskMap: Map<string, QueuedTask> = new Map();
  private processingTasks: Set<string> = new Set();
  private maxConcurrentTasks: number;
  private taskTimeout: number;

  constructor(config: TaskQueueConfig) {
    this.maxConcurrentTasks = config.maxConcurrentTasks || 4;
    this.taskTimeout = config.taskTimeout || 300000; // 5 minutes default

    if (config.redisConfig) {
      this.initializeRedis(config.redisConfig);
    }
  }

  private async initializeRedis(config: TaskQueueConfig['redisConfig']) {
    if (!config) return;

    try {
      this.redisClient = Redis.createClient({
        socket: {
          host: config.host,
          port: config.port
        },
        password: config.password
      }) as Redis;

      await this.redisClient.connect();
      this.logger.info('Redis connected successfully');
    } catch (error) {
      const redisError = new ServiceConnectionError('Redis', 'connect', {
        cause: error instanceof Error ? error : undefined,
        data: { 
          host: config.host,
          port: config.port
        },
        severity: 'medium' // Can still operate without Redis
      });
      this.logger.error(`${redisError.message}`, { error: redisError });
      // Continue without Redis but don't throw - we'll operate in memory only
    }
  }

  /**
   * Enqueues a task for execution
   */
  async enqueueTask(
    task: Task,
    priority: number = 1,
    agentId: string,
    dependencies: string[] = []
  ): Promise<string> {
    return ErrorHandler.withErrorHandling(async () => {
      // Validate maximum tasks limit
      if (this.taskMap.size >= 1000) { // Arbitrary limit to prevent memory issues
        throw new ResourceExhaustedError('task_queue_size', {
          limit: 1000,
          data: { currentSize: this.taskMap.size },
          severity: 'high'
        });
      }
      
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const queuedTask: QueuedTask = {
        id: taskId,
        task,
        priority,
        agentId,
        dependencies,
        status: 'pending',
        attemptCount: 0,
        timestamp: Date.now()
      };

      // Store in memory
      this.taskMap.set(taskId, queuedTask);

      // Store in Redis if available
      if (this.redisClient) {
        try {
          await this.redisClient.set(
            `task:${taskId}`,
            JSON.stringify(queuedTask)
          );
        } catch (error) {
          // Log but continue - Redis is optional
          this.logger.warn(`Failed to store task in Redis: ${error}`);
        }
      }

      // Try to process tasks
      this.processNextTasks();

      return taskId;
    }, {
      agentId,
      action: 'enqueueTask'
    });
  }

  private async processNextTasks() {
    if (this.processingTasks.size >= this.maxConcurrentTasks) {
      return;
    }

    const eligibleTasks = Array.from(this.taskMap.values())
      .filter(task => 
        task.status === 'pending' && 
        this.areDependenciesMet(task) &&
        !this.processingTasks.has(task.id)
      )
      .sort((a, b) => b.priority - a.priority);

    for (const task of eligibleTasks) {
      if (this.processingTasks.size >= this.maxConcurrentTasks) {
        break;
      }

      this.processTask(task);
    }
  }

  private areDependenciesMet(task: QueuedTask): boolean {
    return task.dependencies.every(depId => {
      const depTask = this.taskMap.get(depId);
      return depTask && depTask.status === 'completed';
    });
  }

  /**
   * Process a single task with timeout and retry handling
   */
  private async processTask(task: QueuedTask) {
    this.processingTasks.add(task.id);
    task.status = 'processing';
    task.attemptCount = task.attemptCount || 0;
    const maxRetries = 2; // Maximum number of retries for a failed task

    // Update Redis if available
    if (this.redisClient) {
      try {
        await this.redisClient.set(`task:${task.id}`, JSON.stringify(task));
      } catch (error) {
        // Just log and continue - Redis is optional
        this.logger.warn(`Failed to update task status in Redis: ${error}`);
      }
    }

    const executeWithRetry = async (): Promise<any> => {
      try {
        // Set timeout for task execution
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new TaskTimeoutError(task.id, this.taskTimeout, {
              agentId: task.agentId,
              severity: 'high'
            }));
          }, this.taskTimeout);
        });

        // Execute task with timeout
        const result = await Promise.race([
          task.task.execute(),
          timeoutPromise
        ]);

        // Update task with success
        task.status = 'completed';
        task.result = {
          ...(typeof result === 'object' && result !== null ? result : {}),
          completedAt: Date.now()
        };
        
        return result;
      } catch (error) {
        // Increment attempt count
        task.attemptCount = (task.attemptCount || 0) + 1;
        
        // Check if we should retry
        if (task.attemptCount <= maxRetries) {
          this.logger.warn(`Task ${task.id} failed, retrying (${task.attemptCount}/${maxRetries}):`, { 
            error: error instanceof Error ? error.message : String(error),
            taskId: task.id,
            attemptCount: task.attemptCount
          });
          task.status = 'retrying';
          
          // Exponential backoff for retries
          const backoffMs = Math.min(1000 * Math.pow(2, task.attemptCount), 30000);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          
          // Try again
          return executeWithRetry();
        }
        
        // Max retries exceeded, mark as failed
        const taskError = error instanceof Error ? error : new Error(String(error));
        const executionError = new TaskExecutionError(
          `Task ${task.id} failed after ${maxRetries} retries`, 
          {
            taskId: task.id,
            agentId: task.agentId,
            cause: taskError,
            severity: 'high'
          }
        );
        
        // Update task with failure
        task.status = 'failed';
        task.error = executionError.message;
        this.logger.error(`Task ${task.id} failed permanently:`, executionError);
        
        throw executionError;
      }
    };

    try {
      await executeWithRetry();
    } catch (error) {
      // Error is already handled in executeWithRetry
    } finally {
      // Cleanup
      this.processingTasks.delete(task.id);

      // Update Redis if available
      if (this.redisClient) {
        try {
          await this.redisClient.set(`task:${task.id}`, JSON.stringify(task));
        } catch (error) {
          // Just log and continue - Redis is optional
          this.logger.warn(`Failed to update final task status in Redis: ${error}`);
        }
      }

      // Process next tasks
      this.processNextTasks();
    }
  }

  /**
   * Get the status of a task by its ID
   */
  async getTaskStatus(taskId: string): Promise<QueuedTask | null> {
    return ErrorHandler.withErrorHandling(async () => {
      // Try memory first
      const memoryTask = this.taskMap.get(taskId);
      if (memoryTask) return memoryTask;

      // Try Redis if available
      if (this.redisClient) {
        try {
          const redisTask = await this.redisClient.get(`task:${taskId}`);
          if (redisTask) {
            const task = JSON.parse(redisTask);
            this.taskMap.set(taskId, task); // Cache in memory
            return task;
          }
        } catch (error) {
          this.logger.warn(`Failed to fetch task from Redis: ${error}`);
          // Continue with null result if Redis fails
        }
      }

      return null;
    }, {
      taskId,
      action: 'getTaskStatus'
    });
  }

  async getQueueStatistics() {
    const tasks = Array.from(this.taskMap.values());
    return {
      totalTasks: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      processing: tasks.filter(t => t.status === 'processing').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      averageProcessingTime: this.calculateAverageProcessingTime(tasks)
    };
  }

  /**
   * Calculate average processing time for completed tasks
   */
  private calculateAverageProcessingTime(tasks: QueuedTask[]): number {
    try {
      const completedTasks = tasks.filter(t => 
        t.status === 'completed' && 
        t.result?.completedAt
      );
      
      if (completedTasks.length === 0) return 0;

      const totalTime = completedTasks.reduce((sum, task) => {
        const completionTime = task.result?.completedAt || 0;
        return sum + (completionTime - task.timestamp);
      }, 0);

      return totalTime / completedTasks.length;
    } catch (error) {
      this.logger.warn('Error calculating average processing time:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return 0;
    }
  }

  /**
   * Clean up resources and stop task processing
   */
  async cleanup() {
    return ErrorHandler.withErrorHandling(async () => {
      this.logger.info('Cleaning up TaskQueueManager resources');
      
      if (this.redisClient) {
        try {
          await this.redisClient.disconnect();
        } catch (error) {
          this.logger.warn(`Error disconnecting from Redis: ${error}`);
        }
      }
      
      this.taskMap.clear();
      this.processingTasks.clear();
      
      this.logger.info('TaskQueueManager cleanup complete');
    }, {
      action: 'cleanup'
    });
  }
}
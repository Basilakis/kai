import { Task } from 'crewai';
import { Redis } from 'redis';
import { createLogger } from '../utils/logger';

export interface QueuedTask {
  id: string;
  task: Task;
  priority: number;
  agentId: string;
  dependencies: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
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
      this.logger.error('Redis connection failed:', error);
      throw error;
    }
  }

  async enqueueTask(
    task: Task,
    priority: number = 1,
    agentId: string,
    dependencies: string[] = []
  ): Promise<string> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queuedTask: QueuedTask = {
      id: taskId,
      task,
      priority,
      agentId,
      dependencies,
      status: 'pending',
      timestamp: Date.now()
    };

    // Store in memory
    this.taskMap.set(taskId, queuedTask);

    // Store in Redis if available
    if (this.redisClient) {
      await this.redisClient.set(
        `task:${taskId}`,
        JSON.stringify(queuedTask)
      );
    }

    // Try to process tasks
    this.processNextTasks();

    return taskId;
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

  private async processTask(task: QueuedTask) {
    this.processingTasks.add(task.id);
    task.status = 'processing';

    // Update Redis if available
    if (this.redisClient) {
      await this.redisClient.set(`task:${task.id}`, JSON.stringify(task));
    }

    try {
      // Set timeout for task execution
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), this.taskTimeout);
      });

      // Execute task with timeout
      const result = await Promise.race([
        task.task.execute(),
        timeoutPromise
      ]);

      // Update task with success
      task.status = 'completed';
      task.result = result;
    } catch (error) {
      // Update task with failure
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Task ${task.id} failed:`, error);
    }

    // Cleanup
    this.processingTasks.delete(task.id);

    // Update Redis if available
    if (this.redisClient) {
      await this.redisClient.set(`task:${task.id}`, JSON.stringify(task));
    }

    // Process next tasks
    this.processNextTasks();
  }

  async getTaskStatus(taskId: string): Promise<QueuedTask | null> {
    // Try memory first
    const memoryTask = this.taskMap.get(taskId);
    if (memoryTask) return memoryTask;

    // Try Redis if available
    if (this.redisClient) {
      const redisTask = await this.redisClient.get(`task:${taskId}`);
      if (redisTask) {
        const task = JSON.parse(redisTask);
        this.taskMap.set(taskId, task); // Cache in memory
        return task;
      }
    }

    return null;
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

  private calculateAverageProcessingTime(tasks: QueuedTask[]): number {
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.result?.completedAt);
    if (completedTasks.length === 0) return 0;

    const totalTime = completedTasks.reduce((sum, task) => {
      return sum + (task.result.completedAt - task.timestamp);
    }, 0);

    return totalTime / completedTasks.length;
  }

  async cleanup() {
    if (this.redisClient) {
      await this.redisClient.disconnect();
    }
    this.taskMap.clear();
    this.processingTasks.clear();
  }
}
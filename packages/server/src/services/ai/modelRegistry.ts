/**
 * Model Registry Service
 * 
 * This service manages AI model selection, performance tracking, and
 * evaluation across different providers (OpenAI, Anthropic, HuggingFace).
 * 
 * It implements a rotation-based evaluation system that periodically runs tasks
 * across all available models to gather comparative performance data.
 */

import { logger } from '../../utils/logger';

export type ModelProvider = 'openai' | 'anthropic' | 'huggingface' | 'local';

export interface ModelIdentifier {
  provider: ModelProvider;
  modelId: string;
}

export type TaskType = 
  | 'text-generation'
  | 'embedding'
  | 'classification'
  | 'summarization'
  | 'translation'
  | 'image-analysis'
  | 'material-recognition'
  | 'metadata-extraction'
  | string;

export interface PerformanceMetrics {
  accuracy?: number;
  latency?: number;
  costPerToken?: number;
  tokenCount?: number;
  userRating?: number;
  customMetrics?: Record<string, number>;
}

export interface ModelEvaluationResult {
  modelId: ModelIdentifier;
  taskType: TaskType;
  metrics: PerformanceMetrics;
  timestamp: Date;
  inputHash?: string;
  contextSize?: number;
}

export interface ModelComparisonReport {
  taskType: TaskType;
  timestamp: Date;
  results: ModelEvaluationResult[];
  rankings: Record<string, number>;
  bestModelId: ModelIdentifier;
}

export interface TaskCounter {
  taskType: TaskType;
  count: number;
  lastEvaluationAt: Date;
  inEvaluationMode: boolean;
  evaluationTasksRemaining: number;
}

export interface ModelSelectionOptions {
  taskType: TaskType;
  preferredProvider?: ModelProvider;
  maxLatency?: number;
  minAccuracy?: number;
  costSensitive?: boolean;
}

export interface ModelRegistryConfig {
  standardCycleLength: number;
  evaluationCycleLength: number;
  providers: {
    openai: {
      enabled: boolean;
      defaultModels: Record<TaskType, string>;
    };
    anthropic: {
      enabled: boolean;
      defaultModels: Record<TaskType, string>;
    };
    huggingface: {
      enabled: boolean;
      defaultModels: Record<TaskType, string>;
    };
    local: {
      enabled: boolean;
      defaultModels: Record<TaskType, string>;
    };
  };
  metrics: {
    accuracyWeight: number;
    latencyWeight: number;
    costWeight: number;
  };
}

/**
 * Model Registry Service
 * 
 * Manages AI model selection, performance tracking, and rotation-based evaluation
 */
export class ModelRegistry {
  private static instance: ModelRegistry;
  
  // In-memory storage for performance metrics and task counters
  // In a production system, these would be backed by a database
  private performanceMetrics: ModelEvaluationResult[] = [];
  private taskCounters: Map<TaskType, TaskCounter> = new Map();
  private modelComparisons: ModelComparisonReport[] = [];
  
  // Default configuration
  private config: ModelRegistryConfig = {
    standardCycleLength: 10, // Run standard operation for this many tasks
    evaluationCycleLength: 3, // Then run evaluation mode for this many tasks
    providers: {
      openai: {
        enabled: true,
        defaultModels: {
          'text-generation': 'gpt-4',
          'embedding': 'text-embedding-ada-002',
          'classification': 'gpt-3.5-turbo',
          'summarization': 'gpt-3.5-turbo',
          'translation': 'gpt-3.5-turbo',
          'material-recognition': 'gpt-4-vision'
        }
      },
      anthropic: {
        enabled: true,
        defaultModels: {
          'text-generation': 'claude-2',
          'embedding': '',
          'classification': 'claude-2',
          'summarization': 'claude-2',
          'translation': 'claude-2',
          'material-recognition': ''
        }
      },
      huggingface: {
        enabled: true,
        defaultModels: {
          'text-generation': 'google/flan-t5-xxl',
          'embedding': 'sentence-transformers/all-MiniLM-L6-v2',
          'classification': 'facebook/bart-large-mnli',
          'summarization': 'facebook/bart-large-cnn',
          'translation': 'facebook/mbart-large-50-many-to-many-mmt',
          'material-recognition': 'google/vit-base-patch16-224'
        }
      },
      local: {
        enabled: false,
        defaultModels: {
          'text-generation': 'llama-2-13b-chat',
          'embedding': 'sentence-transformers/all-MiniLM-L6-v2',
          'classification': 'distilbart-mnli',
          'summarization': 'distilbart-cnn',
          'translation': 'mbart-50-many-to-many-mmt',
          'material-recognition': 'yolov8'
        }
      }
    },
    metrics: {
      accuracyWeight: 0.6,
      latencyWeight: 0.2,
      costWeight: 0.2
    }
  };

  private constructor() {
    // Initialize with environment variables or config files
    this.loadConfiguration();
    logger.info('ModelRegistry initialized');
  }

  /**
   * Get the singleton instance
   * @returns The ModelRegistry instance
   */
  public static getInstance(): ModelRegistry {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry();
    }
    return ModelRegistry.instance;
  }

  /**
   * Load configuration from environment variables or config files
   * @private
   */
  private loadConfiguration(): void {
    // In a real implementation, this would load from environment variables or config files
    // For now, we'll use the default configuration
  }

  /**
   * Select the best model for a specific task based on historical performance
   * @param options Model selection options
   * @returns The selected model identifier
   */
  public selectBestModel(options: ModelSelectionOptions): ModelIdentifier {
    const { taskType, preferredProvider, maxLatency, minAccuracy, costSensitive } = options;
    
    // Get all performance metrics for this task type
    const taskMetrics = this.performanceMetrics.filter(m => m.taskType === taskType);
    
    if (taskMetrics.length === 0) {
      // No performance data available, use default model
      return this.getDefaultModel(taskType, preferredProvider);
    }
    
    // Group metrics by model
    const modelMetrics: Record<string, ModelEvaluationResult[]> = {};
    
    for (const metric of taskMetrics) {
      const key = `${metric.modelId.provider}:${metric.modelId.modelId}`;
      if (!modelMetrics[key]) {
        modelMetrics[key] = [];
      }
      modelMetrics[key].push(metric);
    }
    
    // Calculate average performance for each model
    const modelPerformance: Record<string, { 
      modelId: ModelIdentifier; 
      score: number; 
      accuracy: number; 
      latency: number; 
      cost: number; 
    }> = {};
    
    for (const [key, metrics] of Object.entries(modelMetrics)) {
      const [provider, modelId] = key.split(':');
      
      const avgAccuracy = metrics.reduce((sum, m) => sum + (m.metrics.accuracy || 0), 0) / metrics.length;
      const avgLatency = metrics.reduce((sum, m) => sum + (m.metrics.latency || 0), 0) / metrics.length;
      const avgCost = metrics.reduce((sum, m) => sum + (m.metrics.costPerToken || 0) * (m.metrics.tokenCount || 0), 0) / metrics.length;
      
      // Apply weights and constraints
      let score = (avgAccuracy * this.config.metrics.accuracyWeight) - 
                  (avgLatency * this.config.metrics.latencyWeight) - 
                  (avgCost * this.config.metrics.costWeight);
      
      // Apply constraints if specified
      if (maxLatency && avgLatency > maxLatency) {
        score = -Infinity; // Disqualify models that exceed max latency
      }
      
      if (minAccuracy && avgAccuracy < minAccuracy) {
        score = -Infinity; // Disqualify models that don't meet min accuracy
      }
      
      // Prefer specified provider if requested
      if (preferredProvider && provider !== preferredProvider) {
        score *= 0.9; // 10% penalty for non-preferred providers
      }
      
      // For cost-sensitive applications, prioritize cost more
      if (costSensitive) {
        score = score - (avgCost * this.config.metrics.costWeight * 2);
      }
      
      modelPerformance[key] = {
        modelId: { provider: provider as ModelProvider, modelId: modelId || '' },
        score,
        accuracy: avgAccuracy,
        latency: avgLatency,
        cost: avgCost
      };
    }
    
    // Find the model with the highest score
    const bestModel = Object.values(modelPerformance).reduce(
      (best, current) => (current.score > best.score ? current : best),
      { score: -Infinity, modelId: this.getDefaultModel(taskType, preferredProvider) } as typeof modelPerformance[keyof typeof modelPerformance]
    );
    
    return bestModel.modelId;
  }

  /**
   * Record performance metrics for a specific model and task
   * @param modelId Model identifier
   * @param taskType Task type
   * @param metrics Performance metrics
   */
  public recordPerformance(
    modelId: ModelIdentifier, 
    taskType: TaskType, 
    metrics: PerformanceMetrics,
    inputHash?: string
  ): void {
    const evaluationResult: ModelEvaluationResult = {
      modelId,
      taskType,
      metrics,
      timestamp: new Date(),
      inputHash
    };
    
    this.performanceMetrics.push(evaluationResult);
    logger.debug(`Recorded performance for ${modelId.provider}:${modelId.modelId} on ${taskType}`);
    
    // Increment task counter for this task type
    this.incrementTaskCount(taskType);
  }

  /**
   * Increment the task counter for a specific task type
   * @param taskType Task type
   * @returns The updated task counter
   */
  public incrementTaskCount(taskType: TaskType): TaskCounter {
    if (!this.taskCounters.has(taskType)) {
      this.taskCounters.set(taskType, {
        taskType,
        count: 0,
        lastEvaluationAt: new Date(0), // 1970-01-01, never evaluated
        inEvaluationMode: false,
        evaluationTasksRemaining: 0
      });
    }
    
    const counter = this.taskCounters.get(taskType)!;
    counter.count += 1;
    
    // Check if we should enter or exit evaluation mode
    if (counter.inEvaluationMode) {
      // In evaluation mode, decrement tasks remaining
      counter.evaluationTasksRemaining -= 1;
      
      // Exit evaluation mode if no tasks remaining
      if (counter.evaluationTasksRemaining <= 0) {
        counter.inEvaluationMode = false;
        counter.lastEvaluationAt = new Date();
        logger.info(`Exiting evaluation mode for task type ${taskType}`);
      }
    } else {
      // In standard mode, check if we should enter evaluation mode
      const tasksSinceLastEvaluation = 
        counter.count - (this.getLastEvaluationCount(taskType) || 0);
      
      if (tasksSinceLastEvaluation >= this.config.standardCycleLength) {
        counter.inEvaluationMode = true;
        counter.evaluationTasksRemaining = this.config.evaluationCycleLength;
        logger.info(`Entering evaluation mode for task type ${taskType}, next ${this.config.evaluationCycleLength} tasks will evaluate all models`);
      }
    }
    
    this.taskCounters.set(taskType, counter);
    return counter;
  }

  /**
   * Check if the specified task should run in evaluation mode
   * @param taskType Task type
   * @returns True if the task should run in evaluation mode
   */
  public shouldRunEvaluation(taskType: TaskType): boolean {
    const counter = this.taskCounters.get(taskType);
    if (!counter) {
      return false; // No counter exists yet, not in evaluation mode
    }
    
    return counter.inEvaluationMode;
  }

  /**
   * Get the task count at the last evaluation
   * @param taskType Task type
   * @returns The task count at the last evaluation, or null if never evaluated
   * @private
   */
  private getLastEvaluationCount(taskType: TaskType): number | null {
    const counter = this.taskCounters.get(taskType);
    if (!counter || counter.lastEvaluationAt.getTime() === 0) {
      return null; // Never evaluated
    }
    
    // Find the task count at the last evaluation
    // This is an approximation based on the current count and time since last evaluation
    const countsPerEvaluationCycle = this.config.standardCycleLength + this.config.evaluationCycleLength;
    return counter.count - (counter.count % countsPerEvaluationCycle);
  }

  /**
   * Get all available models for a specific task
   * @param taskType Task type
   * @returns Array of model identifiers
   */
  public getAllModels(taskType: TaskType): ModelIdentifier[] {
    const models: ModelIdentifier[] = [];
    
    // Add models from each enabled provider
    for (const [provider, config] of Object.entries(this.config.providers)) {
      if (config.enabled && config.defaultModels[taskType]) {
        models.push({
          provider: provider as ModelProvider,
          modelId: config.defaultModels[taskType]
        });
      }
    }
    
    return models;
  }

  /**
   * Store a model comparison report from a multi-model evaluation
   * @param report Model comparison report
   */
  public storeModelComparison(report: ModelComparisonReport): void {
    this.modelComparisons.push(report);
    logger.info(`Stored model comparison for ${report.taskType} with ${report.results.length} models`);
    
    // Update performance metrics with the results
    for (const result of report.results) {
      this.recordPerformance(
        result.modelId,
        result.taskType,
        result.metrics,
        result.inputHash
      );
    }
  }

  /**
   * Get a default model for a specific task type
   * @param taskType Task type
   * @param preferredProvider Preferred provider
   * @returns The default model identifier
   * @private
   */
  private getDefaultModel(taskType: TaskType, preferredProvider?: ModelProvider): ModelIdentifier {
    // Use preferred provider if specified and available
    if (preferredProvider) {
      const providerConfig = this.config.providers[preferredProvider];
      if (providerConfig && providerConfig.enabled && providerConfig.defaultModels[taskType]) {
        return {
          provider: preferredProvider,
          modelId: providerConfig.defaultModels[taskType]
        };
      }
    }
    
    // Try each provider in priority order
    const providers: ModelProvider[] = ['openai', 'anthropic', 'huggingface', 'local'];
    
    for (const provider of providers) {
      const providerConfig = this.config.providers[provider];
      if (providerConfig && providerConfig.enabled && providerConfig.defaultModels[taskType]) {
        return {
          provider,
          modelId: providerConfig.defaultModels[taskType]
        };
      }
    }
    
    // Fallback to OpenAI GPT-4 for text generation tasks
    if (taskType.includes('text') || taskType.includes('generation')) {
      return {
        provider: 'openai',
        modelId: 'gpt-4'
      };
    }
    
    // Default fallback
    return {
      provider: 'openai',
      modelId: 'gpt-3.5-turbo'
    };
  }

  /**
   * Get performance history for a specific model and task
   * @param modelId Model identifier
   * @param taskType Task type
   * @returns Array of performance metrics
   */
  public getPerformanceHistory(modelId: ModelIdentifier, taskType: TaskType): ModelEvaluationResult[] {
    return this.performanceMetrics.filter(m => 
      m.taskType === taskType && 
      m.modelId.provider === modelId.provider && 
      m.modelId.modelId === modelId.modelId
    );
  }

  /**
   * Get model comparison reports for a specific task
   * @param taskType Task type
   * @param limit Maximum number of reports to return
   * @returns Array of model comparison reports
   */
  public getModelComparisons(taskType: TaskType, limit: number = 10): ModelComparisonReport[] {
    return this.modelComparisons
      .filter(r => r.taskType === taskType)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
}

// Export singleton instance
export const modelRegistry = ModelRegistry.getInstance();
export default modelRegistry;
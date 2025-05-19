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
import { supabase } from '../supabase/supabaseClient'; // Import Supabase client
import { PostgrestError } from '@supabase/supabase-js';

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
  private static initializing: Promise<void> | null = null;
  private isInitialized = false;

  // Default configuration - will be overridden by DB or used as initial seed
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
    // Initialization is now handled by the async init() method
  }

  /**
   * Get the singleton instance, ensuring it's initialized.
   * @returns The ModelRegistry instance
   */
  public static async getInstance(): Promise<ModelRegistry> {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry();
    }
    if (!ModelRegistry.instance.isInitialized && !ModelRegistry.initializing) {
      ModelRegistry.initializing = ModelRegistry.instance.init();
    }
    if (ModelRegistry.initializing) {
      await ModelRegistry.initializing;
      ModelRegistry.initializing = null;
    }
    return ModelRegistry.instance;
  }

  /**
   * Initializes the ModelRegistry, primarily by loading configuration from the database.
   * This method should be called once.
   */
  private async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      await this.loadConfiguration();
      this.isInitialized = true;
      logger.info('ModelRegistry initialized successfully with DB configuration.');
    } catch (error) {
      logger.error('Failed to initialize ModelRegistry:', error);
      // Depending on the severity, you might want to throw the error
      // or operate with default in-memory config as a fallback (though less ideal).
      // For now, it will use the hardcoded default if DB load fails.
      this.isInitialized = true; // Mark as initialized even if using defaults to prevent re-attempts.
      logger.warn('ModelRegistry operating with hardcoded default configuration due to DB load failure.');
    }
  }


  /**
   * Load configuration from the database, or seed it if it doesn't exist.
   * @private
   */
  private async loadConfiguration(): Promise<void> {
    const { data, error } = await supabase
      .getClient()
      .from('model_registry_config')
      .select('config_data')
      .eq('config_key', 'default')
      .maybeSingle();

    if (error) {
      logger.error('Error loading ModelRegistry configuration from DB:', error);
      // Fallback to default hardcoded config if DB error occurs
      logger.warn('Using hardcoded default ModelRegistry configuration due to DB error.');
      return;
    }

    if (data && data.config_data) {
      logger.info('Successfully loaded ModelRegistry configuration from DB.');
      this.config = data.config_data as ModelRegistryConfig;
    } else {
      logger.info('No ModelRegistry configuration found in DB. Seeding with default values.');
      // Seed the database with the default configuration
      const defaultConfigData = this.config; // Current hardcoded config
      const { error: insertError } = await supabase
        .getClient()
        .from('model_registry_config')
        .insert({ config_key: 'default', config_data: defaultConfigData });

      if (insertError) {
        logger.error('Error seeding default ModelRegistry configuration to DB:', insertError);
        logger.warn('Using hardcoded default ModelRegistry configuration due to DB seed failure.');
      } else {
        logger.info('Successfully seeded default ModelRegistry configuration to DB.');
        // No need to set this.config again, it's already the default
      }
    }
  }
  
  /**
   * Update the ModelRegistry configuration in the database.
   * @param newConfig The new configuration object
   */
  public async updateConfiguration(newConfig: ModelRegistryConfig): Promise<void> {
    if (!this.isInitialized) {
        await ModelRegistry.getInstance(); // Ensure initialization
    }
    const { error } = await supabase
      .getClient()
      .from('model_registry_config')
      .update({ config_data: newConfig, updated_at: new Date().toISOString() })
      .eq('config_key', 'default');

    if (error) {
      logger.error('Error updating ModelRegistry configuration in DB:', error);
      throw error;
    }
    this.config = newConfig; // Update in-memory config
    logger.info('ModelRegistry configuration updated successfully in DB and in memory.');
  }

  /**
   * Select the best model for a specific task based on historical performance
   * @param options Model selection options
   * @returns The selected model identifier
   */
  public async selectBestModel(options: ModelSelectionOptions): Promise<ModelIdentifier> {
    if (!this.isInitialized) {
      await ModelRegistry.getInstance(); // Ensure initialization
    }
    const { taskType, preferredProvider, maxLatency, minAccuracy, costSensitive } = options;
    const client = supabase.getClient();

    // Get all performance metrics for this task type
    // TODO: Consider fetching only recent metrics or a summary to avoid large data transfers
    const { data: taskMetricsData, error: metricsError } = await client
      .from('model_performance_metrics')
      .select(`
        model_provider,
        model_id,
        accuracy,
        latency_ms,
        cost_per_token,
        token_count
      `)
      .eq('task_type', taskType);

    if (metricsError) {
      logger.error(`Error fetching performance metrics for ${taskType}:`, metricsError);
      return this.getDefaultModel(taskType, preferredProvider); // Fallback on error
    }
    
    if (!taskMetricsData || taskMetricsData.length === 0) {
      // No performance data available, use default model
      return this.getDefaultModel(taskType, preferredProvider);
    }
    
    // Group metrics by model
    const modelMetrics: Record<string, any[]> = {}; // Using any for simplicity, map to ModelEvaluationResult structure
    
    for (const metric of taskMetricsData) {
      const key = `${metric.model_provider}:${metric.model_id}`;
      if (!modelMetrics[key]) {
        modelMetrics[key] = [];
      }
      // Reconstruct a partial PerformanceMetrics object for calculation
      modelMetrics[key].push({
        metrics: { // Nest under 'metrics' to match ModelEvaluationResult structure
            accuracy: metric.accuracy,
            latency: metric.latency_ms,
            costPerToken: metric.cost_per_token,
            tokenCount: metric.token_count
        }
      });
    }
    
    const modelPerformance: Record<string, {
      modelId: ModelIdentifier;
      score: number;
      accuracy: number;
      latency: number;
      cost: number;
    }> = {};
    
    for (const [key, metricsArray] of Object.entries(modelMetrics)) {
      const [provider, modelIdStr] = key.split(':');
      
      const avgAccuracy = metricsArray.reduce((sum, m) => sum + (m.metrics.accuracy || 0), 0) / metricsArray.length;
      const avgLatency = metricsArray.reduce((sum, m) => sum + (m.metrics.latency || 0), 0) / metricsArray.length;
      // Ensure tokenCount and costPerToken are numbers before multiplication
      const avgCost = metricsArray.reduce((sum, m) => {
          const cost = (m.metrics.costPerToken || 0) * (m.metrics.tokenCount || 0);
          return sum + (isNaN(cost) ? 0 : cost);
      }, 0) / metricsArray.length;
      
      let score = (avgAccuracy * this.config.metrics.accuracyWeight) -
                  (avgLatency * this.config.metrics.latencyWeight) -
                  (avgCost * this.config.metrics.costWeight);
      
      if (maxLatency && avgLatency > maxLatency) score = -Infinity;
      if (minAccuracy && avgAccuracy < minAccuracy) score = -Infinity;
      if (preferredProvider && provider !== preferredProvider) score *= 0.9;
      if (costSensitive) score = score - (avgCost * this.config.metrics.costWeight * 2); // Extra penalty for cost
      
      modelPerformance[key] = {
        modelId: { provider: provider as ModelProvider, modelId: modelIdStr || '' },
        score,
        accuracy: avgAccuracy,
        latency: avgLatency,
        cost: avgCost
      };
    }
    
    if (Object.keys(modelPerformance).length === 0) {
        return this.getDefaultModel(taskType, preferredProvider);
    }

    const bestModelEntry = Object.values(modelPerformance).reduce(
      (best, current) => (current.score > best.score ? current : best)
      // No need for initial value if modelPerformance is guaranteed to be non-empty here
    );
    
    return bestModelEntry.modelId;
  }

  // recordPerformance and incrementTaskCount are already updated

  // shouldRunEvaluation and getLastEvaluationCount are already updated

  // getAllModels is already updated

  // storeModelComparison is already updated

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
  public async getPerformanceHistory(modelId: ModelIdentifier, taskType: TaskType): Promise<ModelEvaluationResult[]> {
    if (!this.isInitialized) {
        await ModelRegistry.getInstance(); // Ensure initialization
    }
    const client = supabase.getClient();
    const { data, error } = await client
      .from('model_performance_metrics')
      .select('*')
      .eq('model_provider', modelId.provider)
      .eq('model_id', modelId.modelId)
      .eq('task_type', taskType)
      .order('timestamp', { ascending: false });

    if (error) {
      logger.error(`Error fetching performance history for ${modelId.provider}:${modelId.modelId} on ${taskType}:`, error);
      return [];
    }
    // Map DB result to ModelEvaluationResult[]
    return (data || []).map((dbResult: any) => ({ // Added 'any' for dbResult to satisfy TS during mapping
        modelId: { provider: dbResult.model_provider as ModelProvider, modelId: dbResult.model_id },
        taskType: dbResult.task_type,
        metrics: {
            accuracy: dbResult.accuracy,
            latency: dbResult.latency_ms,
            costPerToken: dbResult.cost_per_token,
            tokenCount: dbResult.token_count,
            userRating: dbResult.user_rating,
            customMetrics: dbResult.custom_metrics
        },
        timestamp: new Date(dbResult.timestamp),
        inputHash: dbResult.input_hash,
        contextSize: dbResult.context_size
    }));
  }

  /**
   * Get model comparison reports for a specific task
   * @param taskType Task type
   * @param limit Maximum number of reports to return
   * @returns Array of model comparison reports
   */
  public async getModelComparisons(taskType: TaskType, limit: number = 10): Promise<ModelComparisonReport[]> {
    if (!this.isInitialized) {
        await ModelRegistry.getInstance(); // Ensure initialization
    }
    const client = supabase.getClient();
    const { data: reportsData, error: reportsError } = await client
      .from('model_comparison_reports')
      .select('id, task_type, timestamp') // Select specific columns
      .eq('task_type', taskType)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (reportsError) {
      logger.error(`Error fetching model comparison reports for ${taskType}:`, reportsError);
      return [];
    }
    if (!reportsData) return [];

    const reports: ModelComparisonReport[] = [];
    for (const reportRecord of reportsData) {
      const { data: metricsData, error: metricsError } = await client
        .from('model_performance_metrics')
        .select('*')
        .eq('comparison_report_id', reportRecord.id);
      
      if (metricsError) {
        logger.error(`Error fetching metrics for report ${reportRecord.id}:`, metricsError);
        // Continue to next report or handle error differently
        continue;
      }

      const results: ModelEvaluationResult[] = (metricsData || []).map((dbResult: any) => ({ // Added 'any' for dbResult
        modelId: { provider: dbResult.model_provider as ModelProvider, modelId: dbResult.model_id },
        taskType: dbResult.task_type,
        metrics: {
            accuracy: dbResult.accuracy,
            latency: dbResult.latency_ms,
            costPerToken: dbResult.cost_per_token,
            tokenCount: dbResult.token_count,
            userRating: dbResult.user_rating,
            customMetrics: dbResult.custom_metrics
        },
        timestamp: new Date(dbResult.timestamp),
        inputHash: dbResult.input_hash,
        contextSize: dbResult.context_size
      }));
      
      // Reconstruct rankings and bestModelId if they were stored in the report or derive them
      // For now, these are left as potentially empty or to be derived if not in DB
      // A more robust way would be to store/retrieve these if they are critical.
      let bestModelInReport: ModelIdentifier = this.getDefaultModel(reportRecord.task_type);
      if (results && results.length > 0 && results[0]) { // Ensure results[0] is not undefined
          // Simplified: pick the first one, or implement ranking logic based on metrics
          bestModelInReport = results[0].modelId;
      }

      reports.push({
        taskType: reportRecord.task_type,
        timestamp: new Date(reportRecord.timestamp),
        results,
        rankings: {}, // Placeholder: Derive or load if stored
        bestModelId: bestModelInReport
      });
    }
    return reports;
  }
}

// Export singleton instance
export const modelRegistry = ModelRegistry.getInstance();
export default modelRegistry;
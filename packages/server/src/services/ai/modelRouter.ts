/**
 * Model Router Service
 * 
 * This service routes AI requests to the appropriate provider and model based on
 * task type and historical performance. It also implements a rotation-based
 * evaluation system that periodically runs tasks across all models to gather
 * comparative performance data.
 */

import { logger } from '../../utils/logger';
import { modelRegistry, ModelIdentifier, TaskType, PerformanceMetrics, ModelComparisonReport } from './modelRegistry';
import { huggingFaceProvider } from '../huggingface/huggingFaceProvider';

// Add imports for other providers as they are implemented
// import { openAiProvider } from '../openai/openAiProvider';
// import { anthropicProvider } from '../anthropic/anthropicProvider';

export interface RoutingOptions {
  taskType: TaskType;
  preferredProvider?: 'openai' | 'anthropic' | 'huggingface' | 'local';
  maxLatency?: number;
  minAccuracy?: number;
  costSensitive?: boolean;
  forceEvaluation?: boolean;
}

export interface ModelExecutionResult<T> {
  result: T;
  model: ModelIdentifier;
  metrics: PerformanceMetrics;
  executionTime: number;
}

export interface EvaluationResult<T> {
  results: ModelExecutionResult<T>[];
  bestResult: ModelExecutionResult<T>;
  comparisonReport: ModelComparisonReport;
}

/**
 * Model Router Service
 * 
 * Routes AI requests to the appropriate provider and model, implementing
 * a rotation-based evaluation system for continuous improvement
 */
export class ModelRouter {
  private static instance: ModelRouter;

  // Flag to track initialization state
  private initialized = false;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.initialize();
  }

  /**
   * Get the singleton instance
   * @returns The ModelRouter instance
   */
  public static getInstance(): ModelRouter {
    if (!ModelRouter.instance) {
      ModelRouter.instance = new ModelRouter();
    }
    return ModelRouter.instance;
  }

  /**
   * Initialize the router with available providers
   */
  private initialize(): void {
    // Confirm required providers are initialized
    if (!huggingFaceProvider.isInitialized()) {
      logger.warn('HuggingFace provider not initialized, some routes may fail');
    }

    // Check for other providers
    // if (!openAiProvider.isInitialized()) {
    //   logger.warn('OpenAI provider not initialized, some routes may fail');
    // }
    
    // if (!anthropicProvider.isInitialized()) {
    //   logger.warn('Anthropic provider not initialized, some routes may fail');
    // }

    this.initialized = true;
    logger.info('ModelRouter initialized');
  }

  /**
   * Route a text generation request to the appropriate provider and model
   * @param prompt Text prompt
   * @param options Routing options
   * @returns Generated text and performance metrics
   */
  public async routeTextGeneration(
    prompt: string,
    options: RoutingOptions & { 
      maxLength?: number;
      temperature?: number; 
      topP?: number;
    } = { taskType: 'text-generation' }
  ): Promise<ModelExecutionResult<string>> {
    options.taskType = options.taskType || 'text-generation';
    
    // Determine if this task should run in evaluation mode
    const runEvaluation = options.forceEvaluation || modelRegistry.shouldRunEvaluation(options.taskType);
    
    if (runEvaluation) {
      // In evaluation mode, run across all models
      const evalResults = await this.evaluateTextGeneration(prompt, options);
      return evalResults.bestResult;
    }
    
    // Standard mode: route to the best model
    const modelId = modelRegistry.selectBestModel({
      taskType: options.taskType,
      preferredProvider: options.preferredProvider,
      maxLatency: options.maxLatency,
      minAccuracy: options.minAccuracy,
      costSensitive: options.costSensitive
    });
    
    return this.executeTextGeneration(modelId, prompt, options);
  }

  /**
   * Evaluate text generation across all models
   * @param prompt Text prompt
   * @param options Routing options
   * @returns Evaluation results
   */
  public async evaluateTextGeneration(
    prompt: string,
    options: RoutingOptions & { 
      maxLength?: number;
      temperature?: number; 
      topP?: number;
    } = { taskType: 'text-generation' }
  ): Promise<EvaluationResult<string>> {
    options.taskType = options.taskType || 'text-generation';
    
    // Get all models for this task type
    const models = modelRegistry.getAllModels(options.taskType);
    
    // Execute the task on all models
    const executionPromises = models.map(modelId => 
      this.executeTextGeneration(modelId, prompt, options)
        .catch(err => {
          logger.error(`Failed to execute text generation on ${modelId.provider}:${modelId.modelId}: ${err}`);
          return null;
        })
    );
    
    // Wait for all executions to complete
    const results = (await Promise.all(executionPromises)).filter(result => result !== null) as ModelExecutionResult<string>[];
    
    if (results.length === 0) {
      throw new Error('All models failed to execute text generation');
    }
    
    // Rank results by execution time (faster is better) as a simple metric
    // In a real implementation, we would use more sophisticated metrics
    const rankedResults = [...results].sort((a, b) => a.executionTime - b.executionTime);
    
    // Make sure we have at least one result
    if (rankedResults.length === 0) {
      throw new Error('No valid models available for text generation evaluation');
    }
    
    // Use non-null assertion as we've already checked that rankedResults has elements
    const bestResult = rankedResults[0]!;
    
    // Create a comparison report
    const comparisonReport: ModelComparisonReport = {
      taskType: options.taskType,
      timestamp: new Date(),
      results: results.map(r => ({
        modelId: r.model,
        taskType: options.taskType,
        metrics: r.metrics,
        timestamp: new Date()
      })),
      rankings: results.reduce((acc, r, i) => {
        const key = `${r.model.provider}:${r.model.modelId}`;
        acc[key] = i + 1;
        return acc;
      }, {} as Record<string, number>),
      bestModelId: bestResult.model // This is safe now because bestResult is non-null
    };
    
    // Store the comparison report
    modelRegistry.storeModelComparison(comparisonReport);
    
    return {
      results,
      bestResult,
      comparisonReport
    };
  }

  /**
   * Execute a text generation request on a specific model
   * @param modelId Model identifier
   * @param prompt Text prompt
   * @param options Routing options
   * @returns Generated text and performance metrics
   * @private
   */
  private async executeTextGeneration(
    modelId: ModelIdentifier,
    prompt: string,
    options: RoutingOptions & { 
      maxLength?: number;
      temperature?: number; 
      topP?: number;
    }
  ): Promise<ModelExecutionResult<string>> {
    const startTime = Date.now();
    
    try {
      let result: string;
      let tokenCount = 0;
      
      // Route to the appropriate provider
      switch (modelId.provider) {
        case 'huggingface':
          const hfResult = await huggingFaceProvider.generateText(prompt, {
            model: modelId.modelId,
            maxLength: options.maxLength,
            temperature: options.temperature,
            topP: options.topP
          });
          result = hfResult.text;
          // Estimate token count based on words (rough approximation)
          tokenCount = result.split(/\s+/).length + prompt.split(/\s+/).length;
          break;
          
        case 'openai':
          // Placeholder for OpenAI provider
          // const openAiResult = await openAiProvider.generateText(prompt, {
          //   model: modelId.modelId,
          //   maxTokens: options.maxLength,
          //   temperature: options.temperature,
          //   topP: options.topP
          // });
          // result = openAiResult.text;
          // tokenCount = openAiResult.usage.totalTokens;
          throw new Error('OpenAI provider not implemented');
          
        case 'anthropic':
          // Placeholder for Anthropic provider
          // const anthropicResult = await anthropicProvider.generateText(prompt, {
          //   model: modelId.modelId,
          //   maxTokens: options.maxLength,
          //   temperature: options.temperature
          // });
          // result = anthropicResult.text;
          // tokenCount = anthropicResult.usage.totalTokens;
          throw new Error('Anthropic provider not implemented');
          
        case 'local':
          // Placeholder for local provider
          throw new Error('Local provider not implemented');
          
        default:
          throw new Error(`Unknown provider: ${modelId.provider}`);
      }
      
      const executionTime = Date.now() - startTime;
      
      // Create metrics
      const metrics: PerformanceMetrics = {
        latency: executionTime,
        tokenCount,
        // Estimate cost based on provider and model
        costPerToken: this.estimateCostPerToken(modelId)
      };
      
      // Record performance metrics
      modelRegistry.recordPerformance(modelId, options.taskType, metrics);
      
      return {
        result,
        model: modelId,
        metrics,
        executionTime
      };
    } catch (err) {
      logger.error(`Failed to execute text generation on ${modelId.provider}:${modelId.modelId}: ${err}`);
      throw err;
    }
  }

  /**
   * Route an embedding generation request to the appropriate provider and model
   * @param input Text or image input
   * @param options Routing options
   * @returns Embedding vector and performance metrics
   */
  public async routeEmbeddingGeneration(
    input: string | Buffer,
    options: RoutingOptions & {
      encoderType?: 'text' | 'image' | 'multimodal';
      normalize?: boolean;
    } = { taskType: 'embedding' }
  ): Promise<ModelExecutionResult<number[]>> {
    options.taskType = options.taskType || 'embedding';
    
    // Determine if this task should run in evaluation mode
    const runEvaluation = options.forceEvaluation || modelRegistry.shouldRunEvaluation(options.taskType);
    
    if (runEvaluation) {
      // In evaluation mode, run across all models
      const evalResults = await this.evaluateEmbeddingGeneration(input, options);
      return evalResults.bestResult;
    }
    
    // Standard mode: route to the best model
    const modelId = modelRegistry.selectBestModel({
      taskType: options.taskType,
      preferredProvider: options.preferredProvider,
      maxLatency: options.maxLatency,
      minAccuracy: options.minAccuracy,
      costSensitive: options.costSensitive
    });
    
    return this.executeEmbeddingGeneration(modelId, input, options);
  }

  /**
   * Evaluate embedding generation across all models
   * @param input Text or image input
   * @param options Routing options
   * @returns Evaluation results
   */
  public async evaluateEmbeddingGeneration(
    input: string | Buffer,
    options: RoutingOptions & {
      encoderType?: 'text' | 'image' | 'multimodal';
      normalize?: boolean;
    } = { taskType: 'embedding' }
  ): Promise<EvaluationResult<number[]>> {
    options.taskType = options.taskType || 'embedding';
    
    // Get all models for this task type
    const models = modelRegistry.getAllModels(options.taskType);
    
    // Execute the task on all models
    const executionPromises = models.map(modelId => 
      this.executeEmbeddingGeneration(modelId, input, options)
        .catch(err => {
          logger.error(`Failed to execute embedding generation on ${modelId.provider}:${modelId.modelId}: ${err}`);
          return null;
        })
    );
    
    // Wait for all executions to complete
    const results = (await Promise.all(executionPromises)).filter(result => result !== null) as ModelExecutionResult<number[]>[];
    
    if (results.length === 0) {
      throw new Error('All models failed to execute embedding generation');
    }
    
    // Rank results by execution time (faster is better) as a simple metric
    // In a real implementation, we might evaluate embedding quality differently
    const rankedResults = [...results].sort((a, b) => a.executionTime - b.executionTime);
    
    // Make sure we have at least one result
    if (rankedResults.length === 0) {
      throw new Error('No valid models available for embedding generation evaluation');
    }
    
    // Use non-null assertion as we've already checked that rankedResults has elements
    const bestResult = rankedResults[0]!;
    
    // Create a comparison report
    const comparisonReport: ModelComparisonReport = {
      taskType: options.taskType,
      timestamp: new Date(),
      results: results.map(r => ({
        modelId: r.model,
        taskType: options.taskType,
        metrics: r.metrics,
        timestamp: new Date()
      })),
      rankings: results.reduce((acc, r, i) => {
        const key = `${r.model.provider}:${r.model.modelId}`;
        acc[key] = i + 1;
        return acc;
      }, {} as Record<string, number>),
      bestModelId: bestResult.model // This is safe now because bestResult is non-null
    };
    
    // Store the comparison report
    modelRegistry.storeModelComparison(comparisonReport);
    
    return {
      results,
      bestResult,
      comparisonReport
    };
  }

  /**
   * Execute an embedding generation request on a specific model
   * @param modelId Model identifier
   * @param input Text or image input
   * @param options Routing options
   * @returns Embedding vector and performance metrics
   * @private
   */
  private async executeEmbeddingGeneration(
    modelId: ModelIdentifier,
    input: string | Buffer,
    options: RoutingOptions & {
      encoderType?: 'text' | 'image' | 'multimodal';
      normalize?: boolean;
    }
  ): Promise<ModelExecutionResult<number[]>> {
    const startTime = Date.now();
    
    try {
      let embedding: number[];
      let dimensions: number;
      
      // Route to the appropriate provider
      switch (modelId.provider) {
        case 'huggingface':
          const hfResult = await huggingFaceProvider.generateEmbedding(input, {
            model: modelId.modelId,
            encoderType: options.encoderType,
            normalize: options.normalize
          });
          embedding = hfResult.embedding;
          dimensions = hfResult.dimensions;
          break;
          
        case 'openai':
          // Placeholder for OpenAI provider
          // const openAiResult = await openAiProvider.generateEmbedding(input);
          // embedding = openAiResult.embedding;
          // dimensions = openAiResult.dimensions;
          throw new Error('OpenAI provider not implemented');
          
        default:
          throw new Error(`Provider ${modelId.provider} does not support embedding generation`);
      }
      
      const executionTime = Date.now() - startTime;
      
      // Create metrics
      const metrics: PerformanceMetrics = {
        latency: executionTime,
        // For embeddings, use dimensions as a proxy for token count
        tokenCount: dimensions,
        // Estimate cost based on provider and model
        costPerToken: this.estimateCostPerToken(modelId)
      };
      
      // Record performance metrics
      modelRegistry.recordPerformance(modelId, options.taskType, metrics);
      
      return {
        result: embedding,
        model: modelId,
        metrics,
        executionTime
      };
    } catch (err) {
      logger.error(`Failed to execute embedding generation on ${modelId.provider}:${modelId.modelId}: ${err}`);
      throw err;
    }
  }

  /**
   * Route an image analysis request to the appropriate provider and model
   * @param imageBuffer Image data buffer
   * @param options Routing options
   * @returns Analysis results and performance metrics
   */
  public async routeImageAnalysis(
    imageBuffer: Buffer,
    options: RoutingOptions & {
      task?: 'object-detection' | 'image-classification' | 'image-segmentation';
    } = { taskType: 'image-analysis' }
  ): Promise<ModelExecutionResult<any>> {
    options.taskType = options.taskType || 'image-analysis';
    
    // Determine if this task should run in evaluation mode
    const runEvaluation = options.forceEvaluation || modelRegistry.shouldRunEvaluation(options.taskType);
    
    if (runEvaluation) {
      // In evaluation mode, run across all models
      const evalResults = await this.evaluateImageAnalysis(imageBuffer, options);
      return evalResults.bestResult;
    }
    
    // Standard mode: route to the best model
    const modelId = modelRegistry.selectBestModel({
      taskType: options.taskType,
      preferredProvider: options.preferredProvider,
      maxLatency: options.maxLatency,
      minAccuracy: options.minAccuracy,
      costSensitive: options.costSensitive
    });
    
    return this.executeImageAnalysis(modelId, imageBuffer, options);
  }

  /**
   * Evaluate image analysis across all models
   * @param imageBuffer Image data buffer
   * @param options Routing options
   * @returns Evaluation results
   */
  public async evaluateImageAnalysis(
    imageBuffer: Buffer,
    options: RoutingOptions & {
      task?: 'object-detection' | 'image-classification' | 'image-segmentation';
    } = { taskType: 'image-analysis' }
  ): Promise<EvaluationResult<any>> {
    options.taskType = options.taskType || 'image-analysis';
    
    // Get all models for this task type
    const models = modelRegistry.getAllModels(options.taskType);
    
    // Execute the task on all models
    const executionPromises = models.map(modelId => 
      this.executeImageAnalysis(modelId, imageBuffer, options)
        .catch(err => {
          logger.error(`Failed to execute image analysis on ${modelId.provider}:${modelId.modelId}: ${err}`);
          return null;
        })
    );
    
    // Wait for all executions to complete
    const results = (await Promise.all(executionPromises)).filter(result => result !== null) as ModelExecutionResult<any>[];
    
    if (results.length === 0) {
      throw new Error('All models failed to execute image analysis');
    }
    
    // Rank results by execution time (faster is better) as a simple metric
    const rankedResults = [...results].sort((a, b) => a.executionTime - b.executionTime);
    
    // Make sure we have at least one result
    if (rankedResults.length === 0) {
      throw new Error('No valid models available for image analysis evaluation');
    }
    
    // Use non-null assertion as we've already checked that rankedResults has elements
    const bestResult = rankedResults[0]!;
    
    // Create a comparison report
    const comparisonReport: ModelComparisonReport = {
      taskType: options.taskType,
      timestamp: new Date(),
      results: results.map(r => ({
        modelId: r.model,
        taskType: options.taskType,
        metrics: r.metrics,
        timestamp: new Date()
      })),
      rankings: results.reduce((acc, r, i) => {
        const key = `${r.model.provider}:${r.model.modelId}`;
        acc[key] = i + 1;
        return acc;
      }, {} as Record<string, number>),
      bestModelId: bestResult.model // This is safe now because bestResult is non-null
    };
    
    // Store the comparison report
    modelRegistry.storeModelComparison(comparisonReport);
    
    return {
      results,
      bestResult,
      comparisonReport
    };
  }

  /**
   * Execute an image analysis request on a specific model
   * @param modelId Model identifier
   * @param imageBuffer Image data buffer
   * @param options Routing options
   * @returns Analysis results and performance metrics
   * @private
   */
  private async executeImageAnalysis(
    modelId: ModelIdentifier,
    imageBuffer: Buffer,
    options: RoutingOptions & {
      task?: 'object-detection' | 'image-classification' | 'image-segmentation';
    }
  ): Promise<ModelExecutionResult<any>> {
    const startTime = Date.now();
    
    try {
      let result: any;
      
      // Route to the appropriate provider
      switch (modelId.provider) {
        case 'huggingface':
          result = await huggingFaceProvider.analyzeImage(imageBuffer, {
            model: modelId.modelId,
            task: options.task
          });
          break;
          
        default:
          throw new Error(`Provider ${modelId.provider} does not support image analysis`);
      }
      
      const executionTime = Date.now() - startTime;
      
      // Create metrics
      const metrics: PerformanceMetrics = {
        latency: executionTime,
        // For images, use file size as a proxy for token count/complexity
        tokenCount: imageBuffer.length,
        // Estimate cost based on provider and model
        costPerToken: this.estimateCostPerToken(modelId)
      };
      
      // Record performance metrics
      modelRegistry.recordPerformance(modelId, options.taskType, metrics);
      
      return {
        result,
        model: modelId,
        metrics,
        executionTime
      };
    } catch (err) {
      logger.error(`Failed to execute image analysis on ${modelId.provider}:${modelId.modelId}: ${err}`);
      throw err;
    }
  }

  /**
   * Estimate cost per token for a specific model
   * @param modelId Model identifier
   * @returns Estimated cost per token in USD
   * @private
   */
  private estimateCostPerToken(modelId: ModelIdentifier): number {
    // These are approximations, in a real implementation
    // these would be loaded from a configuration or API
    
    const costMap: Record<string, Record<string, number>> = {
      'openai': {
        'gpt-4': 0.00006, // $0.06 per 1000 tokens
        'gpt-3.5-turbo': 0.000002, // $0.002 per 1000 tokens
        'text-embedding-ada-002': 0.0000004 // $0.0004 per 1000 tokens
      },
      'anthropic': {
        'claude-2': 0.00008, // $0.08 per 1000 tokens
        'claude-instant': 0.000008 // $0.008 per 1000 tokens
      },
      'huggingface': {
        // Hugging Face Inference API is free for most models
        // but we'll use a small value to represent compute costs
        'default': 0.0000001 // $0.0001 per 1000 tokens
      }
    };
    
    // Get cost for the specific model, fallback to provider default
    return (
      costMap[modelId.provider]?.[modelId.modelId] || 
      costMap[modelId.provider]?.['default'] || 
      0.0000001 // Fallback default
    );
  }
}

// Export singleton instance
export const modelRouter = ModelRouter.getInstance();
export default modelRouter;
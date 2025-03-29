/**
 * AI Controller
 * 
 * This controller exposes endpoints for AI services including text generation,
 * embedding generation, and image analysis. It leverages the ModelRouter to
 * dynamically select the best model for each task based on historical performance.
 */

// Import core dependencies
// Using minimal typing to avoid TypeScript errors
import { modelRouter } from '../services/ai/modelRouter';
import { logger } from '../utils/logger';

/**
 * Generate text using the optimal AI model
 * @param req Request object
 * @param res Response object
 */
export const generateText = async (req: any, res: any): Promise<void> => {
  try {
    const { prompt, maxLength, temperature, topP, preferredProvider, forceEvaluation } = req.body;
    
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }
    
    const result = await modelRouter.routeTextGeneration(prompt, {
      taskType: 'text-generation',
      maxLength: maxLength || 500,
      temperature: temperature !== undefined ? temperature : 0.7,
      topP: topP !== undefined ? topP : 0.9,
      preferredProvider,
      forceEvaluation: forceEvaluation === true
    });
    
    res.json({
      text: result.result,
      model: {
        provider: result.model.provider,
        name: result.model.modelId
      },
      metrics: {
        latency: result.metrics.latency,
        tokenCount: result.metrics.tokenCount,
        estimatedCost: (result.metrics.tokenCount ?? 0) * (result.metrics.costPerToken ?? 0)
      }
    });
  } catch (err) {
    logger.error(`Error generating text: ${err}`);
    res.status(500).json({ error: 'Failed to generate text', details: err instanceof Error ? err.message : String(err) });
  }
};

/**
 * Generate embeddings using the optimal AI model
 * @param req Request object
 * @param res Response object
 */
export const generateEmbedding = async (req: any, res: any): Promise<void> => {
  try {
    const { text, encoderType, normalize, preferredProvider, forceEvaluation } = req.body;
    
    if (!text) {
      res.status(400).json({ error: 'Text input is required' });
      return;
    }
    
    const result = await modelRouter.routeEmbeddingGeneration(text, {
      taskType: 'embedding',
      encoderType: encoderType || 'text',
      normalize: normalize !== false,
      preferredProvider,
      forceEvaluation: forceEvaluation === true
    });
    
    res.json({
      embedding: result.result,
      dimensions: result.result.length,
      model: {
        provider: result.model.provider,
        name: result.model.modelId
      },
      metrics: {
        latency: result.metrics.latency,
        estimatedCost: (result.metrics.tokenCount ?? 0) * (result.metrics.costPerToken ?? 0)
      }
    });
  } catch (err) {
    logger.error(`Error generating embedding: ${err}`);
    res.status(500).json({ error: 'Failed to generate embedding', details: err instanceof Error ? err.message : String(err) });
  }
};

/**
 * Analyze an image using the optimal AI model
 * @param req Request object
 * @param res Response object
 */
export const analyzeImage = async (req: any, res: any): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Image file is required' });
      return;
    }
    
    const { task, preferredProvider, forceEvaluation } = req.body;
    
    const imageBuffer = req.file.buffer;
    
    const result = await modelRouter.routeImageAnalysis(imageBuffer, {
      taskType: 'image-analysis',
      task: task || 'image-classification',
      preferredProvider,
      forceEvaluation: forceEvaluation === true
    });
    
    res.json({
      analysis: result.result,
      model: {
        provider: result.model.provider,
        name: result.model.modelId
      },
      metrics: {
        latency: result.metrics.latency,
        estimatedCost: (result.metrics.tokenCount ?? 0) * (result.metrics.costPerToken ?? 0)
      }
    });
  } catch (err) {
    logger.error(`Error analyzing image: ${err}`);
    res.status(500).json({ error: 'Failed to analyze image', details: err instanceof Error ? err.message : String(err) });
  }
};

/**
 * Get performance metrics for AI models
 * @param req Request object
 * @param res Response object
 */
export const getModelMetrics = async (req: any, res: any): Promise<void> => {
  try {
    // This would be implemented by querying the ModelRegistry
    // But we'll return a placeholder response for now
    res.json({
      message: 'Model metrics endpoint not yet implemented'
    });
  } catch (err) {
    logger.error(`Error getting model metrics: ${err}`);
    res.status(500).json({ error: 'Failed to get model metrics', details: err instanceof Error ? err.message : String(err) });
  }
};

/**
 * Force evaluation mode for a specific number of tasks
 * @param req Request object
 * @param res Response object
 */
export const setEvaluationMode = async (req: any, res: any): Promise<void> => {
  try {
    // This would be implemented by updating the ModelRegistry configuration
    // But we'll return a placeholder response for now
    res.json({
      message: 'Evaluation mode endpoint not yet implemented'
    });
  } catch (err) {
    logger.error(`Error setting evaluation mode: ${err}`);
    res.status(500).json({ error: 'Failed to set evaluation mode', details: err instanceof Error ? err.message : String(err) });
  }
};
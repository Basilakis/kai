/**
 * AI Controller
 *
 * This controller exposes endpoints for AI services including text generation,
 * embedding generation, and image analysis. It leverages the ModelRouter to
 * dynamically select the best model for each task based on historical performance.
 */

// Import core dependencies with proper TypeScript types
import { Request, Response } from '../types/middleware';
import { modelRouter } from '../services/ai/modelRouter';
import { logger, LogMetadata } from '../utils/logger';
import mcpClientService, { MCPServiceKey } from '../services/mcp/mcpClientService';
import { ApiError } from '../utils/apiError';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

// Provider and encoder type definitions from modelRouter
type AIProvider = 'openai' | 'anthropic' | 'huggingface' | 'local';
type EncoderType = 'text' | 'image' | 'multimodal';
type AnalysisTask = 'object-detection' | 'image-classification' | 'image-segmentation';

// Define typed request interface with generic support that correctly extends Request
interface TypedRequest<
  P extends Record<string, string> = Record<string, string>,
  ReqB = unknown
> extends Request {
  params: P;
  body: ReqB;
}

// Define interfaces for request bodies with proper type literals
interface TextGenerationRequest {
  prompt: string;
  maxLength?: number;
  temperature?: number;
  topP?: number;
  preferredProvider?: AIProvider;
  forceEvaluation?: boolean;
}

interface EmbeddingGenerationRequest {
  text: string;
  encoderType?: EncoderType;
  normalize?: boolean;
  preferredProvider?: AIProvider;
  forceEvaluation?: boolean;
}

// Export for use in other modules and for API documentation
export interface ImageAnalysisRequest {
  task?: AnalysisTask;
  preferredProvider?: AIProvider;
  forceEvaluation?: boolean;
}

/**
 * Interface for file data from multer
 */
interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
  fieldname: string;
  encoding: string;
}

/**
 * Interface for request with file upload (multer)
 */
interface FileRequest extends Request {
  file?: UploadedFile;
}

interface EvaluationModeRequest {
  evaluationMode?: boolean;
  taskCount?: number;
}

/**
 * Response shape for text generation
 * Exported for documentation and usage in client applications
 */
export interface TextGenerationResponse {
  text: string;
  model: {
    provider: AIProvider;
    name: string;
  };
  metrics: {
    latency: number;
    tokenCount?: number;
    estimatedCost?: number;
  };
}

/**
 * Generate text using the optimal AI model
 * @param req Request object with text generation parameters
 * @param res Response object
 */
export const generateText = async (
  req: TypedRequest<Record<string, string>, TextGenerationRequest>,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { prompt, maxLength, temperature, topP, preferredProvider, forceEvaluation } = req.body;

    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    // Check if MCP is available
    const mcpAvailable = await mcpClientService.isMCPAvailable();

    if (mcpAvailable) {
      try {
        // Generate text using MCP
        const mcpResult = await mcpClientService.generateText(
          userId,
          prompt,
          {
            maxTokens: maxLength || 500,
            temperature: temperature !== undefined ? temperature : 0.7,
            topP: topP !== undefined ? topP : 0.9,
            model: preferredProvider === 'openai' ? 'gpt-4' : 'gpt-3.5-turbo'
          }
        );

        res.json({
          text: mcpResult.text,
          model: {
            provider: 'mcp',
            name: 'mcp-text-generation'
          },
          metrics: {
            latency: 0, // MCP doesn't provide latency yet
            tokenCount: mcpResult.usage.totalTokens,
            estimatedCost: 0 // MCP handles cost calculation
          }
        });
        return;
      } catch (mcpError: any) {
        // If MCP fails with insufficient credits, return 402
        if (mcpError.message === 'Insufficient credits') {
          res.status(402).json({
            error: 'Insufficient credits',
            details: 'You do not have enough credits to perform this action. Please purchase more credits.'
          });
          return;
        }

        // For other MCP errors, log and fall back to modelRouter
        logger.warn(`MCP text generation failed, falling back to modelRouter: ${mcpError.message}`);
      }
    }

    // Fall back to modelRouter if MCP is not available or failed
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
 * Response shape for embedding generation
 * Exported for documentation and usage in client applications
 */
export interface EmbeddingGenerationResponse {
  embedding: number[];
  dimensions: number;
  model: {
    provider: AIProvider;
    name: string;
  };
  metrics: {
    latency: number;
    estimatedCost?: number;
  };
}

/**
 * Generate embeddings using the optimal AI model
 * @param req Request object with embedding generation parameters
 * @param res Response object
 */
export const generateEmbedding = async (
  req: TypedRequest<Record<string, string>, EmbeddingGenerationRequest>,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { text, encoderType, normalize, preferredProvider, forceEvaluation } = req.body;

    if (!text) {
      res.status(400).json({ error: 'Text input is required' });
      return;
    }

    // Check if MCP is available
    const mcpAvailable = await mcpClientService.isMCPAvailable();

    if (mcpAvailable) {
      try {
        // Generate embedding using MCP
        const mcpResult = await mcpClientService.generateTextEmbedding(
          userId,
          text,
          {
            model: preferredProvider === 'openai' ? 'text-embedding-ada-002' : 'text-embedding-3-small'
          }
        );

        res.json({
          embedding: mcpResult.embedding,
          dimensions: mcpResult.dimensions,
          model: {
            provider: 'mcp',
            name: 'mcp-text-embedding'
          },
          metrics: {
            latency: 0, // MCP doesn't provide latency yet
            estimatedCost: 0 // MCP handles cost calculation
          }
        });
        return;
      } catch (mcpError: any) {
        // If MCP fails with insufficient credits, return 402
        if (mcpError.message === 'Insufficient credits') {
          res.status(402).json({
            error: 'Insufficient credits',
            details: 'You do not have enough credits to perform this action. Please purchase more credits.'
          });
          return;
        }

        // For other MCP errors, log and fall back to modelRouter
        logger.warn(`MCP embedding generation failed, falling back to modelRouter: ${mcpError.message}`);
      }
    }

    // Fall back to modelRouter if MCP is not available or failed
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
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Error generating embedding: ${errorMessage}`, {
      service: 'AIController',
      method: 'generateEmbedding'
    } as LogMetadata);
    res.status(500).json({
      error: 'Failed to generate embedding',
      details: errorMessage
    });
  }
};

/**
 * Response shape for image analysis
 * Exported for documentation and usage in client applications
 */
export interface ImageAnalysisResponse {
  analysis: unknown;
  model: {
    provider: AIProvider;
    name: string;
  };
  metrics: {
    latency: number;
    estimatedCost?: number;
  };
}

/**
 * Analyze an image using the optimal AI model
 * @param req Request object with file upload and analysis parameters
 * @param res Response object
 */
export const analyzeImage = async (req: FileRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'Image file is required' });
      return;
    }

    const { task, preferredProvider, forceEvaluation } = req.body;

    // Check if MCP is available
    const mcpAvailable = await mcpClientService.isMCPAvailable();

    if (mcpAvailable) {
      try {
        // Save uploaded file to temp directory for MCP
        const tempDir = path.join(os.tmpdir(), 'kai-uploads');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFilePath = path.join(tempDir, `${uuidv4()}-${req.file.originalname}`);
        fs.writeFileSync(tempFilePath, req.file.buffer);

        try {
          // Analyze image using MCP
          const mcpResult = await mcpClientService.analyzeImage(
            userId,
            tempFilePath,
            {
              modelType: task || 'image-classification',
              confidenceThreshold: 0.6,
              maxResults: 10,
              includeFeatures: true
            }
          );

          res.json({
            analysis: mcpResult,
            model: {
              provider: 'mcp',
              name: 'mcp-image-analysis'
            },
            metrics: {
              latency: 0, // MCP doesn't provide latency yet
              estimatedCost: 0 // MCP handles cost calculation
            }
          });
          return;
        } finally {
          // Clean up temp file
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        }
      } catch (mcpError: any) {
        // If MCP fails with insufficient credits, return 402
        if (mcpError.message === 'Insufficient credits') {
          res.status(402).json({
            error: 'Insufficient credits',
            details: 'You do not have enough credits to perform this action. Please purchase more credits.'
          });
          return;
        }

        // For other MCP errors, log and fall back to modelRouter
        logger.warn(`MCP image analysis failed, falling back to modelRouter: ${mcpError.message}`);
      }
    }

    // Fall back to modelRouter if MCP is not available or failed
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
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Error analyzing image: ${errorMessage}`, {
      service: 'AIController',
      method: 'analyzeImage'
    } as LogMetadata);
    res.status(500).json({
      error: 'Failed to analyze image',
      details: errorMessage
    });
  }
};

/**
 * Response shape for model metrics
 * Exported for documentation and usage in client applications
 */
export interface ModelMetricsResponse {
  models: Array<{
    provider: AIProvider;
    modelId: string;
    metrics: {
      avgLatency: number;
      successRate: number;
      costPerToken?: number;
      totalRequests: number;
    };
  }>;
}

/**
 * Get performance metrics for AI models
 * @param req Request object
 * @param res Response object
 */
export const getModelMetrics = async (_req: TypedRequest, res: Response): Promise<void> => {
  try {
    // This would be implemented by querying the ModelRegistry
    // But we'll return a placeholder response for now
    res.json({
      message: 'Model metrics endpoint not yet implemented'
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Error getting model metrics: ${errorMessage}`, {
      service: 'AIController',
      method: 'getModelMetrics'
    } as LogMetadata);
    res.status(500).json({
      error: 'Failed to get model metrics',
      details: errorMessage
    });
  }
};

/**
 * Response shape for evaluation mode settings
 * Exported for documentation and usage in client applications
 */
export interface EvaluationModeResponse {
  success: boolean;
  message: string;
  settings?: {
    evaluationMode: boolean;
    taskCount: number;
    remainingTasks: number;
  };
}

/**
 * Force evaluation mode for a specific number of tasks
 * @param req Request object with evaluation mode parameters
 * @param res Response object
 */
export const setEvaluationMode = async (
  _req: TypedRequest<Record<string, string>, EvaluationModeRequest>,
  res: Response
): Promise<void> => {
  try {
    // This would be implemented by updating the ModelRegistry configuration
    // But we'll return a placeholder response for now
    res.json({
      message: 'Evaluation mode endpoint not yet implemented'
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Error setting evaluation mode: ${errorMessage}`, {
      service: 'AIController',
      method: 'setEvaluationMode'
    } as LogMetadata);
    res.status(500).json({
      error: 'Failed to set evaluation mode',
      details: errorMessage
    });
  }
};
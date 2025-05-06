/**
 * Admin Prompt ML Controller
 * 
 * Handles admin operations for prompt ML models and predictions.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { PromptMLService } from '../../services/ai/promptMLService';
import { promptService } from '../../services/ai/promptService';
import { ApiError } from '../../utils/errors';

// Initialize ML service
const mlService = new PromptMLService();

/**
 * Get all ML models
 */
export async function getMLModels(req: Request, res: Response): Promise<void> {
  try {
    const { isActive } = req.query;
    
    const models = await mlService.getMLModels(
      isActive === 'true' ? true : isActive === 'false' ? false : undefined
    );
    
    res.status(200).json({
      success: true,
      data: models
    });
  } catch (error) {
    logger.error(`Error in getMLModels: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to get ML models: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Get ML model by ID
 */
export async function getMLModelById(req: Request, res: Response): Promise<void> {
  try {
    const { modelId } = req.params;
    
    if (!modelId) {
      throw new ApiError(400, 'Model ID is required');
    }
    
    const model = await mlService.getMLModelById(modelId);
    
    res.status(200).json({
      success: true,
      data: model
    });
  } catch (error) {
    logger.error(`Error in getMLModelById: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to get ML model: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Create ML model
 */
export async function createMLModel(req: Request, res: Response): Promise<void> {
  try {
    const model = req.body;
    
    if (!model || !model.name || !model.modelType || !model.modelParameters) {
      throw new ApiError(400, 'Model name, type, and parameters are required');
    }
    
    // Set created by from user
    model.createdBy = req.user?.id;
    
    const modelId = await mlService.createMLModel(model);
    
    res.status(201).json({
      success: true,
      message: 'ML model created successfully',
      data: { id: modelId }
    });
  } catch (error) {
    logger.error(`Error in createMLModel: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to create ML model: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Train ML model
 */
export async function trainMLModel(req: Request, res: Response): Promise<void> {
  try {
    const { modelId } = req.params;
    const { trainingData } = req.body;
    
    if (!modelId) {
      throw new ApiError(400, 'Model ID is required');
    }
    
    const modelVersionId = await mlService.trainModel(modelId, trainingData);
    
    res.status(200).json({
      success: true,
      message: 'ML model trained successfully',
      data: { modelVersionId }
    });
  } catch (error) {
    logger.error(`Error in trainMLModel: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to train ML model: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Predict prompt success
 */
export async function predictPromptSuccess(req: Request, res: Response): Promise<void> {
  try {
    const { promptId } = req.params;
    
    if (!promptId) {
      throw new ApiError(400, 'Prompt ID is required');
    }
    
    // Get the prompt
    const prompt = await promptService.getPromptById(promptId);
    
    // Make prediction
    const prediction = await mlService.predictPromptSuccess(
      promptId,
      prompt.content,
      prompt.promptType
    );
    
    res.status(200).json({
      success: true,
      data: prediction
    });
  } catch (error) {
    logger.error(`Error in predictPromptSuccess: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to predict prompt success: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Generate improvement suggestions
 */
export async function generateImprovementSuggestions(req: Request, res: Response): Promise<void> {
  try {
    const { promptId } = req.params;
    
    if (!promptId) {
      throw new ApiError(400, 'Prompt ID is required');
    }
    
    // Get the prompt
    const prompt = await promptService.getPromptById(promptId);
    
    // Generate suggestions
    const suggestions = await mlService.generateImprovementSuggestions(
      promptId,
      prompt.content,
      prompt.promptType
    );
    
    res.status(200).json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    logger.error(`Error in generateImprovementSuggestions: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to generate improvement suggestions: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Apply improvement suggestion
 */
export async function applyImprovementSuggestion(req: Request, res: Response): Promise<void> {
  try {
    const { suggestionId } = req.params;
    
    if (!suggestionId) {
      throw new ApiError(400, 'Suggestion ID is required');
    }
    
    // Apply the suggestion
    const updatedContent = await mlService.applyImprovementSuggestion(suggestionId);
    
    res.status(200).json({
      success: true,
      message: 'Improvement suggestion applied successfully',
      data: { updatedContent }
    });
  } catch (error) {
    logger.error(`Error in applyImprovementSuggestion: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to apply improvement suggestion: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

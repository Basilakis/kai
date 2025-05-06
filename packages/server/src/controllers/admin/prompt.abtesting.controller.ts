/**
 * Admin Prompt A/B Testing Controller
 * 
 * Handles admin operations for prompt A/B testing.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { 
  promptService, 
  ABExperimentData,
  ABVariantData
} from '../../services/ai/promptService';
import { ApiError } from '../../utils/errors';

/**
 * Get all A/B test experiments
 */
export async function getABExperiments(req: Request, res: Response): Promise<void> {
  try {
    const { isActive } = req.query;
    
    const experiments = await promptService.getABExperiments(
      isActive === 'true' ? true : isActive === 'false' ? false : undefined
    );
    
    res.status(200).json({
      success: true,
      data: experiments
    });
  } catch (error) {
    logger.error(`Error in getABExperiments: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to get A/B experiments: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Get A/B test experiment by ID
 */
export async function getABExperimentById(req: Request, res: Response): Promise<void> {
  try {
    const { experimentId } = req.params;
    
    if (!experimentId) {
      throw new ApiError(400, 'Experiment ID is required');
    }
    
    const experiment = await promptService.getABExperimentById(experimentId);
    
    res.status(200).json({
      success: true,
      data: experiment
    });
  } catch (error) {
    logger.error(`Error in getABExperimentById: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to get A/B experiment: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Create A/B test experiment
 */
export async function createABExperiment(req: Request, res: Response): Promise<void> {
  try {
    const experiment = req.body;
    
    if (!experiment || !experiment.name || !experiment.variants || experiment.variants.length < 2) {
      throw new ApiError(400, 'Experiment name and at least two variants are required');
    }
    
    // Validate variants
    for (const variant of experiment.variants) {
      if (!variant.promptId || !variant.variantName) {
        throw new ApiError(400, 'Each variant must have a promptId and variantName');
      }
    }
    
    // Ensure at least one control variant
    if (!experiment.variants.some(v => v.isControl)) {
      experiment.variants[0].isControl = true;
    }
    
    // Set default values
    experiment.isActive = experiment.isActive !== false;
    experiment.trafficAllocation = experiment.trafficAllocation || 100;
    experiment.startDate = experiment.startDate || new Date();
    
    // Set created by from user
    experiment.createdBy = req.user?.id;
    
    const experimentId = await promptService.createABExperiment(experiment);
    
    res.status(201).json({
      success: true,
      message: 'A/B experiment created successfully',
      data: { id: experimentId }
    });
  } catch (error) {
    logger.error(`Error in createABExperiment: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to create A/B experiment: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Update A/B test experiment
 */
export async function updateABExperiment(req: Request, res: Response): Promise<void> {
  try {
    const { experimentId } = req.params;
    const experiment = req.body;
    
    if (!experimentId) {
      throw new ApiError(400, 'Experiment ID is required');
    }
    
    const success = await promptService.updateABExperiment(experimentId, experiment);
    
    if (!success) {
      throw new ApiError(404, 'Experiment not found or update failed');
    }
    
    res.status(200).json({
      success: true,
      message: 'A/B experiment updated successfully'
    });
  } catch (error) {
    logger.error(`Error in updateABExperiment: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to update A/B experiment: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * End A/B test experiment
 */
export async function endABExperiment(req: Request, res: Response): Promise<void> {
  try {
    const { experimentId } = req.params;
    
    if (!experimentId) {
      throw new ApiError(400, 'Experiment ID is required');
    }
    
    const success = await promptService.updateABExperiment(experimentId, {
      isActive: false,
      endDate: new Date()
    });
    
    if (!success) {
      throw new ApiError(404, 'Experiment not found or update failed');
    }
    
    res.status(200).json({
      success: true,
      message: 'A/B experiment ended successfully'
    });
  } catch (error) {
    logger.error(`Error in endABExperiment: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to end A/B experiment: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Get experiment results
 */
export async function getExperimentResults(req: Request, res: Response): Promise<void> {
  try {
    const { experimentId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!experimentId) {
      throw new ApiError(400, 'Experiment ID is required');
    }
    
    if (!startDate || !endDate) {
      throw new ApiError(400, 'Start date and end date are required');
    }
    
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ApiError(400, 'Invalid date format');
    }
    
    // Get the experiment to get the variants
    const experiment = await promptService.getABExperimentById(experimentId);
    
    if (!experiment.variants || experiment.variants.length === 0) {
      throw new ApiError(404, 'No variants found for this experiment');
    }
    
    // Get analytics for each variant
    const results = await Promise.all(
      experiment.variants.map(async (variant) => {
        const analytics = await promptService.getPromptUsageAnalytics(
          variant.promptId,
          start,
          end,
          undefined, // No segment filter
          experimentId,
          variant.id
        );
        
        // Calculate success rate
        const totalUses = analytics.reduce((sum, a) => sum + a.totalUses, 0);
        const successfulUses = analytics.reduce((sum, a) => sum + a.successfulUses, 0);
        const successRate = totalUses > 0 ? (successfulUses / totalUses) * 100 : 0;
        
        return {
          variantId: variant.id,
          variantName: variant.variantName,
          promptId: variant.promptId,
          isControl: variant.isControl,
          totalUses,
          successfulUses,
          successRate,
          analytics
        };
      })
    );
    
    res.status(200).json({
      success: true,
      data: {
        experimentId,
        experimentName: experiment.name,
        startDate: experiment.startDate,
        endDate: experiment.endDate,
        isActive: experiment.isActive,
        results
      }
    });
  } catch (error) {
    logger.error(`Error in getExperimentResults: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to get experiment results: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Admin Prompt Statistical Controller
 * 
 * Handles admin operations for prompt statistical analysis.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { PromptStatisticalService } from '../../services/ai/promptStatisticalService';
import { ApiError } from '../../utils/errors';

// Initialize statistical service
const statisticalService = new PromptStatisticalService();

/**
 * Get statistical analyses
 */
export async function getStatisticalAnalyses(req: Request, res: Response): Promise<void> {
  try {
    const { experimentId, segmentId, promptId } = req.query;
    
    const analyses = await statisticalService.getStatisticalAnalyses(
      experimentId as string,
      segmentId as string,
      promptId as string
    );
    
    res.status(200).json({
      success: true,
      data: analyses
    });
  } catch (error) {
    logger.error(`Error in getStatisticalAnalyses: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to get statistical analyses: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Analyze experiment
 */
export async function analyzeExperiment(req: Request, res: Response): Promise<void> {
  try {
    const { experimentId } = req.params;
    const { startDate, endDate } = req.body;
    
    if (!experimentId) {
      throw new ApiError(400, 'Experiment ID is required');
    }
    
    if (!startDate || !endDate) {
      throw new ApiError(400, 'Start date and end date are required');
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ApiError(400, 'Invalid date format');
    }
    
    const results = await statisticalService.analyzeExperiment(experimentId, start, end);
    
    res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error(`Error in analyzeExperiment: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to analyze experiment: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Compare segments
 */
export async function compareSegments(req: Request, res: Response): Promise<void> {
  try {
    const { segmentIds, promptId, startDate, endDate } = req.body;
    
    if (!segmentIds || !Array.isArray(segmentIds) || segmentIds.length < 2) {
      throw new ApiError(400, 'At least two segment IDs are required');
    }
    
    if (!promptId) {
      throw new ApiError(400, 'Prompt ID is required');
    }
    
    if (!startDate || !endDate) {
      throw new ApiError(400, 'Start date and end date are required');
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ApiError(400, 'Invalid date format');
    }
    
    const results = await statisticalService.compareSegments(segmentIds, promptId, start, end);
    
    res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error(`Error in compareSegments: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to compare segments: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

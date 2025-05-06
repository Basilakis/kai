/**
 * Admin Prompt Optimization Controller
 * 
 * Handles admin operations for prompt optimization.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { PromptOptimizationService } from '../../services/ai/promptOptimizationService';
import { ApiError } from '../../utils/errors';

// Initialize optimization service
const optimizationService = new PromptOptimizationService();

/**
 * Get optimization rules
 */
export async function getOptimizationRules(req: Request, res: Response): Promise<void> {
  try {
    const { isActive } = req.query;
    
    const rules = await optimizationService.getOptimizationRules(
      isActive === 'true' ? true : isActive === 'false' ? false : undefined
    );
    
    res.status(200).json({
      success: true,
      data: rules
    });
  } catch (error) {
    logger.error(`Error in getOptimizationRules: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to get optimization rules: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Create optimization rule
 */
export async function createOptimizationRule(req: Request, res: Response): Promise<void> {
  try {
    const rule = req.body;
    
    if (!rule || !rule.name || !rule.ruleType || !rule.ruleParameters) {
      throw new ApiError(400, 'Rule name, type, and parameters are required');
    }
    
    // Set created by from user
    rule.createdBy = req.user?.id;
    
    const ruleId = await optimizationService.createOptimizationRule(rule);
    
    res.status(201).json({
      success: true,
      message: 'Optimization rule created successfully',
      data: { id: ruleId }
    });
  } catch (error) {
    logger.error(`Error in createOptimizationRule: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to create optimization rule: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Get optimization actions
 */
export async function getOptimizationActions(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.query;
    
    const actions = await optimizationService.getOptimizationActions(status as string);
    
    res.status(200).json({
      success: true,
      data: actions
    });
  } catch (error) {
    logger.error(`Error in getOptimizationActions: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to get optimization actions: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Execute optimization rules
 */
export async function executeOptimizationRules(req: Request, res: Response): Promise<void> {
  try {
    const actionsCreated = await optimizationService.executeOptimizationRules();
    
    res.status(200).json({
      success: true,
      message: `Successfully executed optimization rules`,
      data: { actionsCreated }
    });
  } catch (error) {
    logger.error(`Error in executeOptimizationRules: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to execute optimization rules: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Execute pending actions
 */
export async function executePendingActions(req: Request, res: Response): Promise<void> {
  try {
    const actionsExecuted = await optimizationService.executePendingActions();
    
    res.status(200).json({
      success: true,
      message: `Successfully executed pending actions`,
      data: { actionsExecuted }
    });
  } catch (error) {
    logger.error(`Error in executePendingActions: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to execute pending actions: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

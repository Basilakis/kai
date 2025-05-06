/**
 * Admin Prompt Controller
 *
 * Handles admin operations for system prompts.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import {
  promptService,
  PromptType,
  PromptData,
  PromptVersionData,
  PromptSuccessData
} from '../../services/ai/promptService';
import { ApiError } from '../../utils/errors';

/**
 * Get all system prompts
 */
export async function getAllSystemPrompts(req: Request, res: Response): Promise<void> {
  try {
    const promptType = req.query.type as PromptType | undefined;
    const prompts = await promptService.getAllPrompts(promptType);

    res.status(200).json({
      success: true,
      data: prompts
    });
  } catch (error) {
    logger.error(`Error in getAllSystemPrompts: ${error}`);
    res.status(500).json({
      success: false,
      message: `Failed to get system prompts: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

/**
 * Get system prompt by ID
 */
export async function getSystemPromptById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      throw new ApiError(400, 'Prompt ID is required');
    }

    const prompt = await promptService.getPromptById(id);

    res.status(200).json({
      success: true,
      data: prompt
    });
  } catch (error) {
    logger.error(`Error in getSystemPromptById: ${error}`);

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to get system prompt: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Create a new system prompt
 */
export async function createSystemPrompt(req: Request, res: Response): Promise<void> {
  try {
    const promptData = req.body as Omit<PromptData, 'id' | 'createdAt' | 'updatedAt'>;

    // Basic validation
    if (!promptData || !promptData.name || !promptData.promptType || !promptData.content || !promptData.location) {
      throw new ApiError(400, 'Missing required prompt fields (name, promptType, content, location)');
    }

    // Set created by
    promptData.createdBy = req.user?.id;

    const promptId = await promptService.createPrompt(promptData);

    res.status(201).json({
      success: true,
      message: 'System prompt created successfully',
      data: { id: promptId }
    });
  } catch (error) {
    logger.error(`Error in createSystemPrompt: ${error}`);

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to create system prompt: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Update a system prompt
 */
export async function updateSystemPrompt(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const promptUpdates = req.body as Partial<Omit<PromptData, 'id' | 'createdAt' | 'updatedAt'>>;

    if (!id) {
      throw new ApiError(400, 'Prompt ID is required');
    }

    if (!promptUpdates || Object.keys(promptUpdates).length === 0) {
      throw new ApiError(400, 'No update data provided');
    }

    const success = await promptService.updatePrompt(id, promptUpdates);

    if (!success) {
      throw new ApiError(404, 'System prompt not found or update failed');
    }

    res.status(200).json({
      success: true,
      message: 'System prompt updated successfully'
    });
  } catch (error) {
    logger.error(`Error in updateSystemPrompt: ${error}`);

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to update system prompt: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Delete a system prompt
 */
export async function deleteSystemPrompt(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      throw new ApiError(400, 'Prompt ID is required');
    }

    const success = await promptService.deletePrompt(id);

    if (!success) {
      throw new ApiError(404, 'System prompt not found or delete failed');
    }

    res.status(200).json({
      success: true,
      message: 'System prompt deleted successfully'
    });
  } catch (error) {
    logger.error(`Error in deleteSystemPrompt: ${error}`);

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to delete system prompt: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Get all versions of a system prompt
 */
export async function getSystemPromptVersions(req: Request, res: Response): Promise<void> {
  try {
    const { promptId } = req.params;

    if (!promptId) {
      throw new ApiError(400, 'Prompt ID is required');
    }

    const versions = await promptService.getPromptVersions(promptId);

    res.status(200).json({
      success: true,
      data: versions
    });
  } catch (error) {
    logger.error(`Error in getSystemPromptVersions: ${error}`);

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to get prompt versions: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Get a specific version of a system prompt
 */
export async function getSystemPromptVersion(req: Request, res: Response): Promise<void> {
  try {
    const { promptId, versionNumber } = req.params;

    if (!promptId) {
      throw new ApiError(400, 'Prompt ID is required');
    }

    if (!versionNumber || isNaN(parseInt(versionNumber))) {
      throw new ApiError(400, 'Valid version number is required');
    }

    const version = await promptService.getPromptVersion(promptId, parseInt(versionNumber));

    if (!version) {
      throw new ApiError(404, `Version ${versionNumber} not found for prompt ${promptId}`);
    }

    res.status(200).json({
      success: true,
      data: version
    });
  } catch (error) {
    logger.error(`Error in getSystemPromptVersion: ${error}`);

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to get prompt version: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Revert to a previous version of a system prompt
 */
export async function revertToPromptVersion(req: Request, res: Response): Promise<void> {
  try {
    const { promptId, versionNumber } = req.params;

    if (!promptId) {
      throw new ApiError(400, 'Prompt ID is required');
    }

    if (!versionNumber || isNaN(parseInt(versionNumber))) {
      throw new ApiError(400, 'Valid version number is required');
    }

    const success = await promptService.revertToVersion(promptId, parseInt(versionNumber));

    if (!success) {
      throw new ApiError(404, `Failed to revert to version ${versionNumber} for prompt ${promptId}`);
    }

    res.status(200).json({
      success: true,
      message: `Successfully reverted to version ${versionNumber}`
    });
  } catch (error) {
    logger.error(`Error in revertToPromptVersion: ${error}`);

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to revert to version: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Get success rate for a system prompt
 */
export async function getPromptSuccessRate(req: Request, res: Response): Promise<void> {
  try {
    const { promptId } = req.params;

    if (!promptId) {
      throw new ApiError(400, 'Prompt ID is required');
    }

    const successRate = await promptService.getPromptSuccessRate(promptId);

    res.status(200).json({
      success: true,
      data: { successRate }
    });
  } catch (error) {
    logger.error(`Error in getPromptSuccessRate: ${error}`);

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to get success rate: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Get success rate for a specific version of a system prompt
 */
export async function getPromptVersionSuccessRate(req: Request, res: Response): Promise<void> {
  try {
    const { promptId, versionNumber } = req.params;

    if (!promptId) {
      throw new ApiError(400, 'Prompt ID is required');
    }

    if (!versionNumber || isNaN(parseInt(versionNumber))) {
      throw new ApiError(400, 'Valid version number is required');
    }

    const successRate = await promptService.getPromptVersionSuccessRate(promptId, parseInt(versionNumber));

    res.status(200).json({
      success: true,
      data: { successRate }
    });
  } catch (error) {
    logger.error(`Error in getPromptVersionSuccessRate: ${error}`);

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to get version success rate: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Update prompt success tracking
 */
export async function updatePromptSuccessTracking(req: Request, res: Response): Promise<void> {
  try {
    const { trackingId } = req.params;
    const { isSuccessful, feedback } = req.body;

    if (!trackingId) {
      throw new ApiError(400, 'Tracking ID is required');
    }

    if (isSuccessful === undefined) {
      throw new ApiError(400, 'Success status is required');
    }

    const success = await promptService.updatePromptTrackingRecord(trackingId, isSuccessful, feedback);

    if (!success) {
      throw new ApiError(404, `Tracking record ${trackingId} not found or update failed`);
    }

    res.status(200).json({
      success: true,
      message: 'Prompt success tracking updated successfully'
    });
  } catch (error) {
    logger.error(`Error in updatePromptSuccessTracking: ${error}`);

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to update success tracking: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

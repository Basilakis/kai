/**
 * Admin Prompt Segmentation Controller
 * 
 * Handles admin operations for user segmentation.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { 
  promptService, 
  UserSegmentData
} from '../../services/ai/promptService';
import { ApiError } from '../../utils/errors';

/**
 * Get all user segments
 */
export async function getUserSegments(req: Request, res: Response): Promise<void> {
  try {
    const { isActive } = req.query;
    
    const segments = await promptService.getUserSegments(
      isActive === 'true' ? true : isActive === 'false' ? false : undefined
    );
    
    res.status(200).json({
      success: true,
      data: segments
    });
  } catch (error) {
    logger.error(`Error in getUserSegments: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to get user segments: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Create user segment
 */
export async function createUserSegment(req: Request, res: Response): Promise<void> {
  try {
    const segment = req.body;
    
    if (!segment || !segment.name || !segment.segmentType || !segment.segmentCriteria) {
      throw new ApiError(400, 'Segment name, type, and criteria are required');
    }
    
    // Set default values
    segment.isActive = segment.isActive !== false;
    
    // Set created by from user
    segment.createdBy = req.user?.id;
    
    const segmentId = await promptService.createUserSegment(segment);
    
    res.status(201).json({
      success: true,
      message: 'User segment created successfully',
      data: { id: segmentId }
    });
  } catch (error) {
    logger.error(`Error in createUserSegment: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to create user segment: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Update user segment
 */
export async function updateUserSegment(req: Request, res: Response): Promise<void> {
  try {
    const { segmentId } = req.params;
    const segment = req.body;
    
    if (!segmentId) {
      throw new ApiError(400, 'Segment ID is required');
    }
    
    // Update the segment
    const { data, error } = await promptService.supabaseClient.getClient()
      .from('user_segments')
      .update({
        name: segment.name,
        description: segment.description,
        segment_type: segment.segmentType,
        segment_criteria: segment.segmentCriteria,
        is_active: segment.isActive,
        updated_at: new Date()
      })
      .eq('id', segmentId);
    
    if (error) {
      throw new Error(`Failed to update user segment: ${error.message}`);
    }
    
    res.status(200).json({
      success: true,
      message: 'User segment updated successfully'
    });
  } catch (error) {
    logger.error(`Error in updateUserSegment: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to update user segment: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Delete user segment
 */
export async function deleteUserSegment(req: Request, res: Response): Promise<void> {
  try {
    const { segmentId } = req.params;
    
    if (!segmentId) {
      throw new ApiError(400, 'Segment ID is required');
    }
    
    // Delete the segment
    const { error } = await promptService.supabaseClient.getClient()
      .from('user_segments')
      .delete()
      .eq('id', segmentId);
    
    if (error) {
      throw new Error(`Failed to delete user segment: ${error.message}`);
    }
    
    res.status(200).json({
      success: true,
      message: 'User segment deleted successfully'
    });
  } catch (error) {
    logger.error(`Error in deleteUserSegment: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to delete user segment: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Get segment analytics
 */
export async function getSegmentAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const { segmentId } = req.params;
    const { startDate, endDate, promptId } = req.query;
    
    if (!segmentId) {
      throw new ApiError(400, 'Segment ID is required');
    }
    
    if (!startDate || !endDate) {
      throw new ApiError(400, 'Start date and end date are required');
    }
    
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ApiError(400, 'Invalid date format');
    }
    
    // Get analytics for the segment
    const analytics = await promptService.getPromptUsageAnalytics(
      promptId as string,
      start,
      end,
      segmentId
    );
    
    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error(`Error in getSegmentAnalytics: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to get segment analytics: ${error instanceof Error ? error.message : String(error)}`
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
    
    // Get analytics for each segment
    const results = await Promise.all(
      segmentIds.map(async (segmentId) => {
        const analytics = await promptService.getPromptUsageAnalytics(
          promptId,
          start,
          end,
          segmentId
        );
        
        // Calculate success rate
        const totalUses = analytics.reduce((sum, a) => sum + a.totalUses, 0);
        const successfulUses = analytics.reduce((sum, a) => sum + a.successfulUses, 0);
        const successRate = totalUses > 0 ? (successfulUses / totalUses) * 100 : 0;
        
        // Get segment info
        const { data: segmentData, error } = await promptService.supabaseClient.getClient()
          .from('user_segments')
          .select('name')
          .eq('id', segmentId)
          .single();
        
        if (error) {
          throw new Error(`Failed to get segment info: ${error.message}`);
        }
        
        return {
          segmentId,
          segmentName: segmentData.name,
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
        promptId,
        startDate: start,
        endDate: end,
        results
      }
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

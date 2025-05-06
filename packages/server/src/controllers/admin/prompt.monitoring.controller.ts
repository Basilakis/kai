/**
 * Admin Prompt Monitoring Controller
 * 
 * Handles admin operations for prompt monitoring and analytics.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { 
  promptService, 
  AlertType,
  PromptUsageAnalytics,
  PromptMonitoringAlert,
  PromptMonitoringSetting
} from '../../services/ai/promptService';
import { ApiError } from '../../utils/errors';

/**
 * Get prompt usage analytics
 */
export async function getPromptUsageAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const { promptId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!promptId) {
      throw new ApiError(400, 'Prompt ID is required');
    }
    
    if (!startDate || !endDate) {
      throw new ApiError(400, 'Start date and end date are required');
    }
    
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ApiError(400, 'Invalid date format');
    }
    
    const analytics = await promptService.getPromptUsageAnalytics(promptId, start, end);
    
    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error(`Error in getPromptUsageAnalytics: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to get prompt usage analytics: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Get active monitoring alerts
 */
export async function getActiveMonitoringAlerts(req: Request, res: Response): Promise<void> {
  try {
    const { promptId } = req.query;
    
    const alerts = await promptService.getActiveMonitoringAlerts(promptId as string);
    
    res.status(200).json({
      success: true,
      data: alerts
    });
  } catch (error) {
    logger.error(`Error in getActiveMonitoringAlerts: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to get active monitoring alerts: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Resolve a monitoring alert
 */
export async function resolveMonitoringAlert(req: Request, res: Response): Promise<void> {
  try {
    const { alertId } = req.params;
    
    if (!alertId) {
      throw new ApiError(400, 'Alert ID is required');
    }
    
    const success = await promptService.resolveMonitoringAlert(alertId);
    
    if (!success) {
      throw new ApiError(404, 'Alert not found or already resolved');
    }
    
    res.status(200).json({
      success: true,
      message: 'Alert resolved successfully'
    });
  } catch (error) {
    logger.error(`Error in resolveMonitoringAlert: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to resolve alert: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Save monitoring setting
 */
export async function saveMonitoringSetting(req: Request, res: Response): Promise<void> {
  try {
    const { promptId } = req.params;
    const setting = req.body;
    
    if (!promptId) {
      throw new ApiError(400, 'Prompt ID is required');
    }
    
    if (!setting || !setting.settingType || setting.threshold === undefined) {
      throw new ApiError(400, 'Setting type and threshold are required');
    }
    
    // Validate setting type
    if (!Object.values(AlertType).includes(setting.settingType)) {
      throw new ApiError(400, `Invalid setting type. Must be one of: ${Object.values(AlertType).join(', ')}`);
    }
    
    const settingId = await promptService.saveMonitoringSetting({
      promptId,
      settingType: setting.settingType,
      threshold: setting.threshold,
      isActive: setting.isActive !== false, // Default to true
      notificationEmail: setting.notificationEmail
    });
    
    res.status(200).json({
      success: true,
      message: 'Monitoring setting saved successfully',
      data: { id: settingId }
    });
  } catch (error) {
    logger.error(`Error in saveMonitoringSetting: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to save monitoring setting: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Submit feedback for a prompt
 */
export async function submitPromptFeedback(req: Request, res: Response): Promise<void> {
  try {
    const { trackingId } = req.params;
    const { 
      isSuccessful, 
      feedback, 
      feedbackRating, 
      feedbackCategory,
      feedbackTags,
      responseTimeMs
    } = req.body;
    
    if (!trackingId) {
      throw new ApiError(400, 'Tracking ID is required');
    }
    
    if (isSuccessful === undefined) {
      throw new ApiError(400, 'Success status is required');
    }
    
    // Validate rating if provided
    if (feedbackRating !== undefined && (feedbackRating < 1 || feedbackRating > 5)) {
      throw new ApiError(400, 'Feedback rating must be between 1 and 5');
    }
    
    const success = await promptService.updatePromptTrackingRecord(trackingId, {
      isSuccessful,
      feedback,
      feedbackRating,
      feedbackCategory,
      feedbackTags,
      responseTimeMs,
      autoDetected: false
    });
    
    if (!success) {
      throw new ApiError(404, 'Tracking record not found or update failed');
    }
    
    res.status(200).json({
      success: true,
      message: 'Feedback submitted successfully'
    });
  } catch (error) {
    logger.error(`Error in submitPromptFeedback: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to submit feedback: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Auto-detect prompt success based on user behavior
 */
export async function autoDetectPromptSuccess(req: Request, res: Response): Promise<void> {
  try {
    const { trackingId } = req.params;
    const { responseTimeMs, userActions } = req.body;
    
    if (!trackingId) {
      throw new ApiError(400, 'Tracking ID is required');
    }
    
    if (!responseTimeMs) {
      throw new ApiError(400, 'Response time is required');
    }
    
    if (!userActions) {
      throw new ApiError(400, 'User actions are required');
    }
    
    const success = await promptService.autoDetectPromptSuccess(
      trackingId,
      responseTimeMs,
      userActions
    );
    
    if (!success) {
      throw new ApiError(404, 'Tracking record not found or update failed');
    }
    
    res.status(200).json({
      success: true,
      message: 'Success detection completed'
    });
  } catch (error) {
    logger.error(`Error in autoDetectPromptSuccess: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to detect success: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

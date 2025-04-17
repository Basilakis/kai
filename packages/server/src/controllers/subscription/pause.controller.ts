/**
 * Subscription Pause Controller
 * 
 * This controller handles API endpoints for pausing and resuming subscriptions,
 * including scheduling future resumption.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { ApiError } from '../../middleware/error.middleware';
import pauseManager from '../../services/subscription/pauseManager.service';
import { getUserSubscription } from '../../models/userSubscription.model';

/**
 * Pause a subscription
 * @route POST /api/subscriptions/pause
 * @access Private
 */
export const pauseSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { resumeAt, reason } = req.body;
    
    // Get current subscription
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      throw new ApiError(404, 'You do not have an active subscription');
    }
    
    if (subscription.status === 'paused') {
      throw new ApiError(400, 'Your subscription is already paused');
    }
    
    // Parse resumeAt date if provided
    let resumeDate: Date | undefined;
    if (resumeAt) {
      resumeDate = new Date(resumeAt);
      
      // Validate resumeAt date
      const now = new Date();
      const maxResumeDate = new Date();
      maxResumeDate.setMonth(maxResumeDate.getMonth() + 3); // Max 3 months in the future
      
      if (resumeDate <= now) {
        throw new ApiError(400, 'Resume date must be in the future');
      }
      
      if (resumeDate > maxResumeDate) {
        throw new ApiError(400, 'Resume date cannot be more than 3 months in the future');
      }
    }
    
    // Pause the subscription
    const result = await pauseManager.pauseSubscription(userId, {
      resumeAt: resumeDate,
      reason,
      metadata: {
        pausedBy: 'user',
        pausedFrom: req.headers['user-agent']
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Subscription paused successfully',
      data: {
        status: result.subscription.status,
        pausedAt: result.subscription.metadata?.pausedAt,
        scheduledResumeAt: result.subscription.metadata?.scheduledResumeAt
      }
    });
  } catch (error) {
    logger.error(`Error pausing subscription: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to pause subscription');
  }
};

/**
 * Resume a paused subscription
 * @route POST /api/subscriptions/resume
 * @access Private
 */
export const resumeSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // Get current subscription
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      throw new ApiError(404, 'You do not have an active subscription');
    }
    
    if (subscription.status !== 'paused') {
      throw new ApiError(400, 'Your subscription is not paused');
    }
    
    // Resume the subscription
    const result = await pauseManager.resumeSubscription(userId, {
      resumedBy: 'user',
      resumedFrom: req.headers['user-agent']
    });
    
    res.status(200).json({
      success: true,
      message: 'Subscription resumed successfully',
      data: {
        status: result.subscription.status,
        resumedAt: result.subscription.metadata?.resumedAt,
        pauseDuration: result.subscription.metadata?.pauseDuration
      }
    });
  } catch (error) {
    logger.error(`Error resuming subscription: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to resume subscription');
  }
};

/**
 * Update pause settings for a subscription
 * @route PUT /api/subscriptions/pause
 * @access Private
 */
export const updatePauseSettings = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { resumeAt } = req.body;
    
    if (!resumeAt) {
      throw new ApiError(400, 'Resume date is required');
    }
    
    // Get current subscription
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      throw new ApiError(404, 'You do not have an active subscription');
    }
    
    if (subscription.status !== 'paused') {
      throw new ApiError(400, 'Your subscription is not paused');
    }
    
    // Parse resumeAt date
    const resumeDate = new Date(resumeAt);
    
    // Validate resumeAt date
    const now = new Date();
    const maxResumeDate = new Date();
    maxResumeDate.setMonth(maxResumeDate.getMonth() + 3); // Max 3 months in the future
    
    if (resumeDate <= now) {
      throw new ApiError(400, 'Resume date must be in the future');
    }
    
    if (resumeDate > maxResumeDate) {
      throw new ApiError(400, 'Resume date cannot be more than 3 months in the future');
    }
    
    // Update the subscription metadata
    const { data, error } = await supabaseClient.getClient()
      .from('user_subscriptions')
      .update({
        metadata: {
          ...subscription.metadata,
          scheduledResumeAt: resumeDate.toISOString(),
          updatedAt: new Date().toISOString()
        }
      })
      .eq('id', subscription.id)
      .select();
    
    if (error) {
      throw error;
    }
    
    res.status(200).json({
      success: true,
      message: 'Pause settings updated successfully',
      data: {
        scheduledResumeAt: data[0].metadata?.scheduledResumeAt
      }
    });
  } catch (error) {
    logger.error(`Error updating pause settings: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to update pause settings');
  }
};

/**
 * Get pause history for a subscription
 * @route GET /api/subscriptions/pause/history
 * @access Private
 */
export const getPauseHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // Get pause history
    const history = await pauseManager.getPauseHistory(userId);
    
    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error(`Error getting pause history: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to get pause history');
  }
};

export default {
  pauseSubscription,
  resumeSubscription,
  updatePauseSettings,
  getPauseHistory
};

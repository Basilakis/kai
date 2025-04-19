/**
 * Notification Controller
 * 
 * This controller handles API endpoints for managing notifications,
 * including user preferences and in-app notifications.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { ApiError } from '../../middleware/error.middleware';
import { supabaseClient } from '../../services/supabase/supabaseClient';
import { notificationService } from '../../services/messaging/notificationService';
import { eventNotificationService, EventType } from '../../services/messaging/eventNotificationService';

/**
 * Get notification preferences for the current user
 * @param req Request
 * @param res Response
 */
export async function getNotificationPreferences(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    
    const preferences = await notificationService.getUserNotificationPreferences(userId);
    
    res.status(200).json({
      success: true,
      data: preferences
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      logger.error(`Error in getNotificationPreferences: ${error}`);
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred'
      });
    }
  }
}

/**
 * Update notification preferences for the current user
 * @param req Request
 * @param res Response
 */
export async function updateNotificationPreferences(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    
    const preferences = req.body;
    
    // Validate preferences
    if (!preferences || typeof preferences !== 'object') {
      throw new ApiError(400, 'Invalid preferences format');
    }
    
    const success = await notificationService.updateUserNotificationPreferences(userId, preferences);
    
    if (!success) {
      throw new ApiError(500, 'Failed to update notification preferences');
    }
    
    res.status(200).json({
      success: true,
      message: 'Notification preferences updated successfully'
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      logger.error(`Error in updateNotificationPreferences: ${error}`);
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred'
      });
    }
  }
}

/**
 * Get in-app notifications for the current user
 * @param req Request
 * @param res Response
 */
export async function getInAppNotifications(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const unreadOnly = req.query.unreadOnly === 'true';
    
    // Calculate offset
    const offset = (page - 1) * limit;
    
    // Build query
    let query = supabaseClient.getClient()
      .from('notifications')
      .select('*, count()') // Explicitly select count along with data
      .eq('user_id', userId);
    
    if (unreadOnly) {
      query = query.eq('is_read', false);
    }
    
    // Add pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Execute query
    const { data, error, count } = await query;
    
    if (error) {
      throw new ApiError(500, `Failed to get notifications: ${error.message}`);
    }
    
    res.status(200).json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: count ? Math.ceil(count / limit) : 0
      }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      logger.error(`Error in getInAppNotifications: ${error}`);
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred'
      });
    }
  }
}

/**
 * Mark in-app notifications as read
 * @param req Request
 * @param res Response
 */
export async function markNotificationsAsRead(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    
    const { ids } = req.body;
    
    // Validate IDs
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'Invalid notification IDs');
    }
    
    // Update notifications
    const { error } = await supabaseClient.getClient()
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .in('id', ids);
    
    if (error) {
      throw new ApiError(500, `Failed to mark notifications as read: ${error.message}`);
    }
    
    res.status(200).json({
      success: true,
      message: 'Notifications marked as read successfully'
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      logger.error(`Error in markNotificationsAsRead: ${error}`);
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred'
      });
    }
  }
}

/**
 * Mark all in-app notifications as read
 * @param req Request
 * @param res Response
 */
export async function markAllNotificationsAsRead(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    
    // Update all notifications
    const { error } = await supabaseClient.getClient()
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    
    if (error) {
      throw new ApiError(500, `Failed to mark all notifications as read: ${error.message}`);
    }
    
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read successfully'
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      logger.error(`Error in markAllNotificationsAsRead: ${error}`);
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred'
      });
    }
  }
}

/**
 * Delete in-app notifications
 * @param req Request
 * @param res Response
 */
export async function deleteNotifications(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    
    const { ids } = req.body;
    
    // Validate IDs
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'Invalid notification IDs');
    }
    
    // Delete notifications
    const { error } = await supabaseClient.getClient()
      .from('notifications')
      .delete()
      .eq('user_id', userId)
      .in('id', ids);
    
    if (error) {
      throw new ApiError(500, `Failed to delete notifications: ${error.message}`);
    }
    
    res.status(200).json({
      success: true,
      message: 'Notifications deleted successfully'
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      logger.error(`Error in deleteNotifications: ${error}`);
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred'
      });
    }
  }
}

/**
 * Get unread notification count
 * @param req Request
 * @param res Response
 */
export async function getUnreadNotificationCount(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    
    // Count unread notifications
    // Explicitly select only count when head: true is used
    const { count, error } = await supabaseClient.getClient()
      .from('notifications')
      .select('count()', { count: 'exact', head: true }) 
      .eq('user_id', userId)
      .eq('is_read', false);
    
    if (error) {
      throw new ApiError(500, `Failed to get unread notification count: ${error.message}`);
    }
    
    res.status(200).json({
      success: true,
      data: { count: count || 0 }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      logger.error(`Error in getUnreadNotificationCount: ${error}`);
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred'
      });
    }
  }
}

/**
 * Send a test notification
 * @param req Request
 * @param res Response
 */
export async function sendTestNotification(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    
    const { type } = req.body;
    
    // Validate notification type
    if (!type || !['email', 'sms', 'in_app'].includes(type)) {
      throw new ApiError(400, 'Invalid notification type');
    }
    
    // Use authenticated user details from req.user populated by authMiddleware
    const user = req.user; 
    
    // Send test notification based on type
    switch (type) {
      case 'email':
        // Check if email exists on the authenticated user object
        if (!user.email) {
          throw new ApiError(400, 'Authenticated user has no email address associated.');
        }
        
        await notificationService.sendEmail({
          to: user.email, // Use email from req.user
          subject: 'Test Notification',
          text: 'This is a test notification from the KAI platform.',
          html: '<p>This is a test notification from the KAI platform.</p>',
          userId
        });
        break;
        
      case 'sms':
        // Check if phone exists on the authenticated user object
        // Note: Supabase JWT might not include phone by default. Add check.
        // Assuming req.user might have a 'phone' property similar to 'email'.
        // If 'phone' is not reliably available, this test might need adjustment.
        // @ts-ignore - Allow potential access to phone if it exists
        const userPhone = user.phone; 
        
        if (!userPhone) {
          throw new ApiError(400, 'Authenticated user has no phone number associated or it is not included in the token.');
        }
        
        await notificationService.sendSMS({
          to: userPhone, // Use phone from req.user if available
          message: 'This is a test notification from the KAI platform.',
          userId
        });
        break;
        
      case 'in_app':
        await notificationService.sendInAppNotification({
          userId,
          title: 'Test Notification',
          message: 'This is a test notification from the KAI platform.',
          type: 'info'
        });
        break;
    }
    
    res.status(200).json({
      success: true,
      message: `Test ${type} notification sent successfully`
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      logger.error(`Error in sendTestNotification: ${error}`);
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred'
      });
    }
  }
}

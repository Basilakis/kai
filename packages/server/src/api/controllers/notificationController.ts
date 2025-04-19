/**
 * Notification Controller
 * 
 * This controller handles notification-related operations, including:
 * - Sending notifications
 * - Managing notification preferences
 * - Retrieving notification history
 * - Managing notification templates
 */

import { Request, Response } from 'express';
import { supabaseClient } from '../../services/supabase/supabaseClient';
import { notificationService, NotificationType } from '../../services/messaging/notificationService';
import { logger } from '../../utils/logger';

/**
 * Notification controller
 */
class NotificationController {
  /**
   * Get notification preferences for the authenticated user
   * @param req Express request
   * @param res Express response
   */
  public async getNotificationPreferences(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }
      
      // Get notification preferences from the database
      const { data, error } = await supabaseClient.getClient()
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw error;
      }
      
      // If no preferences exist, return default preferences
      if (!data) {
        const defaultPreferences = {
          email_enabled: true,
          sms_enabled: true,
          push_enabled: true,
          in_app_enabled: true,
          marketing_enabled: true,
          transaction_enabled: true,
          social_enabled: true,
          security_enabled: true
        };
        
        return res.json({
          success: true,
          data: defaultPreferences
        });
      }
      
      return res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error(`Error getting notification preferences: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to get notification preferences'
      });
    }
  }
  
  /**
   * Update notification preferences for the authenticated user
   * @param req Express request
   * @param res Express response
   */
  public async updateNotificationPreferences(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }
      
      const preferences = req.body;
      
      // Check if preferences exist
      const { data: existingPreferences, error: checkError } = await supabaseClient.getClient()
        .from('notification_preferences')
        .select('id')
        .eq('user_id', userId)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      
      if (existingPreferences) {
        // Update existing preferences
        const { error } = await supabaseClient.getClient()
          .from('notification_preferences')
          .update({
            ...preferences,
            updated_at: new Date()
          })
          .eq('user_id', userId);
        
        if (error) {
          throw error;
        }
      } else {
        // Create new preferences
        const { error } = await supabaseClient.getClient()
          .from('notification_preferences')
          .insert([{
            user_id: userId,
            ...preferences
          }]);
        
        if (error) {
          throw error;
        }
      }
      
      return res.json({
        success: true,
        message: 'Notification preferences updated successfully'
      });
    } catch (error) {
      logger.error(`Error updating notification preferences: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to update notification preferences'
      });
    }
  }
  
  /**
   * Get notifications for the authenticated user
   * @param req Express request
   * @param res Express response
   */
  public async getUserNotifications(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }
      
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const type = req.query.type as string;
      
      // Build query
      let query = supabaseClient.getClient()
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1);
      
      // Add type filter if provided
      if (type) {
        query = query.eq('type', type);
      }
      
      // Execute query
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      // Get total count
      const { count, error: countError } = await supabaseClient.getClient()
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      if (countError) {
        throw countError;
      }
      
      return res.json({
        success: true,
        data,
        pagination: {
          total: count,
          limit,
          offset
        }
      });
    } catch (error) {
      logger.error(`Error getting user notifications: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to get notifications'
      });
    }
  }
  
  /**
   * Mark notifications as read
   * @param req Express request
   * @param res Express response
   */
  public async markNotificationsAsRead(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }
      
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No notification IDs provided'
        });
      }
      
      // Update notifications
      const { error } = await supabaseClient.getClient()
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .in('id', ids);
      
      if (error) {
        throw error;
      }
      
      return res.json({
        success: true,
        message: 'Notifications marked as read'
      });
    } catch (error) {
      logger.error(`Error marking notifications as read: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark notifications as read'
      });
    }
  }
  
  /**
   * Mark all notifications as read
   * @param req Express request
   * @param res Express response
   */
  public async markAllNotificationsAsRead(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }
      
      // Update all notifications
      const { error } = await supabaseClient.getClient()
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      
      if (error) {
        throw error;
      }
      
      return res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      logger.error(`Error marking all notifications as read: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read'
      });
    }
  }
  
  /**
   * Delete notifications
   * @param req Express request
   * @param res Express response
   */
  public async deleteNotifications(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }
      
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No notification IDs provided'
        });
      }
      
      // Delete notifications
      const { error } = await supabaseClient.getClient()
        .from('notifications')
        .delete()
        .eq('user_id', userId)
        .in('id', ids);
      
      if (error) {
        throw error;
      }
      
      return res.json({
        success: true,
        message: 'Notifications deleted'
      });
    } catch (error) {
      logger.error(`Error deleting notifications: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete notifications'
      });
    }
  }
  
  /**
   * Send a test notification
   * @param req Express request
   * @param res Express response
   */
  public async sendTestNotification(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }
      
      const { type } = req.body;
      
      // Get user profile
      const { data: profile, error: profileError } = await supabaseClient.getClient()
        .from('profiles')
        .select('email, phone, expo_push_token')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        throw profileError;
      }
      
      let result;
      
      switch (type) {
        case 'email':
          if (!profile.email) {
            return res.status(400).json({
              success: false,
              message: 'No email address found for this user'
            });
          }
          
          result = await notificationService.sendEmail({
            to: profile.email,
            subject: 'Test Notification',
            text: 'This is a test notification from our platform.',
            html: '<h1>Test Notification</h1><p>This is a test notification from our platform.</p>',
            userId
          });
          break;
          
        case 'sms':
          if (!profile.phone) {
            return res.status(400).json({
              success: false,
              message: 'No phone number found for this user'
            });
          }
          
          result = await notificationService.sendSMS({
            to: profile.phone,
            message: 'This is a test notification from our platform.',
            userId
          });
          break;
          
        case 'push':
          if (!profile.expo_push_token) {
            return res.status(400).json({
              success: false,
              message: 'No push token found for this user'
            });
          }
          
          result = await notificationService.sendPushNotification({
            to: profile.expo_push_token,
            title: 'Test Notification',
            body: 'This is a test notification from our platform.',
            userId
          });
          break;
          
        case 'in_app':
          result = await notificationService.sendInAppNotification({
            userId,
            title: 'Test Notification',
            message: 'This is a test notification from our platform.',
            type: 'info'
          });
          break;
          
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid notification type'
          });
      }
      
      if (!result.success) {
        throw result.error;
      }
      
      return res.json({
        success: true,
        message: `Test ${type} notification sent successfully`
      });
    } catch (error) {
      logger.error(`Error sending test notification: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to send test notification'
      });
    }
  }
  
  /**
   * Send notification to users (admin only)
   * @param req Express request
   * @param res Express response
   */
  public async sendNotification(req: Request, res: Response) {
    try {
      const {
        title,
        message,
        channels,
        recipients,
        userGroups,
        specificUsers,
        templateId,
        schedule,
        scheduledDate,
        scheduledTime
      } = req.body;
      
      // Validate scheduled date and time if scheduling is enabled
      if (schedule) {
        if (!scheduledDate || !scheduledTime) {
          return res.status(400).json({
            success: false,
            message: 'Scheduled date and time are required when scheduling is enabled'
          });
        }
        
        const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
        
        if (isNaN(scheduledDateTime.getTime()) || scheduledDateTime <= new Date()) {
          return res.status(400).json({
            success: false,
            message: 'Invalid scheduled date and time'
          });
        }
      }
      
      // Get target user IDs
      let userIds: string[] = [];
      
      if (recipients === 'all') {
        // Get all user IDs
        const { data, error } = await supabaseClient.getClient()
          .from('profiles')
          .select('id');
        
        if (error) {
          throw error;
        }
        
        userIds = data.map(user => user.id);
      } else if (recipients === 'groups' && userGroups && userGroups.length > 0) {
        // Get user IDs from specified groups
        for (const group of userGroups) {
          let query = supabaseClient.getClient()
            .from('profiles')
            .select('id');
          
          switch (group) {
            case 'all_users':
              // No additional filter needed
              break;
            case 'active_users':
              query = query.eq('is_active', true);
              break;
            case 'inactive_users':
              query = query.eq('is_active', false);
              break;
            case 'free_tier':
              query = query.eq('subscription_tier', 'free');
              break;
            case 'basic_tier':
              query = query.eq('subscription_tier', 'basic');
              break;
            case 'premium_tier':
              query = query.eq('subscription_tier', 'premium');
              break;
            case 'enterprise_tier':
              query = query.eq('subscription_tier', 'enterprise');
              break;
            default:
              // Skip unknown groups
              continue;
          }
          
          const { data, error } = await query;
          
          if (error) {
            throw error;
          }
          
          userIds = [...userIds, ...data.map(user => user.id)];
        }
        
        // Remove duplicates
        userIds = [...new Set(userIds)];
      } else if (recipients === 'specific' && specificUsers) {
        // Parse specific users (comma-separated list of IDs or emails)
        const userIdentifiers = specificUsers.split(',').map(id => id.trim()).filter(Boolean);
        
        for (const identifier of userIdentifiers) {
          // Check if it's an email or UUID
          const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
          
          let query = supabaseClient.getClient()
            .from('profiles')
            .select('id');
          
          if (isEmail) {
            query = query.eq('email', identifier);
          } else {
            query = query.eq('id', identifier);
          }
          
          const { data, error } = await query;
          
          if (error) {
            throw error;
          }
          
          if (data && data.length > 0) {
            userIds.push(data[0].id);
          }
        }
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid recipients configuration'
        });
      }
      
      if (userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No recipients found'
        });
      }
      
      // If scheduling is enabled, create scheduled notification
      if (schedule) {
        const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
        
        // Insert scheduled notification
        const { error } = await supabaseClient.getClient()
          .from('scheduled_notifications')
          .insert([{
            title,
            message,
            channels,
            user_ids: userIds,
            template_id: templateId || null,
            scheduled_at: scheduledDateTime.toISOString(),
            created_by: req.user?.id
          }]);
        
        if (error) {
          throw error;
        }
        
        return res.json({
          success: true,
          message: 'Notification scheduled successfully',
          data: {
            recipientCount: userIds.length,
            scheduledAt: scheduledDateTime.toISOString()
          }
        });
      }
      
      // Send notifications immediately
      const results = [];
      const errors = [];
      
      for (const userId of userIds) {
        try {
          // Send notifications through selected channels
          for (const channel of channels) {
            let result;
            
            switch (channel) {
              case 'email':
                // Get user email
                const { data: emailData, error: emailError } = await supabaseClient.getClient()
                  .from('profiles')
                  .select('email')
                  .eq('id', userId)
                  .single();
                
                if (emailError || !emailData.email) {
                  errors.push({
                    userId,
                    channel,
                    error: emailError?.message || 'No email found'
                  });
                  continue;
                }
                
                result = await notificationService.sendEmail({
                  to: emailData.email,
                  subject: title,
                  text: message,
                  html: `<h1>${title}</h1><p>${message}</p>`,
                  userId
                });
                break;
                
              case 'sms':
                // Get user phone
                const { data: phoneData, error: phoneError } = await supabaseClient.getClient()
                  .from('profiles')
                  .select('phone')
                  .eq('id', userId)
                  .single();
                
                if (phoneError || !phoneData.phone) {
                  errors.push({
                    userId,
                    channel,
                    error: phoneError?.message || 'No phone found'
                  });
                  continue;
                }
                
                result = await notificationService.sendSMS({
                  to: phoneData.phone,
                  message: `${title}: ${message}`,
                  userId
                });
                break;
                
              case 'push':
                // Get user push token
                const { data: pushData, error: pushError } = await supabaseClient.getClient()
                  .from('profiles')
                  .select('expo_push_token')
                  .eq('id', userId)
                  .single();
                
                if (pushError || !pushData.expo_push_token) {
                  errors.push({
                    userId,
                    channel,
                    error: pushError?.message || 'No push token found'
                  });
                  continue;
                }
                
                result = await notificationService.sendPushNotification({
                  to: pushData.expo_push_token,
                  title,
                  body: message,
                  userId
                });
                break;
                
              case 'in_app':
                result = await notificationService.sendInAppNotification({
                  userId,
                  title,
                  message,
                  type: 'info'
                });
                break;
                
              default:
                errors.push({
                  userId,
                  channel,
                  error: 'Invalid channel'
                });
                continue;
            }
            
            if (result.success) {
              results.push({
                userId,
                channel,
                success: true
              });
            } else {
              errors.push({
                userId,
                channel,
                error: result.error?.message || 'Unknown error'
              });
            }
          }
        } catch (error) {
          errors.push({
            userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      return res.json({
        success: true,
        message: 'Notifications sent',
        data: {
          recipientCount: userIds.length,
          successCount: results.length,
          errorCount: errors.length,
          errors: errors.length > 0 ? errors : undefined
        }
      });
    } catch (error) {
      logger.error(`Error sending notification: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to send notification'
      });
    }
  }
  
  /**
   * Get notification templates (admin only)
   * @param req Express request
   * @param res Express response
   */
  public async getNotificationTemplates(req: Request, res: Response) {
    try {
      // Get templates from the database
      const { data, error } = await supabaseClient.getClient()
        .from('notification_templates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      return res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error(`Error getting notification templates: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to get notification templates'
      });
    }
  }
  
  /**
   * Get notification template by ID (admin only)
   * @param req Express request
   * @param res Express response
   */
  public async getNotificationTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      // Get template from the database
      const { data, error } = await supabaseClient.getClient()
        .from('notification_templates')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        throw error;
      }
      
      return res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error(`Error getting notification template: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to get notification template'
      });
    }
  }
  
  /**
   * Create notification template (admin only)
   * @param req Express request
   * @param res Express response
   */
  public async createNotificationTemplate(req: Request, res: Response) {
    try {
      const {
        name,
        description,
        type,
        format,
        content,
        subject,
        variables
      } = req.body;
      
      // Validate template
      if (type === 'email' && !subject) {
        return res.status(400).json({
          success: false,
          message: 'Subject is required for email templates'
        });
      }
      
      // Create template
      const { data, error } = await supabaseClient.getClient()
        .from('notification_templates')
        .insert([{
          name,
          description: description || '',
          type,
          format,
          content,
          subject: subject || null,
          variables: variables || [],
          created_by: req.user?.id
        }])
        .select();
      
      if (error) {
        throw error;
      }
      
      return res.json({
        success: true,
        message: 'Notification template created successfully',
        data: data[0]
      });
    } catch (error) {
      logger.error(`Error creating notification template: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to create notification template'
      });
    }
  }
  
  /**
   * Update notification template (admin only)
   * @param req Express request
   * @param res Express response
   */
  public async updateNotificationTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        type,
        format,
        content,
        subject,
        variables
      } = req.body;
      
      // Validate template
      if (type === 'email' && !subject) {
        return res.status(400).json({
          success: false,
          message: 'Subject is required for email templates'
        });
      }
      
      // Update template
      const { data, error } = await supabaseClient.getClient()
        .from('notification_templates')
        .update({
          name,
          description,
          type,
          format,
          content,
          subject,
          variables,
          updated_at: new Date()
        })
        .eq('id', id)
        .select();
      
      if (error) {
        throw error;
      }
      
      return res.json({
        success: true,
        message: 'Notification template updated successfully',
        data: data[0]
      });
    } catch (error) {
      logger.error(`Error updating notification template: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to update notification template'
      });
    }
  }
  
  /**
   * Delete notification template (admin only)
   * @param req Express request
   * @param res Express response
   */
  public async deleteNotificationTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      // Delete template
      const { error } = await supabaseClient.getClient()
        .from('notification_templates')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      return res.json({
        success: true,
        message: 'Notification template deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting notification template: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete notification template'
      });
    }
  }
  
  /**
   * Get notification stats (admin only)
   * @param req Express request
   * @param res Express response
   */
  public async getNotificationStats(req: Request, res: Response) {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const type = req.query.type as string;
      
      // Build date filter
      let dateFilter = '';
      if (startDate && endDate) {
        dateFilter = `created_at >= '${startDate}' AND created_at <= '${endDate}'`;
      } else if (startDate) {
        dateFilter = `created_at >= '${startDate}'`;
      } else if (endDate) {
        dateFilter = `created_at <= '${endDate}'`;
      }
      
      // Build type filter
      let typeFilter = '';
      if (type) {
        typeFilter = `type = '${type}'`;
      }
      
      // Combine filters
      let whereClause = '';
      if (dateFilter && typeFilter) {
        whereClause = `WHERE ${dateFilter} AND ${typeFilter}`;
      } else if (dateFilter) {
        whereClause = `WHERE ${dateFilter}`;
      } else if (typeFilter) {
        whereClause = `WHERE ${typeFilter}`;
      }
      
      // Get total count
      const { data: totalData, error: totalError } = await supabaseClient.getClient()
        .rpc('get_notification_count', {
          where_clause: whereClause
        });
      
      if (totalError) {
        throw totalError;
      }
      
      // Get counts by type
      const { data: typeData, error: typeError } = await supabaseClient.getClient()
        .rpc('get_notification_count_by_type', {
          where_clause: whereClause
        });
      
      if (typeError) {
        throw typeError;
      }
      
      // Get counts by day
      const { data: dailyData, error: dailyError } = await supabaseClient.getClient()
        .rpc('get_notification_count_by_day', {
          where_clause: whereClause
        });
      
      if (dailyError) {
        throw dailyError;
      }
      
      return res.json({
        success: true,
        data: {
          total: totalData,
          byType: typeData,
          byDay: dailyData
        }
      });
    } catch (error) {
      logger.error(`Error getting notification stats: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to get notification stats'
      });
    }
  }
}

export const notificationController = new NotificationController();

/**
 * Admin Notification Controller
 * 
 * Handles admin-specific API endpoints for managing notification templates
 * and potentially sending broadcast notifications.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { ApiError } from '../../middleware/error.middleware';
import { templateService, TemplateData } from '../../services/messaging/templates/templateService';

/**
 * Get all notification templates
 */
export async function getNotificationTemplates(_req: Request, res: Response): Promise<void> {
  try {
    const templates = await templateService.getAllTemplates();
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    logger.error(`Error in getNotificationTemplates: ${error}`);
    res.status(500).json({ success: false, message: 'Failed to retrieve notification templates' });
  }
}

/**
 * Get a notification template by ID
 */
export async function getNotificationTemplateById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    // In a real implementation, templateService should have a getById method
    // For now, filter from getAllTemplates (inefficient)
    const templates = await templateService.getAllTemplates();
    const template = templates.find(t => t.id === id);

    if (!template) {
      throw new ApiError(404, 'Notification template not found');
    }
    res.status(200).json({ success: true, data: template });
  } catch (error) {
     if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
    } else {
      logger.error(`Error in getNotificationTemplateById: ${error}`);
      res.status(500).json({ success: false, message: 'Failed to retrieve notification template' });
    }
  }
}

/**
 * Create a new notification template
 */
export async function createNotificationTemplate(req: Request, res: Response): Promise<void> {
  try {
    const templateData = req.body as Omit<TemplateData, 'id' | 'createdAt' | 'updatedAt'>;
    
    // Basic validation
    if (!templateData || !templateData.name || !templateData.type || !templateData.format || !templateData.content) {
       throw new ApiError(400, 'Missing required template fields (name, type, format, content)');
    }

    const templateId = await templateService.createTemplate(templateData);
    res.status(201).json({ success: true, message: 'Template created successfully', data: { id: templateId } });
  } catch (error) {
     if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
    } else {
      logger.error(`Error in createNotificationTemplate: ${error}`);
      // Check for specific validation errors from templateService if possible
      res.status(500).json({ success: false, message: `Failed to create template: ${error instanceof Error ? error.message : String(error)}` });
    }
  }
}

/**
 * Update a notification template
 */
export async function updateNotificationTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const templateUpdates = req.body as Partial<Omit<TemplateData, 'id' | 'createdAt' | 'updatedAt'>>;

    if (!id || typeof id !== 'string') {
      throw new ApiError(400, 'Template ID parameter is required');
    }

    if (!templateUpdates || Object.keys(templateUpdates).length === 0) {
       throw new ApiError(400, 'No update data provided');
    }

    const success = await templateService.updateTemplate(id, templateUpdates);
    if (!success) {
       // This might happen if the template doesn't exist, but updateTemplate might throw instead
       throw new ApiError(404, 'Notification template not found or update failed');
    }
    res.status(200).json({ success: true, message: 'Template updated successfully' });
  } catch (error) {
     if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
    } else {
      logger.error(`Error in updateNotificationTemplate: ${error}`);
      res.status(500).json({ success: false, message: `Failed to update template: ${error instanceof Error ? error.message : String(error)}` });
    }
  }
}

/**
 * Delete a notification template
 */
export async function deleteNotificationTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      throw new ApiError(400, 'Template ID parameter is required');
    }

    const success = await templateService.deleteTemplate(id);
     if (!success) {
       // This might happen if the template doesn't exist, but deleteTemplate might throw instead
       throw new ApiError(404, 'Notification template not found or delete failed');
    }
    res.status(200).json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
     if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
    } else {
      logger.error(`Error in deleteNotificationTemplate: ${error}`);
      res.status(500).json({ success: false, message: `Failed to delete template: ${error instanceof Error ? error.message : String(error)}` });
    }
  }
}

/**
 * Send a notification (Admin) - Placeholder
 * Needs implementation for selecting recipients (users, roles, etc.)
 * and calling notificationService.
 */
export async function sendAdminNotification(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user;
    const {
      recipients,
      message,
      subject,
      templateId,
      notificationType = 'email',
      priority = 'normal'
    } = req.body;

    // Validate admin authentication
    if (!user || !user.id) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    if (user.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
      return;
    }

    // Validate required fields
    if (!recipients || (!message && !templateId)) {
      res.status(400).json({
        success: false,
        message: 'Recipients and either message content or templateId are required'
      });
      return;
    }

    // Validate notification type
    const validTypes = ['email', 'sms', 'push', 'in-app'];
    if (!validTypes.includes(notificationType)) {
      res.status(400).json({
        success: false,
        message: `Invalid notification type. Must be one of: ${validTypes.join(', ')}`
      });
      return;
    }

    // Validate priority
    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      res.status(400).json({
        success: false,
        message: `Invalid priority. Must be one of: ${validPriorities.join(', ')}`
      });
      return;
    }

    // Process recipients - can be userIds, roles, or 'all'
    let targetUsers: any[] = [];
    
    if (recipients.type === 'all') {
      // Send to all active users
      targetUsers = [
        { id: '1', email: 'admin@example.com', name: 'Admin User', phone: '+1-555-0123' },
        { id: '2', email: 'user@example.com', name: 'Regular User', phone: '+1-555-0124' },
        { id: '3', email: 'moderator@example.com', name: 'Moderator User', phone: '+1-555-0125' }
      ];
    } else if (recipients.type === 'roles') {
      // Filter users by roles
      const mockUsers = [
        { id: '1', email: 'admin@example.com', name: 'Admin User', role: 'admin', phone: '+1-555-0123' },
        { id: '2', email: 'user@example.com', name: 'Regular User', role: 'user', phone: '+1-555-0124' },
        { id: '3', email: 'moderator@example.com', name: 'Moderator User', role: 'moderator', phone: '+1-555-0125' }
      ];
      
      targetUsers = mockUsers.filter(u => recipients.roles.includes(u.role));
    } else if (recipients.type === 'userIds') {
      // Send to specific user IDs
      const mockUsers = [
        { id: '1', email: 'admin@example.com', name: 'Admin User', phone: '+1-555-0123' },
        { id: '2', email: 'user@example.com', name: 'Regular User', phone: '+1-555-0124' },
        { id: '3', email: 'moderator@example.com', name: 'Moderator User', phone: '+1-555-0125' }
      ];
      
      targetUsers = mockUsers.filter(u => recipients.userIds.includes(u.id));
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid recipients type. Must be "all", "roles", or "userIds"'
      });
      return;
    }

    if (targetUsers.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No valid recipients found'
      });
      return;
    }

    // Prepare notification content
    let notificationContent = message;
    if (templateId) {
      // In a real implementation, this would fetch the template from database
      const mockTemplates: Record<string, any> = {
        'welcome': {
          subject: 'Welcome to our platform!',
          content: 'Welcome {{name}}! We\'re excited to have you on board.'
        },
        'maintenance': {
          subject: 'Scheduled Maintenance Notice',
          content: 'Dear {{name}}, we will be performing scheduled maintenance on {{date}}.'
        },
        'security-alert': {
          subject: 'Security Alert',
          content: 'Hello {{name}}, we detected unusual activity on your account.'
        }
      };

      const template = mockTemplates[templateId];
      if (!template) {
        res.status(400).json({
          success: false,
          message: 'Template not found'
        });
        return;
      }

      notificationContent = template.content;
      if (!subject && template.subject) {
        req.body.subject = template.subject;
      }
    }

    // Simulate sending notifications
    const results = [];
    const errors = [];

    for (const targetUser of targetUsers) {
      try {
        // Replace template variables
        let personalizedContent = notificationContent;
        let personalizedSubject = subject || 'Notification from Admin';
        
        if (personalizedContent.includes('{{name}}')) {
          personalizedContent = personalizedContent.replace(/\{\{name\}\}/g, targetUser.name);
        }
        if (personalizedSubject.includes('{{name}}')) {
          personalizedSubject = personalizedSubject.replace(/\{\{name\}\}/g, targetUser.name);
        }

        // Simulate notification sending based on type
        let notificationResult;
        switch (notificationType) {
          case 'email':
            if (!targetUser.email) {
              throw new Error('User email not available');
            }
            // Simulate email sending
            notificationResult = {
              userId: targetUser.id,
              type: 'email',
              recipient: targetUser.email,
              subject: personalizedSubject,
              content: personalizedContent,
              status: 'sent',
              sentAt: new Date().toISOString(),
              messageId: `email_${Date.now()}_${targetUser.id}`
            };
            break;

          case 'sms':
            if (!targetUser.phone) {
              throw new Error('User phone number not available');
            }
            // Simulate SMS sending
            notificationResult = {
              userId: targetUser.id,
              type: 'sms',
              recipient: targetUser.phone,
              content: personalizedContent,
              status: 'sent',
              sentAt: new Date().toISOString(),
              messageId: `sms_${Date.now()}_${targetUser.id}`
            };
            break;

          case 'push':
            // Simulate push notification
            notificationResult = {
              userId: targetUser.id,
              type: 'push',
              title: personalizedSubject,
              content: personalizedContent,
              status: 'sent',
              sentAt: new Date().toISOString(),
              messageId: `push_${Date.now()}_${targetUser.id}`
            };
            break;

          case 'in-app':
            // Simulate in-app notification
            notificationResult = {
              userId: targetUser.id,
              type: 'in-app',
              title: personalizedSubject,
              content: personalizedContent,
              status: 'sent',
              sentAt: new Date().toISOString(),
              messageId: `inapp_${Date.now()}_${targetUser.id}`
            };
            break;

          default:
            throw new Error(`Unsupported notification type: ${notificationType}`);
        }

        results.push(notificationResult);
        logger.info(`Notification sent to user ${targetUser.id} via ${notificationType}`);

      } catch (error) {
        const errorResult = {
          userId: targetUser.id,
          error: error instanceof Error ? error.message : String(error),
          status: 'failed'
        };
        errors.push(errorResult);
        logger.error(`Failed to send notification to user ${targetUser.id}:`, error);
      }
    }

    // Prepare response
    const response = {
      success: true,
      message: `Notification sending completed. ${results.length} sent, ${errors.length} failed.`,
      data: {
        summary: {
          totalRecipients: targetUsers.length,
          successful: results.length,
          failed: errors.length,
          notificationType,
          priority,
          sentBy: user.id,
          sentAt: new Date().toISOString()
        },
        results,
        errors: errors.length > 0 ? errors : undefined
      }
    };

    // Log the notification sending activity
    logger.info(`Admin ${user.id} sent ${notificationType} notifications to ${targetUsers.length} recipients`);

    res.status(200).json(response);

    // Real Supabase implementation would look like:
    /*
    // 1. Fetch recipients based on criteria
    let query = supabase.from('users').select('id, email, phone, name, role');
    
    if (recipients.type === 'roles') {
      query = query.in('role', recipients.roles);
    } else if (recipients.type === 'userIds') {
      query = query.in('id', recipients.userIds);
    }
    // For 'all', no additional filter needed
    
    const { data: targetUsers, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    // 2. Fetch template if templateId provided
    if (templateId) {
      const { data: template, error: templateError } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      
      if (templateError) throw templateError;
      notificationContent = template.content;
      if (!subject) subject = template.subject;
    }

    // 3. Create notification records
    const notifications = targetUsers.map(user => ({
      recipient_id: user.id,
      sender_id: req.user.id,
      type: notificationType,
      subject: subject,
      content: notificationContent,
      priority: priority,
      status: 'pending',
      scheduled_at: scheduledAt || new Date().toISOString()
    }));

    const { data: createdNotifications, error: createError } = await supabase
      .from('notifications')
      .insert(notifications)
      .select();

    if (createError) throw createError;

    // 4. Send notifications via appropriate service
    // This would integrate with actual email/SMS/push services
    */

  } catch (error: unknown) {
    logger.error('Error sending admin notification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending notification',
      error: process.env.NODE_ENV === 'development' ?
        (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
}
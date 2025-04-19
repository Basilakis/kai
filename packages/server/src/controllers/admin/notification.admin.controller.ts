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
export async function getNotificationTemplates(req: Request, res: Response): Promise<void> {
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
   logger.warn('sendAdminNotification endpoint called but not fully implemented.');
   res.status(510).json({ success: false, message: 'Admin notification sending not yet implemented.' });
   // TODO: Implement recipient selection (userIds, roles, all users?)
   // TODO: Get message content (templateId or direct content) from req.body
   // TODO: Fetch user details if needed (email/phone)
   // TODO: Loop through recipients and call appropriate notificationService methods (e.g., sendEmail, sendSMS)
}
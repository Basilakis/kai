/**
 * Webhook Controller
 * 
 * This controller handles API endpoints for managing webhook integrations,
 * including creating, updating, and deleting webhook configurations.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { ApiError } from '../../middleware/error.middleware';
import { supabaseClient } from '../../services/supabase/supabaseClient';
import { webhookProvider } from '../../services/messaging/providers/webhookProvider';
import { eventNotificationService, EventType } from '../../services/messaging/eventNotificationService';

/**
 * Get all webhook configurations for the current user
 * @param req Request
 * @param res Response
 */
export async function getWebhookConfigurations(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    
    const { data, error } = await supabaseClient.getClient()
      .from('webhook_configurations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new ApiError(500, `Failed to get webhook configurations: ${error.message}`);
    }
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      logger.error(`Error in getWebhookConfigurations: ${error}`);
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred'
      });
    }
  }
}

/**
 * Get a webhook configuration by ID
 * @param req Request
 * @param res Response
 */
export async function getWebhookConfigurationById(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const webhookId = req.params.id;
    
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    
    const { data, error } = await supabaseClient.getClient()
      .from('webhook_configurations')
      .select('*')
      .eq('id', webhookId)
      .eq('user_id', userId)
      .single();
    
    if (error) {
      throw new ApiError(404, 'Webhook configuration not found');
    }
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      logger.error(`Error in getWebhookConfigurationById: ${error}`);
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred'
      });
    }
  }
}

/**
 * Create a new webhook configuration
 * @param req Request
 * @param res Response
 */
export async function createWebhookConfiguration(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    
    const { name, url, events, headers, isActive } = req.body;
    
    // Validate required fields
    if (!name) {
      throw new ApiError(400, 'Webhook name is required');
    }
    
    if (!url) {
      throw new ApiError(400, 'Webhook URL is required');
    }
    
    if (!events || !Array.isArray(events) || events.length === 0) {
      throw new ApiError(400, 'At least one event must be specified');
    }
    
    // Validate URL
    const isValidUrl = await webhookProvider.validateWebhookUrl(url);
    
    if (!isValidUrl) {
      throw new ApiError(400, 'Invalid webhook URL');
    }
    
    // Generate a secret for signing payloads
    const crypto = require('crypto');
    const secret = crypto.randomBytes(32).toString('hex');
    
    // Create webhook configuration
    const { data, error } = await supabaseClient.getClient()
      .from('webhook_configurations')
      .insert([{
        user_id: userId,
        name,
        url,
        events,
        headers: headers || {},
        is_active: isActive !== undefined ? isActive : true,
        secret
      }])
      .select()
      .single();
    
    if (error) {
      throw new ApiError(500, `Failed to create webhook configuration: ${error.message}`);
    }
    
    res.status(201).json({
      success: true,
      message: 'Webhook configuration created successfully',
      data
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      logger.error(`Error in createWebhookConfiguration: ${error}`);
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred'
      });
    }
  }
}

/**
 * Update a webhook configuration
 * @param req Request
 * @param res Response
 */
export async function updateWebhookConfiguration(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const webhookId = req.params.id;
    
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    
    const { name, url, events, headers, isActive } = req.body;
    
    // Check if webhook exists and belongs to user
    const { data: existingWebhook, error: fetchError } = await supabaseClient.getClient()
      .from('webhook_configurations')
      .select('*')
      .eq('id', webhookId)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !existingWebhook) {
      throw new ApiError(404, 'Webhook configuration not found');
    }
    
    // Validate URL if changed
    if (url && url !== existingWebhook.url) {
      const isValidUrl = await webhookProvider.validateWebhookUrl(url);
      
      if (!isValidUrl) {
        throw new ApiError(400, 'Invalid webhook URL');
      }
    }
    
    // Update webhook configuration
    const updateData: Record<string, any> = {};
    
    if (name !== undefined) updateData.name = name;
    if (url !== undefined) updateData.url = url;
    if (events !== undefined) updateData.events = events;
    if (headers !== undefined) updateData.headers = headers;
    if (isActive !== undefined) updateData.is_active = isActive;
    
    updateData.updated_at = new Date();
    
    const { error: updateError } = await supabaseClient.getClient()
      .from('webhook_configurations')
      .update(updateData)
      .eq('id', webhookId)
      .eq('user_id', userId);
    
    if (updateError) {
      throw new ApiError(500, `Failed to update webhook configuration: ${updateError.message}`);
    }
    
    res.status(200).json({
      success: true,
      message: 'Webhook configuration updated successfully'
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      logger.error(`Error in updateWebhookConfiguration: ${error}`);
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred'
      });
    }
  }
}

/**
 * Delete a webhook configuration
 * @param req Request
 * @param res Response
 */
export async function deleteWebhookConfiguration(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const webhookId = req.params.id;
    
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    
    // Check if webhook exists and belongs to user
    const { data: existingWebhook, error: fetchError } = await supabaseClient.getClient()
      .from('webhook_configurations')
      .select('*')
      .eq('id', webhookId)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !existingWebhook) {
      throw new ApiError(404, 'Webhook configuration not found');
    }
    
    // Delete webhook configuration
    const { error: deleteError } = await supabaseClient.getClient()
      .from('webhook_configurations')
      .delete()
      .eq('id', webhookId)
      .eq('user_id', userId);
    
    if (deleteError) {
      throw new ApiError(500, `Failed to delete webhook configuration: ${deleteError.message}`);
    }
    
    res.status(200).json({
      success: true,
      message: 'Webhook configuration deleted successfully'
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      logger.error(`Error in deleteWebhookConfiguration: ${error}`);
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred'
      });
    }
  }
}

/**
 * Get webhook delivery logs for a webhook configuration
 * @param req Request
 * @param res Response
 */
export async function getWebhookDeliveryLogs(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const webhookId = req.params.id;
    
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    
    // Check if webhook exists and belongs to user
    const { data: existingWebhook, error: fetchError } = await supabaseClient.getClient()
      .from('webhook_configurations')
      .select('*')
      .eq('id', webhookId)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !existingWebhook) {
      throw new ApiError(404, 'Webhook configuration not found');
    }
    
    // Get delivery logs
    const { data, error } = await supabaseClient.getClient()
      .from('webhook_delivery_logs')
      .select('*')
      .eq('webhook_id', webhookId)
      .order('timestamp', { ascending: false })
      .limit(100);
    
    if (error) {
      throw new ApiError(500, `Failed to get webhook delivery logs: ${error.message}`);
    }
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      logger.error(`Error in getWebhookDeliveryLogs: ${error}`);
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred'
      });
    }
  }
}

/**
 * Test a webhook configuration
 * @param req Request
 * @param res Response
 */
export async function testWebhookConfiguration(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const webhookId = req.params.id;
    
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    
    // Check if webhook exists and belongs to user
    const { data: webhook, error: fetchError } = await supabaseClient.getClient()
      .from('webhook_configurations')
      .select('*')
      .eq('id', webhookId)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !webhook) {
      throw new ApiError(404, 'Webhook configuration not found');
    }
    
    // Send test event
    const testEvent = {
      eventType: EventType.CUSTOM_EVENT,
      userId,
      data: {
        message: 'This is a test webhook event',
        timestamp: new Date().toISOString()
      },
      metadata: {
        isTest: true,
        webhookId
      }
    };
    
    // Process the test event
    await eventNotificationService.processEvent(testEvent);
    
    res.status(200).json({
      success: true,
      message: 'Test webhook event sent successfully'
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      logger.error(`Error in testWebhookConfiguration: ${error}`);
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred'
      });
    }
  }
}

/**
 * Regenerate webhook secret
 * @param req Request
 * @param res Response
 */
export async function regenerateWebhookSecret(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const webhookId = req.params.id;
    
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    
    // Check if webhook exists and belongs to user
    const { data: existingWebhook, error: fetchError } = await supabaseClient.getClient()
      .from('webhook_configurations')
      .select('*')
      .eq('id', webhookId)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !existingWebhook) {
      throw new ApiError(404, 'Webhook configuration not found');
    }
    
    // Generate a new secret
    const crypto = require('crypto');
    const secret = crypto.randomBytes(32).toString('hex');
    
    // Update webhook with new secret
    const { error: updateError } = await supabaseClient.getClient()
      .from('webhook_configurations')
      .update({
        secret,
        updated_at: new Date()
      })
      .eq('id', webhookId)
      .eq('user_id', userId);
    
    if (updateError) {
      throw new ApiError(500, `Failed to regenerate webhook secret: ${updateError.message}`);
    }
    
    res.status(200).json({
      success: true,
      message: 'Webhook secret regenerated successfully',
      data: { secret }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      logger.error(`Error in regenerateWebhookSecret: ${error}`);
      res.status(500).json({
        success: false,
        message: 'An unexpected error occurred'
      });
    }
  }
}

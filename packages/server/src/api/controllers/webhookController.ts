/**
 * Webhook Controller
 * 
 * This controller handles webhook-related operations, including:
 * - Creating and managing webhook configurations
 * - Testing webhooks
 * - Viewing webhook delivery logs
 * - Regenerating webhook secrets
 */

import { Request, Response } from 'express';
import { supabaseClient } from '../../services/supabase/supabaseClient';
import { webhookService } from '../../services/messaging/webhookService';
import { logger } from '../../utils/logger';
import crypto from 'crypto';

/**
 * Webhook controller
 */
class WebhookController {
  /**
   * Get webhook configurations for the authenticated user
   * @param req Express request
   * @param res Express response
   */
  public async getUserWebhookConfigurations(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }
      
      // Get webhook configurations from the database
      const { data, error } = await supabaseClient.getClient()
        .from('webhook_configurations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      return res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error(`Error getting webhook configurations: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to get webhook configurations'
      });
    }
  }
  
  /**
   * Get webhook configuration by ID
   * @param req Express request
   * @param res Express response
   */
  public async getWebhookConfiguration(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }
      
      const { id } = req.params;
      
      // Get webhook configuration from the database
      const { data, error } = await supabaseClient.getClient()
        .from('webhook_configurations')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();
      
      if (error) {
        throw error;
      }
      
      return res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error(`Error getting webhook configuration: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to get webhook configuration'
      });
    }
  }
  
  /**
   * Create webhook configuration
   * @param req Express request
   * @param res Express response
   */
  public async createWebhookConfiguration(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }
      
      const { name, url, events, isActive = true } = req.body;
      
      // Generate webhook secret
      const secret = crypto.randomBytes(32).toString('hex');
      
      // Create webhook configuration
      const { data, error } = await supabaseClient.getClient()
        .from('webhook_configurations')
        .insert([{
          user_id: userId,
          name,
          url,
          events,
          is_active: isActive,
          secret
        }])
        .select();
      
      if (error) {
        throw error;
      }
      
      return res.json({
        success: true,
        message: 'Webhook configuration created successfully',
        data: {
          ...data[0],
          secret
        }
      });
    } catch (error) {
      logger.error(`Error creating webhook configuration: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to create webhook configuration'
      });
    }
  }
  
  /**
   * Update webhook configuration
   * @param req Express request
   * @param res Express response
   */
  public async updateWebhookConfiguration(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }
      
      const { id } = req.params;
      const { name, url, events, isActive } = req.body;
      
      // Update webhook configuration
      const { data, error } = await supabaseClient.getClient()
        .from('webhook_configurations')
        .update({
          name,
          url,
          events,
          is_active: isActive,
          updated_at: new Date()
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select();
      
      if (error) {
        throw error;
      }
      
      return res.json({
        success: true,
        message: 'Webhook configuration updated successfully',
        data: data[0]
      });
    } catch (error) {
      logger.error(`Error updating webhook configuration: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to update webhook configuration'
      });
    }
  }
  
  /**
   * Delete webhook configuration
   * @param req Express request
   * @param res Express response
   */
  public async deleteWebhookConfiguration(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }
      
      const { id } = req.params;
      
      // Delete webhook configuration
      const { error } = await supabaseClient.getClient()
        .from('webhook_configurations')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      
      if (error) {
        throw error;
      }
      
      return res.json({
        success: true,
        message: 'Webhook configuration deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting webhook configuration: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete webhook configuration'
      });
    }
  }
  
  /**
   * Test webhook
   * @param req Express request
   * @param res Express response
   */
  public async testWebhook(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }
      
      const { id } = req.params;
      
      // Get webhook configuration
      const { data: webhook, error: webhookError } = await supabaseClient.getClient()
        .from('webhook_configurations')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();
      
      if (webhookError) {
        throw webhookError;
      }
      
      // Send test webhook
      const result = await webhookService.sendWebhook({
        url: webhook.url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Id': webhook.id,
          'X-Webhook-Event': 'test'
        },
        payload: {
          event: 'test',
          timestamp: new Date().toISOString(),
          data: {
            message: 'This is a test webhook'
          }
        },
        userId,
        webhookId: webhook.id,
        eventType: 'test'
      });
      
      if (!result.success) {
        throw result.error;
      }
      
      return res.json({
        success: true,
        message: 'Test webhook sent successfully',
        data: {
          status: result.metadata?.status,
          response: result.metadata?.data
        }
      });
    } catch (error) {
      logger.error(`Error testing webhook: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to test webhook'
      });
    }
  }
  
  /**
   * Regenerate webhook secret
   * @param req Express request
   * @param res Express response
   */
  public async regenerateWebhookSecret(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }
      
      const { id } = req.params;
      
      // Generate new webhook secret
      const secret = crypto.randomBytes(32).toString('hex');
      
      // Update webhook configuration
      const { data, error } = await supabaseClient.getClient()
        .from('webhook_configurations')
        .update({
          secret,
          updated_at: new Date()
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select();
      
      if (error) {
        throw error;
      }
      
      return res.json({
        success: true,
        message: 'Webhook secret regenerated successfully',
        data: {
          ...data[0],
          secret
        }
      });
    } catch (error) {
      logger.error(`Error regenerating webhook secret: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to regenerate webhook secret'
      });
    }
  }
  
  /**
   * Get webhook delivery logs
   * @param req Express request
   * @param res Express response
   */
  public async getWebhookDeliveryLogs(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }
      
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string;
      
      // Verify webhook ownership
      const { data: webhook, error: webhookError } = await supabaseClient.getClient()
        .from('webhook_configurations')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .single();
      
      if (webhookError) {
        throw webhookError;
      }
      
      // Build query
      let query = supabaseClient.getClient()
        .from('webhook_delivery_logs')
        .select('*')
        .eq('webhook_id', id)
        .order('created_at', { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1);
      
      // Add status filter if provided
      if (status) {
        query = query.eq('status', status);
      }
      
      // Execute query
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      // Get total count
      const { count, error: countError } = await supabaseClient.getClient()
        .from('webhook_delivery_logs')
        .select('*', { count: 'exact', head: true })
        .eq('webhook_id', id);
      
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
      logger.error(`Error getting webhook delivery logs: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to get webhook delivery logs'
      });
    }
  }
  
  /**
   * Get all webhook configurations (admin only)
   * @param req Express request
   * @param res Express response
   */
  public async getAllWebhookConfigurations(req: Request, res: Response) {
    try {
      const userId = req.query.userId as string;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      
      // Build query
      let query = supabaseClient.getClient()
        .from('webhook_configurations')
        .select('*, profiles(email, display_name)')
        .order('created_at', { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1);
      
      // Add user filter if provided
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      // Execute query
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      // Get total count
      const { count, error: countError } = await supabaseClient.getClient()
        .from('webhook_configurations')
        .select('*', { count: 'exact', head: true });
      
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
      logger.error(`Error getting all webhook configurations: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to get webhook configurations'
      });
    }
  }
  
  /**
   * Get all webhook delivery logs (admin only)
   * @param req Express request
   * @param res Express response
   */
  public async getAllWebhookDeliveryLogs(req: Request, res: Response) {
    try {
      const configurationId = req.query.configurationId as string;
      const userId = req.query.userId as string;
      const status = req.query.status as string;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      
      // Build query
      let query = supabaseClient.getClient()
        .from('webhook_delivery_logs')
        .select('*, webhook_configurations(name, url, user_id, profiles(email, display_name))')
        .order('created_at', { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1);
      
      // Add filters if provided
      if (configurationId) {
        query = query.eq('webhook_id', configurationId);
      }
      
      if (status) {
        query = query.eq('status', status);
      }
      
      if (userId) {
        query = query.eq('webhook_configurations.user_id', userId);
      }
      
      // Execute query
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      // Get total count
      const { count, error: countError } = await supabaseClient.getClient()
        .from('webhook_delivery_logs')
        .select('*', { count: 'exact', head: true });
      
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
      logger.error(`Error getting all webhook delivery logs: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to get webhook delivery logs'
      });
    }
  }
  
  /**
   * Get webhook stats (admin only)
   * @param req Express request
   * @param res Express response
   */
  public async getWebhookStats(req: Request, res: Response) {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      
      // Build date filter
      let dateFilter = '';
      if (startDate && endDate) {
        dateFilter = `created_at >= '${startDate}' AND created_at <= '${endDate}'`;
      } else if (startDate) {
        dateFilter = `created_at >= '${startDate}'`;
      } else if (endDate) {
        dateFilter = `created_at <= '${endDate}'`;
      }
      
      // Get total count
      const { data: totalData, error: totalError } = await supabaseClient.getClient()
        .rpc('get_webhook_delivery_count', {
          where_clause: dateFilter ? `WHERE ${dateFilter}` : ''
        });
      
      if (totalError) {
        throw totalError;
      }
      
      // Get counts by status
      const { data: statusData, error: statusError } = await supabaseClient.getClient()
        .rpc('get_webhook_delivery_count_by_status', {
          where_clause: dateFilter ? `WHERE ${dateFilter}` : ''
        });
      
      if (statusError) {
        throw statusError;
      }
      
      // Get counts by day
      const { data: dailyData, error: dailyError } = await supabaseClient.getClient()
        .rpc('get_webhook_delivery_count_by_day', {
          where_clause: dateFilter ? `WHERE ${dateFilter}` : ''
        });
      
      if (dailyError) {
        throw dailyError;
      }
      
      // Get top users by webhook count
      const { data: topUsersData, error: topUsersError } = await supabaseClient.getClient()
        .rpc('get_top_users_by_webhook_count', {
          limit_count: 10,
          where_clause: dateFilter ? `WHERE ${dateFilter}` : ''
        });
      
      if (topUsersError) {
        throw topUsersError;
      }
      
      return res.json({
        success: true,
        data: {
          total: totalData,
          byStatus: statusData,
          byDay: dailyData,
          topUsers: topUsersData
        }
      });
    } catch (error) {
      logger.error(`Error getting webhook stats: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to get webhook stats'
      });
    }
  }
}

export const webhookController = new WebhookController();

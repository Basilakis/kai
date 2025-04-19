/**
 * Admin Webhook Controller
 * 
 * Handles admin-specific API endpoints for viewing webhook configurations and logs.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { ApiError } from '../../middleware/error.middleware';
import { supabaseClient } from '../../services/supabase/supabaseClient';

/**
 * Get all webhook configurations (Admin)
 */
export async function getAllWebhookConfigurations(req: Request, res: Response): Promise<void> {
  try {
    // Add pagination options from query parameters
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseClient.getClient()
      .from('webhook_configurations')
      .select('*, count()') // Explicitly select count
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      throw new ApiError(500, `Failed to get webhook configurations: ${error.message}`);
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
      res.status(error.statusCode).json({ success: false, message: error.message });
    } else {
      logger.error(`Error in getAllWebhookConfigurations: ${error}`);
      res.status(500).json({ success: false, message: 'An unexpected error occurred while retrieving webhook configurations' });
    }
  }
}

/**
 * Get all webhook delivery logs (Admin)
 */
export async function getAllWebhookDeliveryLogs(req: Request, res: Response): Promise<void> {
  try {
    // Add pagination options from query parameters
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '100', 10);
    const offset = (page - 1) * limit;

    // Optional filtering by webhook_id or status could be added here via query params

    const { data, error, count } = await supabaseClient.getClient()
      .from('webhook_delivery_logs')
      .select('*, count()') // Explicitly select count
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      throw new ApiError(500, `Failed to get webhook delivery logs: ${error.message}`);
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
      res.status(error.statusCode).json({ success: false, message: error.message });
    } else {
      logger.error(`Error in getAllWebhookDeliveryLogs: ${error}`);
      res.status(500).json({ success: false, message: 'An unexpected error occurred while retrieving webhook delivery logs' });
    }
  }
}
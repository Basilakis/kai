/**
 * Real-Time Analytics Controller
 * 
 * This controller provides API endpoints for real-time analytics functionality,
 * allowing users to track and analyze events as they happen.
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/error.middleware';
import { realTimeAnalyticsService } from '../services/analytics/real-time-analytics-service';

/**
 * Track a real-time analytics event
 * 
 * @route POST /api/analytics/real-time/event
 */
export const trackRealTimeEvent = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    // Get event data from request body
    const { 
      event_type,
      resource_type,
      resource_id,
      query,
      parameters,
      source,
      source_detail
    } = req.body;
    
    // Validate event type
    if (!event_type) {
      throw new ApiError(400, 'Event type is required');
    }
    
    // Track event
    const eventId = await realTimeAnalyticsService.trackEvent({
      event_type,
      resource_type,
      resource_id,
      user_id: userId,
      query,
      parameters,
      source,
      source_detail
    });
    
    res.status(200).json({
      success: true,
      data: {
        id: eventId
      }
    });
  } catch (error: any) {
    logger.error(`Error tracking real-time event: ${error}`);
    
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Internal server error',
      message: 'Failed to track real-time event'
    });
  }
};

/**
 * Get recent real-time analytics events
 * 
 * @route GET /api/analytics/real-time/events
 */
export const getRecentEvents = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new ApiError(401, 'User ID is required');
    }
    
    // Get limit from query
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    // Get recent events
    const events = await realTimeAnalyticsService.getRecentEvents(userId, limit);
    
    res.status(200).json({
      success: true,
      data: events
    });
  } catch (error: any) {
    logger.error(`Error getting recent events: ${error}`);
    
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Internal server error',
      message: 'Failed to get recent events'
    });
  }
};

/**
 * Subscribe to real-time analytics events (WebSocket)
 * 
 * This is handled by the WebSocket server in the real-time analytics service.
 * The route is defined in the routes file, but the actual handling is done
 * by the WebSocket server.
 */

export default {
  trackRealTimeEvent,
  getRecentEvents
};

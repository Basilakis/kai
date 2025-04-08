/**
 * Analytics Controller
 * 
 * This controller handles API endpoints for retrieving analytics data
 * about searches, agent AI prompts, API requests, and crewAI agent activities.
 */

import { Request, Response } from 'express';
import { 
  analyticsService, 
  AnalyticsQueryOptions, 
  AnalyticsEventType, 
  AnalyticsSourceType,
  TrendAnalysisOptions 
} from '../services/analytics/analyticsService';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/error.middleware';

/**
 * Get analytics events with optional filtering
 */
export const getAnalyticsEvents = async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const queryOptions: AnalyticsQueryOptions = {};
    
    // Handle date filters
    if (req.query.startDate) {
      queryOptions.startDate = new Date(req.query.startDate as string);
    }
    
    if (req.query.endDate) {
      queryOptions.endDate = new Date(req.query.endDate as string);
    }
    
    // Handle event type filter
    if (req.query.eventType) {
      queryOptions.eventType = req.query.eventType as AnalyticsEventType;
    }
    
    // Handle resource type filter
    if (req.query.resourceType) {
      queryOptions.resourceType = req.query.resourceType as string;
    }
    
    // Handle user filter
    if (req.query.userId) {
      queryOptions.userId = req.query.userId as string;
    }
    
    // Handle pagination
    if (req.query.limit) {
      queryOptions.limit = parseInt(req.query.limit as string);
    }
    
    if (req.query.skip) {
      queryOptions.skip = parseInt(req.query.skip as string);
    }
    
    // Handle sorting
    if (req.query.sortBy && req.query.sortDirection) {
      const sortBy = req.query.sortBy as string;
      const sortDirection = req.query.sortDirection as 'asc' | 'desc';
      queryOptions.sort = { [sortBy]: sortDirection };
    }
    
    // Get analytics events
    const events = await analyticsService.queryEvents(queryOptions);
    
    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    logger.error(`Error getting analytics events: ${error}`);
    throw new ApiError(500, 'Failed to retrieve analytics events');
  }
};

/**
 * Get analytics trends over time
 */
export const getAnalyticsTrends = async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const trendOptions: TrendAnalysisOptions = {
      timeframe: (req.query.timeframe as 'day' | 'week' | 'month') || 'day'
    };
    
    // Handle date filters
    if (req.query.startDate) {
      trendOptions.startDate = new Date(req.query.startDate as string);
    }
    
    if (req.query.endDate) {
      trendOptions.endDate = new Date(req.query.endDate as string);
    }
    
    // Handle event type filter
    if (req.query.eventType) {
      trendOptions.eventType = req.query.eventType as AnalyticsEventType;
    }
    
    // Get analytics trends
    const trends = await analyticsService.getTrends(trendOptions);
    
    res.status(200).json({
      success: true,
      data: trends
    });
  } catch (error) {
    logger.error(`Error getting analytics trends: ${error}`);
    throw new ApiError(500, 'Failed to retrieve analytics trends');
  }
};

/**
 * Get analytics statistics
 */
export const getAnalyticsStats = async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    
    if (req.query.startDate) {
      startDate = new Date(req.query.startDate as string);
    }
    
    if (req.query.endDate) {
      endDate = new Date(req.query.endDate as string);
    }
    
    // Get analytics stats
    const stats = await analyticsService.getStats(startDate, endDate);
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error(`Error getting analytics stats: ${error}`);
    throw new ApiError(500, 'Failed to retrieve analytics statistics');
  }
};

/**
 * Get top search queries
 */
export const getTopSearchQueries = async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    
    if (req.query.startDate) {
      startDate = new Date(req.query.startDate as string);
    }
    
    if (req.query.endDate) {
      endDate = new Date(req.query.endDate as string);
    }
    
    // Get top search queries
    const queries = await analyticsService.getTopSearchQueries(limit, startDate, endDate);
    
    res.status(200).json({
      success: true,
      count: queries.length,
      data: queries
    });
  } catch (error) {
    logger.error(`Error getting top search queries: ${error}`);
    throw new ApiError(500, 'Failed to retrieve top search queries');
  }
};

/**
 * Get top agent prompts
 */
export const getTopAgentPrompts = async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    
    if (req.query.startDate) {
      startDate = new Date(req.query.startDate as string);
    }
    
    if (req.query.endDate) {
      endDate = new Date(req.query.endDate as string);
    }
    
    // Get top agent prompts
    const prompts = await analyticsService.getTopAgentPrompts(limit, startDate, endDate);
    
    res.status(200).json({
      success: true,
      count: prompts.length,
      data: prompts
    });
  } catch (error) {
    logger.error(`Error getting top agent prompts: ${error}`);
    throw new ApiError(500, 'Failed to retrieve top agent prompts');
  }
};

/**
 * Get top viewed materials
 */
export const getTopMaterials = async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    
    if (req.query.startDate) {
      startDate = new Date(req.query.startDate as string);
    }
    
    if (req.query.endDate) {
      endDate = new Date(req.query.endDate as string);
    }
    
    // Get top viewed materials
    const materials = await analyticsService.getTopMaterials(limit, startDate, endDate);
    
    res.status(200).json({
      success: true,
      count: materials.length,
      data: materials
    });
  } catch (error) {
    logger.error(`Error getting top materials: ${error}`);
    throw new ApiError(500, 'Failed to retrieve top viewed materials');
  }
};

/**
 * Clear analytics data (admin only)
 */
export const clearAnalyticsData = async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    let before: Date | undefined;
    
    if (req.query.before) {
      before = new Date(req.query.before as string);
    }
    
    // Clear analytics data
    const count = await analyticsService.clearData(before);
    
    res.status(200).json({
      success: true,
      message: `Cleared ${count} analytics records`,
      data: { count }
    });
  } catch (error) {
    logger.error(`Error clearing analytics data: ${error}`);
    throw new ApiError(500, 'Failed to clear analytics data');
  }
};

/**
 * Track agent activity event
 */
export const trackAgentActivity = async (req: Request, res: Response) => {
  try {
    const { agentId, agentType, action, status, details, source, source_detail } = req.body;
    
    if (!agentId || !agentType || !action || !status) {
      throw new ApiError(400, 'Missing required fields: agentId, agentType, action, and status are required');
    }
    
    // Track the agent activity
    await analyticsService.trackAgentPrompt(
      action,
      agentType,
      req.user?.id,
      req.body.sessionId,
      details,
      source || AnalyticsSourceType.CREW_AI_AGENT,
      source_detail || agentId
    );
    
    res.status(200).json({
      success: true,
      message: 'Agent activity tracked successfully'
    });
  } catch (error) {
    logger.error(`Error tracking agent activity: ${error}`);
    throw new ApiError(500, 'Failed to track agent activity');
  }
};

/**
 * Track search event from agents
 */
export const trackAgentSearch = async (req: Request, res: Response) => {
  try {
    const { query, resourceType, agentId, parameters, source, source_detail } = req.body;
    
    if (!query || !resourceType || !agentId) {
      throw new ApiError(400, 'Missing required fields: query, resourceType, and agentId are required');
    }
    
    // Track the search
    await analyticsService.trackSearch(
      query,
      resourceType,
      req.user?.id,
      parameters,
      undefined,
      undefined,
      source || AnalyticsSourceType.CREW_AI_AGENT,
      source_detail || agentId
    );
    
    res.status(200).json({
      success: true,
      message: 'Search tracked successfully'
    });
  } catch (error) {
    logger.error(`Error tracking agent search: ${error}`);
    throw new ApiError(500, 'Failed to track search');
  }
};

/**
 * Track API request from agents
 */
export const trackAgentApiRequest = async (req: Request, res: Response) => {
  try {
    const { path, method, agentId, parameters, source, source_detail } = req.body;
    
    if (!path || !method || !agentId) {
      throw new ApiError(400, 'Missing required fields: path, method, and agentId are required');
    }
    
    // Track the API request
    await analyticsService.trackApiRequest(
      path,
      method,
      req.user?.id,
      parameters,
      undefined,
      undefined,
      source || AnalyticsSourceType.CREW_AI_AGENT,
      source_detail || agentId
    );
    
    res.status(200).json({
      success: true,
      message: 'API request tracked successfully'
    });
  } catch (error) {
    logger.error(`Error tracking agent API request: ${error}`);
    throw new ApiError(500, 'Failed to track API request');
  }
};

export default {
  getAnalyticsEvents,
  getAnalyticsTrends,
  getAnalyticsStats,
  getTopSearchQueries,
  getTopAgentPrompts,
  getTopMaterials,
  clearAnalyticsData,
  trackAgentActivity,
  trackAgentSearch,
  trackAgentApiRequest
};
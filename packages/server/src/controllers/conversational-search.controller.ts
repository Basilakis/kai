/**
 * Conversational Search Controller
 * 
 * This controller provides API endpoints for conversational search functionality,
 * allowing users to maintain context across multiple search queries.
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/error.middleware';
import { conversationalSearchService } from '../services/search/conversational-search-service';

/**
 * Perform conversational search
 * 
 * @route POST /api/search/conversational
 */
export const performConversationalSearch = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    // Get search parameters from request body
    const { 
      query,
      sessionId,
      materialType,
      limit,
      skip,
      includeKnowledge,
      includeRelationships,
      filters,
      userPreferences
    } = req.body;
    
    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new ApiError(400, 'Query is required');
    }
    
    // Perform conversational search
    const results = await conversationalSearchService.search(
      {
        query,
        sessionId,
        materialType,
        limit: limit ? parseInt(limit) : undefined,
        skip: skip ? parseInt(skip) : undefined,
        includeKnowledge: includeKnowledge !== 'false',
        includeRelationships: includeRelationships !== 'false',
        filters: filters ? (typeof filters === 'string' ? JSON.parse(filters) : filters) : undefined,
        userPreferences: userPreferences ? (typeof userPreferences === 'string' ? JSON.parse(userPreferences) : userPreferences) : undefined
      },
      userId
    );
    
    res.status(200).json({
      success: true,
      data: results.materials,
      knowledgeEntries: results.knowledgeEntries,
      relationships: results.relationships,
      sessionId: results.sessionId,
      enhancedQuery: results.enhancedQuery,
      interpretedQuery: results.interpretedQuery,
      metadata: results.metadata
    });
  } catch (error: any) {
    logger.error(`Error in conversational search: ${error}`);
    
    // Handle specific error cases
    if (error.message === 'Insufficient credits') {
      res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        message: 'You do not have enough credits to perform this search'
      });
    } else if (error.message === 'MCP server is not available') {
      res.status(503).json({
        success: false,
        error: 'Service unavailable',
        message: 'The search service is currently unavailable'
      });
    } else {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Internal server error',
        message: 'Failed to perform conversational search'
      });
    }
  }
};

/**
 * Get conversation history
 * 
 * @route GET /api/search/conversational/history/:sessionId
 */
export const getConversationHistory = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    // Validate session ID
    if (!sessionId) {
      throw new ApiError(400, 'Session ID is required');
    }
    
    // Get conversation history
    const history = await conversationalSearchService.getConversationHistory(sessionId);
    
    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error: any) {
    logger.error(`Error getting conversation history: ${error}`);
    
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Internal server error',
      message: 'Failed to get conversation history'
    });
  }
};

/**
 * Clear conversation history
 * 
 * @route DELETE /api/search/conversational/history/:sessionId
 */
export const clearConversationHistory = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    // Validate session ID
    if (!sessionId) {
      throw new ApiError(400, 'Session ID is required');
    }
    
    // Clear conversation history
    const success = await conversationalSearchService.clearConversationHistory(sessionId);
    
    if (success) {
      res.status(200).json({
        success: true,
        message: 'Conversation history cleared successfully'
      });
    } else {
      throw new ApiError(500, 'Failed to clear conversation history');
    }
  } catch (error: any) {
    logger.error(`Error clearing conversation history: ${error}`);
    
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Internal server error',
      message: 'Failed to clear conversation history'
    });
  }
};

export default {
  performConversationalSearch,
  getConversationHistory,
  clearConversationHistory
};

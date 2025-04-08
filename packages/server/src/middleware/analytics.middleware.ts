/**
 * Analytics Middleware
 * 
 * This middleware automatically tracks API requests for analytics purposes.
 * It captures:
 * - Request path and method
 * - Request parameters and query
 * - Response status
 * - Response time
 * - User information (if authenticated)
 * - Source of the request (API, internal, agent, etc.)
 */

import { Request, Response, NextFunction } from 'express';
import { 
  analyticsService, 
  AnalyticsSourceType 
} from '../services/analytics/analyticsService';
import { logger } from '../utils/logger';

// Paths that should be excluded from analytics tracking
const EXCLUDED_PATHS = [
  '/health',
  '/metrics',
  '/favicon.ico',
  '/static',
];

// Check if a path should be excluded from tracking
const shouldExcludePath = (path: string): boolean => {
  return EXCLUDED_PATHS.some(excludedPath => path.startsWith(excludedPath));
};

// Extract resource type from the path
const getResourceTypeFromPath = (path: string): string => {
  const parts = path.split('/').filter(Boolean);
  // First non-empty part after the base URL is typically the resource type
  // Ensure we always return a string, even if parts[0] is undefined
  return parts.length > 0 && parts[0] ? parts[0] : 'unknown';
};

/**
 * Analytics middleware for tracking API requests
 */
export const analyticsMiddleware = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip tracking for excluded paths
    if (shouldExcludePath(req.path)) {
      return next();
    }

    // Capture start time for response time calculation
    const startTime = Date.now();
    
    // Store the original end method to intercept it
    // Use type assertion to avoid TypeScript errors with the signature
    const originalEnd = res.end as any;

    // Override the end method to capture response details
    // Use type assertion to bypass strict TypeScript checking
    res.end = function(_chunk?: any, _encoding?: any, _callback?: any): any {
      // Calculate response time
      const responseTime = Date.now() - startTime;
      
      // Get authenticated user ID if available
      const userId = (req as any).user?.id || undefined;

      // Track request in analytics
      const resourceType = getResourceTypeFromPath(req.path);
      
      // Determine request source
      const source = AnalyticsSourceType.API;
      
      // Get additional source information from headers or request
      const sourceDetail = req.headers['x-request-source'] as string || 'external-api';

      // Capture search queries specifically
      if (req.path.includes('/search') || req.path.includes('/unified')) {
        // Handle search event tracking
        const query = req.query.q as string || req.body?.query || '';
        
        analyticsService.trackSearch(
          query,
          resourceType,
          userId,
          {
            ...req.query,
            ...req.body,
            path: req.path,
            method: req.method
          },
          responseTime,
          res.statusCode,
          source,
          sourceDetail
        ).catch(err => {
          logger.error(`Failed to track search analytics: ${err}`);
        });
      }
      // Capture agent AI prompts
      else if (req.path.includes('/agents') || req.path.includes('/ai')) {
        // Extract agent prompt from request body if available
        const prompt = req.body?.prompt || req.body?.message || req.body?.query || '';
        const agentType = req.path.includes('recognition') ? 'recognition' :
                          req.path.includes('material-expert') ? 'material-expert' :
                          req.path.includes('project-assistant') ? 'project-assistant' :
                          req.path.includes('3d-designer') ? '3d-designer' :
                          'unknown';
                          
        // Determine if this is a direct API call or from a crewAI agent
        const agentSource = req.headers['x-agent-source'] === 'crew-ai' 
          ? AnalyticsSourceType.CREW_AI_AGENT 
          : source;
          
        const agentSourceDetail = req.headers['x-agent-id'] as string || sourceDetail;
        
        analyticsService.trackAgentPrompt(
          prompt,
          agentType,
          userId,
          req.body?.sessionId,
          {
            ...req.body,
            path: req.path,
            method: req.method
          },
          agentSource,
          agentSourceDetail
        ).catch(err => {
          logger.error(`Failed to track agent analytics: ${err}`);
        });
      }
      // Track regular API requests
      else {
        analyticsService.trackApiRequest(
          req.path,
          req.method,
          userId,
          {
            query: req.query,
            body: req.method !== 'GET' ? req.body : undefined
          },
          responseTime,
          res.statusCode,
          source,
          sourceDetail
        ).catch(err => {
          logger.error(`Failed to track API analytics: ${err}`);
        });
      }

      // Track analytics data after calculating response time
      // Then call the original end method with all original arguments
      // Using type assertion to bypass strict TypeScript checking
      return originalEnd.apply(this, arguments as any);
    };

    // Continue to the next middleware
    next();
  };
};

export default analyticsMiddleware;
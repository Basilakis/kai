/**
 * Analytics Tools
 * 
 * A set of specialized tools for analyzing system metrics, user behavior patterns,
 * and generating insights about the platform's operation and performance.
 */

import { Tool } from 'crewai';
import { createLogger } from '../utils/logger';
import { ApiError } from '../services/baseService';

// Analytics service import
import { 
  AnalyticsQueryOptions,
  AnalyticsEventType,
  TrendAnalysisOptions
} from '../services/analyticsService';
import { getAnalyticsService } from '../services/serviceFactory';

// Logger instance
const logger = createLogger('AnalyticsTools');

/**
 * Create a tool for querying analytics events with filters
 */
export async function createAnalyticsQueryTool(): Promise<Tool> {
  logger.info('Creating analytics query tool');
  
  return new Tool({
    name: 'query_analytics',
    description: `
      Query analytics events from the KAI platform with various filters.
      
      parameters:
      - eventType (string, optional): Type of event to query (search, agent_prompt, api_request, material_view, recognition)
      - resourceType (string, optional): Type of resource (material, agent type, etc.)
      - startDate (string, optional): ISO date string for start of date range
      - endDate (string, optional): ISO date string for end of date range
      - userId (string, optional): Filter by specific user ID
      - limit (number, optional): Maximum number of results to return
      - skip (number, optional): Number of results to skip (for pagination)
      - sort (object, optional): Sorting parameters (e.g., {"timestamp": "desc"})
    `,
    func: async (args) => {
      logger.info('Executing analytics query tool');
      
      try {
        // Parse input arguments
        const params = typeof args === 'string' ? JSON.parse(args) : args;
        
        // Build query options
        const options: AnalyticsQueryOptions = {};
        
        if (params.eventType) {
          options.eventType = params.eventType as AnalyticsEventType;
        }
        
        if (params.resourceType) {
          options.resourceType = params.resourceType;
        }
        
        if (params.startDate) {
          options.startDate = new Date(params.startDate);
        }
        
        if (params.endDate) {
          options.endDate = new Date(params.endDate);
        }
        
        if (params.userId) {
          options.userId = params.userId;
        }
        
        if (params.limit) {
          options.limit = parseInt(params.limit, 10);
        }
        
        if (params.skip) {
          options.skip = parseInt(params.skip, 10);
        }
        
        if (params.sort) {
          options.sort = typeof params.sort === 'string' 
            ? JSON.parse(params.sort) 
            : params.sort;
        }
        
        // Execute the query
        const analyticsService = getAnalyticsService();
        const results = await analyticsService.queryEvents(options);
        
        // Format and return results
        logger.debug(`Query returned ${results.length} results`);
        return JSON.stringify(results, null, 2);
      } catch (error) {
        // Handle and format errors
        logger.error(`Error in analytics query tool: ${error}`);
        return JSON.stringify({
          error: 'Failed to query analytics events',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });
}

/**
 * Create a tool for analyzing trends in analytics data
 */
export async function createTrendAnalysisTool(): Promise<Tool> {
  logger.info('Creating trend analysis tool');
  
  return new Tool({
    name: 'analyze_trends',
    description: `
      Analyze trends in analytics data over time.
      
      parameters:
      - timeframe (string, required): Timeframe for trend analysis (day, week, month)
      - eventType (string, optional): Type of event to analyze
      - startDate (string, optional): ISO date string for start of date range
      - endDate (string, optional): ISO date string for end of date range
    `,
    func: async (args) => {
      logger.info('Executing trend analysis tool');
      
      try {
        // Parse input arguments
        const params = typeof args === 'string' ? JSON.parse(args) : args;
        
        // Validate required parameters
        if (!params.timeframe) {
          return JSON.stringify({
            error: 'Missing required parameter',
            message: 'timeframe is required (day, week, or month)'
          });
        }
        
        // Build trend analysis options
        const options: TrendAnalysisOptions = {
          timeframe: params.timeframe as 'day' | 'week' | 'month'
        };
        
        if (params.eventType) {
          options.eventType = params.eventType as AnalyticsEventType;
        }
        
        if (params.startDate) {
          options.startDate = new Date(params.startDate);
        }
        
        if (params.endDate) {
          options.endDate = new Date(params.endDate);
        }
        
        // Get trend data
        const analyticsService = getAnalyticsService();
        const trends = await analyticsService.getTrends(options);
        
        // Format and return results
        logger.debug(`Trend analysis returned data for ${Object.keys(trends).length} time periods`);
        return JSON.stringify(trends, null, 2);
      } catch (error) {
        // Handle and format errors
        logger.error(`Error in trend analysis tool: ${error}`);
        return JSON.stringify({
          error: 'Failed to analyze trends',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });
}

/**
 * Create a tool for generating analytics statistics
 */
export async function createAnalyticsStatsTool(): Promise<Tool> {
  logger.info('Creating analytics stats tool');
  
  return new Tool({
    name: 'get_analytics_stats',
    description: `
      Get aggregated statistics about platform usage and performance.
      
      parameters:
      - startDate (string, optional): ISO date string for start of date range
      - endDate (string, optional): ISO date string for end of date range
    `,
    func: async (args) => {
      logger.info('Executing analytics stats tool');
      
      try {
        // Parse input arguments
        const params = typeof args === 'string' ? JSON.parse(args) : args;
        
        // Parse date parameters if provided
        const startDate = params.startDate ? new Date(params.startDate) : undefined;
        const endDate = params.endDate ? new Date(params.endDate) : undefined;
        
        // Get statistics
        const analyticsService = getAnalyticsService();
        const stats = await analyticsService.getStats(startDate, endDate);
        
        // Format and return results
        logger.debug('Retrieved analytics statistics successfully');
        return JSON.stringify(stats, null, 2);
      } catch (error) {
        // Handle and format errors
        logger.error(`Error in analytics stats tool: ${error}`);
        return JSON.stringify({
          error: 'Failed to get analytics statistics',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });
}

/**
 * Create a tool for getting top search queries
 */
export async function createTopSearchQueriesTool(): Promise<Tool> {
  logger.info('Creating top search queries tool');
  
  return new Tool({
    name: 'get_top_search_queries',
    description: `
      Get the most frequent search queries used on the platform.
      
      parameters:
      - limit (number, optional): Maximum number of queries to return (default: 10)
      - startDate (string, optional): ISO date string for start of date range
      - endDate (string, optional): ISO date string for end of date range
    `,
    func: async (args) => {
      logger.info('Executing top search queries tool');
      
      try {
        // Parse input arguments
        const params = typeof args === 'string' ? JSON.parse(args) : args;
        
        // Parse parameters
        const limit = params.limit ? parseInt(params.limit, 10) : 10;
        const startDate = params.startDate ? new Date(params.startDate) : undefined;
        const endDate = params.endDate ? new Date(params.endDate) : undefined;
        
        // Get top search queries
        const analyticsService = getAnalyticsService();
        const queries = await analyticsService.getTopSearchQueries(limit, startDate, endDate);
        
        // Format and return results
        logger.debug(`Retrieved ${queries.length} top search queries`);
        return JSON.stringify(queries, null, 2);
      } catch (error) {
        // Handle and format errors
        logger.error(`Error in top search queries tool: ${error}`);
        return JSON.stringify({
          error: 'Failed to get top search queries',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });
}

/**
 * Create a tool for getting top agent prompts
 */
export async function createTopAgentPromptsTool(): Promise<Tool> {
  logger.info('Creating top agent prompts tool');
  
  return new Tool({
    name: 'get_top_agent_prompts',
    description: `
      Get the most frequent prompts sent to agents on the platform.
      
      parameters:
      - limit (number, optional): Maximum number of prompts to return (default: 10)
      - startDate (string, optional): ISO date string for start of date range
      - endDate (string, optional): ISO date string for end of date range
    `,
    func: async (args) => {
      logger.info('Executing top agent prompts tool');
      
      try {
        // Parse input arguments
        const params = typeof args === 'string' ? JSON.parse(args) : args;
        
        // Parse parameters
        const limit = params.limit ? parseInt(params.limit, 10) : 10;
        const startDate = params.startDate ? new Date(params.startDate) : undefined;
        const endDate = params.endDate ? new Date(params.endDate) : undefined;
        
        // Get top agent prompts
        const analyticsService = getAnalyticsService();
        const prompts = await analyticsService.getTopAgentPrompts(limit, startDate, endDate);
        
        // Format and return results
        logger.debug(`Retrieved ${prompts.length} top agent prompts`);
        return JSON.stringify(prompts, null, 2);
      } catch (error) {
        // Handle and format errors
        logger.error(`Error in top agent prompts tool: ${error}`);
        return JSON.stringify({
          error: 'Failed to get top agent prompts',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });
}

/**
 * Create a tool for getting top viewed materials
 */
export async function createTopMaterialsTool(): Promise<Tool> {
  logger.info('Creating top materials tool');
  
  return new Tool({
    name: 'get_top_materials',
    description: `
      Get the most frequently viewed materials on the platform.
      
      parameters:
      - limit (number, optional): Maximum number of materials to return (default: 10)
      - startDate (string, optional): ISO date string for start of date range
      - endDate (string, optional): ISO date string for end of date range
    `,
    func: async (args) => {
      logger.info('Executing top materials tool');
      
      try {
        // Parse input arguments
        const params = typeof args === 'string' ? JSON.parse(args) : args;
        
        // Parse parameters
        const limit = params.limit ? parseInt(params.limit, 10) : 10;
        const startDate = params.startDate ? new Date(params.startDate) : undefined;
        const endDate = params.endDate ? new Date(params.endDate) : undefined;
        
        // Get top materials
        const analyticsService = getAnalyticsService();
        const materials = await analyticsService.getTopMaterials(limit, startDate, endDate);
        
        // Format and return results
        logger.debug(`Retrieved ${materials.length} top materials`);
        return JSON.stringify(materials, null, 2);
      } catch (error) {
        // Handle and format errors
        logger.error(`Error in top materials tool: ${error}`);
        return JSON.stringify({
          error: 'Failed to get top materials',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });
}

/**
 * Create a set of analytics tools for use by analytics agents
 */
export async function createAnalyticsTools(): Promise<Tool[]> {
  logger.info('Creating full set of analytics tools');
  
  // Create all analytics tools
  const tools = [
    await createAnalyticsQueryTool(),
    await createTrendAnalysisTool(),
    await createAnalyticsStatsTool(),
    await createTopSearchQueriesTool(),
    await createTopAgentPromptsTool(),
    await createTopMaterialsTool()
  ];
  
  logger.info(`Created ${tools.length} analytics tools`);
  return tools;
}

export default {
  createAnalyticsQueryTool,
  createTrendAnalysisTool,
  createAnalyticsStatsTool,
  createTopSearchQueriesTool,
  createTopAgentPromptsTool,
  createTopMaterialsTool,
  createAnalyticsTools
};
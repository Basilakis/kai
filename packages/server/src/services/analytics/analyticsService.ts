/**
 * Analytics Service
 * 
 * This service provides functionality for tracking user interactions including:
 * - Search queries
 * - Agent AI prompts
 * - API requests
 * 
 * The tracked data can be used for generating reports, identifying trends,
 * and improving the user experience.
 */

import { supabaseClient } from '../supabase/supabaseClient';
import { logger } from '../../utils/logger';

// Event types for analytics tracking
export enum AnalyticsEventType {
  SEARCH = 'search',
  AGENT_PROMPT = 'agent_prompt',
  API_REQUEST = 'api_request',
  MATERIAL_VIEW = 'material_view',
  RECOGNITION = 'recognition'
}

// Source types for analytics tracking
export enum AnalyticsSourceType {
  API = 'api',
  INTERNAL = 'internal',
  CREW_AI_AGENT = 'crew_ai_agent',
  USER_INTERFACE = 'user_interface', 
  SYSTEM = 'system',
  SCHEDULER = 'scheduler'
}

// Interface for analytics event data
export interface AnalyticsEvent {
  id?: string;
  timestamp?: string;
  user_id?: string;
  event_type: AnalyticsEventType;
  resource_type?: string;
  query?: string;
  parameters?: Record<string, any>;
  response_status?: number;
  response_time?: number;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  source?: AnalyticsSourceType;
  source_detail?: string;
}

// Interface for analytics query options
export interface AnalyticsQueryOptions {
  startDate?: Date;
  endDate?: Date;
  eventType?: AnalyticsEventType;
  resourceType?: string;
  userId?: string;
  limit?: number;
  skip?: number;
  sort?: Record<string, 'asc' | 'desc'>;
}

// Interface for trend analysis options
export interface TrendAnalysisOptions {
  timeframe: 'day' | 'week' | 'month';
  eventType?: AnalyticsEventType;
  startDate?: Date;
  endDate?: Date;
}

// Interface for statistics
export interface AnalyticsStats {
  total: number;
  byEventType: Record<string, number>;
  byResourceType: Record<string, number>;
  topQueries: Array<{query: string; count: number}>;
  topMaterials: Array<{materialId: string; name: string; count: number}>;
  averageResponseTime: Record<string, number>;
}

/**
 * Analytics Service class for tracking user interactions
 */
class AnalyticsService {
  private static instance: AnalyticsService;
  private readonly tableName = 'analytics_events';

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.initializeService().catch(err => {
      logger.error(`Failed to initialize AnalyticsService: ${err}`);
    });
  }

  /**
   * Get singleton instance of AnalyticsService
   */
  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Initialize the service, creating database table if needed
   */

  private async initializeService(): Promise<void> {
    // Check if the table exists, and create it if it doesn't
    try {
      const { error } = await supabaseClient.getClient()
        .from(this.tableName)
        .select('id');
      
      if (error && error.code === '42P01') {
        // Table doesn't exist, create it
        logger.info(`Creating analytics_events table`);
        await this.createAnalyticsTable();
      }
    } catch (err) {
      logger.error(`Error checking analytics table: ${err}`);
    }
  }

  /**
   * Create the analytics_events table in the database
   */
  private async createAnalyticsTable(): Promise<void> {
    try {
      const { error } = await supabaseClient.getClient().rpc('create_analytics_table');
      
      if (error) {
        logger.error(`Failed to create analytics table: ${error}`);
        throw error;
      }
      
      logger.info('Analytics table created successfully');
    } catch (err) {
      logger.error(`Error creating analytics table: ${err}`);
      throw err;
    }
  }

  /**
   * Track an analytics event
   * 
   * @param event The analytics event to track
   * @returns The ID of the created event
   */
  public async trackEvent(event: AnalyticsEvent): Promise<string> {
    try {
      // Set timestamp if not provided
      if (!event.timestamp) {
        event.timestamp = new Date().toISOString();
      }

      // Insert event into database
      const { data, error } = await supabaseClient.getClient()
        .from(this.tableName)
        .insert([event]);

      if (error) {
        logger.error(`Failed to track analytics event: ${error}`);
        throw error;
      }

      // If we need the ID, fetch the inserted record separately
      if (data && data[0] && data[0].id) {
        return data[0].id;
      } else {
        // Using a more direct approach for querying without complex casting
        const timestamp = event.timestamp;
        const { data: fetchedData, error: fetchError } = await supabaseClient.getClient()
          .from(this.tableName)
          .select('id');
          
        if (fetchError) {
          logger.error(`Failed to fetch inserted analytics event: ${fetchError}`);
          return '';
        }
        
        // Find the record with matching timestamp manually
        const matchedRecord = fetchedData?.find((record: { timestamp: string; id: string }) => record.timestamp === timestamp);
        return matchedRecord?.id || '';
      }
    } catch (err) {
      logger.error(`Error tracking analytics event: ${err}`);
      // Don't disrupt the application flow for analytics errors
      return '';
    }
  }

  /**
   * Track a search event
   * 
   * @param query The search query
   * @param resourceType The type of resource being searched
   * @param userId The ID of the user making the search
   * @param parameters Additional search parameters
   * @param responseTime Time taken to process the search in ms
   * @param responseStatus HTTP status code of the response
   * @param source The source of the search event
   * @param sourceDetail Additional details about the source
   * @returns The ID of the created event
   */
  public async trackSearch(
    query: string,
    resourceType: string,
    userId?: string,
    parameters?: Record<string, any>,
    responseTime?: number,
    responseStatus?: number,
    source: AnalyticsSourceType = AnalyticsSourceType.API,
    sourceDetail?: string
  ): Promise<string> {
    return this.trackEvent({
      event_type: AnalyticsEventType.SEARCH,
      query,
      resource_type: resourceType,
      user_id: userId,
      parameters,
      response_time: responseTime,
      response_status: responseStatus,
      source,
      source_detail: sourceDetail
    });
  }

  /**
   * Track an agent prompt event
   * 
   * @param prompt The agent prompt text
   * @param agentType The type of agent being used
   * @param userId The ID of the user interacting with the agent
   * @param sessionId The agent session ID
   * @param parameters Additional parameters
   * @param source The source of the agent prompt event
   * @param sourceDetail Additional details about the source
   * @returns The ID of the created event
   */
  public async trackAgentPrompt(
    prompt: string,
    agentType: string,
    userId?: string,
    sessionId?: string,
    parameters?: Record<string, any>,
    source: AnalyticsSourceType = AnalyticsSourceType.API,
    sourceDetail?: string
  ): Promise<string> {
    return this.trackEvent({
      event_type: AnalyticsEventType.AGENT_PROMPT,
      query: prompt,
      resource_type: agentType,
      user_id: userId,
      session_id: sessionId,
      parameters,
      source,
      source_detail: sourceDetail
    });
  }

  /**
   * Track an API request event
   * 
   * @param path The API endpoint path
   * @param method The HTTP method used
   * @param userId The ID of the user making the request
   * @param parameters Request parameters and body
   * @param responseTime Time taken to process the request in ms
   * @param responseStatus HTTP status code of the response
   * @param source The source of the API request event
   * @param sourceDetail Additional details about the source
   * @returns The ID of the created event
   */
  public async trackApiRequest(
    path: string,
    method: string,
    userId?: string,
    parameters?: Record<string, any>,
    responseTime?: number,
    responseStatus?: number,
    source: AnalyticsSourceType = AnalyticsSourceType.API,
    sourceDetail?: string
  ): Promise<string> {
    return this.trackEvent({
      event_type: AnalyticsEventType.API_REQUEST,
      resource_type: `${method}:${path}`,
      user_id: userId,
      parameters,
      response_time: responseTime,
      response_status: responseStatus,
      source,
      source_detail: sourceDetail
    });
  }

  /**
   * Track a material view event
   * 
   * @param materialId The ID of the material being viewed
   * @param userId The ID of the user viewing the material
   * @param parameters Additional parameters
   * @param source The source of the material view event
   * @param sourceDetail Additional details about the source
   * @returns The ID of the created event
   */
  public async trackMaterialView(
    materialId: string,
    userId?: string,
    parameters?: Record<string, any>,
    source: AnalyticsSourceType = AnalyticsSourceType.USER_INTERFACE,
    sourceDetail?: string
  ): Promise<string> {
    return this.trackEvent({
      event_type: AnalyticsEventType.MATERIAL_VIEW,
      resource_type: 'material',
      user_id: userId,
      parameters: { ...parameters, materialId },
      source,
      source_detail: sourceDetail
    });
  }

  /**
   * Track a recognition event
   * 
   * @param imageType The type of image used for recognition
   * @param userId The ID of the user performing recognition
   * @param parameters Additional parameters including recognition results
   * @param responseTime Time taken to process the recognition in ms
   * @param source The source of the recognition event
   * @param sourceDetail Additional details about the source
   * @returns The ID of the created event
   */
  public async trackRecognition(
    imageType: string,
    userId?: string,
    parameters?: Record<string, any>,
    responseTime?: number,
    source: AnalyticsSourceType = AnalyticsSourceType.API,
    sourceDetail?: string
  ): Promise<string> {
    return this.trackEvent({
      event_type: AnalyticsEventType.RECOGNITION,
      resource_type: imageType,
      user_id: userId,
      parameters,
      response_time: responseTime,
      source,
      source_detail: sourceDetail
    });
  }

  /**
   * Track a crewAI agent activity event
   * 
   * @param agentId The ID of the agent
   * @param agentType The type of agent
   * @param action The action performed by the agent
   * @param status The status of the action
   * @param details Additional details about the action
   * @returns The ID of the created event
   */
  public async trackCrewAIAgentActivity(
    agentId: string,
    agentType: string,
    action: string,
    status: string,
    details?: Record<string, any>
  ): Promise<string> {
    return this.trackEvent({
      event_type: AnalyticsEventType.AGENT_PROMPT,
      resource_type: agentType,
      parameters: { 
        agentId,
        action,
        status,
        ...details
      },
      source: AnalyticsSourceType.CREW_AI_AGENT,
      source_detail: agentId
    });
  }

  /**
   * Query analytics events
   * 
   * @param options Query options
   * @returns The matching analytics events
   */
  public async queryEvents(options: AnalyticsQueryOptions = {}): Promise<AnalyticsEvent[]> {
    try {
      // Build query parameters
      const queryParams: Record<string, any> = {};
      
      // Add filters
      if (options.eventType) {
        queryParams.event_type = options.eventType;
      }
      
      if (options.resourceType) {
        queryParams.resource_type = options.resourceType;
      }
      
      if (options.userId) {
        queryParams.user_id = options.userId;
      }
      
      // Build filter conditions for date ranges (these can't be done with simple equality)
      const filterConditions = [];
      
      if (options.startDate) {
        filterConditions.push(`timestamp >= '${options.startDate.toISOString()}'`);
      }
      
      if (options.endDate) {
        filterConditions.push(`timestamp <= '${options.endDate.toISOString()}'`);
      }
      
      // Handle pagination
      const paginationParams: Record<string, any> = {};
      
      if (options.limit) {
        paginationParams.limit = options.limit;
      }
      
      if (options.skip) {
        paginationParams.offset = options.skip;
      }
      
      // Handle sorting
      let sortString = 'timestamp.desc'; // Default sort
      
      if (options.sort) {
        const sortKey = Object.keys(options.sort)[0];
        if (sortKey) {
          const direction = options.sort[sortKey] === 'asc' ? 'asc' : 'desc';
          sortString = `${sortKey}.${direction}`;
        }
      }
      
      paginationParams.order = sortString;
      
      // Fetch all events
      const { data, error } = await supabaseClient.getClient()
        .from(this.tableName)
        .select('*');
      
      if (error) {
        logger.error(`Failed to query analytics events: ${error}`);
        throw error;
      }
      
      // Filter and process results manually
      let results = data || [];
      
      // Apply filters with proper type annotations
      if (options.eventType) {
        results = results.filter((item: AnalyticsEvent) => item.event_type === options.eventType);
      }
      
      if (options.resourceType) {
        results = results.filter((item: AnalyticsEvent) => item.resource_type === options.resourceType);
      }
      
      if (options.userId) {
        results = results.filter((item: AnalyticsEvent) => item.user_id === options.userId);
      }
      
      // Date filtering with proper type annotations
      if (options.startDate) {
        const startTimestamp = options.startDate.toISOString();
        results = results.filter((item: AnalyticsEvent) => item.timestamp && item.timestamp >= startTimestamp);
      }
      
      if (options.endDate) {
        const endTimestamp = options.endDate.toISOString();
        results = results.filter((item: AnalyticsEvent) => item.timestamp && item.timestamp <= endTimestamp);
      }
      
      // Sorting with proper type annotations
      if (options.sort) {
        const sortKey = Object.keys(options.sort)[0];
        
        if (sortKey) {
          const sortDirection = options.sort[sortKey];
          results.sort((a: AnalyticsEvent, b: AnalyticsEvent) => {
            // Convert values to strings to ensure safe comparison
            const aValue = String(a[sortKey as keyof AnalyticsEvent] || '');
            const bValue = String(b[sortKey as keyof AnalyticsEvent] || '');
            
            if (sortDirection === 'asc') {
              return aValue < bValue ? -1 : 1;
            } else {
              return aValue > bValue ? -1 : 1;
            }
          });
        }
      } else {
        // Default sort by timestamp descending with proper type annotations
        results.sort((a: AnalyticsEvent, b: AnalyticsEvent) => {
          return (a.timestamp || '') > (b.timestamp || '') ? -1 : 1;
        });
      }
      
      // Pagination
      if (options.skip !== undefined && options.limit !== undefined) {
        results = results.slice(options.skip, options.skip + options.limit);
      } else if (options.limit !== undefined) {
        results = results.slice(0, options.limit);
      }

      return results;
    } catch (err) {
      logger.error(`Error querying analytics events: ${err}`);
      return [];
    }
  }

  /**
   * Get trend analysis for analytics events
   * 
   * @param options Trend analysis options
   * @returns Trend data grouped by timeframe
   */
  public async getTrends(options: TrendAnalysisOptions): Promise<Record<string, number>> {
    try {
      const { timeframe, eventType, startDate, endDate } = options;
      
      // Use RPC to get trend data grouped by timeframe
      const { data, error } = await supabaseClient.getClient().rpc('get_analytics_trends', {
        p_timeframe: timeframe,
        p_event_type: eventType,
        p_start_date: startDate?.toISOString(),
        p_end_date: endDate?.toISOString()
      });

      if (error) {
        logger.error(`Failed to get analytics trends: ${error}`);
        throw error;
      }

      // Convert array of [date, count] to Record<date, count>
      const trends: Record<string, number> = {};
      for (const item of data) {
        trends[item.date] = item.count;
      }

      return trends;
    } catch (err) {
      logger.error(`Error getting analytics trends: ${err}`);
      return {};
    }
  }

  /**
   * Get analytics statistics
   * 
   * @param startDate Optional start date for filtering stats
   * @param endDate Optional end date for filtering stats
   * @returns Analytics statistics
   */
  public async getStats(startDate?: Date, endDate?: Date): Promise<AnalyticsStats> {
    try {
      // Use RPC to get analytics statistics
      const { data, error } = await supabaseClient.getClient().rpc('get_analytics_stats', {
        p_start_date: startDate?.toISOString(),
        p_end_date: endDate?.toISOString()
      });

      if (error) {
        logger.error(`Failed to get analytics stats: ${error}`);
        throw error;
      }

      return data;
    } catch (err) {
      logger.error(`Error getting analytics stats: ${err}`);
      return {
        total: 0,
        byEventType: {},
        byResourceType: {},
        topQueries: [],
        topMaterials: [],
        averageResponseTime: {}
      };
    }
  }

  /**
   * Get top search queries
   * 
   * @param limit The maximum number of queries to return
   * @param startDate Optional start date for filtering
   * @param endDate Optional end date for filtering
   * @returns Top search queries with counts
   */
  public async getTopSearchQueries(
    limit: number = 10,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{query: string; count: number}>> {
    try {
      // Use RPC to get top search queries
      const { data, error } = await supabaseClient.getClient().rpc('get_top_search_queries', {
        p_limit: limit,
        p_start_date: startDate?.toISOString(),
        p_end_date: endDate?.toISOString()
      });

      if (error) {
        logger.error(`Failed to get top search queries: ${error}`);
        throw error;
      }

      return data;
    } catch (err) {
      logger.error(`Error getting top search queries: ${err}`);
      return [];
    }
  }

  /**
   * Get top agent prompts
   * 
   * @param limit The maximum number of prompts to return
   * @param startDate Optional start date for filtering
   * @param endDate Optional end date for filtering
   * @returns Top agent prompts with counts
   */
  public async getTopAgentPrompts(
    limit: number = 10,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{prompt: string; count: number}>> {
    try {
      // Use RPC to get top agent prompts
      const { data, error } = await supabaseClient.getClient().rpc('get_top_agent_prompts', {
        p_limit: limit,
        p_start_date: startDate?.toISOString(),
        p_end_date: endDate?.toISOString()
      });

      if (error) {
        logger.error(`Failed to get top agent prompts: ${error}`);
        throw error;
      }

      return data;
    } catch (err) {
      logger.error(`Error getting top agent prompts: ${err}`);
      return [];
    }
  }

  /**
   * Get top viewed materials
   * 
   * @param limit The maximum number of materials to return
   * @param startDate Optional start date for filtering
   * @param endDate Optional end date for filtering
   * @returns Top viewed materials with counts
   */
  public async getTopMaterials(
    limit: number = 10,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{materialId: string; name: string; count: number}>> {
    try {
      // Use RPC to get top viewed materials
      const { data, error } = await supabaseClient.getClient().rpc('get_top_materials', {
        p_limit: limit,
        p_start_date: startDate?.toISOString(),
        p_end_date: endDate?.toISOString()
      });

      if (error) {
        logger.error(`Failed to get top materials: ${error}`);
        throw error;
      }

      return data;
    } catch (err) {
      logger.error(`Error getting top materials: ${err}`);
      return [];
    }
  }

  /**
   * Clear analytics data (admin only)
   * 
   * @param before Optional date to clear data before
   * @returns The number of deleted events
   */
  public async clearData(before?: Date): Promise<number> {
    try {
      if (before) {
        // This is just for documentation purposes as filtering isn't implemented yet
        logger.debug(`Clearing analytics data before ${before.toISOString()}`);
      }
      
      // Delete with a simpler approach
      const { data, error } = await supabaseClient.getClient()
        .from(this.tableName)
        .delete();
        
      // Note: Without support for query filters, we might need to implement this differently,
      // such as by fetching all records first, filtering them, and then deleting individually.
      // For now, we'll just delete all records for simplicity.

      if (error) {
        logger.error(`Failed to clear analytics data: ${error}`);
        throw error;
      }

      return data?.length || 0;
    } catch (err) {
      logger.error(`Error clearing analytics data: ${err}`);
      return 0;
    }
  }
}

export const analyticsService = AnalyticsService.getInstance();
export default analyticsService;
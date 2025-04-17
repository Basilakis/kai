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

import { supabase } from '../supabase/supabaseClient';
import optimizedClient from '../../../../shared/src/services/supabase/optimizedClient';
import { withConnection } from '../../../../shared/src/services/supabase/connectionPool';
import { withCache } from '../../../../shared/src/services/supabase/queryCache';
import { logger } from '../../utils/logger';
import mcpClientService, { MCPServiceKey } from '../mcp/mcpClientService';
import creditService from '../credit/creditService';

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
   * Check if MCP is available for analytics processing
   * @returns True if MCP is available
   */
  private async isMCPAvailable(): Promise<boolean> {
    try {
      return await mcpClientService.isMCPAvailable();
    } catch (error) {
      logger.error(`Error checking MCP availability: ${error}`);
      return false;
    }
  }

  /**
   * Initialize the service, creating database table if needed
   */
  private async initializeService(): Promise<void> {
    // Check if the table exists, and create it if it doesn't
    try {
      // Use withConnection for better connection management
      await withConnection(async (client) => {
        const { error } = await client
          .from(this.tableName)
          .select('id');

        if (error && error.code === '42P01') {
          // Table doesn't exist, create it
          logger.info(`Creating analytics_events table`);
          await this.createAnalyticsTable();
        }

        return true; // Return value is required for withConnection
      });
    } catch (err) {
      logger.error(`Error checking analytics table: ${err}`);
    }
  }

  /**
   * Create the analytics_events table in the database
   */
  private async createAnalyticsTable(): Promise<void> {
    try {
      // Use withConnection for better connection management
      await withConnection(async (client) => {
        const { error } = await client.rpc('create_analytics_table');

        if (error) {
          logger.error(`Failed to create analytics table: ${error}`);
          throw error;
        }

        return true; // Return value is required for withConnection
      });

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

      // Check if MCP is available and user ID is provided
      const mcpAvailable = await this.isMCPAvailable();
      const userId = event.user_id;

      if (mcpAvailable && userId) {
        try {
          // Estimate event count (1 event = 1 unit)
          const estimatedUnits = 1;

          // Check if user has enough credits
          const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
            userId,
            MCPServiceKey.ANALYTICS_PROCESSING,
            estimatedUnits
          );

          if (hasEnoughCredits) {
            // Use MCP for analytics processing
            const mcpResult = await mcpClientService.processAnalyticsEvent(
              userId,
              {
                eventType: event.event_type,
                resourceType: event.resource_type,
                query: event.query,
                parameters: event.parameters,
                timestamp: event.timestamp,
                source: event.source,
                sourceDetail: event.source_detail
              }
            );

            // Track credit usage
            await creditService.useServiceCredits(
              userId,
              MCPServiceKey.ANALYTICS_PROCESSING,
              estimatedUnits,
              `${MCPServiceKey.ANALYTICS_PROCESSING} API usage`,
              {
                eventType: event.event_type,
                timestamp: event.timestamp
              }
            );

            return mcpResult.id;
          }
        } catch (mcpError: any) {
          // For MCP errors, log and fall back to direct implementation
          // We don't want to disrupt analytics for credit issues
          logger.warn(`MCP analytics processing failed, falling back to direct implementation: ${mcpError.message}`);
        }
      }

      // Fall back to direct implementation if MCP is not available or failed
      // Use optimized client for better performance
      await optimizedClient.insert(
        this.tableName,
        event,
        {
          cacheEnabled: false, // Don't cache analytics inserts
          useConnectionPool: true,
          retryCount: 2 // Retry a couple times for reliability
        }
      );

      // If we need the ID, fetch the inserted record separately
      if (data && data[0] && data[0].id) {
        return data[0].id;
      } else {
        // Using optimized client for better performance
        const timestamp = event.timestamp;

        try {
          // Use withCache to improve performance for repeated queries
          const fetchedData = await withCache(
            this.tableName,
            'select_recent',
            { timestamp },
            async () => {
              // Use optimized client for better performance
              return optimizedClient.select(
                this.tableName,
                {
                  columns: 'id,timestamp',
                  filters: {},
                  orderBy: 'timestamp',
                  orderDirection: 'desc',
                  limit: 10
                },
                { cacheTtlMs: 5000 } // Short cache time for recent inserts
              );
            },
            5000 // Cache for 5 seconds
          );

          // Find the record with matching timestamp
          const matchedRecord = fetchedData?.find((record: { timestamp: string; id: string }) => record.timestamp === timestamp);
          return matchedRecord?.id || '';
        } catch (err) {
          logger.error(`Failed to fetch inserted analytics event: ${err}`);
          return '';
        }
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
   * @param requestUserId User ID making the request (for MCP integration)
   * @returns The matching analytics events
   */
  public async queryEvents(options: AnalyticsQueryOptions = {}, requestUserId?: string): Promise<AnalyticsEvent[]> {
    try {
      // Check if MCP is available and user ID is provided
      const mcpAvailable = await this.isMCPAvailable();

      if (mcpAvailable && requestUserId) {
        try {
          // Estimate query complexity (1 unit per query)
          const estimatedUnits = 1;

          // Check if user has enough credits
          const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
            requestUserId,
            MCPServiceKey.ANALYTICS_REPORTING,
            estimatedUnits
          );

          if (hasEnoughCredits) {
            // Use MCP for analytics query
            const mcpResult = await mcpClientService.queryAnalyticsEvents(
              requestUserId,
              {
                eventType: options.eventType,
                resourceType: options.resourceType,
                userId: options.userId,
                startDate: options.startDate?.toISOString(),
                endDate: options.endDate?.toISOString(),
                limit: options.limit,
                skip: options.skip,
                sort: options.sort
              }
            );

            // Track credit usage
            await creditService.useServiceCredits(
              requestUserId,
              MCPServiceKey.ANALYTICS_REPORTING,
              estimatedUnits,
              `${MCPServiceKey.ANALYTICS_REPORTING} API usage`,
              {
                queryType: 'events',
                filters: {
                  eventType: options.eventType,
                  resourceType: options.resourceType,
                  userId: options.userId
                }
              }
            );

            return mcpResult;
          }
        } catch (mcpError: any) {
          // For MCP errors, log and fall back to direct implementation
          logger.warn(`MCP analytics query failed, falling back to direct implementation: ${mcpError.message}`);
        }
      }

      // Fall back to direct implementation if MCP is not available or failed
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

      // Use optimized client for better performance with caching
      const data = await optimizedClient.select(
        this.tableName,
        { columns: '*' },
        {
          cacheEnabled: true,
          cacheTtlMs: 30000, // Cache for 30 seconds
          useConnectionPool: true
        }
      );

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
   * @param requestUserId User ID making the request (for MCP integration)
   * @returns Trend data grouped by timeframe
   */
  public async getTrends(options: TrendAnalysisOptions, requestUserId?: string): Promise<Record<string, number>> {
    try {
      const { timeframe, eventType, startDate, endDate } = options;

      // Check if MCP is available and user ID is provided
      const mcpAvailable = await this.isMCPAvailable();

      if (mcpAvailable && requestUserId) {
        try {
          // Estimate query complexity (2 units per trends query)
          const estimatedUnits = 2;

          // Check if user has enough credits
          const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
            requestUserId,
            MCPServiceKey.ANALYTICS_TRENDS,
            estimatedUnits
          );

          if (hasEnoughCredits) {
            // Use MCP for analytics trends
            const mcpResult = await mcpClientService.getAnalyticsTrends(
              requestUserId,
              {
                timeframe,
                eventType,
                startDate: startDate?.toISOString(),
                endDate: endDate?.toISOString()
              }
            );

            // Track credit usage
            await creditService.useServiceCredits(
              requestUserId,
              MCPServiceKey.ANALYTICS_TRENDS,
              estimatedUnits,
              `${MCPServiceKey.ANALYTICS_TRENDS} API usage`,
              {
                timeframe,
                eventType
              }
            );

            return mcpResult;
          }
        } catch (mcpError: any) {
          // For MCP errors, log and fall back to direct implementation
          logger.warn(`MCP analytics trends failed, falling back to direct implementation: ${mcpError.message}`);
        }
      }

      // Fall back to direct implementation if MCP is not available or failed
      // Use withCache for better performance on trend queries
      const data = await withCache(
        'analytics_trends',
        'get_trends',
        { timeframe, eventType, startDate, endDate },
        async () => {
          // Use withConnection for better connection management
          return withConnection(async (client) => {
            const { data, error } = await client.rpc('get_analytics_trends', {
              p_timeframe: timeframe,
              p_event_type: eventType,
              p_start_date: startDate?.toISOString(),
              p_end_date: endDate?.toISOString()
            });

            if (error) {
              logger.error(`Failed to get analytics trends: ${error}`);
              throw error;
            }

            return data;
          });
        },
        60000 // Cache for 1 minute
      );

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
   * @param requestUserId User ID making the request (for MCP integration)
   * @returns Analytics statistics
   */
  public async getStats(startDate?: Date, endDate?: Date, requestUserId?: string): Promise<AnalyticsStats> {
    try {
      // Check if MCP is available and user ID is provided
      const mcpAvailable = await this.isMCPAvailable();

      if (mcpAvailable && requestUserId) {
        try {
          // Estimate query complexity (2 units per stats query)
          const estimatedUnits = 2;

          // Check if user has enough credits
          const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
            requestUserId,
            MCPServiceKey.ANALYTICS_STATS,
            estimatedUnits
          );

          if (hasEnoughCredits) {
            // Use MCP for analytics stats
            const mcpResult = await mcpClientService.getAnalyticsStats(
              requestUserId,
              {
                startDate: startDate?.toISOString(),
                endDate: endDate?.toISOString()
              }
            );

            // Track credit usage
            await creditService.useServiceCredits(
              requestUserId,
              MCPServiceKey.ANALYTICS_STATS,
              estimatedUnits,
              `${MCPServiceKey.ANALYTICS_STATS} API usage`,
              {
                startDate: startDate?.toISOString(),
                endDate: endDate?.toISOString()
              }
            );

            return mcpResult;
          }
        } catch (mcpError: any) {
          // For MCP errors, log and fall back to direct implementation
          logger.warn(`MCP analytics stats failed, falling back to direct implementation: ${mcpError.message}`);
        }
      }

      // Fall back to direct implementation if MCP is not available or failed
      // Use withCache for better performance on stats queries
      const data = await withCache(
        'analytics_stats',
        'get_stats',
        { startDate, endDate },
        async () => {
          // Use withConnection for better connection management
          return withConnection(async (client) => {
            const { data, error } = await client.rpc('get_analytics_stats', {
              p_start_date: startDate?.toISOString(),
              p_end_date: endDate?.toISOString()
            });

            if (error) {
              logger.error(`Failed to get analytics stats: ${error}`);
              throw error;
            }

            return data;
          });
        },
        60000 // Cache for 1 minute
      );

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
   * @param requestUserId User ID making the request (for MCP integration)
   * @returns Top search queries with counts
   */
  public async getTopSearchQueries(
    limit: number = 10,
    startDate?: Date,
    endDate?: Date,
    requestUserId?: string
  ): Promise<Array<{query: string; count: number}>> {
    try {
      // Check if MCP is available and user ID is provided
      const mcpAvailable = await this.isMCPAvailable();

      if (mcpAvailable && requestUserId) {
        try {
          // Estimate query complexity (1 unit per search query)
          const estimatedUnits = 1;

          // Check if user has enough credits
          const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
            requestUserId,
            MCPServiceKey.ANALYTICS_REPORTING,
            estimatedUnits
          );

          if (hasEnoughCredits) {
            // Use MCP for top search queries
            const mcpResult = await mcpClientService.queryAnalyticsEvents(
              requestUserId,
              {
                eventType: 'search',
                startDate: startDate?.toISOString(),
                endDate: endDate?.toISOString(),
                limit
              }
            );

            // Process results to match expected format
            const processedResults = [];
            const queryCountMap: Record<string, number> = {};

            // Count occurrences of each query
            for (const event of mcpResult) {
              const query = event.query || '';
              if (query) {
                queryCountMap[query] = (queryCountMap[query] || 0) + 1;
              }
            }

            // Convert to array and sort
            for (const [query, count] of Object.entries(queryCountMap)) {
              processedResults.push({ query, count });
            }

            // Sort by count descending
            processedResults.sort((a, b) => b.count - a.count);

            // Limit results
            const limitedResults = processedResults.slice(0, limit);

            // Track credit usage
            await creditService.useServiceCredits(
              requestUserId,
              MCPServiceKey.ANALYTICS_REPORTING,
              estimatedUnits,
              `${MCPServiceKey.ANALYTICS_REPORTING} API usage`,
              {
                queryType: 'top_searches',
                limit
              }
            );

            return limitedResults;
          }
        } catch (mcpError: any) {
          // For MCP errors, log and fall back to direct implementation
          logger.warn(`MCP top search queries failed, falling back to direct implementation: ${mcpError.message}`);
        }
      }

      // Fall back to direct implementation if MCP is not available or failed
      // Use withCache for better performance on top queries
      const data = await withCache(
        'top_search_queries',
        'get_top_queries',
        { limit, startDate, endDate },
        async () => {
          // Use withConnection for better connection management
          return withConnection(async (client) => {
            const { data, error } = await client.rpc('get_top_search_queries', {
              p_limit: limit,
              p_start_date: startDate?.toISOString(),
              p_end_date: endDate?.toISOString()
            });

            if (error) {
              logger.error(`Failed to get top search queries: ${error}`);
              throw error;
            }

            return data;
          });
        },
        120000 // Cache for 2 minutes
      );

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
   * @param requestUserId User ID making the request (for MCP integration)
   * @returns Top agent prompts with counts
   */
  public async getTopAgentPrompts(
    limit: number = 10,
    startDate?: Date,
    endDate?: Date,
    requestUserId?: string
  ): Promise<Array<{prompt: string; count: number}>> {
    try {
      // Check if MCP is available and user ID is provided
      const mcpAvailable = await this.isMCPAvailable();

      if (mcpAvailable && requestUserId) {
        try {
          // Estimate query complexity (1 unit per agent prompts query)
          const estimatedUnits = 1;

          // Check if user has enough credits
          const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
            requestUserId,
            MCPServiceKey.ANALYTICS_REPORTING,
            estimatedUnits
          );

          if (hasEnoughCredits) {
            // Use MCP for top agent prompts
            const mcpResult = await mcpClientService.queryAnalyticsEvents(
              requestUserId,
              {
                eventType: 'agent_prompt',
                startDate: startDate?.toISOString(),
                endDate: endDate?.toISOString(),
                limit
              }
            );

            // Process results to match expected format
            const processedResults = [];
            const promptCountMap: Record<string, number> = {};

            // Count occurrences of each prompt
            for (const event of mcpResult) {
              const parameters = event.parameters || {};
              const prompt = parameters.prompt || '';
              if (prompt) {
                promptCountMap[prompt] = (promptCountMap[prompt] || 0) + 1;
              }
            }

            // Convert to array and sort
            for (const [prompt, count] of Object.entries(promptCountMap)) {
              processedResults.push({ prompt, count });
            }

            // Sort by count descending
            processedResults.sort((a, b) => b.count - a.count);

            // Limit results
            const limitedResults = processedResults.slice(0, limit);

            // Track credit usage
            await creditService.useServiceCredits(
              requestUserId,
              MCPServiceKey.ANALYTICS_REPORTING,
              estimatedUnits,
              `${MCPServiceKey.ANALYTICS_REPORTING} API usage`,
              {
                queryType: 'top_agent_prompts',
                limit
              }
            );

            return limitedResults;
          }
        } catch (mcpError: any) {
          // For MCP errors, log and fall back to direct implementation
          logger.warn(`MCP top agent prompts failed, falling back to direct implementation: ${mcpError.message}`);
        }
      }

      // Fall back to direct implementation if MCP is not available or failed
      // Use withCache for better performance on top prompts
      const data = await withCache(
        'top_agent_prompts',
        'get_top_prompts',
        { limit, startDate, endDate },
        async () => {
          // Use withConnection for better connection management
          return withConnection(async (client) => {
            const { data, error } = await client.rpc('get_top_agent_prompts', {
              p_limit: limit,
              p_start_date: startDate?.toISOString(),
              p_end_date: endDate?.toISOString()
            });

            if (error) {
              logger.error(`Failed to get top agent prompts: ${error}`);
              throw error;
            }

            return data;
          });
        },
        120000 // Cache for 2 minutes
      );

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
   * @param requestUserId User ID making the request (for MCP integration)
   * @returns Top viewed materials with counts
   */
  public async getTopMaterials(
    limit: number = 10,
    startDate?: Date,
    endDate?: Date,
    requestUserId?: string
  ): Promise<Array<{materialId: string; name: string; count: number}>> {
    try {
      // Check if MCP is available and user ID is provided
      const mcpAvailable = await this.isMCPAvailable();

      if (mcpAvailable && requestUserId) {
        try {
          // Estimate query complexity (1 unit per materials query)
          const estimatedUnits = 1;

          // Check if user has enough credits
          const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
            requestUserId,
            MCPServiceKey.ANALYTICS_REPORTING,
            estimatedUnits
          );

          if (hasEnoughCredits) {
            // Use MCP for top materials
            const mcpResult = await mcpClientService.queryAnalyticsEvents(
              requestUserId,
              {
                eventType: 'view',
                resourceType: 'material',
                startDate: startDate?.toISOString(),
                endDate: endDate?.toISOString(),
                limit
              }
            );

            // Process results to match expected format
            const processedResults = [];
            const materialCountMap: Record<string, {id: string; name: string; count: number}> = {};

            // Count occurrences of each material
            for (const event of mcpResult) {
              const parameters = event.parameters || {};
              const materialId = parameters.materialId || '';
              const materialName = parameters.materialName || 'Unknown Material';

              if (materialId) {
                if (!materialCountMap[materialId]) {
                  materialCountMap[materialId] = {
                    id: materialId,
                    name: materialName,
                    count: 0
                  };
                }
                materialCountMap[materialId].count++;
              }
            }

            // Convert to array and sort
            for (const material of Object.values(materialCountMap)) {
              processedResults.push({
                materialId: material.id,
                name: material.name,
                count: material.count
              });
            }

            // Sort by count descending
            processedResults.sort((a, b) => b.count - a.count);

            // Limit results
            const limitedResults = processedResults.slice(0, limit);

            // Track credit usage
            await creditService.useServiceCredits(
              requestUserId,
              MCPServiceKey.ANALYTICS_REPORTING,
              estimatedUnits,
              `${MCPServiceKey.ANALYTICS_REPORTING} API usage`,
              {
                queryType: 'top_materials',
                limit
              }
            );

            return limitedResults;
          }
        } catch (mcpError: any) {
          // For MCP errors, log and fall back to direct implementation
          logger.warn(`MCP top materials failed, falling back to direct implementation: ${mcpError.message}`);
        }
      }

      // Fall back to direct implementation if MCP is not available or failed
      // Use withCache for better performance on top materials
      const data = await withCache(
        'top_materials',
        'get_top_materials',
        { limit, startDate, endDate },
        async () => {
          // Use withConnection for better connection management
          return withConnection(async (client) => {
            const { data, error } = await client.rpc('get_top_materials', {
              p_limit: limit,
              p_start_date: startDate?.toISOString(),
              p_end_date: endDate?.toISOString()
            });

            if (error) {
              logger.error(`Failed to get top materials: ${error}`);
              throw error;
            }

            return data;
          });
        },
        120000 // Cache for 2 minutes
      );

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

      // Use optimized client for better performance
      const data = await optimizedClient.executeQuery(
        this.tableName,
        'delete_all',
        {},
        async (client) => {
          return client.from(this.tableName).delete();
        },
        {
          cacheEnabled: false, // Don't cache delete operations
          useConnectionPool: true
        }
      );

      // Invalidate all caches related to analytics
      optimizedClient.invalidateCache(this.tableName);
      optimizedClient.invalidateCache('analytics_trends');
      optimizedClient.invalidateCache('analytics_stats');
      optimizedClient.invalidateCache('top_search_queries');
      optimizedClient.invalidateCache('top_agent_prompts');
      optimizedClient.invalidateCache('top_materials');

      return data?.length || 0;
    } catch (err) {
      logger.error(`Error clearing analytics data: ${err}`);
      return 0;
    }
  }
}

export const analyticsService = AnalyticsService.getInstance();
export default analyticsService;
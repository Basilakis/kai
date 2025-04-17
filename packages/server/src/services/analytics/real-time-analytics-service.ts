/**
 * Real-Time Analytics Service
 *
 * This service provides real-time analytics processing capabilities,
 * allowing for immediate insights and notifications based on user activity.
 */

import { logger } from '../../utils/logger';
import { supabase } from '../supabase/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import mcpClientService, { MCPServiceKey } from '../mcp/mcpClientService';
import creditService from '../credit/creditService';
import { WebSocketServer } from 'ws';
import http from 'http';
import { AnalyticsEvent } from './analyticsService';

/**
 * Real-time analytics event
 */
export interface RealTimeAnalyticsEvent extends AnalyticsEvent {
  processed_at?: string;
  insights?: Record<string, any>;
}

/**
 * Real-time analytics options
 */
export interface RealTimeAnalyticsOptions {
  enableAnomalyDetection?: boolean;
  enableTrendDetection?: boolean;
  enableUserBehaviorTracking?: boolean;
  notificationThreshold?: number;
  aggregationWindow?: number; // in seconds
}

/**
 * Real-time analytics subscription
 */
interface RealTimeAnalyticsSubscription {
  id: string;
  userId: string;
  filters: Record<string, any>;
  callback: (event: RealTimeAnalyticsEvent) => void;
  options: RealTimeAnalyticsOptions;
}

/**
 * Real-Time Analytics Service class
 */
class RealTimeAnalyticsService {
  private static instance: RealTimeAnalyticsService;
  private subscriptions: Map<string, RealTimeAnalyticsSubscription>;
  private eventBuffer: RealTimeAnalyticsEvent[];
  private processingInterval: NodeJS.Timeout | null;
  private wss: WebSocketServer | null;
  private readonly tableName = 'real_time_analytics_events';
  private readonly bufferSize = 100;
  private readonly processingIntervalMs = 1000; // 1 second
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.subscriptions = new Map<string, RealTimeAnalyticsSubscription>();
    this.eventBuffer = [];
    this.processingInterval = null;
    this.wss = null;
    this.initializeService().catch(err => {
      logger.error(`Failed to initialize RealTimeAnalyticsService: ${err}`);
    });
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): RealTimeAnalyticsService {
    if (!RealTimeAnalyticsService.instance) {
      RealTimeAnalyticsService.instance = new RealTimeAnalyticsService();
    }
    return RealTimeAnalyticsService.instance;
  }
  
  /**
   * Initialize the service
   */
  private async initializeService(): Promise<void> {
    try {
      // Check if the table exists, and create it if it doesn't
      const { error } = await supabase.getClient()
        .from(this.tableName)
        .select('id')
        .limit(1);
      
      if (error && error.code === '42P01') {
        // Table doesn't exist, create it
        logger.info(`Creating ${this.tableName} table`);
        await this.createRealTimeAnalyticsTable();
      }
      
      // Start processing interval
      this.startProcessing();
    } catch (err) {
      logger.error(`Error initializing real-time analytics service: ${err}`);
    }
  }
  
  /**
   * Create the real_time_analytics_events table in the database
   */
  private async createRealTimeAnalyticsTable(): Promise<void> {
    try {
      const { error } = await supabase.getClient().rpc('create_real_time_analytics_table');
      
      if (error) {
        logger.error(`Failed to create real-time analytics table: ${error}`);
        throw error;
      }
      
      logger.info('Real-time analytics table created successfully');
    } catch (err) {
      logger.error(`Error creating real-time analytics table: ${err}`);
      throw err;
    }
  }
  
  /**
   * Start processing events
   */
  private startProcessing(): void {
    if (this.processingInterval) {
      return;
    }
    
    this.processingInterval = setInterval(() => {
      this.processEventBuffer().catch(err => {
        logger.error(`Error processing event buffer: ${err}`);
      });
    }, this.processingIntervalMs);
    
    logger.info('Real-time analytics processing started');
  }
  
  /**
   * Stop processing events
   */
  private stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('Real-time analytics processing stopped');
    }
  }
  
  /**
   * Process event buffer
   */
  private async processEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }
    
    // Take events from buffer
    const events = [...this.eventBuffer];
    this.eventBuffer = [];
    
    // Process events
    const processedEvents = await this.processEvents(events);
    
    // Notify subscribers
    this.notifySubscribers(processedEvents);
    
    // Broadcast to WebSocket clients
    this.broadcastEvents(processedEvents);
    
    // Store processed events
    await this.storeProcessedEvents(processedEvents);
  }
  
  /**
   * Process events
   */
  private async processEvents(events: RealTimeAnalyticsEvent[]): Promise<RealTimeAnalyticsEvent[]> {
    // Group events by user
    const eventsByUser: Record<string, RealTimeAnalyticsEvent[]> = {};
    
    for (const event of events) {
      if (event.user_id) {
        if (!eventsByUser[event.user_id]) {
          eventsByUser[event.user_id] = [];
        }
        eventsByUser[event.user_id].push(event);
      }
    }
    
    // Process events for each user
    const processedEvents: RealTimeAnalyticsEvent[] = [];
    
    for (const [userId, userEvents] of Object.entries(eventsByUser)) {
      try {
        // Check if MCP is available
        const mcpAvailable = await this.isMCPAvailable();
        
        if (mcpAvailable) {
          // Use MCP for real-time analytics processing
          const mcpProcessedEvents = await this.processMCPEvents(userId, userEvents);
          processedEvents.push(...mcpProcessedEvents);
        } else {
          // Use direct implementation
          const directProcessedEvents = this.processDirectEvents(userEvents);
          processedEvents.push(...directProcessedEvents);
        }
      } catch (error) {
        logger.error(`Error processing events for user ${userId}: ${error}`);
        
        // Add events with basic processing
        for (const event of userEvents) {
          processedEvents.push({
            ...event,
            processed_at: new Date().toISOString(),
            insights: {
              error: 'Failed to process event',
              message: error instanceof Error ? error.message : 'Unknown error'
            }
          });
        }
      }
    }
    
    return processedEvents;
  }
  
  /**
   * Process events using MCP
   */
  private async processMCPEvents(
    userId: string,
    events: RealTimeAnalyticsEvent[]
  ): Promise<RealTimeAnalyticsEvent[]> {
    try {
      // Check if user has enough credits
      const estimatedUnits = Math.ceil(events.length / 10); // 1 credit per 10 events
      
      const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
        userId,
        MCPServiceKey.ANALYTICS_PROCESSING,
        estimatedUnits
      );
      
      if (!hasEnoughCredits) {
        // Process events directly if not enough credits
        return this.processDirectEvents(events);
      }
      
      // Use MCP for real-time analytics processing
      const mcpResult = await mcpClientService.processRealTimeAnalytics(
        userId,
        {
          events: events.map(event => ({
            id: event.id,
            event_type: event.event_type,
            resource_type: event.resource_type,
            resource_id: event.resource_id,
            user_id: event.user_id,
            query: event.query,
            parameters: event.parameters,
            timestamp: event.timestamp,
            source: event.source,
            source_detail: event.source_detail
          }))
        }
      );
      
      // Track credit usage
      await creditService.useServiceCredits(
        userId,
        MCPServiceKey.ANALYTICS_PROCESSING,
        estimatedUnits,
        `${MCPServiceKey.ANALYTICS_PROCESSING} API usage`,
        {
          eventCount: events.length,
          processingType: 'real-time'
        }
      );
      
      // Map MCP results back to events
      return mcpResult.processedEvents.map(processedEvent => {
        const originalEvent = events.find(e => e.id === processedEvent.id);
        
        if (!originalEvent) {
          return processedEvent as RealTimeAnalyticsEvent;
        }
        
        return {
          ...originalEvent,
          processed_at: processedEvent.processed_at || new Date().toISOString(),
          insights: processedEvent.insights || {}
        };
      });
    } catch (error) {
      logger.error(`Error processing events with MCP: ${error}`);
      
      // Fall back to direct processing
      return this.processDirectEvents(events);
    }
  }
  
  /**
   * Process events directly
   */
  private processDirectEvents(events: RealTimeAnalyticsEvent[]): RealTimeAnalyticsEvent[] {
    const now = new Date().toISOString();
    
    // Simple direct processing
    return events.map(event => {
      // Extract basic insights
      const insights: Record<string, any> = {
        processingType: 'direct',
        processingTime: now
      };
      
      // Add event type specific insights
      switch (event.event_type) {
        case 'search':
          insights.searchQuery = event.query;
          insights.searchParameters = event.parameters;
          break;
        
        case 'view':
          insights.viewedResource = event.resource_id;
          insights.viewedResourceType = event.resource_type;
          break;
        
        case 'agent_prompt':
          insights.promptContent = event.parameters?.prompt;
          insights.promptLength = event.parameters?.prompt?.length || 0;
          break;
        
        default:
          insights.eventType = event.event_type;
          break;
      }
      
      return {
        ...event,
        processed_at: now,
        insights
      };
    });
  }
  
  /**
   * Notify subscribers
   */
  private notifySubscribers(events: RealTimeAnalyticsEvent[]): void {
    for (const subscription of this.subscriptions.values()) {
      // Filter events based on subscription filters
      const filteredEvents = this.filterEvents(events, subscription.filters);
      
      // Notify subscriber if there are matching events
      if (filteredEvents.length > 0) {
        try {
          for (const event of filteredEvents) {
            subscription.callback(event);
          }
        } catch (error) {
          logger.error(`Error notifying subscriber ${subscription.id}: ${error}`);
        }
      }
    }
  }
  
  /**
   * Filter events based on subscription filters
   */
  private filterEvents(
    events: RealTimeAnalyticsEvent[],
    filters: Record<string, any>
  ): RealTimeAnalyticsEvent[] {
    return events.filter(event => {
      // Check each filter
      for (const [key, value] of Object.entries(filters)) {
        // Handle special case for user_id
        if (key === 'user_id' && event.user_id !== value) {
          return false;
        }
        
        // Handle special case for event_type
        if (key === 'event_type') {
          if (Array.isArray(value)) {
            if (!value.includes(event.event_type)) {
              return false;
            }
          } else if (event.event_type !== value) {
            return false;
          }
        }
        
        // Handle special case for resource_type
        if (key === 'resource_type') {
          if (Array.isArray(value)) {
            if (!value.includes(event.resource_type || '')) {
              return false;
            }
          } else if (event.resource_type !== value) {
            return false;
          }
        }
        
        // Handle special case for resource_id
        if (key === 'resource_id' && event.resource_id !== value) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * Broadcast events to WebSocket clients
   */
  private broadcastEvents(events: RealTimeAnalyticsEvent[]): void {
    if (!this.wss) {
      return;
    }
    
    // Group events by user
    const eventsByUser: Record<string, RealTimeAnalyticsEvent[]> = {};
    
    for (const event of events) {
      if (event.user_id) {
        if (!eventsByUser[event.user_id]) {
          eventsByUser[event.user_id] = [];
        }
        eventsByUser[event.user_id].push(event);
      }
    }
    
    // Broadcast to WebSocket clients
    this.wss.clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        try {
          // Get user ID from client
          const userId = (client as any).userId;
          
          if (userId && eventsByUser[userId]) {
            // Send events for this user
            client.send(JSON.stringify({
              type: 'real-time-analytics',
              events: eventsByUser[userId]
            }));
          }
        } catch (error) {
          logger.error(`Error broadcasting to WebSocket client: ${error}`);
        }
      }
    });
  }
  
  /**
   * Store processed events
   */
  private async storeProcessedEvents(events: RealTimeAnalyticsEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    
    try {
      // Store events in database
      const { error } = await supabase.getClient()
        .from(this.tableName)
        .insert(events.map(event => ({
          id: event.id,
          event_type: event.event_type,
          resource_type: event.resource_type,
          resource_id: event.resource_id,
          user_id: event.user_id,
          query: event.query,
          parameters: event.parameters,
          timestamp: event.timestamp,
          source: event.source,
          source_detail: event.source_detail,
          processed_at: event.processed_at,
          insights: event.insights
        })));
      
      if (error) {
        logger.error(`Error storing processed events: ${error}`);
      }
    } catch (error) {
      logger.error(`Error storing processed events: ${error}`);
    }
  }
  
  /**
   * Check if MCP is available
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
   * Initialize WebSocket server
   */
  public initialize(server: http.Server): void {
    // Create WebSocket server
    this.wss = new WebSocketServer({ server, path: '/api/analytics/real-time' });
    
    // Handle connections
    this.wss.on('connection', (ws, req) => {
      try {
        // Extract user ID from request
        const userId = req.url?.split('?')[1]?.split('=')[1];
        
        if (!userId) {
          ws.close(1008, 'User ID is required');
          return;
        }
        
        // Store user ID on client
        (ws as any).userId = userId;
        
        // Handle messages
        ws.on('message', (message) => {
          try {
            const data = JSON.parse(message.toString());
            
            // Handle subscription
            if (data.type === 'subscribe') {
              const subscriptionId = this.subscribe(
                userId,
                data.filters || {},
                (event) => {
                  if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'event',
                      event
                    }));
                  }
                },
                data.options || {}
              );
              
              // Send subscription confirmation
              ws.send(JSON.stringify({
                type: 'subscription',
                id: subscriptionId
              }));
            }
            
            // Handle unsubscription
            if (data.type === 'unsubscribe') {
              this.unsubscribe(data.id);
              
              // Send unsubscription confirmation
              ws.send(JSON.stringify({
                type: 'unsubscription',
                id: data.id
              }));
            }
          } catch (error) {
            logger.error(`Error handling WebSocket message: ${error}`);
          }
        });
        
        // Handle close
        ws.on('close', () => {
          // Clean up subscriptions for this user
          this.unsubscribeAll(userId);
        });
        
        // Send connection confirmation
        ws.send(JSON.stringify({
          type: 'connected',
          userId
        }));
      } catch (error) {
        logger.error(`Error handling WebSocket connection: ${error}`);
        ws.close(1011, 'Internal server error');
      }
    });
    
    logger.info('Real-time analytics WebSocket server initialized');
  }
  
  /**
   * Close WebSocket server
   */
  public close(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.wss) {
        resolve();
        return;
      }
      
      this.wss.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.wss = null;
          resolve();
        }
      });
    });
  }
  
  /**
   * Track an analytics event in real-time
   */
  public async trackEvent(event: AnalyticsEvent): Promise<string> {
    // Generate ID if not provided
    if (!event.id) {
      event.id = uuidv4();
    }
    
    // Set timestamp if not provided
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
    }
    
    // Add to buffer
    this.eventBuffer.push(event as RealTimeAnalyticsEvent);
    
    // Limit buffer size
    if (this.eventBuffer.length > this.bufferSize) {
      this.eventBuffer = this.eventBuffer.slice(-this.bufferSize);
    }
    
    return event.id;
  }
  
  /**
   * Subscribe to real-time analytics events
   */
  public subscribe(
    userId: string,
    filters: Record<string, any>,
    callback: (event: RealTimeAnalyticsEvent) => void,
    options: RealTimeAnalyticsOptions = {}
  ): string {
    const id = uuidv4();
    
    this.subscriptions.set(id, {
      id,
      userId,
      filters,
      callback,
      options
    });
    
    return id;
  }
  
  /**
   * Unsubscribe from real-time analytics events
   */
  public unsubscribe(id: string): boolean {
    return this.subscriptions.delete(id);
  }
  
  /**
   * Unsubscribe all subscriptions for a user
   */
  public unsubscribeAll(userId: string): void {
    for (const [id, subscription] of this.subscriptions.entries()) {
      if (subscription.userId === userId) {
        this.subscriptions.delete(id);
      }
    }
  }
  
  /**
   * Get recent real-time analytics events
   */
  public async getRecentEvents(
    userId: string,
    limit: number = 10
  ): Promise<RealTimeAnalyticsEvent[]> {
    try {
      // Get recent events from database
      const { data, error } = await supabase.getClient()
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);
      
      if (error) {
        logger.error(`Error getting recent events: ${error}`);
        return [];
      }
      
      return data as RealTimeAnalyticsEvent[];
    } catch (error) {
      logger.error(`Error getting recent events: ${error}`);
      return [];
    }
  }
}

export const realTimeAnalyticsService = RealTimeAnalyticsService.getInstance();
export default realTimeAnalyticsService;

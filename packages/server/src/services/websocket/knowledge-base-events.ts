/**
 * Knowledge Base Events WebSocket Server
 * 
 * Provides real-time knowledge base updates to clients via WebSockets.
 * Broadcasts changes to materials, collections, and other knowledge base entities.
 * Supports client authorization, entity filtering, and targeted notifications.
 */

import { Server } from 'http';
import WebSocket from 'ws';
import { logger } from '../../utils/logger';
import { messageBroker, MessagePayload } from '../messaging/messageBroker';

// WebSocket ready state constants
const READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};

// Define knowledge base event types (expanded)
export type KnowledgeBaseEntityType = 
  | 'material'
  | 'collection'
  | 'category'
  | 'metadata-field'
  | 'search-index'
  | 'relationship'
  | 'property'
  | 'user-permission'
  | 'external-source';

export type KnowledgeBaseEventType = 
  | 'created'
  | 'updated'
  | 'deleted'
  | 'bulk-imported'
  | 'bulk-updated'
  | 'bulk-deleted'
  | 'permission-changed'
  | 'synchronized'
  | 'linked'
  | 'categorized'
  | 'version-created'
  | 'version-restored';

export interface KnowledgeBaseEvent {
  id: string;                           // Entity ID
  entityType: KnowledgeBaseEntityType;  // Type of entity
  eventType: KnowledgeBaseEventType;    // Type of event
  timestamp: number;                    // Event timestamp
  data?: any;                           // Event data payload
  userId?: string;                      // User who triggered the event
  collectionId?: string;                // Related collection (if applicable)
  targetEntityIds?: string[];           // Additional affected entity IDs
  metadata?: Record<string, any>;       // Additional metadata
}

// Client data structure for managing WebSocket connections
interface ClientData {
  userId: string;                       // User ID
  permissions: {                        // Permission flags 
    isAdmin: boolean;                   // Admin flag
    collections: string[];              // Allowed collection IDs
    readOnly: boolean;                  // Read-only flag
    permissionLevel: string;            // Permission level
  };
  subscriptions: {
    entities: Set<KnowledgeBaseEntityType>;      // Entity types
    collections: Set<string>;                     // Collection IDs
    specificEntities: Set<string>;                // Specific entity IDs
  };
  clientInfo?: {                        // Optional client metadata
    clientId: string;                   // Client identifier
    browser: string;                    // Browser info
    deviceType: string;                 // Device type
    appVersion: string;                 // Application version
  };
}

/**
 * Knowledge Base Events WebSocket Server
 */
export class KnowledgeBaseEventsServer {
  private wss: WebSocket.Server | null = null;
  private clients: Map<WebSocket, ClientData> = new Map();
  private messageSubscriptions: Array<() => Promise<void>> = [];
  
  // Track recent events for new connections to catch up
  private recentEvents: KnowledgeBaseEvent[] = [];
  private readonly MAX_RECENT_EVENTS = 100;
  
  /**
   * Initialize the WebSocket server
   * @param httpServer HTTP server instance to attach to
   */
  public initialize(httpServer: Server): void {
    // Create WebSocket server
    this.wss = new WebSocket.Server({ 
      server: httpServer
    });
    
    // We'll implement our own ping mechanism since the ws library doesn't have built-in options
    
    // Set up connection handler
    this.wss.on('connection', (ws: WebSocket, req: any) => {
      logger.info(`WebSocket client connected for knowledge base events from ${req.socket.remoteAddress}`);
      
      // Initialize client data with default permissions
      this.clients.set(ws, {
        userId: '',
        permissions: {
          isAdmin: false,
          collections: [],
          readOnly: true,
          permissionLevel: 'guest'
        },
        subscriptions: {
          entities: new Set(['material', 'collection', 'category']),
          collections: new Set(),
          specificEntities: new Set()
        }
      });
      
      // Handle messages from client
      ws.on('message', (data: any) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (err) {
          logger.error(`Failed to parse WebSocket knowledge base message: ${err}`);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });
      
      // Handle connection close
      ws.on('close', () => {
        const clientData = this.clients.get(ws);
        logger.info(`WebSocket client disconnected from knowledge base events: ${clientData?.userId || 'anonymous'}`);
        this.clients.delete(ws);
      });
      
      // Handle errors
      ws.on('error', (err) => {
        logger.error(`Knowledge base events WebSocket error: ${err}`);
      });
      
      // Handle pong responses for connection health monitoring
      ws.on('pong', () => {
        // Client is still connected
      });
      
      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        timestamp: Date.now(),
        message: 'Connected to knowledge base events',
        protocol: 'v2',
        features: [
          'real-time-sync',
          'targeted-notifications',
          'collection-filtering',
          'permission-based-filtering',
          'event-history'
        ]
      }));
    });
    
    // Set up message broker subscriptions
    this.setupMessageSubscriptions();
    
    // Set up periodic health check for connections using heartbeat messages
    setInterval(() => {
      if (this.wss) {
        // Send heartbeat to all clients
        for (const [ws, _] of this.clients.entries()) {
          if (ws.readyState === READY_STATE.OPEN) {
            try {
              ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
            } catch (err) {
              logger.error(`Failed to send heartbeat to client: ${err}`);
            }
          }
        }
      }
    }, 30000);
    
    logger.info('Knowledge base events WebSocket server initialized with enhanced features');
  }
  
  /**
   * Set up subscriptions to the message broker
   */
  private async setupMessageSubscriptions(): Promise<void> {
    try {
      // Subscribe to knowledge base events via the message broker
      const unsubscribe = await messageBroker.subscribe(
        'system', 
        this.handleKnowledgeBaseEvent.bind(this), 
        'knowledge-base-event'
      );
      this.messageSubscriptions.push(unsubscribe);
      
      logger.info('Message broker subscription established for knowledge base events');
    } catch (err) {
      logger.error(`Failed to set up message broker subscription for knowledge base events: ${err}`);
    }
  }
  
  /**
   * Handle knowledge base event from message broker
   * @param message Message payload from message broker
   */
  private async handleKnowledgeBaseEvent(message: MessagePayload<KnowledgeBaseEvent>): Promise<void> {
    if (!this.wss) {
      return;
    }
    
    const event = message.data;
    
    // Store in recent events cache (for new connections to catch up)
    this.addToRecentEvents(event);
    
    // Format the message for WebSocket clients
    const socketMessage = {
      type: 'knowledge-base-event',
      entityType: event.entityType,
      eventType: event.eventType,
      entityId: event.id,
      timestamp: event.timestamp,
      data: event.data,
      collectionId: event.collectionId,
      targetEntityIds: event.targetEntityIds,
      metadata: event.metadata
    };
    
    // Broadcast to appropriate clients based on permissions and subscriptions
    this.broadcastEventToClients(event, socketMessage);
    
    logger.debug(`Broadcasted ${event.entityType}:${event.eventType} event for ${event.id}`);
  }
  
  /**
   * Add event to recent events cache
   * @param event Knowledge base event
   */
  private addToRecentEvents(event: KnowledgeBaseEvent): void {
    this.recentEvents.unshift(event);
    
    // Trim cache if needed
    if (this.recentEvents.length > this.MAX_RECENT_EVENTS) {
      this.recentEvents = this.recentEvents.slice(0, this.MAX_RECENT_EVENTS);
    }
  }
  
  /**
   * Broadcast event to appropriate clients based on permissions and subscriptions
   * @param event Original event
   * @param socketMessage Formatted message for WebSocket
   */
  private broadcastEventToClients(event: KnowledgeBaseEvent, socketMessage: any): void {
    for (const [ws, clientData] of this.clients.entries()) {
      // Skip if client socket is not open
      if (ws.readyState !== READY_STATE.OPEN) {
        continue;
      }
      
      // Check entity type subscription
      if (!clientData.subscriptions.entities.has(event.entityType)) {
        continue;
      }
      
      // Check collection-based permissions and subscriptions
      if (event.collectionId && 
          clientData.subscriptions.collections.size > 0 && 
          !clientData.subscriptions.collections.has(event.collectionId)) {
        // Client is only subscribed to specific collections and this event isn't for one of them
        continue;
      }
      
      // Check collection-based permissions
      if (event.collectionId && 
          !clientData.permissions.isAdmin && 
          clientData.permissions.collections.length > 0 &&
          !clientData.permissions.collections.includes(event.collectionId)) {
        // Client doesn't have permission for this collection
        continue;
      }
      
      // Check specific entity subscription
      if (clientData.subscriptions.specificEntities.size > 0 && 
          !clientData.subscriptions.specificEntities.has(event.id) &&
          (!event.targetEntityIds || !event.targetEntityIds.some(id => 
            clientData.subscriptions.specificEntities.has(id)))) {
        // Client is only subscribed to specific entities and this event isn't for one of them
        continue;
      }
      
      // All checks passed, send the message
      ws.send(JSON.stringify(socketMessage));
    }
  }
  
  /**
   * Handle message from client
   * @param ws WebSocket connection
   * @param message Parsed client message
   */
  private handleClientMessage(ws: WebSocket, message: any): void {
    const clientData = this.clients.get(ws);
    if (!clientData) {
      return;
    }
    
    // Handle authentication
    if (message.type === 'auth') {
      this.handleAuthMessage(ws, clientData, message);
    }
    
    // Handle entity subscription updates
    else if (message.type === 'subscribe-entities' && Array.isArray(message.entities)) {
      this.handleEntitySubscription(ws, clientData, message);
    }
    
    // Handle collection subscription updates
    else if (message.type === 'subscribe-collections' && Array.isArray(message.collections)) {
      this.handleCollectionSubscription(ws, clientData, message);
    }
    
    // Handle specific entity subscription
    else if (message.type === 'subscribe-specific' && Array.isArray(message.entityIds)) {
      this.handleSpecificEntitySubscription(ws, clientData, message);
    }
    
    // Handle request for recent events
    else if (message.type === 'get-recent-events') {
      this.handleRecentEventsRequest(ws, clientData, message);
    }
    
    // Handle client info update
    else if (message.type === 'client-info') {
      this.handleClientInfoUpdate(ws, clientData, message);
    }
    
    // Handle unknown message type
    else {
      ws.send(JSON.stringify({
        type: 'error',
        message: `Unknown message type: ${message.type}`
      }));
    }
  }
  
  /**
   * Handle authentication message
   * @param ws WebSocket connection
   * @param clientData Client data
   * @param message Auth message
   */
  private handleAuthMessage(ws: WebSocket, clientData: ClientData, message: any): void {
    clientData.userId = message.userId || '';
    
    // Update permissions
    clientData.permissions = {
      isAdmin: message.isAdmin === true,
      collections: Array.isArray(message.collections) ? message.collections : [],
      readOnly: message.readOnly === true,
      permissionLevel: message.permissionLevel || 'guest'
    };
    
    logger.info(`WebSocket client authenticated: ${clientData.userId} (${clientData.permissions.permissionLevel})`);
    
    // Send confirmation with permissions
    ws.send(JSON.stringify({
      type: 'auth-success',
      userId: clientData.userId,
      permissions: clientData.permissions,
      timestamp: Date.now()
    }));
  }
  
  /**
   * Handle entity type subscription
   * @param ws WebSocket connection
   * @param clientData Client data
   * @param message Subscription message
   */
  private handleEntitySubscription(ws: WebSocket, clientData: ClientData, message: any): void {
    const validEntityTypes: KnowledgeBaseEntityType[] = [
      'material', 'collection', 'category', 'metadata-field', 
      'search-index', 'relationship', 'property', 'user-permission',
      'external-source'
    ];
    
    clientData.subscriptions.entities = new Set(
      message.entities.filter((e: string) => validEntityTypes.includes(e as KnowledgeBaseEntityType))
    );
    
    logger.info(`Client ${clientData.userId} updated entity subscriptions: ${
      Array.from(clientData.subscriptions.entities).join(', ')
    }`);
    
    // Send confirmation
    ws.send(JSON.stringify({
      type: 'subscriptions-updated',
      entityTypes: Array.from(clientData.subscriptions.entities),
      timestamp: Date.now()
    }));
  }
  
  /**
   * Handle collection subscription
   * @param ws WebSocket connection
   * @param clientData Client data
   * @param message Subscription message
   */
  private handleCollectionSubscription(ws: WebSocket, clientData: ClientData, message: any): void {
    // Clear existing collection subscriptions if reset flag is true
    if (message.reset === true) {
      clientData.subscriptions.collections.clear();
    }
    
    // Add new collection subscriptions
    message.collections.forEach((id: string) => {
      if (id && typeof id === 'string') {
        clientData.subscriptions.collections.add(id);
      }
    });
    
    logger.info(`Client ${clientData.userId} updated collection subscriptions: ${
      Array.from(clientData.subscriptions.collections).join(', ')
    }`);
    
    // Send confirmation
    ws.send(JSON.stringify({
      type: 'collection-subscriptions-updated',
      collections: Array.from(clientData.subscriptions.collections),
      timestamp: Date.now()
    }));
  }
  
  /**
   * Handle specific entity subscription
   * @param ws WebSocket connection
   * @param clientData Client data
   * @param message Subscription message
   */
  private handleSpecificEntitySubscription(ws: WebSocket, clientData: ClientData, message: any): void {
    // Clear existing entity subscriptions if reset flag is true
    if (message.reset === true) {
      clientData.subscriptions.specificEntities.clear();
    }
    
    // Add new entity subscriptions
    message.entityIds.forEach((id: string) => {
      if (id && typeof id === 'string') {
        clientData.subscriptions.specificEntities.add(id);
      }
    });
    
    const entityCount = clientData.subscriptions.specificEntities.size;
    logger.info(`Client ${clientData.userId} updated specific entity subscriptions: ${entityCount} entities`);
    
    // Send confirmation
    ws.send(JSON.stringify({
      type: 'specific-subscriptions-updated',
      entityCount,
      timestamp: Date.now()
    }));
  }
  
  /**
   * Handle request for recent events
   * @param ws WebSocket connection
   * @param clientData Client data
   * @param message Request message
   */
  private handleRecentEventsRequest(ws: WebSocket, clientData: ClientData, message: any): void {
    const limit = Math.min(message.limit || 20, this.MAX_RECENT_EVENTS);
    const entityTypes = Array.isArray(message.entityTypes) ? message.entityTypes : null;
    const collectionId = message.collectionId;
    
    // Filter events based on client permissions and request parameters
    const filteredEvents = this.recentEvents
      .filter(event => {
        // Filter by entity type if specified
        if (entityTypes && !entityTypes.includes(event.entityType)) {
          return false;
        }
        
        // Filter by collection if specified
        if (collectionId && event.collectionId !== collectionId) {
          return false;
        }
        
        // Check collection-based permissions
        if (event.collectionId && 
            !clientData.permissions.isAdmin && 
            clientData.permissions.collections.length > 0 &&
            !clientData.permissions.collections.includes(event.collectionId)) {
          return false;
        }
        
        return true;
      })
      .slice(0, limit);
    
    // Send recent events
    ws.send(JSON.stringify({
      type: 'recent-events',
      events: filteredEvents,
      timestamp: Date.now()
    }));
  }
  
  /**
   * Handle client info update
   * @param ws WebSocket connection
   * @param clientData Client data
   * @param message Client info message
   */
  private handleClientInfoUpdate(ws: WebSocket, clientData: ClientData, message: any): void {
    clientData.clientInfo = {
      clientId: message.clientId || 'unknown',
      browser: message.browser || 'unknown',
      deviceType: message.deviceType || 'unknown',
      appVersion: message.appVersion || 'unknown'
    };
    
    logger.debug(`Client ${clientData.userId} updated client info: ${
      JSON.stringify(clientData.clientInfo)
    }`);
    
    // Send confirmation
    ws.send(JSON.stringify({
      type: 'client-info-updated',
      timestamp: Date.now()
    }));
  }
  
  /**
   * Publish a knowledge base event
   * @param event Knowledge base event
   * @returns Success flag
   */
  public async publishEvent(event: KnowledgeBaseEvent): Promise<boolean> {
    try {
      // Ensure event has all required fields
      const normalizedEvent: KnowledgeBaseEvent = {
        ...event,
        timestamp: event.timestamp || Date.now()
      };
      
      // Publish to message broker
      const success = await messageBroker.publish(
        'system',                // queue
        'knowledge-base-event',  // type
        normalizedEvent,         // data
        'knowledge-base-server'  // source
      );
      
      if (success) {
        logger.info(`Published knowledge base event: ${event.entityType} ${event.eventType} ${event.id}`);
      } else {
        logger.error(`Failed to publish knowledge base event: ${event.entityType} ${event.eventType} ${event.id}`);
      }
      
      return success;
    } catch (err) {
      logger.error(`Error publishing knowledge base event: ${err}`);
      return false;
    }
  }
  
  /**
   * Send a targeted notification to specific users
   * @param userIds Array of user IDs to notify
   * @param message Notification message
   * @returns Number of clients notified
   */
  public sendTargetedNotification(userIds: string[], message: any): number {
    let notifiedCount = 0;
    
    for (const [ws, clientData] of this.clients.entries()) {
      if (ws.readyState === READY_STATE.OPEN && userIds.includes(clientData.userId)) {
        ws.send(JSON.stringify({
          type: 'targeted-notification',
          ...message,
          timestamp: Date.now()
        }));
        notifiedCount++;
      }
    }
    
    return notifiedCount;
  }
  
  /**
   * Get active connections count
   * @returns Count of active connections
   */
  public getActiveConnectionsCount(): number {
    return [...this.clients.keys()].filter(ws => ws.readyState === READY_STATE.OPEN).length;
  }
  
  /**
   * Get active users count
   * @returns Count of authenticated users
   */
  public getActiveUsersCount(): number {
    const uniqueUsers = new Set<string>();
    
    for (const [ws, clientData] of this.clients.entries()) {
      if (ws.readyState === READY_STATE.OPEN && clientData.userId) {
        uniqueUsers.add(clientData.userId);
      }
    }
    
    return uniqueUsers.size;
  }
  
  /**
   * Close the WebSocket server and clean up resources
   */
  public async close(): Promise<void> {
    // Unsubscribe from all message broker subscriptions
    for (const unsubscribe of this.messageSubscriptions) {
      await unsubscribe();
    }
    this.messageSubscriptions = [];
    
    // Close WebSocket server
    if (this.wss) {
      this.wss.close(() => {
        logger.info('Knowledge base events WebSocket server closed');
      });
      this.wss = null;
    }
    
    // Clear client data
    this.clients.clear();
    
    // Clear recent events
    this.recentEvents = [];
  }
}

// Create singleton instance
export const knowledgeBaseEventsServer = new KnowledgeBaseEventsServer();
export default knowledgeBaseEventsServer;
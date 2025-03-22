/**
 * Knowledge Base Events WebSocket Server
 * 
 * Provides real-time knowledge base updates to clients via WebSockets.
 * Broadcasts changes to materials, collections, and other knowledge base entities.
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

// Define knowledge base event types
export type KnowledgeBaseEntityType = 
  | 'material'
  | 'collection'
  | 'category'
  | 'metadata-field'
  | 'search-index';

export type KnowledgeBaseEventType = 
  | 'created'
  | 'updated'
  | 'deleted'
  | 'bulk-imported'
  | 'bulk-updated';

export interface KnowledgeBaseEvent {
  id: string;
  entityType: KnowledgeBaseEntityType;
  eventType: KnowledgeBaseEventType;
  timestamp: number;
  data?: any;
  userId?: string;
}

// Client data structure for managing WebSocket connections
interface ClientData {
  userId: string;
  isAdmin: boolean;
  subscribedEntities: Set<KnowledgeBaseEntityType>;
}

/**
 * Knowledge Base Events WebSocket Server
 */
export class KnowledgeBaseEventsServer {
  private wss: WebSocket.Server | null = null;
  private clients: Map<WebSocket, ClientData> = new Map();
  private messageSubscriptions: Array<() => Promise<void>> = [];
  
  /**
   * Initialize the WebSocket server
   * @param httpServer HTTP server instance to attach to
   */
  public initialize(httpServer: Server): void {
    // Create WebSocket server
    this.wss = new WebSocket.Server({ server: httpServer });
    
    // Set up connection handler
    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('WebSocket client connected for knowledge base events');
      
      // Initialize client data
      this.clients.set(ws, {
        userId: '',
        isAdmin: false,
        subscribedEntities: new Set(['material', 'collection', 'category'])
      });
      
      // Handle messages from client
      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data);
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
        logger.info('WebSocket client disconnected from knowledge base events');
        this.clients.delete(ws);
      });
      
      // Handle errors
      ws.on('error', (err) => {
        logger.error(`Knowledge base events WebSocket error: ${err}`);
      });
      
      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        timestamp: Date.now(),
        message: 'Connected to knowledge base events'
      }));
    });
    
    // Set up message broker subscriptions
    this.setupMessageSubscriptions();
    
    logger.info('Knowledge base events WebSocket server initialized');
  }
  
  /**
   * Set up subscriptions to the message broker
   */
  private async setupMessageSubscriptions(): Promise<void> {
    try {
      // Subscribe to knowledge base events via the message broker
      // We'll publish events to the 'system' queue with a specific type
      const unsubscribe = await messageBroker.subscribe('system', this.handleKnowledgeBaseEvent.bind(this), 'knowledge-base-event');
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
    
    // Format the message for WebSocket clients
    const socketMessage = {
      type: 'knowledge-base-event',
      entityType: event.entityType,
      eventType: event.eventType,
      entityId: event.id,
      timestamp: event.timestamp,
      data: event.data
    };
    
    // Broadcast to all connected clients that have subscribed to this entity type
    this.broadcastToSubscribers(event.entityType, socketMessage);
    
    logger.debug(`Broadcasted ${event.entityType}:${event.eventType} event to WebSocket clients`);
  }
  
  /**
   * Broadcast message to subscribers of a specific entity type
   * @param entityType Entity type
   * @param message Message to broadcast
   */
  private broadcastToSubscribers(entityType: KnowledgeBaseEntityType, message: any): void {
    for (const [ws, clientData] of this.clients.entries()) {
      if (clientData.subscribedEntities.has(entityType)) {
        if (ws.readyState === READY_STATE.OPEN) {
          ws.send(JSON.stringify(message));
        }
      }
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
      clientData.userId = message.userId;
      clientData.isAdmin = message.isAdmin === true;
      
      logger.info(`WebSocket client authenticated for knowledge base events: ${message.userId} (Admin: ${clientData.isAdmin})`);
      
      // Send confirmation
      ws.send(JSON.stringify({
        type: 'auth-success',
        userId: clientData.userId,
        isAdmin: clientData.isAdmin
      }));
    }
    
    // Handle entity subscription updates
    if (message.type === 'subscribe' && Array.isArray(message.entities)) {
      const validEntityTypes: KnowledgeBaseEntityType[] = ['material', 'collection', 'category', 'metadata-field', 'search-index'];
      clientData.subscribedEntities = new Set(
        message.entities.filter((e: string) => validEntityTypes.includes(e as KnowledgeBaseEntityType))
      );
      
      logger.info(`Client ${clientData.userId} updated entity subscriptions: ${Array.from(clientData.subscribedEntities).join(', ')}`);
      
      // Send confirmation
      ws.send(JSON.stringify({
        type: 'subscriptions-updated',
        subscribedEntities: Array.from(clientData.subscribedEntities)
      }));
    }
  }
  
  /**
   * Publish a knowledge base event
   * @param event Knowledge base event
   */
  public async publishEvent(event: KnowledgeBaseEvent): Promise<boolean> {
    try {
      // Publish to message broker
      const success = await messageBroker.publish(
        'system',                // queue
        'knowledge-base-event',  // type
        event,                  // data
        'knowledge-base-server' // source
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
  }
}

// Create singleton instance
export const knowledgeBaseEventsServer = new KnowledgeBaseEventsServer();
export default knowledgeBaseEventsServer;
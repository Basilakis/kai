/**
 * Queue Events WebSocket Server
 * 
 * Provides real-time queue event updates to clients via WebSockets.
 * Connects to Supabase Realtime channels and forwards events to connected clients.
 */

import { Server } from 'http';
import WebSocket from 'ws';

// WebSocket ready state constants
const READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};

import { logger } from '../../utils/logger';
import { MessagePayload, MessageQueueType } from '../messaging/messageBrokerInterface';
import { messageBrokerFactory, BrokerImplementation } from '../messaging/messageBrokerFactory';

// Get broker instance from factory
const broker = messageBrokerFactory.createBroker({
  implementation: BrokerImplementation.BASIC
});

// Client data structure for managing WebSocket connections
interface ClientData {
  userId: string;
  isAdmin: boolean;
  subscribedQueues: Set<MessageQueueType>;
}

/**
 * Queue Events WebSocket Server
 */
export class QueueEventsServer {
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
      logger.info('WebSocket client connected for queue events');
      
      // Initialize client data
      this.clients.set(ws, {
        userId: '',
        isAdmin: false,
        subscribedQueues: new Set(['pdf', 'crawler', 'system'])
      });
      
      // Handle messages from client
      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data);
          this.handleClientMessage(ws, message);
        } catch (err) {
          logger.error(`Failed to parse WebSocket queue message: ${err}`);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });
      
      // Handle connection close
      ws.on('close', () => {
        logger.info('WebSocket client disconnected from queue events');
        this.clients.delete(ws);
      });
      
      // Handle errors
      ws.on('error', (err) => {
        logger.error(`Queue events WebSocket error: ${err}`);
      });
      
      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        timestamp: Date.now(),
        message: 'Connected to queue events'
      }));
    });
    
    // Set up Supabase Realtime subscriptions
    this.setupMessageSubscriptions();
    
    logger.info('Queue events WebSocket server initialized');
  }
  
  /**
   * Set up subscriptions to Supabase Realtime channels via message broker
   */
  private async setupMessageSubscriptions(): Promise<void> {
    try {
      // Subscribe to PDF queue events
      const pdfUnsubscribe = await broker.subscribe('pdf', this.handleQueueEvent.bind(this));
      this.messageSubscriptions.push(pdfUnsubscribe);
      
      // Subscribe to Crawler queue events
      const crawlerUnsubscribe = await broker.subscribe('crawler', this.handleQueueEvent.bind(this));
      this.messageSubscriptions.push(crawlerUnsubscribe);
      
      // Subscribe to System events
      const systemUnsubscribe = await broker.subscribe('system', this.handleQueueEvent.bind(this));
      this.messageSubscriptions.push(systemUnsubscribe);
      
      logger.info('Supabase Realtime subscriptions established for WebSocket server');
    } catch (err) {
      logger.error(`Failed to set up Supabase Realtime subscriptions for WebSocket server: ${err}`);
    }
  }
  
  /**
   * Handle Queue Event from Supabase Realtime
   * @param message Message payload from Supabase Realtime
   */
  private async handleQueueEvent(message: MessagePayload): Promise<void> {
    if (!this.wss) {
      return;
    }
    
    // Format the message for WebSocket clients
    const socketMessage = {
      type: 'queue-event',
      queueType: message.queue,
      eventType: message.type,
      timestamp: message.timestamp,
      data: message.data
    };
    
    // Broadcast to all connected clients that have subscribed to this queue
    this.broadcastToSubscribers(message.queue, socketMessage);
    
    logger.debug(`Broadcasted ${message.queue}:${message.type} event to WebSocket clients`);
  }
  
  /**
   * Broadcast message to subscribers of a specific queue
   * @param queueType Queue type
   * @param message Message to broadcast
   */
  private broadcastToSubscribers(queueType: MessageQueueType, message: any): void {
    for (const [ws, clientData] of this.clients.entries()) {
      if (clientData.subscribedQueues.has(queueType)) {
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
      
      logger.info(`WebSocket client authenticated for queue events: ${message.userId} (Admin: ${clientData.isAdmin})`);
      
      // Send confirmation
      ws.send(JSON.stringify({
        type: 'auth-success',
        userId: clientData.userId,
        isAdmin: clientData.isAdmin
      }));
    }
    
    // Handle queue subscription updates
    if (message.type === 'subscribe' && Array.isArray(message.queues)) {
      clientData.subscribedQueues = new Set(
        message.queues.filter((q: string) => ['pdf', 'crawler', 'system'].includes(q))
      );
      
      logger.info(`Client ${clientData.userId} updated queue subscriptions: ${Array.from(clientData.subscribedQueues).join(', ')}`);
      
      // Send confirmation
      ws.send(JSON.stringify({
        type: 'subscriptions-updated',
        subscribedQueues: Array.from(clientData.subscribedQueues)
      }));
    }
  }
  
  /**
   * Close the WebSocket server and clean up resources
   */
  public async close(): Promise<void> {
    // Unsubscribe from all Supabase Realtime subscriptions
    for (const unsubscribe of this.messageSubscriptions) {
      await unsubscribe();
    }
    this.messageSubscriptions = [];
    
    // Close WebSocket server
    if (this.wss) {
      this.wss.close(() => {
        logger.info('Queue events WebSocket server closed');
      });
      this.wss = null;
    }
    
    // Clear client data
    this.clients.clear();
  }
  
  /**
   * Broadcast a system message to all connected clients
   * @param message System message
   */
  public broadcastSystemMessage(message: string): void {
    if (!this.wss) {
      return;
    }
    
    const systemMessage = {
      type: 'system',
      timestamp: Date.now(),
      message
    };
    
    // Broadcast to all connected clients
    for (const [ws, _] of this.clients.entries()) {
      if (ws.readyState === READY_STATE.OPEN) {
        ws.send(JSON.stringify(systemMessage));
      }
    }
    
    logger.info(`Broadcasted system message to all WebSocket clients: ${message}`);
  }
}

// Create singleton instance
export const queueEventsServer = new QueueEventsServer();
export default queueEventsServer;
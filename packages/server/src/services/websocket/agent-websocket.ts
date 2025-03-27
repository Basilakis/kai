/**
 * Agent WebSocket Service
 * 
 * Handles WebSocket connections for real-time agent communication.
 * Manages sessions, routes messages to appropriate agents, and streams responses.
 */

import WebSocket from 'ws';
import http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { AgentType, initializeAgentSystem } from '@kai/agents';
import { logger } from '../../utils/logger';

// WebSocket event types
export enum WebSocketEventType {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  MESSAGE = 'message',
  THINKING = 'thinking',
  TYPING = 'typing',
  ERROR = 'error',
  STATUS = 'status',
  REACTION = 'reaction',
  FILE = 'file',
  ACTION = 'action'
}

// WebSocket message interface
export interface WebSocketMessage {
  id: string;
  sessionId: string;
  type: WebSocketEventType;
  content: any;
  timestamp: Date;
}

// AgentSession interface
interface AgentSession {
  id: string;
  agentType: AgentType;
  userId?: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

// Client connection interface
interface ClientConnection {
  id: string;
  socket: WebSocket;
  sessions: Set<string>;
  userId?: string;
}

/**
 * Agent WebSocket Service
 */
class AgentWebSocketService {
  private server: WebSocket.Server | null = null;
  private sessions: Map<string, AgentSession> = new Map();
  private connections: Map<string, ClientConnection> = new Map();
  
  // Session timeout (30 minutes)
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000;
  
  // Agent system instance
  private agentSystem = initializeAgentSystem({
    // Required configuration for AgentConfig
    apiKey: process.env.AGENT_API_KEY || 'development-key'
  });
  
  /**
   * Initialize WebSocket server
   */
  public initialize(httpServer: http.Server): void {
    if (this.server) {
      logger.warn('WebSocket server already initialized');
      return;
    }
    
    // Create WebSocket server
    this.server = new WebSocket.Server({
      server: httpServer,
      path: '/api/ws/agents'
    });
    
    // Set up event handlers
    this.server.on('connection', this.handleConnection.bind(this));
    this.server.on('error', (error) => {
      logger.error('WebSocket server error:', error);
    });
    
    // Start session cleanup interval
    setInterval(this.cleanupSessions.bind(this), 5 * 60 * 1000); // Every 5 minutes
    
    logger.info('WebSocket server initialized');
  }
  
  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: WebSocket, request: any): void {
    // Create connection ID
    const connectionId = uuidv4();
    
    // Extract user ID from request (using authentication middleware)
    const userId = (request as any).user?.id;
    
    // Store connection
    this.connections.set(connectionId, {
      id: connectionId,
      socket,
      sessions: new Set(),
      userId
    });
    
    logger.info(`New WebSocket connection: ${connectionId}`);
    
    // Set up event handlers
    socket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      this.handleMessage(connectionId, data);
    });
    
    socket.on('close', () => {
      this.handleDisconnection(connectionId);
    });
    
    socket.on('error', (error) => {
      logger.error(`WebSocket error for connection ${connectionId}:`, error);
    });
  }
  
  /**
   * Handle WebSocket message
   */
  private handleMessage(connectionId: string, data: Buffer | ArrayBuffer | Buffer[]): void {
    const connection = this.connections.get(connectionId);
    
    if (!connection) {
      logger.warn(`Message received for unknown connection: ${connectionId}`);
      return;
    }
    
    try {
      // Parse message
      const message: WebSocketMessage = JSON.parse(data.toString());
      const { sessionId, type, content } = message;
      
      // Update session activity
      const session = this.sessions.get(sessionId);
      
      if (session) {
        session.lastActivity = new Date();
      }
      
      // Process message based on type
      switch (type) {
        case WebSocketEventType.CONNECT:
          this.handleConnectMessage(connection, message);
          break;
          
        case WebSocketEventType.MESSAGE:
          this.handleTextMessage(connection, message);
          break;
          
        case WebSocketEventType.FILE:
          this.handleFileMessage(connection, message);
          break;
          
        case WebSocketEventType.ACTION:
          this.handleActionMessage(connection, message);
          break;
          
        default:
          logger.warn(`Unknown message type: ${type}`);
      }
    } catch (error) {
      logger.error('Error processing WebSocket message:', error);
      
      // Send error response
      this.sendErrorMessage(connection, 'Error processing message');
    }
  }
  
  /**
   * Handle connection message
   */
  private handleConnectMessage(connection: ClientConnection, message: WebSocketMessage): void {
    const { sessionId, content } = message;
    const { agentType } = content;
    
    try {
      // Create new session if it doesn't exist
      if (!this.sessions.has(sessionId)) {
        this.sessions.set(sessionId, {
          id: sessionId,
          agentType,
          userId: connection.userId,
          createdAt: new Date(),
          lastActivity: new Date(),
          isActive: true
        });
        
        // Associate session with connection
        connection.sessions.add(sessionId);
        
        logger.info(`Created agent session: ${sessionId} (${agentType})`);
      }
      
      // Send confirmation
      this.sendStatusMessage(connection, sessionId, 'connected');
    } catch (error) {
      logger.error(`Error creating session ${sessionId}:`, error);
      this.sendErrorMessage(connection, 'Error creating session', sessionId);
    }
  }
  
  /**
   * Handle text message
   */
  private async handleTextMessage(connection: ClientConnection, message: WebSocketMessage): Promise<void> {
    const { sessionId, content } = message;
    const { message: text, agentType } = content;
    
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      this.sendErrorMessage(connection, 'Session not found', sessionId);
      return;
    }
    
    try {
      // Send typing indicator
      this.sendTypingMessage(connection, sessionId, true);
      
      // Process message with agent
      const response = await this.processAgentMessage(sessionId, text, agentType);
      
      // Send response
      this.sendMessage(connection, sessionId, response);
      
      // Stop typing indicator
      this.sendTypingMessage(connection, sessionId, false);
    } catch (error) {
      logger.error(`Error processing message for session ${sessionId}:`, error);
      this.sendErrorMessage(connection, 'Error processing message', sessionId);
      this.sendTypingMessage(connection, sessionId, false);
    }
  }
  
  /**
   * Handle file message
   */
  private async handleFileMessage(connection: ClientConnection, message: WebSocketMessage): Promise<void> {
    const { sessionId, content } = message;
    const { filename, mimeType, data, agentType } = content;
    
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      this.sendErrorMessage(connection, 'Session not found', sessionId);
      return;
    }
    
    try {
      // Send thinking indicator
      this.sendThinkingMessage(connection, sessionId, true);
      
      // Process file with agent
      const response = await this.processAgentFile(sessionId, {
        filename,
        mimeType,
        data,
        agentType
      });
      
      // Send response
      this.sendMessage(connection, sessionId, response);
      
      // Stop thinking indicator
      this.sendThinkingMessage(connection, sessionId, false);
    } catch (error) {
      logger.error(`Error processing file for session ${sessionId}:`, error);
      this.sendErrorMessage(connection, 'Error processing file', sessionId);
      this.sendThinkingMessage(connection, sessionId, false);
    }
  }
  
  /**
   * Handle action message
   */
  private async handleActionMessage(connection: ClientConnection, message: WebSocketMessage): Promise<void> {
    const { sessionId, content } = message;
    const { action, agentType } = content;
    
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      this.sendErrorMessage(connection, 'Session not found', sessionId);
      return;
    }
    
    try {
      // Send thinking indicator
      this.sendThinkingMessage(connection, sessionId, true);
      
      // Process action with agent
      const response = await this.processAgentAction(sessionId, action, agentType);
      
      // Send response
      this.sendMessage(connection, sessionId, response);
      
      // Stop thinking indicator
      this.sendThinkingMessage(connection, sessionId, false);
    } catch (error) {
      logger.error(`Error processing action for session ${sessionId}:`, error);
      this.sendErrorMessage(connection, 'Error processing action', sessionId);
      this.sendThinkingMessage(connection, sessionId, false);
    }
  }
  
  /**
   * Handle client disconnection
   */
  private handleDisconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    
    if (!connection) {
      return;
    }
    
    logger.info(`WebSocket disconnection: ${connectionId}`);
    
    // Keep sessions active for reconnection
    // They will be cleaned up by the session timeout if not reconnected
    
    // Remove connection
    this.connections.delete(connectionId);
  }
  
  /**
   * Process message with agent
   */
  private async processAgentMessage(sessionId: string, message: string, agentType: AgentType): Promise<string> {
    // In a real implementation, this would use the crewAI agent system
    // For now, we'll return a mock response
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing time
    
    return `I processed your message: "${message}" (Agent: ${agentType}, Session: ${sessionId})`;
  }
  
  /**
   * Process file with agent
   */
  private async processAgentFile(sessionId: string, fileData: any): Promise<string> {
    // In a real implementation, this would use the crewAI agent system
    // For now, we'll return a mock response
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing time
    
    const { filename, mimeType, agentType } = fileData;
    
    return `I processed your file: "${filename}" (${mimeType}) (Agent: ${agentType}, Session: ${sessionId})`;
  }
  
  /**
   * Process action with agent
   */
  private async processAgentAction(sessionId: string, action: any, agentType: AgentType): Promise<string> {
    // In a real implementation, this would use the crewAI agent system
    // For now, we'll return a mock response
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing time
    
    return `I processed your action: "${action.type}" (Agent: ${agentType}, Session: ${sessionId})`;
  }
  
  /**
   * Send WebSocket message
   */
  private sendWebSocketMessage(connection: ClientConnection, message: WebSocketMessage): void {
    // WebSocket.OPEN is 1
    if (connection.socket.readyState === 1) {
      connection.socket.send(JSON.stringify(message));
    }
  }
  
  /**
   * Send text message to client
   */
  private sendMessage(connection: ClientConnection, sessionId: string, content: string): void {
    const message: WebSocketMessage = {
      id: uuidv4(),
      sessionId,
      type: WebSocketEventType.MESSAGE,
      content: {
        message: content
      },
      timestamp: new Date()
    };
    
    this.sendWebSocketMessage(connection, message);
  }
  
  /**
   * Send error message to client
   */
  private sendErrorMessage(connection: ClientConnection, error: string, sessionId?: string): void {
    const message: WebSocketMessage = {
      id: uuidv4(),
      sessionId: sessionId || 'system',
      type: WebSocketEventType.ERROR,
      content: {
        error
      },
      timestamp: new Date()
    };
    
    this.sendWebSocketMessage(connection, message);
  }
  
  /**
   * Send status message to client
   */
  private sendStatusMessage(connection: ClientConnection, sessionId: string, status: string): void {
    const message: WebSocketMessage = {
      id: uuidv4(),
      sessionId,
      type: WebSocketEventType.STATUS,
      content: {
        status
      },
      timestamp: new Date()
    };
    
    this.sendWebSocketMessage(connection, message);
  }
  
  /**
   * Send thinking message to client
   */
  private sendThinkingMessage(connection: ClientConnection, sessionId: string, isThinking: boolean): void {
    const message: WebSocketMessage = {
      id: uuidv4(),
      sessionId,
      type: WebSocketEventType.THINKING,
      content: {
        isThinking
      },
      timestamp: new Date()
    };
    
    this.sendWebSocketMessage(connection, message);
  }
  
  /**
   * Send typing message to client
   */
  private sendTypingMessage(connection: ClientConnection, sessionId: string, isTyping: boolean): void {
    const message: WebSocketMessage = {
      id: uuidv4(),
      sessionId,
      type: WebSocketEventType.TYPING,
      content: {
        isTyping
      },
      timestamp: new Date()
    };
    
    this.sendWebSocketMessage(connection, message);
  }
  
  /**
   * Clean up inactive sessions
   */
  private cleanupSessions(): void {
    const now = new Date();
    
    // Find expired sessions
    const expiredSessions: string[] = [];
    
    this.sessions.forEach((session, sessionId) => {
      const lastActivity = session.lastActivity.getTime();
      const elapsed = now.getTime() - lastActivity;
      
      if (elapsed > this.SESSION_TIMEOUT) {
        expiredSessions.push(sessionId);
      }
    });
    
    // Remove expired sessions
    expiredSessions.forEach(sessionId => {
      this.sessions.delete(sessionId);
      logger.info(`Removed expired session: ${sessionId}`);
    });
  }
}

// Create singleton instance
const agentWebSocketService = new AgentWebSocketService();

// Export service
export default agentWebSocketService;
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
import { logger, LogMetadata } from '../../utils/logger';

/**
 * WebSocket event types
 */
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

/**
 * Base WebSocket message interface
 */
export interface BaseWebSocketMessage {
  id: string;
  sessionId: string;
  type: WebSocketEventType;
  timestamp: Date;
}

/**
 * Connect message content
 */
export interface ConnectMessageContent {
  agentType: AgentType;
}

/**
 * Text message content
 */
export interface TextMessageContent {
  message: string;
  agentType: AgentType;
}

/**
 * File message content
 */
export interface FileMessageContent {
  filename: string;
  mimeType: string;
  data: string; // Base64-encoded file data
  agentType: AgentType;
}

/**
 * Action message content
 */
export interface ActionMessageContent {
  type: string;
  payload: Record<string, unknown>;
  agentType: AgentType;
}

/**
 * Error message content
 */
export interface ErrorMessageContent {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Status message content
 */
export interface StatusMessageContent {
  status: string;
}

/**
 * Thinking/typing indicator content
 */
export interface IndicatorMessageContent {
  isThinking?: boolean;
  isTyping?: boolean;
}

/**
 * Message type discriminator unions
 */
export type WebSocketMessage =
  | (BaseWebSocketMessage & { type: WebSocketEventType.CONNECT; content: ConnectMessageContent })
  | (BaseWebSocketMessage & { type: WebSocketEventType.MESSAGE; content: TextMessageContent })
  | (BaseWebSocketMessage & { type: WebSocketEventType.FILE; content: FileMessageContent })
  | (BaseWebSocketMessage & { type: WebSocketEventType.ACTION; content: ActionMessageContent })
  | (BaseWebSocketMessage & { type: WebSocketEventType.ERROR; content: ErrorMessageContent })
  | (BaseWebSocketMessage & { type: WebSocketEventType.STATUS; content: StatusMessageContent })
  | (BaseWebSocketMessage & { type: WebSocketEventType.THINKING; content: IndicatorMessageContent })
  | (BaseWebSocketMessage & { type: WebSocketEventType.TYPING; content: IndicatorMessageContent });

/**
 * Agent session interface
 */
interface AgentSession {
  id: string;
  agentType: AgentType;
  userId?: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

/**
 * Client connection interface
 */
interface ClientConnection {
  id: string;
  socket: WebSocket;
  sessions: Set<string>;
  userId?: string;
}

/**
 * WebSocket request with auth data
 */
interface AuthenticatedRequest {
  user?: {
    id: string;
    role: string;
  };
}

/**
 * WebSocket error types
 */
export enum WebSocketErrorType {
  INVALID_MESSAGE = 'invalid_message',
  SESSION_NOT_FOUND = 'session_not_found',
  CONNECTION_ERROR = 'connection_error',
  PROCESSING_ERROR = 'processing_error',
  AUTHENTICATION_ERROR = 'authentication_error'
}

/**
 * WebSocket error interface
 */
export interface WebSocketError extends Error {
  type: WebSocketErrorType;
  sessionId?: string;
  details?: Record<string, unknown>;
}

/**
 * Agent WebSocket Service
 */
class AgentWebSocketService {
  private server: WebSocket.Server | null = null;
  private sessions: Map<string, AgentSession> = new Map();
  private connections: Map<string, ClientConnection> = new Map();
  private sessionCleanupInterval?: NodeJS.Timeout;
  
  // Session timeout (30 minutes)
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000;
  
  // Agent system instance (used in production implementation)
  private _agentSystem = initializeAgentSystem({
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
    this.sessionCleanupInterval = setInterval(this.cleanupSessions.bind(this), 5 * 60 * 1000); // Every 5 minutes
    
    logger.info('WebSocket server initialized');
  }
  
  /**
   * Close WebSocket server and clean up resources
   * @returns Promise that resolves when the server is closed
   */
  public close(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.server) {
        logger.warn('WebSocket server not initialized, nothing to close');
        resolve();
        return;
      }

      logger.info('Closing agent WebSocket server');

      // Clear the session cleanup interval
      if (this.sessionCleanupInterval) {
        clearInterval(this.sessionCleanupInterval);
        this.sessionCleanupInterval = undefined;
      }

      // Close all client connections
      this.connections.forEach((connection) => {
        // WebSocket.OPEN is 1
        if (connection.socket.readyState === 1) {
          connection.socket.close(1000, 'Server shutting down');
        }
      });

      // Clear connections and sessions
      this.connections.clear();
      this.sessions.clear();

      // Close the WebSocket server
      this.server.close((err) => {
        if (err) {
          logger.error('Error closing agent WebSocket server:', err);
          reject(err);
        } else {
          logger.info('Agent WebSocket server closed successfully');
          this.server = null;
          resolve();
        }
      });
    });
  }
  
  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: WebSocket, request: AuthenticatedRequest): void {
    // Create connection ID
    const connectionId = uuidv4();
    
    // Extract user ID from request (using authentication middleware)
    const userId = request.user?.id;
    
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
      const { sessionId, type } = message;
      
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
      const err = error instanceof Error ? error : new Error(String(error));
      
      logger.error('Error processing WebSocket message:', {
        error: err.message,
        connectionId,
        data: data.toString().substring(0, 100) // Log first 100 chars for debugging
      } as LogMetadata);
      
      // Send error response
      this.sendErrorMessage(
        connection, 
        'Error processing message', 
        undefined, 
        WebSocketErrorType.INVALID_MESSAGE
      );
    }
  }
  
  /**
   * Handle connection message
   */
  private handleConnectMessage(
    connection: ClientConnection, 
    message: WebSocketMessage & { type: WebSocketEventType.CONNECT }
  ): void {
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
      const err = error instanceof Error ? error : new Error(String(error));
      
      logger.error(`Error creating session ${sessionId}:`, {
        error: err.message,
        sessionId,
        agentType,
        connectionId: connection.id
      } as LogMetadata);
      
      this.sendErrorMessage(
        connection, 
        'Error creating session', 
        sessionId,
        WebSocketErrorType.PROCESSING_ERROR
      );
    }
  }
  
  /**
   * Handle text message
   */
  private async handleTextMessage(
    connection: ClientConnection, 
    message: WebSocketMessage & { type: WebSocketEventType.MESSAGE }
  ): Promise<void> {
    const { sessionId, content } = message;
    const { message: text, agentType } = content;
    
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      this.sendErrorMessage(
        connection, 
        'Session not found', 
        sessionId,
        WebSocketErrorType.SESSION_NOT_FOUND
      );
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
      const err = error instanceof Error ? error : new Error(String(error));
      
      logger.error(`Error processing message for session ${sessionId}:`, {
        error: err.message,
        sessionId,
        agentType,
        connectionId: connection.id
      } as LogMetadata);
      
      this.sendErrorMessage(
        connection, 
        'Error processing message', 
        sessionId,
        WebSocketErrorType.PROCESSING_ERROR
      );
      this.sendTypingMessage(connection, sessionId, false);
    }
  }
  
  /**
   * Handle file message
   */
  private async handleFileMessage(
    connection: ClientConnection, 
    message: WebSocketMessage & { type: WebSocketEventType.FILE }
  ): Promise<void> {
    const { sessionId, content } = message;
    const { filename, mimeType, data, agentType } = content;
    
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      this.sendErrorMessage(
        connection, 
        'Session not found', 
        sessionId,
        WebSocketErrorType.SESSION_NOT_FOUND
      );
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
      const err = error instanceof Error ? error : new Error(String(error));
      
      logger.error(`Error processing file for session ${sessionId}:`, {
        error: err.message,
        sessionId,
        agentType,
        filename,
        mimeType,
        connectionId: connection.id
      } as LogMetadata);
      
      this.sendErrorMessage(
        connection, 
        'Error processing file', 
        sessionId,
        WebSocketErrorType.PROCESSING_ERROR
      );
      this.sendThinkingMessage(connection, sessionId, false);
    }
  }
  
  /**
   * Handle action message
   */
  private async handleActionMessage(
    connection: ClientConnection, 
    message: WebSocketMessage & { type: WebSocketEventType.ACTION }
  ): Promise<void> {
    const { sessionId, content } = message;
    const { type: actionType, payload, agentType } = content;
    
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      this.sendErrorMessage(
        connection, 
        'Session not found', 
        sessionId,
        WebSocketErrorType.SESSION_NOT_FOUND
      );
      return;
    }
    
    try {
      // Send thinking indicator
      this.sendThinkingMessage(connection, sessionId, true);
      
      // Process action with agent
      const response = await this.processAgentAction(
        sessionId, 
        { type: actionType, payload }, 
        agentType
      );
      
      // Send response
      this.sendMessage(connection, sessionId, response);
      
      // Stop thinking indicator
      this.sendThinkingMessage(connection, sessionId, false);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      logger.error(`Error processing action for session ${sessionId}:`, {
        error: err.message,
        sessionId,
        agentType,
        actionType,
        connectionId: connection.id
      } as LogMetadata);
      
      this.sendErrorMessage(
        connection, 
        'Error processing action', 
        sessionId,
        WebSocketErrorType.PROCESSING_ERROR
      );
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
  private async processAgentMessage(
    sessionId: string, 
    message: string, 
    agentType: AgentType
  ): Promise<string> {
    // In a real implementation, this would use the crewAI agent system
    // For demonstration purposes, we reference the agent system initialization
    logger.debug(`Using agent system for processing: ${!!this._agentSystem}`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return `I processed your message: "${message}" (Agent: ${agentType}, Session: ${sessionId})`;
  }
  
  /**
   * Process file with agent
   */
  private async processAgentFile(
    sessionId: string, 
    fileData: FileMessageContent
  ): Promise<string> {
    // In a real implementation, this would use the crewAI agent system
    // For now, we'll return a mock response
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing time
    
    const { filename, mimeType, agentType } = fileData;
    
    return `I processed your file: "${filename}" (${mimeType}) (Agent: ${agentType}, Session: ${sessionId})`;
  }
  
  /**
   * Process action with agent
   */
  private async processAgentAction(
    sessionId: string, 
    action: { type: string; payload: Record<string, unknown> }, 
    agentType: AgentType
  ): Promise<string> {
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
        message: content,
        agentType: this.sessions.get(sessionId)?.agentType || 'unknown' as AgentType
      },
      timestamp: new Date()
    };
    
    this.sendWebSocketMessage(connection, message);
  }
  
  /**
   * Send error message to client
   */
  private sendErrorMessage(
    connection: ClientConnection, 
    error: string, 
    sessionId?: string,
    errorType: WebSocketErrorType = WebSocketErrorType.PROCESSING_ERROR
  ): void {
    const message: WebSocketMessage = {
      id: uuidv4(),
      sessionId: sessionId || 'system',
      type: WebSocketEventType.ERROR,
      content: {
        error,
        code: errorType
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
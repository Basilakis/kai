/**
 * Agent WebSocket Service
 * 
 * Provides real-time communication with the agent system via WebSockets.
 * Enables streaming responses, agent status updates, and event notifications.
 */

// Use a more robust approach to handle the UUID functionality
const uuidv4 = (): string => {
  // Simple UUID v4 implementation for browser environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
import { AgentMessage, AgentType } from './agentService';

// Event types for WebSocket messages
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

// Interface for WebSocket message
export interface WebSocketMessage {
  id: string;
  sessionId: string;
  type: WebSocketEventType;
  content: any;
  timestamp: Date;
}

// Interface for WebSocket event handlers
export interface WebSocketEventHandlers {
  onMessage?: (message: AgentMessage) => void;
  onThinking?: (isThinking: boolean) => void;
  onTyping?: (isTyping: boolean) => void;
  onStatus?: (status: string) => void;
  onError?: (error: Error) => void;
  onAction?: (action: any) => void;
  onFile?: (file: any) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

// AgentWebSocket service class
class AgentWebSocketService {
  private socket: WebSocket | null = null;
  private connectionId: string = '';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: number = 2000; // ms
  private reconnectTimeoutId: number | null = null;
  private eventHandlers: Map<string, WebSocketEventHandlers> = new Map();
  private isConnecting: boolean = false;
  private messageQueue: WebSocketMessage[] = [];

  /**
   * Initialize WebSocket connection
   */
  public connect(): Promise<boolean> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return Promise.resolve(true);
    }

    if (this.isConnecting) {
      return new Promise((resolve) => {
        // Add timeout protection to prevent hanging promises
        let timeoutId: number | null = null;
        const checkInterval = setInterval(() => {
          if (this.socket?.readyState === WebSocket.OPEN) {
            clearInterval(checkInterval);
            if (timeoutId) clearTimeout(timeoutId);
            resolve(true);
          }
        }, 100);
        
        // Set a timeout to resolve the promise after 10 seconds to prevent hanging
        timeoutId = setTimeout(() => {
          clearInterval(checkInterval);
          console.warn('Connection check timed out after 10 seconds');
          resolve(false);
        }, 10000);
      });
    }

    this.isConnecting = true;
    this.connectionId = uuidv4();

    return new Promise((resolve) => {
      try {
        // Get WebSocket URL from environment or use default
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/api/ws/agents`;

        this.socket = new WebSocket(wsUrl);
        
        this.socket.onopen = () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.processQueuedMessages();
          
          // Notify all registered handlers about the connection
          this.eventHandlers.forEach((handlers) => {
            handlers.onConnected?.();
          });
          
          resolve(true);
        };
        
        this.socket.onclose = () => {
          this.socket = null;
          this.isConnecting = false;
          
          // Notify all registered handlers about the disconnection
          this.eventHandlers.forEach((handlers) => {
            handlers.onDisconnected?.();
          });
          
          this.attemptReconnect();
        };
        
        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          
          // Notify all registered handlers about the error
          this.eventHandlers.forEach((handlers) => {
            handlers.onError?.(new Error('WebSocket connection error'));
          });
        };
        
        this.socket.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
      } catch (error) {
        console.error('Error creating WebSocket:', error);
        this.isConnecting = false;
        resolve(false);
      }
    });
  }

  /**
   * Disconnect WebSocket and clean up resources
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    
    // Reset state for clean restart
    this.isConnecting = false;
    this.connectionId = '';
    this.reconnectAttempts = 0;
    this.messageQueue = [];
  }

  /**
   * Register event handlers for a session
   */
  public registerSession(sessionId: string, handlers: WebSocketEventHandlers): void {
    this.eventHandlers.set(sessionId, handlers);
  }

  /**
   * Unregister event handlers for a session
   */
  public unregisterSession(sessionId: string): void {
    this.eventHandlers.delete(sessionId);
  }

  /**
   * Send message to agent through WebSocket
   */
  public sendMessage(sessionId: string, message: string, agentType: AgentType): void {
    const wsMessage: WebSocketMessage = {
      id: uuidv4(),
      sessionId,
      type: WebSocketEventType.MESSAGE,
      content: {
        message,
        agentType
      },
      timestamp: new Date()
    };
    
    this.sendToWebSocket(wsMessage);
  }

  /**
   * Send file to agent through WebSocket
   */
  public sendFile(sessionId: string, file: File, agentType: AgentType): void {
    // Convert file to base64 for sending over WebSocket
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = () => {
      const wsMessage: WebSocketMessage = {
        id: uuidv4(),
        sessionId,
        type: WebSocketEventType.FILE,
        content: {
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          data: reader.result,
          agentType
        },
        timestamp: new Date()
      };
      
      this.sendToWebSocket(wsMessage);
    };
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(message: WebSocketMessage): void {
    const { sessionId, type, content } = message;
    const handlers = this.eventHandlers.get(sessionId);
    
    if (!handlers) {
      return;
    }
    
    switch (type) {
      case WebSocketEventType.MESSAGE:
        handlers.onMessage?.({
          id: message.id,
          content: content.message,
          sender: 'agent',
          timestamp: new Date(message.timestamp)
        });
        break;
        
      case WebSocketEventType.THINKING:
        handlers.onThinking?.(content.isThinking);
        break;
        
      case WebSocketEventType.TYPING:
        handlers.onTyping?.(content.isTyping);
        break;
        
      case WebSocketEventType.STATUS:
        handlers.onStatus?.(content.status);
        break;
        
      case WebSocketEventType.ERROR:
        handlers.onError?.(new Error(content.error));
        break;
        
      case WebSocketEventType.ACTION:
        handlers.onAction?.(content.action);
        break;
        
      case WebSocketEventType.FILE:
        handlers.onFile?.(content.file);
        break;
        
      default:
        console.warn('Unknown WebSocket message type:', type);
    }
  }

  /**
   * Send message to WebSocket, queue if not connected
   */
  private sendToWebSocket(message: WebSocketMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send message:', error);
        // Queue message for retry
        this.messageQueue.push(message);
      }
    } else {
      // Queue message for when connection is established
      this.messageQueue.push(message);
      this.connect().catch(error => {
        console.error('Connection attempt failed:', error);
      });
    }
  }

  /**
   * Process queued messages
   */
  private processQueuedMessages(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        if (message) {
          this.socket.send(JSON.stringify(message));
        }
      }
    }
  }

  /**
   * Attempt to reconnect to WebSocket with capped exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    // Calculate delay with exponential backoff but cap it at 30 seconds
    const delay = Math.min(
      this.reconnectTimeout * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts} of ${this.maxReconnectAttempts})`);
    
    this.reconnectTimeoutId = setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection attempt failed:', error);
      });
    }, delay);
  }
}

// Export singleton instance
export default new AgentWebSocketService();
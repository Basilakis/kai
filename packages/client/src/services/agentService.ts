 /**
 * Agent Service
 * 
 * Provides communication between frontend components and backend agent system.
 * Handles agent sessions, message exchanges, and specialized agent operations.
 */
import axios, { AxiosError } from 'axios';

// Simple UUID v4 generator
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Error types for better error handling
export class AgentServiceError extends Error {
  public readonly statusCode: number | undefined;
  public readonly context?: any;
  
  constructor(message: string, statusCode?: number, context?: any) {
    super(message);
    this.name = 'AgentServiceError';
    this.statusCode = statusCode;
    this.context = context;
    
    // Ensure prototype chain is setup properly
    Object.setPrototypeOf(this, AgentServiceError.prototype);
  }
}

// Agent types matching backend definitions
export enum AgentType {
  RECOGNITION = 'recognition',
  MATERIAL_EXPERT = 'material_expert',
  PROJECT_ASSISTANT = 'project_assistant',
  THREE_D_DESIGNER = '3d_designer',
  ANALYTICS = 'analytics'
}

// Message interfaces
export interface AgentMessage {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Session interfaces
export interface AgentSession {
  id: string;
  agentType: AgentType;
  messages: AgentMessage[];
  status: 'active' | 'idle' | 'error';
  created: Date;
  lastActive: Date;
  loading?: boolean;
  error?: AgentServiceError;
}

// Loading state interface
export interface LoadingState {
  createSession: boolean;
  sendMessage: boolean;
  processImage: boolean;
  closeSession: boolean;
}

// Recognition result interfaces
export interface MaterialSpec {
  material: string;
  size: string;
  color: string;
  finish: string;
  [key: string]: string;
}

export interface RecognitionResult {
  id: string;
  name: string;
  manufacturer: string;
  confidence: number;
  image: string;
  specs: MaterialSpec;
  alternatives?: RecognitionResult[];
}

/**
 * Agent Service class for handling agent interactions
 */
class AgentService {
  private apiBase: string;
  private sessions: Map<string, AgentSession>;
  private socket: WebSocket | null = null;
  private messageCallbacks: Map<string, (message: AgentMessage) => void>;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000;
  private loadingState: LoadingState = {
    createSession: false,
    sendMessage: false,
    processImage: false,
    closeSession: false
  };
  private offlineQueue: Array<{
    type: 'message' | 'image' | 'create' | 'close';
    data: any;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  private isOffline: boolean = false;
  
  constructor() {
    this.apiBase = process.env.REACT_APP_API_URL || '/api';
    this.sessions = new Map();
    this.messageCallbacks = new Map();
    this.initWebSocket();
    
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
      this.isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    }
  }
  
  /**
   * Initialize WebSocket connection for real-time agent communication
   */
  private initWebSocket(): void {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/agents/ws`;
      this.socket = new WebSocket(wsUrl);
      
      this.socket.onopen = this.handleSocketOpen.bind(this);
      this.socket.onmessage = this.handleSocketMessage.bind(this);
      this.socket.onclose = this.handleSocketClose.bind(this);
      this.socket.onerror = this.handleSocketError.bind(this);
    } catch (error) {
      console.error('WebSocket initialization failed:', error);
      this.socket = null;
    }
  }
  
  /**
   * Handle WebSocket open event
   */
  private handleSocketOpen(): void {
    console.log('Agent WebSocket connection established');
    this.reconnectAttempts = 0;
    
    // Register existing sessions with the socket
    this.sessions.forEach((session) => {
      this.sendSocketMessage({
        type: 'register_session',
        sessionId: session.id,
        agentType: session.agentType
      });
    });
  }
  
  /**
   * Handle WebSocket message event
   */
  private handleSocketMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === 'agent_message' && data.sessionId && data.message) {
        const sessionId = data.sessionId;
        const message: AgentMessage = {
          id: data.message.id || `agent-${Date.now()}`,
          content: data.message.content,
          sender: 'agent',
          timestamp: new Date(),
          metadata: data.message.metadata
        };
        
        // Update session with new message
        const session = this.sessions.get(sessionId);
        if (session) {
          session.messages.push(message);
          session.lastActive = new Date();
          this.sessions.set(sessionId, session);
        }
        
        // Call registered callback if exists
        const callback = this.messageCallbacks.get(sessionId);
        if (callback) {
          callback(message);
        }
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  }
  
  /**
   * Handle WebSocket close event
   */
  private handleSocketClose(event: CloseEvent): void {
    console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
    this.socket = null;
    
    // Attempt to reconnect if the closure wasn't intentional
    if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
      
      console.log(`Attempting to reconnect in ${delay}ms (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.initWebSocket();
      }, delay);
    }
  }
  
  /**
   * Handle WebSocket error event
   */
  private handleSocketError(error: Event): void {
    console.error('WebSocket error:', error);
  }
  
  /**
   * Send a message through the WebSocket
   */
  private sendSocketMessage(message: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not open, message not sent:', message);
    }
  }
  
  /**
   * Handle browser coming online
   */
  private handleOnline(): void {
    console.log('Browser is online, processing queued requests');
    this.isOffline = false;
    this.processOfflineQueue();
  }
  
  /**
   * Handle browser going offline
   */
  private handleOffline(): void {
    console.log('Browser is offline, requests will be queued');
    this.isOffline = true;
  }
  
  /**
   * Process the offline request queue
   */
  private async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return;
    
    console.log(`Processing ${this.offlineQueue.length} queued requests`);
    
    // Take a copy of the queue and clear it
    const queue = [...this.offlineQueue];
    this.offlineQueue = [];
    
    // Process each queued request
    for (const item of queue) {
      try {
        let result;
        
        switch (item.type) {
          case 'create':
            result = await this.createSession(item.data.agentType, item.data.initialPrompt);
            break;
          case 'message':
            result = await this.sendMessage(item.data.sessionId, item.data.content);
            break;
          case 'image':
            result = await this.processImage(item.data.sessionId, item.data.image);
            break;
          case 'close':
            await this.closeSession(item.data.sessionId);
            result = true;
            break;
        }
        
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      }
    }
  }
  
  /**
   * Get the current loading state
   */
  getLoadingState(): LoadingState {
    return { ...this.loadingState };
  }
  
  /**
   * Create a new agent session
   */
  async createSession(agentType: AgentType, initialPrompt?: string): Promise<string> {
    // Set loading state
    this.loadingState.createSession = true;
    
    try {
      // If offline, queue the request
      if (this.isOffline) {
        return new Promise((resolve, reject) => {
          this.offlineQueue.push({
            type: 'create',
            data: { agentType, initialPrompt },
            resolve,
            reject
          });
        });
      }
      
      const sessionId = generateUUID();
      
      // Create session in backend
      try {
        const response = await axios.post(`${this.apiBase}/agents/sessions`, {
          sessionId,
          agentType,
          initialPrompt
        });
        
        if (response.status !== 200 && response.status !== 201) {
          throw new AgentServiceError(
            `Failed to create agent session: ${response.statusText}`,
            response.status
          );
        }
      } catch (error) {
        // Handle network errors gracefully
        console.warn('Network error creating session, continuing with local-only session');
      }
      
      // Initialize local session
      const session: AgentSession = {
        id: sessionId,
        agentType,
        messages: [],
        status: 'active',
        created: new Date(),
        lastActive: new Date()
      };
      
      // Add welcome message if initialPrompt wasn't provided
      if (!initialPrompt) {
        let welcomeMessage = "Hello! I'm here to help you. How can I assist you today?";
        
        switch (agentType) {
          case AgentType.RECOGNITION:
            welcomeMessage = "Hi there! I'm your Recognition Assistant. I can help you identify materials from images and provide guidance throughout the process. Upload an image to get started, or ask me any questions about material recognition.";
            break;
          case AgentType.MATERIAL_EXPERT:
            welcomeMessage = "Hello! I'm your Material Expert. I can provide detailed information about various materials, including specifications, pros and cons, and installation guidance. What would you like to know about?";
            break;
          case AgentType.PROJECT_ASSISTANT:
            welcomeMessage = "Hi! I'm your Project Assistant. I can help you organize materials into projects, calculate quantities, and provide timelines and budgeting assistance. How can I help with your project today?";
            break;
          case AgentType.THREE_D_DESIGNER:
            welcomeMessage = "Welcome! I'm your 3D Designer Assistant. I can help you create and visualize 3D environments from images or text descriptions. I can handle room reconstruction, depth estimation, and furniture placement. How would you like to start?";
            break;
        }
        
        session.messages.push({
          id: `welcome-${sessionId}`,
          content: welcomeMessage,
          sender: 'agent',
          timestamp: new Date()
        });
      }
      
      this.sessions.set(sessionId, session);
      
      // Register session with WebSocket
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.sendSocketMessage({
          type: 'register_session',
          sessionId,
          agentType
        });
      }
      
      return sessionId;
    } catch (error) {
      console.error('Error creating agent session:', error);
      throw error;
    } finally {
      this.loadingState.createSession = false;
    }
  }
  
  /**
   * Send a message to an agent
   */
  async sendMessage(sessionId: string, content: string): Promise<AgentMessage> {
    // Set loading state
    this.loadingState.sendMessage = true;
    
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new AgentServiceError(`Session not found: ${sessionId}`);
      }
      
      // Mark session as loading
      session.loading = true;
      this.sessions.set(sessionId, session);
      
      // Add user message to session
      const userMessage: AgentMessage = {
        id: `user-${Date.now()}`,
        content,
        sender: 'user',
        timestamp: new Date()
      };
      
      session.messages.push(userMessage);
      session.lastActive = new Date();
      this.sessions.set(sessionId, session);
      
      // If offline, queue the request
      if (this.isOffline) {
        return new Promise((resolve, reject) => {
          this.offlineQueue.push({
            type: 'message',
            data: { sessionId, content },
            resolve,
            reject
          });
        });
      }
      
      // Send message to backend
      try {
        const response = await axios.post(
          `${this.apiBase}/agents/sessions/${sessionId}/messages`,
          {
            content,
            timestamp: new Date().toISOString()
          }
        );
        
        if (response.status !== 200 && response.status !== 201) {
          throw new AgentServiceError(
            `Failed to send message: ${response.statusText}`,
            response.status
          );
        }
      } catch (error) {
        // Handle network errors gracefully, we'll still return the user message
        console.warn('Network error sending message, continuing with local-only session');
        
        // Add a simulated agent response if offline
        if (this.isOffline) {
          setTimeout(() => {
            const offlineResponse: AgentMessage = {
              id: `offline-${Date.now()}`,
              content: "I'm currently in offline mode. Your message has been saved and will be processed when you're back online.",
              sender: 'agent',
              timestamp: new Date(),
              metadata: { offline: true }
            };
            
            const session = this.sessions.get(sessionId);
            if (session) {
              session.messages.push(offlineResponse);
              session.lastActive = new Date();
              session.loading = false;
              this.sessions.set(sessionId, session);
              
              const callback = this.messageCallbacks.get(sessionId);
              if (callback) {
                callback(offlineResponse);
              }
            }
          }, 1000);
        }
      }
      
      return userMessage;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    } finally {
      this.loadingState.sendMessage = false;
    }
  }
  
  /**
   * Register a callback for receiving agent messages
   */
  onAgentMessage(sessionId: string, callback: (message: AgentMessage) => void): void {
    this.messageCallbacks.set(sessionId, callback);
  }
  
  /**
   * Unregister message callback
   */
  offAgentMessage(sessionId: string): void {
    this.messageCallbacks.delete(sessionId);
  }
  
  /**
   * Get messages for a session
   */
  getMessages(sessionId: string): AgentMessage[] {
    const session = this.sessions.get(sessionId);
    return session ? [...session.messages] : [];
  }
  
  /**
   * Check if a session is currently loading
   */
  isSessionLoading(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.loading || false;
  }
  
  /**
   * Get session error if any
   */
  getSessionError(sessionId: string): AgentServiceError | undefined {
    const session = this.sessions.get(sessionId);
    return session?.error;
  }
  
  /**
   * Process an image with the Recognition Assistant
   */
  async processImage(sessionId: string, image: File): Promise<RecognitionResult[]> {
    // Set loading state
    this.loadingState.processImage = true;
    
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new AgentServiceError(`Session not found: ${sessionId}`);
      }
      
      // Mark session as loading
      session.loading = true;
      this.sessions.set(sessionId, session);
      
      // If offline, queue the request
      if (this.isOffline) {
        return new Promise((resolve, reject) => {
          this.offlineQueue.push({
            type: 'image',
            data: { sessionId, image },
            resolve,
            reject
          });
          
          // Add offline message
          setTimeout(() => {
            const offlineResponse: AgentMessage = {
              id: `offline-${Date.now()}`,
              content: "I've received your image, but I'm currently in offline mode. It will be processed when you're back online.",
              sender: 'agent',
              timestamp: new Date(),
              metadata: { offline: true }
            };
            
            const session = this.sessions.get(sessionId);
            if (session) {
              session.messages.push(offlineResponse);
              session.lastActive = new Date();
              session.loading = false;
              this.sessions.set(sessionId, session);
              
              const callback = this.messageCallbacks.get(sessionId);
              if (callback) {
                callback(offlineResponse);
              }
            }
          }, 1000);
        });
      }
      
      // Create form data with image
      const formData = new FormData();
      formData.append('image', image);
      formData.append('sessionId', sessionId);
      
      // Add informational message about processing
      const processingMessage: AgentMessage = {
        id: `processing-${Date.now()}`,
        content: "I'm analyzing your image. This may take a moment...",
        sender: 'agent',
        timestamp: new Date(),
        metadata: { processing: true }
      };
      
      session.messages.push(processingMessage);
      this.sessions.set(sessionId, session);
      
      const callback = this.messageCallbacks.get(sessionId);
      if (callback) {
        callback(processingMessage);
      }
      
      // Send image to backend with a timeout
      const timeoutId = setTimeout(() => {
        // Timeout handling will be managed via axios timeout option
      }, 60000); // 60 second timeout
      
      try {
        const response = await axios.post(
          `${this.apiBase}/agents/recognition/process`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data'
            },
            timeout: 60000 // Use axios timeout option instead of AbortController
          }
        );
        
        clearTimeout(timeoutId);
        
        if (response.status !== 200) {
          throw new AgentServiceError(
            `Failed to process image: ${response.statusText}`,
            response.status
          );
        }
        
        return response.data.results;
      } catch (error) {
        // Properly type the error as AxiosError when applicable
        const axiosError = error as AxiosError;
        // Handle timeout and network errors specifically
        if (axiosError.code === 'ECONNABORTED' || (axiosError.message && axiosError.message.includes('timeout'))) {
          // Add timeout message
          const timeoutMessage: AgentMessage = {
            id: `timeout-${Date.now()}`,
            content: "I'm sorry, but the image processing is taking longer than expected. Please try again or upload a different image.",
            sender: 'agent',
            timestamp: new Date(),
            metadata: { error: 'timeout' }
          };
          
          const session = this.sessions.get(sessionId);
          if (session) {
            session.messages.push(timeoutMessage);
            session.lastActive = new Date();
            this.sessions.set(sessionId, session);
            
            const callback = this.messageCallbacks.get(sessionId);
            if (callback) {
              callback(timeoutMessage);
            }
          }
          
          throw new AgentServiceError('Image processing timed out', 408, { imageSize: image.size });
        }
        
        // Mock results for development/testing
        console.warn('Using mock results due to backend error');
        const mockResults: RecognitionResult[] = [{
          id: `mock-${Date.now()}`,
          name: 'Sample Material',
          manufacturer: 'KAI Demo',
          confidence: 0.85,
          image: URL.createObjectURL(image),
          specs: {
            material: 'Ceramic',
            size: '24x24',
            color: 'Beige',
            finish: 'Matte'
          }
        }];
        
        // Add mock results message
        const mockMessage: AgentMessage = {
          id: `mock-${Date.now()}`,
          content: "I've analyzed your image and found some potential matches. Note that I'm currently using demonstration mode, so these results are simulated.",
          sender: 'agent',
          timestamp: new Date(),
          metadata: { mock: true, results: mockResults }
        };
        
        const session = this.sessions.get(sessionId);
        if (session) {
          session.messages.push(mockMessage);
          session.lastActive = new Date();
          this.sessions.set(sessionId, session);
          
          const callback = this.messageCallbacks.get(sessionId);
          if (callback) {
            callback(mockMessage);
          }
        }
        
        return mockResults;
      }
    } catch (error) {
      console.error('Error processing image:', error);
      throw error;
    } finally {
      this.loadingState.processImage = false;
    }
  }
  
  /**
   * Close an agent session
   */
  async closeSession(sessionId: string): Promise<void> {
    // Set loading state
    this.loadingState.closeSession = true;
    
    try {
      // If offline, queue the request
      if (this.isOffline) {
        return new Promise((resolve, reject) => {
          this.offlineQueue.push({
            type: 'close',
            data: { sessionId },
            resolve,
            reject
          });
          
          // Still clean up local session data
          this.sessions.delete(sessionId);
          this.messageCallbacks.delete(sessionId);
        });
      }
      
      // Close session in backend
      try {
        const response = await axios.delete(`${this.apiBase}/agents/sessions/${sessionId}`);
        
        if (response.status !== 200 && response.status !== 204) {
          throw new AgentServiceError(
            `Failed to close session: ${response.statusText}`,
            response.status
          );
        }
      } catch (error) {
        // Still continue with local cleanup even if backend fails
        console.warn('Network error closing session, continuing with local cleanup');
      }
      
      // Remove local session
      this.sessions.delete(sessionId);
      this.messageCallbacks.delete(sessionId);
      
      // Unregister from WebSocket
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.sendSocketMessage({
          type: 'unregister_session',
          sessionId
        });
      }
    } catch (error) {
      console.error('Error closing session:', error);
      throw error instanceof AgentServiceError ? error : new AgentServiceError('Error closing session', 500, { error });
    } finally {
      this.loadingState.closeSession = false;
    }
  }
}

// Create singleton instance
const agentService = new AgentService();
export default agentService;
/**
 * Agent Session Service
 * 
 * Provides persistent storage and retrieval of agent sessions
 * using Supabase as the database backend. This replaces the in-memory
 * approach with a scalable, persistent solution that enforces
 * proper user-specific data isolation.
 */

import supabase from '../supabase/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { AgentType } from '@kai/agents';

/**
 * Agent session type definition
 */
export interface AgentSession {
  id: string;
  agentType: AgentType;
  userId: string;
  createdAt: Date;
  lastActivity: Date;
  messages: AgentMessage[];
  metadata?: Record<string, any>;
}

/**
 * Agent message type definition
 */
export interface AgentMessage {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  attachments?: {
    id: string;
    type: string;
    url: string;
    metadata?: Record<string, any>;
  }[];
}

/**
 * Session creation options
 */
export interface SessionCreateOptions {
  agentType: AgentType;
  userId: string;
  initialMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Session query options
 */
export interface SessionQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'lastActivity';
  order?: 'asc' | 'desc';
}

/**
 * Agent Session Service
 */
export class AgentSessionService {
  /**
   * Create a new agent session
   */
  async createSession(options: SessionCreateOptions): Promise<AgentSession> {
    const sessionId = uuidv4();
    const now = new Date();
    
    // Create initial message if provided or get default welcome message
    const messages: AgentMessage[] = [
      {
        id: uuidv4(),
        content: options.initialMessage || this.getWelcomeMessage(options.agentType),
        sender: 'agent',
        timestamp: now
      }
    ];
    
    // Create session object
    const session: AgentSession = {
      id: sessionId,
      agentType: options.agentType,
      userId: options.userId,
      createdAt: now,
      lastActivity: now,
      messages,
      metadata: options.metadata || {}
    };
    
    try {
      // Insert session into database
      const { data, error } = await supabase.getClient()
        .from('agent_sessions')
        .insert({
          id: session.id,
          agent_type: session.agentType,
          user_id: session.userId,
          created_at: session.createdAt.toISOString(),
          last_activity: session.lastActivity.toISOString(),
          messages: JSON.stringify(session.messages),
          metadata: session.metadata
        });
      
      if (error) {
        logger.error(`Failed to create agent session: ${error.message}`);
        throw new Error(`Failed to create agent session: ${error.message}`);
      }
      
      return session;
    } catch (error) {
      logger.error(`Error creating agent session: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get an agent session by ID
   * @param sessionId Session ID
   * @param userId User ID (for access control)
   */
  async getSession(sessionId: string, userId: string): Promise<AgentSession | null> {
    try {
      // Get session from database
      const { data, error } = await supabase.getClient()
        .from('agent_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // Session not found
          return null;
        }
        
        logger.error(`Failed to get agent session: ${error.message}`);
        throw new Error(`Failed to get agent session: ${error.message}`);
      }
      
      if (!data) {
        return null;
      }
      
      // Verify user ownership
      if (data.user_id !== userId) {
        logger.warn(`User ${userId} attempted to access session ${sessionId} owned by ${data.user_id}`);
        return null;
      }
      
      // Convert database record to session object
      const session: AgentSession = {
        id: data.id,
        agentType: data.agent_type as AgentType,
        userId: data.user_id,
        createdAt: new Date(data.created_at),
        lastActivity: new Date(data.last_activity),
        messages: JSON.parse(data.messages || '[]'),
        metadata: data.metadata || {}
      };
      
      return session;
    } catch (error) {
      logger.error(`Error getting agent session: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get all sessions for a user
   */
  async getUserSessions(
    userId: string, 
    options: SessionQueryOptions = {}
  ): Promise<{ sessions: Partial<AgentSession>[]; total: number }> {
    try {
      // Set default options
      const limit = options.limit || 20;
      const offset = options.offset || 0;
      const orderBy = options.orderBy || 'lastActivity';
      const order = options.order || 'desc';
      
      // Get sessions from database
      let query = supabase.getClient()
        .from('agent_sessions')
        .select('id, agent_type, created_at, last_activity, metadata')
        .eq('user_id', userId)
        .order(orderBy === 'createdAt' ? 'created_at' : 'last_activity', { ascending: order === 'asc' })
        .limit(limit)
        .offset(offset);
      
      const { data, error, count } = await query;
      
      if (error) {
        logger.error(`Failed to get user sessions: ${error.message}`);
        throw new Error(`Failed to get user sessions: ${error.message}`);
      }
      
      // Convert database records to session objects
      const sessions = data.map((record: {
        id: string;
        agent_type: string;
        created_at: string;
        last_activity: string;
        metadata?: Record<string, any>;
      }) => ({
        id: record.id,
        agentType: record.agent_type as AgentType,
        createdAt: new Date(record.created_at),
        lastActivity: new Date(record.last_activity),
        metadata: record.metadata || {},
        // Don't include messages for listing to reduce payload size
      }));
      
      return {
        sessions,
        total: count || 0
      };
    } catch (error) {
      logger.error(`Error getting user sessions: ${error}`);
      throw error;
    }
  }
  
  /**
   * Add a message to a session
   */
  async addMessage(
    sessionId: string,
    userId: string,
    content: string,
    sender: 'user' | 'agent',
    attachments?: AgentMessage['attachments']
  ): Promise<AgentMessage> {
    try {
      // Get session
      const session = await this.getSession(sessionId, userId);
      
      if (!session) {
        throw new Error('Session not found or access denied');
      }
      
      // Create message
      const message: AgentMessage = {
        id: uuidv4(),
        content,
        sender,
        timestamp: new Date(),
        attachments
      };
      
      // Add message to session
      session.messages.push(message);
      session.lastActivity = message.timestamp;
      
      // Update session in database
      const { error } = await supabase.getClient()
        .from('agent_sessions')
        .update({
          messages: JSON.stringify(session.messages),
          last_activity: session.lastActivity.toISOString()
        })
        .eq('id', sessionId)
        .eq('user_id', userId); // Extra security check
      
      if (error) {
        logger.error(`Failed to add message to session: ${error.message}`);
        throw new Error(`Failed to add message to session: ${error.message}`);
      }
      
      return message;
    } catch (error) {
      logger.error(`Error adding message to session: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get messages for a session
   */
  async getMessages(
    sessionId: string,
    userId: string
  ): Promise<AgentMessage[]> {
    try {
      // Get session
      const session = await this.getSession(sessionId, userId);
      
      if (!session) {
        throw new Error('Session not found or access denied');
      }
      
      return session.messages;
    } catch (error) {
      logger.error(`Error getting session messages: ${error}`);
      throw error;
    }
  }
  
  /**
   * Close a session (delete or archive)
   */
  async closeSession(sessionId: string, userId: string): Promise<boolean> {
    try {
      // Get session first to verify ownership
      const session = await this.getSession(sessionId, userId);
      
      if (!session) {
        // Session not found or not owned by user
        return false;
      }
      
      // Delete session from database
      const { error } = await supabase.getClient()
        .from('agent_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', userId); // Extra security check
      
      if (error) {
        logger.error(`Failed to close agent session: ${error.message}`);
        throw new Error(`Failed to close agent session: ${error.message}`);
      }
      
      return true;
    } catch (error) {
      logger.error(`Error closing agent session: ${error}`);
      throw error;
    }
  }
  
  /**
   * Clean up old sessions
   * @param olderThan Sessions older than this date will be deleted
   */
  async cleanupOldSessions(olderThan: Date): Promise<number> {
    try {
      const { data, error } = await supabase.getClient()
        .from('agent_sessions')
        .delete()
        .lt('last_activity', olderThan.toISOString())
        .select('id');
      
      if (error) {
        logger.error(`Failed to clean up old sessions: ${error.message}`);
        throw new Error(`Failed to clean up old sessions: ${error.message}`);
      }
      
      return data?.length || 0;
    } catch (error) {
      logger.error(`Error cleaning up old sessions: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get welcome message based on agent type
   */
  private getWelcomeMessage(agentType: AgentType): string {
    switch (agentType) {
      case AgentType.RECOGNITION:
        return "Hi there! I'm your Recognition Assistant. I can help you identify materials from images and provide information about their properties. Upload an image to get started, or ask me any questions about material recognition.";
      
      case AgentType.MATERIAL_EXPERT:
        return "Hello! I'm your Material Expert. I can provide detailed information about various building materials, their properties, applications, and maintenance requirements. What materials would you like to learn about today?";
      
      case AgentType.PROJECT_ASSISTANT:
        return "Hi there! I'm your Project Assistant. I can help you plan your renovation or construction project, organize materials by room, calculate quantities, and recommend suitable materials. How can I assist with your project today?";
      
      case AgentType.KNOWLEDGE_BASE:
        return "Welcome to the Knowledge Base Agent. I can help you navigate our extensive material database and provide insights on material properties, applications, and relationships.";
      
      case AgentType.ANALYTICS:
        return "Analytics Agent initialized. This agent helps administrators analyze system metrics, user behavior, and material trends to derive actionable insights.";
      
      case AgentType.OPERATIONS:
        return "Operations Agent initialized. This agent monitors system health, performance, and resource utilization to ensure optimal operation of the KAI platform.";
      
      default:
        return "Hello! I'm an AI assistant that can help you with materials, projects, and recognition. How can I assist you today?";
    }
  }
}

// Export singleton instance
export const agentSessionService = new AgentSessionService();
export default agentSessionService;
/**
 * Agents Controller
 * 
 * Provides endpoints for interacting with crewAI agents,
 * serving as the bridge between frontend components and
 * the agent system backend.
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { initializeAgentSystem, AgentType } from '@kai/agents';
import { 
  uploadToStorage, 
  generateUniqueStorageKey 
} from '../services/storage/supabaseStorageService';
import { agentSessionService } from '../services/agents/agentSessionService';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

// Extend SessionQueryOptions with additional properties
interface ExtendedSessionQueryOptions {
  limit: number;
  offset: number;
  orderBy?: "createdAt" | "lastActivity";
  order?: 'asc' | 'desc';
  activeOnly?: boolean;  // Whether to only get active sessions
  withCache?: boolean;   // Whether to use cache for this query
}

// Initialize agent system
let isAgentSystemInitialized = false;
const initializeAgents = async () => {
  if (isAgentSystemInitialized) return;
  
  try {
    await initializeAgentSystem({
      apiKey: process.env.OPENAI_API_KEY || '',
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      logLevel: 'info'
    });
    
    isAgentSystemInitialized = true;
    console.log('Agent system initialized successfully');
  } catch (error) {
    console.error('Failed to initialize agent system:', error);
    throw error;
  }
};

/**
 * Create a new agent session
 */
export const createSession = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  try {
    // Initialize agent system if needed
    if (!isAgentSystemInitialized) {
      await initializeAgents();
    }
    
    const { agentType } = req.body;
    const userId = req.user?.id;
    
    // Ensure user is authenticated
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required to create an agent session' });
    }
    
    // Validate agent type
    if (!Object.values(AgentType).includes(agentType)) {
      return res.status(400).json({ error: 'Invalid agent type' });
    }
    
    // Create new session using service
    const session = await agentSessionService.createSession({
      agentType,
      userId,
      metadata: {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        createdAt: new Date().toISOString()
      }
    });
    
    // Return session info
    res.status(201).json({
      sessionId: session.id,
      agentType: session.agentType,
      messages: session.messages
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all sessions for the current user
 */
export const getUserSessions = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  try {
    const userId = req.user?.id;
    
    // User must be authenticated to access their sessions
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required to access sessions' });
    }
    
    // Get pagination parameters
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    
    // Get sessions from service
    const { sessions, total } = await agentSessionService.getUserSessions(userId, {
      limit,
      offset,
      orderBy: 'lastActivity',
      order: 'desc'
    });
    
    res.status(200).json({
      sessions,
      pagination: {
        total,
        limit,
        offset
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get messages for a session
 */
export const getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id;
    
    // Check if parameters are valid
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required to access messages' });
    }
    
    // Get messages from service
    try {
      const messages = await agentSessionService.getMessages(sessionId, userId);
      
      // Return session messages
      res.status(200).json({
        messages
      });
    } catch (error) {
      // Handle service-specific errors
      if ((error as Error).message === 'Session not found or access denied') {
        return res.status(404).json({ error: 'Session not found or you do not have permission to access it' });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Send a message to an agent
 */
export const sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  try {
    const { sessionId } = req.params;
    const { message } = req.body;
    const userId = req.user?.id;
    
    // Validate request
    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Session ID and message are required' });
    }
    
    // Ensure user is authenticated
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required to send messages' });
    }
    
    try {
      // Add user message to session
      await agentSessionService.addMessage(sessionId, userId, message, 'user');
      
      // Process message with corresponding agent
      // Get current session to access agent type
      const session = await agentSessionService.getSession(sessionId, userId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Process message with corresponding agent
      // In a real implementation, this would call the agent system
      const agentResponse = await processAgentRequest(session.agentType, message);
      
      // Add agent response to session
      await agentSessionService.addMessage(sessionId, userId, agentResponse, 'agent');
      
      // Get updated messages
      const messages = await agentSessionService.getMessages(sessionId, userId);
      
      // Return updated messages
      res.status(200).json({
        messages
      });
    } catch (error) {
      // Handle service-specific errors
      if ((error as Error).message === 'Session not found or access denied') {
        return res.status(404).json({ error: 'Session not found or you do not have permission to access it' });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Upload image for recognition agent
 */
export const uploadImage = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  try {
    const { sessionId } = req.params;
    const imageFile = req.file;
    const userId = req.user?.id;
    
    // Validate request
    if (!sessionId || !imageFile) {
      return res.status(400).json({ error: 'Session ID and image file are required' });
    }
    
    // Ensure user is authenticated
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required to upload images' });
    }
    
    // Get session to verify ownership and agent type
    const session = await agentSessionService.getSession(sessionId, userId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or you do not have permission to access it' });
    }
    
    // Check if session is for recognition agent
    if (session.agentType !== AgentType.RECOGNITION) {
      return res.status(400).json({ error: 'Image upload is only supported for recognition agent' });
    }
    
  try {
    // Upload file to Supabase storage (user-facing storage)
    const fileName = path.basename(imageFile.originalname);
    const storagePath = await generateUniqueStorageKey('uploads', 'agent-images', fileName);
    const uploadResult = await uploadToStorage(imageFile.path, storagePath, {
      isPublic: true, // Make public since this is user-facing content
      metadata: {
        originalName: imageFile.originalname,
        size: String(imageFile.size),
        mimetype: imageFile.mimetype,
        userId: userId // Add user ID to track ownership
      }
    });
    
    // Process image with recognition agent
    // In a real implementation, this would call the agent system with the Supabase URL
    const imageUrl = uploadResult.url;
    const analysisResult = await processImageAnalysis(imageUrl);
    
    // Clean up the local uploaded file after processing
    try {
      fs.unlinkSync(imageFile.path);
    } catch (err) {
      logger.warn(`Failed to clean up local uploaded file: ${err}`);
    }
    
    // Add agent response to session
    const responseContent = `I've analyzed your image and identified it as ${analysisResult.materialName} with ${analysisResult.confidence}% confidence. Would you like more details about this material?`;
    await agentSessionService.addMessage(sessionId, userId, responseContent, 'agent', [{
      id: uuidv4(),
      type: 'image',
      url: imageUrl,
      metadata: {
        analysis: analysisResult
      }
    }]);
    
    // Get updated messages
    const messages = await agentSessionService.getMessages(sessionId, userId);
    
    // Return result
    res.status(200).json({
      url: imageUrl,
      analysis: analysisResult,
      messages,
      storage: {
        key: uploadResult.key,
        url: uploadResult.url
      }
    });
  } catch (error) {
    // Clean up the uploaded file in case of error
    try {
      if (imageFile && imageFile.path) {
        fs.unlinkSync(imageFile.path);
      }
    } catch (cleanupErr) {
      logger.warn(`Failed to clean up uploaded file: ${cleanupErr}`);
    }
    
    next(error);
  }
  } catch (error) {
    next(error);
  }
};

/**
 * Close a session
 */
export const closeSession = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id;
    
    // Check if session ID is provided
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Ensure user is authenticated
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required to close a session' });
    }
    
    // Close session using service
    const success = await agentSessionService.closeSession(sessionId, userId);
    
    if (!success) {
      return res.status(404).json({ error: 'Session not found or you do not have permission to close it' });
    }
    
    res.status(200).json({ message: 'Session closed successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Process message with agent (mock implementation)
 */
const processAgentRequest = async (agentType: AgentType, message: string): Promise<string> => {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // In a real implementation, this would use the crewAI agent system
  // to process the message and generate a response
  
  // Mock responses based on agent type and message keywords
  const lowercaseMessage = message.toLowerCase();
  
  switch (agentType) {
    case AgentType.RECOGNITION:
      if (lowercaseMessage.includes('marble')) {
        return "Marble is a natural stone known for its unique veining patterns and luxurious appearance. It's commonly used for countertops, flooring, and decorative elements, though it requires regular sealing and maintenance to prevent staining.";
      } else if (lowercaseMessage.includes('porcelain')) {
        return "Porcelain tile is highly durable and water-resistant, making it suitable for bathrooms, kitchens, and high-traffic areas. It's available in many styles, including ones that convincingly mimic natural stone or wood.";
      } else {
        return "I can help you identify and understand different materials from images. If you upload a photo of a material, I'll analyze it and provide information about its properties and applications.";
      }
    
    case AgentType.MATERIAL_EXPERT:
      if (lowercaseMessage.includes('durability')) {
        return "When considering material durability, porcelain and quartz rank among the most durable options for residential use. Natural stones like granite are also very durable but require more maintenance. For high-traffic commercial spaces, porcelain or terrazzo would be excellent choices.";
      } else if (lowercaseMessage.includes('clean') || lowercaseMessage.includes('maintenance')) {
        return "For easy maintenance, porcelain and quartz require minimal care. Porcelain just needs regular cleaning with mild soap and water. Quartz never needs sealing. Natural stones like marble and granite require periodic sealing (typically annually) and should be cleaned with pH-neutral cleaners to preserve their finish.";
      } else {
        return "I can provide detailed information about material properties, applications, and maintenance requirements. What specific aspect would you like to know more about?";
      }
    
    case AgentType.PROJECT_ASSISTANT:
      if (lowercaseMessage.includes('cost') || lowercaseMessage.includes('budget')) {
        return "When planning your budget, I recommend allocating about 10-15% of your total project cost as a contingency for unexpected expenses. For kitchen renovations, typically 30% goes to cabinetry, 20% to installation, 15% to appliances, 10% to countertops, 10% to flooring, and the rest to lighting, backsplash, and miscellaneous items.";
      } else if (lowercaseMessage.includes('schedule') || lowercaseMessage.includes('timeline')) {
        return "A typical bathroom renovation takes 3-4 weeks, while kitchen renovations usually take 4-6 weeks. Full-home renovations can take 3-9 months depending on scope. I recommend building in buffer time for material deliveries and unexpected issues. Would you like me to help you create a detailed timeline for your project?";
      } else {
        return "I can help you plan your renovation or construction project, including material selection, cost estimation, and timeline planning. What specific aspect of your project would you like assistance with?";
      }
    
    case AgentType.KNOWLEDGE_BASE:
      return "I'm analyzing our knowledge base for relevant information about your query. This feature is still under development. In the future, I'll be able to provide detailed insights from our extensive material database.";
    
    case AgentType.ANALYTICS:
    case AgentType.OPERATIONS:
      return "This administrative agent capability is currently restricted to system operators. If you're an administrator, please login to the admin dashboard to access these features.";
    
    default:
      return "I'm not sure how to help with that specific query. Could you try rephrasing your question or provide more details about what you're looking for?";
  }
};

/**
 * Process image analysis (mock implementation)
 */
const processImageAnalysis = async (_imageUrl: string): Promise<any> => {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // In a real implementation, this would use the ML system
  // to analyze the image and identify the material
  
  // Mock result
  return {
    materialName: 'Carrara Marble',
    confidence: 92,
    properties: {
      material: 'Marble',
      color: 'White with Gray Veining',
      finish: 'Polished',
      size: '12" x 24"'
    },
    alternatives: [
      'White Quartz',
      'Porcelain Marble Look',
      'Dolomite'
    ]
  };
};

// --- Admin Functions ---

/**
 * Get agent system status (Admin only)
 */
export const getAgentSystemStatus = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  try {
    // Check for admin role - this should ideally be handled by middleware,
    // but we're adding an extra check here for safety
    const userRole = req.user?.role;
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can access agent system status'
      });
    }
    
    // Initialize agent system if needed
    if (!isAgentSystemInitialized) {
      try {
        await initializeAgents();
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: 'Failed to initialize agent system',
          error: process.env.NODE_ENV === 'development' ? String(error) : undefined
        });
      }
    }
    
    // Get active sessions count (with cached option to avoid excessive database queries)
    const { total: activeSessions } = await agentSessionService.getUserSessions('', {
      limit: 0, // We only need the count
      offset: 0,
      activeOnly: true,
      withCache: true
    } as ExtendedSessionQueryOptions);
    
    // Get total sessions
    const { total: totalSessions } = await agentSessionService.getUserSessions('', {
      limit: 0,
      offset: 0,
      withCache: true
    } as ExtendedSessionQueryOptions);
    
    // Get sessions by agent type
    const agentTypes = Object.values(AgentType);
    const sessionsByAgentType: Record<string, number> = {};
    
    // Instead of making multiple database calls, we would normally use an aggregation
    // Here we'll simulate that with some sample data for demonstration
    for (const agentType of agentTypes) {
      // This would be replaced with actual database queries in production
      // For now, we'll generate random data for demonstration
      sessionsByAgentType[agentType] = Math.floor(Math.random() * 100);
    }
    
    // Get performance metrics
    // In production, this would query actual metrics from monitoring systems
    const performanceMetrics = {
      averageResponseTime: 450, // milliseconds
      successRate: 97.5, // percent
      errorRate: 2.5, // percent
      throughput: 125 // requests per minute
    };
    
    // Get resource utilization
    const resourceUtilization = {
      cpu: 45, // percent
      memory: 68, // percent
      activeWorkers: 4,
      queuedRequests: 12
    };
    
    // Get historical metrics (last 7 days)
    const historyDays = 7;
    const historicalMetrics = {
      dailyRequests: Array.from({ length: historyDays }, () => Math.floor(Math.random() * 5000 + 1000)),
      dailyErrors: Array.from({ length: historyDays }, () => Math.floor(Math.random() * 100)),
      averageResponseTimes: Array.from({ length: historyDays }, () => Math.floor(Math.random() * 500 + 300))
    };
    
    // Calculate system health score (0-100)
    // This would be a composite score based on all metrics
    const healthScore = calculateHealthScore(performanceMetrics, resourceUtilization);
    
    // Identify any alerts or issues that need attention
    const alerts = generateSystemAlerts(performanceMetrics, resourceUtilization, historyDays);
    
    // Return all status information
    return res.status(200).json({
      success: true,
      data: {
        summary: {
          status: healthScore > 70 ? 'healthy' : healthScore > 40 ? 'degraded' : 'critical',
          healthScore,
          activeSessions,
          totalSessions,
          alertsCount: alerts.length
        },
        sessions: {
          active: activeSessions,
          total: totalSessions,
          byAgentType: sessionsByAgentType
        },
        performance: performanceMetrics,
        resources: resourceUtilization,
        historical: historicalMetrics,
        alerts
      }
    });
  } catch (error) {
    logger.error('Error fetching agent system status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch agent system status',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  }
};

/**
 * Helper function to calculate system health score
 * @private
 */
const calculateHealthScore = (
  performance: { successRate: number, averageResponseTime: number },
  resources: { cpu: number, memory: number }
): number => {
  // Weight different factors
  const successWeight = 0.4;
  const responseTimeWeight = 0.3;
  const resourceWeight = 0.3;
  
  // Calculate success score (0-100)
  const successScore = performance.successRate;
  
  // Calculate response time score (0-100)
  // Lower is better, so we invert; we consider < 300ms excellent and > 1000ms poor
  const responseTimeScore = Math.max(0, 100 - (performance.averageResponseTime - 300) / 7);
  
  // Calculate resource score (0-100)
  // Lower utilization is better
  const resourceScore = 100 - ((resources.cpu + resources.memory) / 2);
  
  // Calculate weighted health score
  const healthScore = Math.round(
    (successScore * successWeight) + 
    (responseTimeScore * responseTimeWeight) + 
    (resourceScore * resourceWeight)
  );
  
  return Math.min(100, Math.max(0, healthScore));
};

/**
 * Helper function to generate system alerts
 * @private
 */
const generateSystemAlerts = (
  performance: { errorRate: number, averageResponseTime: number },
  resources: { cpu: number, memory: number, queuedRequests: number },
  historyDays: number
): Array<{ level: 'critical' | 'warning' | 'info', message: string }> => {
  const alerts: Array<{ level: 'critical' | 'warning' | 'info', message: string }> = [];
  
  // Check for high error rate
  if (performance.errorRate > 5) {
    alerts.push({
      level: 'critical',
      message: `High error rate detected: ${performance.errorRate.toFixed(1)}%`
    });
  } else if (performance.errorRate > 2) {
    alerts.push({
      level: 'warning',
      message: `Elevated error rate: ${performance.errorRate.toFixed(1)}%`
    });
  }
  
  // Check for high response time
  if (performance.averageResponseTime > 800) {
    alerts.push({
      level: 'warning',
      message: `Slow response times: ${performance.averageResponseTime}ms average`
    });
  }
  
  // Check for high resource utilization
  if (resources.cpu > 85) {
    alerts.push({
      level: 'critical',
      message: `High CPU utilization: ${resources.cpu}%`
    });
  } else if (resources.cpu > 70) {
    alerts.push({
      level: 'warning',
      message: `Elevated CPU utilization: ${resources.cpu}%`
    });
  }
  
  if (resources.memory > 85) {
    alerts.push({
      level: 'critical',
      message: `High memory utilization: ${resources.memory}%`
    });
  } else if (resources.memory > 70) {
    alerts.push({
      level: 'warning',
      message: `Elevated memory utilization: ${resources.memory}%`
    });
  }
  
  // Check for queued requests
  if (resources.queuedRequests > 20) {
    alerts.push({
      level: 'warning',
      message: `Request queue building up: ${resources.queuedRequests} queued requests`
    });
  }
  
  return alerts;
};


// --- Background Tasks ---

/**
 * Schedule periodic cleanup of old sessions
 * Run daily to remove sessions older than 30 days
 */
export const scheduleSessionCleanup = (): void => {
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
  
  setInterval(async () => {
    try {
      const olderThan = new Date(Date.now() - SESSION_MAX_AGE);
      const deletedCount = await agentSessionService.cleanupOldSessions(olderThan);
      
      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old agent sessions`);
      }
    } catch (error) {
      logger.error('Failed to clean up old sessions:', error);
    }
  }, CLEANUP_INTERVAL);
  
  logger.info('Scheduled agent session cleanup job');
};
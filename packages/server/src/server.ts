/**
 * Main server entry point
 *
 * Sets up Express server, middleware, routes, and initializes services.
 * Handles application startup and shutdown.
 * Uses a dependency injection container for service management.
 */

import express, { Request, Response } from 'express';
import container from './container';
import { getDatabaseService } from './services/database/databaseService';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import http from 'http';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import { queueEventsServer } from './services/websocket/queue-events';
import { trainingProgressServer } from './services/websocket/training-progress';
import { knowledgeBaseEventsServer } from './services/websocket/knowledge-base-events';
import { KnowledgeBaseService } from './services/knowledgeBase/knowledgeBaseService';
import supabaseClient from './services/supabase/supabaseClient';
import { initializeStorage } from './services/storage/storageInitializer';
import { logger } from './utils/logger';
import healthCheckService from './services/monitoring/healthCheck.service';

// Type declarations moved to types/global.d.ts

// Load environment variables
dotenv.config();

// Import and validate environment variables
import { validateEnvironment, getEnvironmentHealth } from './utils/environment.validator';
// Create a local validator for Supabase configuration
function validateSupabaseConfig() {
  const hasUrl = !!process.env.SUPABASE_URL;
  const hasKey = !!process.env.SUPABASE_KEY;
  const isValid = hasUrl && hasKey;

  return {
    isValid,
    message: isValid ? 'Supabase configuration is valid' : 'Missing Supabase URL or key'
  };
}

// Import middleware before routes for clarity
import { errorHandler, notFound } from './middleware/error.middleware';
import { authMiddleware } from './middleware/auth.middleware';
import { analyticsMiddleware } from './middleware/analytics.middleware';
import {
  defaultLimiter,
  authLimiter,
  mlProcessingLimiter,
  agentLimiter,
  pdfProcessingLimiter
} from './middleware/rate-limit.middleware';

// Validate environment variables
try {
  validateEnvironment();

  // Validate Supabase configuration
  const supabaseValidation = validateSupabaseConfig();

  // Only initialize Supabase if configuration is valid
  if (supabaseValidation.isValid) {
    logger.info('Supabase configuration is valid, initializing client');
    supabaseClient.init({
      url: process.env.SUPABASE_URL!,
      key: process.env.SUPABASE_KEY!
    });
  } else {
    logger.warn('Supabase configuration validation failed, some features may not work properly');
  }
} catch (error) {
  logger.error('Server startup failed due to environment configuration issues:', error);
  process.exit(1);
}

// Import routes after middleware imports
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import materialRoutes from './routes/material.routes';
import catalogRoutes from './routes/catalog.routes';
import recognitionRoutes from './routes/recognition.routes';
import crawlerRoutes from './routes/crawler.routes';
import adminRoutes from './routes/admin.routes';
import pdfRoutes from './routes/api/pdf.routes';
import credentialsRoutes from './routes/credentials.routes';
import agentRoutes from './routes/agents.routes';
import aiRoutes from './routes/ai.routes';
import searchRoutes from './routes/search.routes';
import analyticsRoutes from './routes/analytics.routes';
import subscriptionRoutes from './routes/subscription.routes';
import enhancedVectorRoutes from './routes/enhancedVector.routes';
import webhookRoutes from './routes/webhook.routes';
import lightingRoutes from './routes/lighting.routes';
import materialPropertiesRoutes from './routes/material-properties.routes';
import cameraPoseRoutes from './routes/camera-pose.routes';
import { sceneOptimizationRoutes } from './routes/scene-optimization.routes';
import { roomLayoutRoutes } from './routes/room-layout.routes';
import pointCloudRoutes from './routes/point-cloud.routes';
import sceneGraphRoutes from './routes/scene-graph.routes';
import { scheduleSessionCleanup } from './controllers/agents.controller';

// Create Express app
const app = express();
const httpServer = http.createServer(app);

// Import WebSocket service
import agentWebSocketService from './services/websocket/agent-websocket';

// Set up security and basic middleware first
app.use(cors({
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Apply rate limiting before routes
app.use('/api/auth', authLimiter); // Stricter limit for auth endpoints
app.use('/api/recognition', mlProcessingLimiter); // ML processing limit
app.use('/api/agents', agentLimiter); // Agent API limit
app.use('/api/pdf', pdfProcessingLimiter); // PDF processing limit
app.use('/api', defaultLimiter); // Default limit for all other API routes

// Add analytics middleware to track all API requests
app.use(analyticsMiddleware());

// Serve Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true,
  }
}));


// Set up routes after all prerequisites
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/catalogs', authMiddleware, catalogRoutes);
app.use('/api/recognition', recognitionRoutes);
app.use('/api/crawlers', authMiddleware, crawlerRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/pdf', authMiddleware, pdfRoutes);
app.use('/api/credentials', authMiddleware, credentialsRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/vector/enhanced', enhancedVectorRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/lighting', lightingRoutes);
app.use('/api/material-properties', materialPropertiesRoutes);
app.use('/api/camera-pose', cameraPoseRoutes);
app.use('/api/scene-optimization', sceneOptimizationRoutes);
app.use('/api/room-layout', roomLayoutRoutes);
app.use('/api/point-cloud', pointCloudRoutes);
app.use('/api/scene-graph', sceneGraphRoutes);

/**
 * @openapi
 * /health:
 *   get:
 *     tags:
 *       - System
 *     summary: Basic health check endpoint
 *     description: Returns basic system health information
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: object
 *                   properties:
 *                     seconds:
 *                       type: integer
 *                     formatted:
 *                       type: string
 *                 memory:
 *                   type: object
 *                 cpu:
 *                   type: object
 *                 services:
 *                   type: object
 */
app.get('/health', async (_req: Request, res: Response) => {
  try {
    // Use the health check service to get comprehensive health information
    const healthInfo = await healthCheckService.getHealth();
    
    // Get database health status
    let dbHealth = { status: 'not_configured' };
    try {
      // Get database service from container and check health if available
      const dbService = getDatabaseService();
      dbHealth = await dbService.healthCheck();
    } catch (dbError) {
      logger.warn('Database health check failed or service not initialized', { error: dbError });
    }
    
    // Merge health information
    const mergedHealthInfo = {
      ...healthInfo,
      services: {
        ...healthInfo.services,
        database: dbHealth
      }
    };
    
    res.status(200).json(mergedHealthInfo);
  } catch (error) {
    logger.error('Error retrieving health information:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @openapi
 * /health/detailed:
 *   get:
 *     tags:
 *       - System
 *     summary: Detailed health check endpoint
 *     description: Returns comprehensive system health metrics with detailed component status
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detailed health information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: object
 *                 memory:
 *                   type: object
 *                 cpu:
 *                   type: object
 *                 services:
 *                   type: object
 *                 trends:
 *                   type: object
 *                 systemDetails:
 *                   type: object
 *       401:
 *         description: Unauthorized - authentication required
 *       500:
 *         description: Server error
 */
app.get('/health/detailed', authMiddleware, async (_req: Request, res: Response) => {
  try {
    // Get detailed health metrics including trends and system details
    const detailedHealth = await healthCheckService.getDetailedHealth();
    
    // Get detailed database metrics if available
    let dbMetrics = { status: 'not_configured', metrics: {} };
    try {
      const dbService = getDatabaseService();
      dbMetrics = await dbService.getDetailedMetrics();
    } catch (dbError) {
      logger.warn('Database detailed metrics check failed', { error: dbError });
    }
    
    // Merge health information with database metrics
    const enhancedHealth = {
      ...detailedHealth,
      services: {
        ...detailedHealth.services,
        database: {
          ...dbMetrics
        }
      }
    };
    
    res.status(200).json(enhancedHealth);
  } catch (error) {
    logger.error('Error retrieving detailed health information:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add 404 handler for undefined routes
app.use(notFound);

// Error handling middleware should always be last
app.use(errorHandler);

/**
 * Starts the server and initializes all required services
 */
const PORT = process.env.PORT || 3000;
const startServer = async (): Promise<void> => {
  // Start health monitoring service with 2-minute interval
  healthCheckService.startMonitoring(120000);
  logger.info('Health monitoring service started');
  
  // Initialize database service from container
  try {
    const dbService = getDatabaseService();
    await dbService.initialize();
    logger.info('Database service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database service:', error);
    // Don't throw here - we can still start the server without DB
    // Some features may be degraded but system can still function
  }
  // Initialize Services
  // Initialize KnowledgeBaseService (singleton pattern, initialization has side effects)
  KnowledgeBaseService.getInstance();
  console.log('Knowledge Base Service initialized');

  // Initialize S3 Storage
  try {
    initializeStorage();
    console.log('S3 Storage initialized successfully');
  } catch (error) {
    console.error('Failed to initialize S3 Storage:', error);
    throw error; // Rethrow to prevent server startup if storage init fails
  }

  // Initialize WebSocket servers
  queueEventsServer.initialize(httpServer);
  trainingProgressServer.initialize(httpServer);
  knowledgeBaseEventsServer.initialize(httpServer);
  agentWebSocketService.initialize(httpServer);

  console.log('WebSocket servers initialized');

  // Initialize agent session cleanup job
  scheduleSessionCleanup();
  logger.info('Agent session cleanup job scheduled');

  return new Promise<void>((resolve) => {
    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      resolve();
    });
  });
};

/**
 * Graceful shutdown handler
 * Closes all server connections and exits the process
 */
const shutdownGracefully = async (err?: Error): Promise<void> => {
  // Stop health monitoring
  healthCheckService.stopMonitoring();
  logger.info('Health monitoring service stopped');
  
  // Close database connections
  try {
    const dbService = getDatabaseService();
    await dbService.close();
    logger.info('Database connections closed successfully');
  } catch (dbError) {
    logger.error('Error closing database connections:', dbError);
  }
  if (err) {
    logger.error(`Server shutting down due to error: ${err.message}`, {
      stack: err.stack
    });
  } else {
    logger.info('Server shutting down gracefully');
  }

  // Close WebSocket servers
  const closePromises = [
    queueEventsServer.close(),
    trainingProgressServer.close(),
    knowledgeBaseEventsServer.close()
  ];

  // Add agentWebSocketService.close() if it exists
  if (typeof agentWebSocketService.close === 'function') {
    closePromises.push(agentWebSocketService.close());
  } else {
    logger.warn('Agent WebSocket service does not have a close method');
  }

  await Promise.allSettled(closePromises).catch(closeErr => {
    logger.error(`Error during WebSocket server closure: ${closeErr.message}`);
  });

  // Close HTTP server (only once)
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(err ? 1 : 0);
  });
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  shutdownGracefully(err);
});

// Handle SIGTERM signal (e.g., from Docker, Kubernetes)
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  shutdownGracefully();
});

// Handle SIGINT signal (e.g., Ctrl+C)
process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  shutdownGracefully();
});

// Start the server
startServer().catch(err => {
  logger.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});

export default app;
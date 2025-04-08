/**
 * Main server entry point
 * 
 * Sets up Express server, middleware, routes, and initializes services.
 * Handles application startup and shutdown.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import http from 'http';
import { queueEventsServer } from './services/websocket/queue-events';
import { trainingProgressServer } from './services/websocket/training-progress';
import { knowledgeBaseEventsServer } from './services/websocket/knowledge-base-events';
import { KnowledgeBaseService } from './services/knowledgeBase/knowledgeBaseService';
import { supabaseClient } from './services/supabase/supabaseClient';
import { initializeStorage } from './services/storage/storageInitializer';
import { logger } from './utils/logger';

// Type declarations moved to types/global.d.ts
  
// Load environment variables
dotenv.config();

// Import and validate environment variables
import { validateEnvironment, getEnvironmentHealth } from './utils/environment.validator';

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
} catch (error) {
  logger.error('Server startup failed due to environment configuration issues:', error);
  process.exit(1);
}

// Initialize Supabase
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  supabaseClient.init({
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY
  });
} else {
  logger.warn('Supabase URL or key not found in environment variables');
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

/**
 * Enhanced health check endpoint - public access
 * Provides basic system health information
 */
app.get('/health', (_req: Request, res: Response) => {
  // Gather system information
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  const nodeVersion = process.version;
  
  const healthInfo = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(uptime),
      formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
    },
    system: {
      nodeVersion,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
      }
    },
    environment: getEnvironmentHealth()
  };
  
  res.status(200).json(healthInfo);
});

/**
 * Advanced health check endpoint - protected by auth
 * Provides detailed system and component status information
 */
app.get('/health/detailed', authMiddleware, (_req: Request, res: Response) => {
  // Gather detailed system and component status
  const healthInfo = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    system: {
      nodeVersion: process.version,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    },
    environment: getEnvironmentHealth(),
    components: {
      database: { status: 'ok' }, // Could be expanded with actual DB health check
      storage: { status: 'ok' },  // Could be expanded with S3 connection status
      websockets: {
        status: 'ok',
        servers: [
          { name: 'queue-events', status: 'active' },
          { name: 'training-progress', status: 'active' },
          { name: 'knowledge-base-events', status: 'active' },
          { name: 'agent-websocket', status: 'active' }
        ]
      }
    }
  };
  
  res.status(200).json(healthInfo);
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
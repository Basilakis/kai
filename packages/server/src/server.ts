import express from 'express';
import type Request from 'express';
import type Response from 'express';
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

// Add type declaration for Node.js process
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SUPABASE_URL?: string;
      SUPABASE_KEY?: string;
      PORT?: string;
      JWT_SECRET?: string;
      NODE_ENV?: 'development' | 'production' | 'test';
    }
  }
}
  
// Load environment variables
dotenv.config();

// Initialize Supabase
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  supabaseClient.init({
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY
  });
} else {
  console.warn('Supabase URL or key not found in environment variables');
}

// Import routes
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

// Import middleware
import { errorHandler } from './middleware/error.middleware';
import { authMiddleware } from './middleware/auth.middleware';

// Create Express app
const app = express();
const httpServer = http.createServer(app);

// Import WebSocket service
import agentWebSocketService from './services/websocket/agent-websocket';

// Set up middleware
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


// Set up routes
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

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
const startServer = async () => {
  // Initialize Services
  const knowledgeBaseService = KnowledgeBaseService.getInstance();
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
  
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error(`Unhandled Rejection: ${err.message}`);
  // Close WebSocket servers
  queueEventsServer.close();
  trainingProgressServer.close();
  knowledgeBaseEventsServer.close().catch(err => {
    console.error(`Error closing knowledge base events server: ${err.message}`);
  });
  // Close server & exit process
  httpServer.close(() => process.exit(1));
});

// Start the server
startServer().catch(err => {
  console.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});

export default app;
/**
 * Main entry point for the Coordinator service
 *
 * Sets up Express server, middleware, routes, and initializes services.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { CoordinatorService } from './services/coordinator.service';
import { QueueService } from './services/queue.service';
import { WorkflowService } from './services/workflow.service';
import { MetricsService } from './services/metrics.service';
import { PredictiveScalingService } from './services/predictive-scaling.service';
import { ScalingDependenciesService } from './services/scaling-dependencies.service';
import { HpaEventLoggerService } from './services/hpa-event-logger.service';
import { setupMetricsRoutes } from './routes/metrics.routes';
import { setupPredictiveScalingRoutes } from './routes/predictive-scaling.routes';
import { setupScalingDependenciesRoutes } from './routes/scaling-dependencies.routes';
import { setupHpaEventsRoutes } from './routes/hpa-events.routes';
import { createLogger } from './utils/logger';

// Create logger
const logger = createLogger('coordinator-main');

// Create Express app
const app = express();
const httpServer = createServer(app);

// Create metrics server for Prometheus scraping
const metricsApp = express();
const metricsServer = createServer(metricsApp);

// Initialize services
const queueService = new QueueService();
const workflowService = new WorkflowService();
const coordinatorService = new CoordinatorService();
const metricsService = new MetricsService(queueService, workflowService);
const predictiveScalingService = new PredictiveScalingService();
const scalingDependenciesService = new ScalingDependenciesService();
const hpaEventLoggerService = new HpaEventLoggerService();

// Start predictive scaling service if enabled
if (process.env.ENABLE_PREDICTIVE_SCALING === 'true') {
  predictiveScalingService.start();
  logger.info('Predictive scaling service started');
}

// Start scaling dependencies service if enabled
if (process.env.ENABLE_SCALING_DEPENDENCIES === 'true') {
  scalingDependenciesService.start();
  logger.info('Scaling dependencies service started');
}

// Start HPA event logger service if enabled
if (process.env.ENABLE_HPA_EVENT_LOGGING === 'true') {
  hpaEventLoggerService.start();
  logger.info('HPA event logger service started');
}

// Apply middleware
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Add security headers
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Basic routes
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy' });
});

app.get('/ready', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ready' });
});

// API routes
if (process.env.ENABLE_PREDICTIVE_SCALING === 'true') {
  app.use('/api/predictive-scaling', setupPredictiveScalingRoutes(predictiveScalingService));
  logger.info('Predictive scaling routes registered');
}

if (process.env.ENABLE_SCALING_DEPENDENCIES === 'true') {
  app.use('/api/scaling-dependencies', setupScalingDependenciesRoutes(scalingDependenciesService));
  logger.info('Scaling dependencies routes registered');
}

if (process.env.ENABLE_HPA_EVENT_LOGGING === 'true') {
  app.use('/api/hpa-events', setupHpaEventsRoutes(hpaEventLoggerService));
  logger.info('HPA events routes registered');
}

// API routes
app.post('/api/workflow', async (req: Request, res: Response) => {
  try {
    const result = await coordinatorService.createWorkflow(req.body);
    res.status(201).json(result);
  } catch (error) {
    logger.error('Error creating workflow', { error });
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

app.get('/api/workflow/:id', async (req: Request, res: Response) => {
  try {
    const result = await coordinatorService.getWorkflow(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error getting workflow', { error });
    res.status(500).json({ error: 'Failed to get workflow' });
  }
});

// Set up metrics routes on a separate server
metricsApp.use('/metrics', setupMetricsRoutes(metricsService));

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', { error: err });
  res.status(500).json({ error: 'Internal server error' });
});

// Start servers
const PORT = process.env.PORT || 8080;
const METRICS_PORT = process.env.METRICS_PORT || 8081;

// Start the main server
httpServer.listen(PORT, () => {
  logger.info(`Coordinator service running on port ${PORT}`);
});

// Start the metrics server
metricsServer.listen(METRICS_PORT, () => {
  logger.info(`Metrics server running on port ${METRICS_PORT}`);
});

// Handle graceful shutdown
const shutdownGracefully = async () => {
  logger.info('Shutting down gracefully');

  // Stop metrics collection
  metricsService.stopMetricsCollection();

  // Stop predictive scaling service if enabled
  if (process.env.ENABLE_PREDICTIVE_SCALING === 'true') {
    await predictiveScalingService.close();
    logger.info('Predictive scaling service closed');
  }

  // Stop scaling dependencies service if enabled
  if (process.env.ENABLE_SCALING_DEPENDENCIES === 'true') {
    await scalingDependenciesService.close();
    logger.info('Scaling dependencies service closed');
  }

  // Stop HPA event logger service if enabled
  if (process.env.ENABLE_HPA_EVENT_LOGGING === 'true') {
    await hpaEventLoggerService.close();
    logger.info('HPA event logger service closed');
  }

  // Close HTTP servers
  httpServer.close(() => {
    logger.info('Main HTTP server closed');
  });

  metricsServer.close(() => {
    logger.info('Metrics HTTP server closed');
  });

  // Exit with success code
  process.exit(0);
};

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  shutdownGracefully();
});

process.on('SIGINT', () => {
  logger.info('SIGINT received');
  shutdownGracefully();
});

export default app;

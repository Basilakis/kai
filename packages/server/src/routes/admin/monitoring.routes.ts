/**
 * Monitoring Routes
 * 
 * API endpoints for the monitoring dashboard, providing access to:
 * - System logs
 * - Error distribution
 * - Health metrics
 * - Rate limit statistics
 * - Service-specific metrics (search index, message broker, etc.)
 * - ML system performance
 * - Real-time event monitoring
 * - Infrastructure details
 */
import express, { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { logger, LogQueryOptions } from '../../../../shared/src/utils/logger';
import * as os from 'os';
import searchIndexQueue from '../../services/knowledgeBase/searchIndexQueue';
import { messageBrokerFactory } from '../../services/messaging/messageBrokerFactory';
import { isEnhancedMessageBroker } from '../../services/messaging/messageBrokerInterface';

// Get broker instance
const broker = messageBrokerFactory.createBroker();

// Define interface for completed job
interface CompletedJob {
  startedAt?: Date;
  completedAt?: Date;
  [key: string]: any; // Allow other properties
}

// Define interface for CPU utilization
interface CpuUtilization {
  perCore: Array<{
    usage: number;
    user: number;
    sys: number;
    idle: number;
  }>;
  average: {
    usage: number;
    user: number;
    sys: number;
    idle: number;
  };
}

// Add type augmentation for the OS module only
declare module "os" {
  function loadavg(): number[];
  function uptime(): number;
  function cpus(): Array<{
    model: string;
    speed: number;
    times: {
      user: number;
      nice: number;
      sys: number;
      idle: number;
      irq: number;
    }
  }>;
}

// Create router with proper typing
const router = (express as any).Router();

// Middleware to ensure only admins can access monitoring routes
const adminAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // First apply the standard auth middleware
  authMiddleware(req, res, (err: Error) => {
    if (err) {
      return next(err);
    }
    
    // Check if the user has admin role
    // This would be replaced with your actual admin check logic
    if (req.user && req.user.roles && req.user.roles.includes('admin')) {
      return next();
    }
    
    // Not an admin
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have permission to access monitoring data'
    });
  });
};

/**
 * @route POST /api/admin/monitoring/logs
 * @description Get system logs with filtering
 * @access Admin
 */
router.post('/logs', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const options: LogQueryOptions = req.body;
    
    // Convert ISO date strings to Date objects
    if (options.startDate && typeof options.startDate === 'string') {
      options.startDate = new Date(options.startDate);
    }
    
    if (options.endDate && typeof options.endDate === 'string') {
      options.endDate = new Date(options.endDate);
    }
    
    // Query logs
    const logs = await logger.query(options);
    const total = await logger.count({
      level: options.level,
      module: options.module,
      startDate: options.startDate,
      endDate: options.endDate,
      searchText: options.searchText
    });
    
    res.json({
      logs,
      total
    });
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch logs'
    });
  }
});

/**
 * @route GET /api/admin/monitoring/errors
 * @description Get error distribution by module
 * @access Admin
 */
router.get('/errors', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    // Default to 24 hours (24 * 60 * 60 * 1000 milliseconds)
    // Safely handle the timespan parameter which could be string, array, or undefined
    const timespan = parseInt(typeof req.query.timespan === 'string' ? req.query.timespan : '') || 24 * 60 * 60 * 1000;
    
    // Get error distribution
    const distribution = await logger.getErrorDistribution(timespan);
    
    res.json({
      distribution
    });
  } catch (err) {
    console.error('Error fetching error distribution:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch error distribution'
    });
  }
});

/**
 * @route GET /api/admin/monitoring/service-metrics
 * @description Get detailed metrics from various services
 * @access Admin
 */
router.get('/service-metrics', adminAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    // Get metrics from multiple services
    const metrics = {
      // Search Index Queue metrics
      searchIndex: {
        jobs: {
          counts: searchIndexQueue.getCounts(),
          all: searchIndexQueue.getAll()
        },
        processing: {
          active: searchIndexQueue.getAll('processing').length,
          averageTime: calculateAverageProcessingTime(searchIndexQueue.getAll('completed'))
        }
      },
      // Message Broker metrics
      messageBroker: {
        queues: isEnhancedMessageBroker(broker) ? await broker.getMessageStats() : {},
        performance: {
          avgDeliveryTime: await getAverageMessageDeliveryTime(),
          throughput: await getMessageThroughput()
        }
      }
    };
    
    res.json(metrics);
  } catch (err) {
    console.error('Error fetching service metrics:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch service metrics'
    });
  }
});

/**
 * @route GET /api/admin/monitoring/ml-performance
 * @description Get ML model performance metrics
 * @access Admin
 */
router.get('/ml-performance', adminAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    // Get metrics from ML services
    const metrics = {
      models: {
        // These would come from actual ML services in a real implementation
        materialRecognizer: {
          accuracy: 0.94,
          precision: 0.92,
          recall: 0.91,
          f1Score: 0.914,
          lastEvaluated: new Date(Date.now() - 86400000), // 1 day ago
          inferenceSpeed: '120ms',
          confidenceDistribution: {
            high: 76,
            medium: 18,
            low: 6
          }
        },
        textEmbeddings: {
          dimensions: 1536,
          clusterQuality: 0.87,
          retrievalAccuracy: 0.89,
          averageInferenceTime: '45ms',
          lastTrainingTimestamp: new Date(Date.now() - 7 * 86400000) // 7 days ago
        }
      },
      trainingJobs: {
        active: 1,
        queued: 3,
        completed: 42,
        failed: 3
      },
      feedback: {
        positiveRate: 0.87,
        negativeRate: 0.13,
        improvementRate: 0.08
      }
    };
    
    res.json(metrics);
  } catch (err) {
    console.error('Error fetching ML performance metrics:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch ML performance metrics'
    });
  }
});

/**
 * @route GET /api/admin/monitoring/realtime-info
 * @description Get information about available real-time monitoring channels
 * @access Admin
 */
router.get('/realtime-info', adminAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const realtimeInfo = {
      websocketEndpoints: {
        queueEvents: {
          url: '/api/ws/queue-events',
          availableQueues: ['searchIndex', 'pdf', 'ml', 'agents'],
          eventTypes: ['job-added', 'job-started', 'job-progress', 'job-completed', 'job-failed']
        },
        knowledgeBaseEvents: {
          url: '/api/ws/knowledge-base-events',
          entities: ['materials', 'collections', 'categories', 'searchIndices'],
          eventTypes: ['created', 'updated', 'deleted']
        },
        agentEvents: {
          url: '/api/ws/agent-events',
          eventTypes: ['session-created', 'message-received', 'action-performed', 'session-ended']
        }
      },
      subscriptionInstructions: {
        authentication: 'Send authentication message with JWT token after connection',
        subscribing: 'Send subscribe message with entity types and event types',
        messageFormat: 'All messages are JSON with type, payload, and timestamp fields'
      },
      currentConnections: {
        queueEvents: 3,
        knowledgeBaseEvents: 1,
        agentEvents: 2
      }
    };
    
    res.json(realtimeInfo);
  } catch (err) {
    console.error('Error fetching realtime info:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch realtime monitoring information'
    });
  }
});

/**
 * @route GET /api/admin/monitoring/infrastructure
 * @description Get detailed infrastructure metrics
 * @access Admin
 */
router.get('/infrastructure', adminAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    // Get detailed infrastructure metrics
    const metrics = {
      system: {
        os: {
          type: os.type(),
          platform: os.platform(),
          release: os.release(),
          uptime: os.uptime(),
          loadavg: os.loadavg()
        },
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          usagePercent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
        },
        cpu: {
          cores: os.cpus().length,
          model: os.cpus()[0]?.model || 'Unknown',
          speed: os.cpus()[0]?.speed || 0,
          utilization: await getCpuUtilizationDetails()
        }
      },
      database: {
        connections: 24,
        activeQueries: 3,
        slowQueries: 1,
        avgQueryTime: '4.2ms',
        cacheHitRate: '87%',
        storageUsed: '1.2GB',
        storageAvailable: '48.8GB'
      },
      storage: {
        totalSize: '240GB',
        usedSize: '85GB',
        freeSize: '155GB',
        usagePercent: '35.4%',
        readOperations: 14520,
        writeOperations: 3245,
        avgReadLatency: '3.1ms',
        avgWriteLatency: '8.7ms'
      },
      network: {
        inboundTraffic: '1.2GB/hour',
        outboundTraffic: '3.4GB/hour',
        activeConnections: 156,
        errorRate: '0.02%',
        avgLatency: '18ms'
      }
    };
    
    res.json(metrics);
  } catch (err) {
    console.error('Error fetching infrastructure metrics:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch infrastructure metrics'
    });
  }
});

/**
 * @route GET /api/admin/monitoring/health
 * @description Get system health metrics
 * @access Admin
 */
router.get('/health', adminAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    // Get rate limit stats
    const rateLimitStats = await getRateLimitStats();
    
    // Build health metrics
    const healthMetrics = {
      status: determineSystemStatus(),
      uptime: process.uptime(),
      memory: {
        total: os.totalmem(),
        used: os.totalmem() - os.freemem(),
        free: os.freemem()
      },
      cpu: {
        usage: await getCpuUsage()
      },
      services: await getServiceStatuses(),
      rateLimits: rateLimitStats
    };
    
    res.json(healthMetrics);
  } catch (err) {
    console.error('Error fetching health metrics:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch health metrics'
    });
  }
});

/**
 * Determine overall system status based on various metrics
 */
function determineSystemStatus(): 'healthy' | 'degraded' | 'unhealthy' {
  const memoryUsagePercent = (os.totalmem() - os.freemem()) / os.totalmem() * 100;
  
  if (memoryUsagePercent > 90) {
    return 'unhealthy';
  } else if (memoryUsagePercent > 75) {
    return 'degraded';
  }
  
  return 'healthy';
}

/**
 * Get CPU usage percentage
 */
async function getCpuUsage(): Promise<number> {
  return new Promise(resolve => {
    // Simple CPU load estimate using OS - with null check
    const loadAvg = os.loadavg()[0] ?? 0; // Use 0 as fallback if undefined
    const cpuCount = os.cpus().length;
    const cpuUsagePercent = (loadAvg / cpuCount) * 100;
    
    resolve(Math.min(Math.round(cpuUsagePercent), 100));
  });
}

/**
 * Get status of various services
 */
async function getServiceStatuses(): Promise<Record<string, { status: 'up' | 'down' | 'degraded', lastCheck: Date, metadata?: Record<string, unknown> }>> {
  // In a real implementation, this would check actual services with more details
  return {
    'database': {
      status: 'up',
      lastCheck: new Date()
    },
    'cache': {
      status: 'up',
      lastCheck: new Date()
    },
    'search': {
      status: 'up',
      lastCheck: new Date()
    },
    'ml-processor': {
      status: 'up',
      lastCheck: new Date()
    },
    'queue': {
      status: 'up',
      lastCheck: new Date()
    }
  };
}

/**
 * Get detailed CPU utilization metrics
 */
async function getCpuUtilizationDetails(): Promise<CpuUtilization> {
  // In a real implementation, this would collect detailed CPU metrics
  const cpus = os.cpus();
  const utilization = cpus.map(cpu => {
    const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
    const idle = cpu.times.idle;
    const used = total - idle;
    return {
      usage: Math.round((used / total) * 100),
      user: Math.round((cpu.times.user / total) * 100),
      sys: Math.round((cpu.times.sys / total) * 100),
      idle: Math.round((idle / total) * 100)
    };
  });

  // Calculate average across all cores
  const avgUtilization = {
    usage: Math.round(utilization.reduce((acc, core) => acc + core.usage, 0) / cpus.length),
    user: Math.round(utilization.reduce((acc, core) => acc + core.user, 0) / cpus.length),
    sys: Math.round(utilization.reduce((acc, core) => acc + core.sys, 0) / cpus.length),
    idle: Math.round(utilization.reduce((acc, core) => acc + core.idle, 0) / cpus.length)
  };

  return {
    perCore: utilization,
    average: avgUtilization
  };
}

/**
 * Calculate average processing time for completed jobs
 */
function calculateAverageProcessingTime(completedJobs: CompletedJob[]): number {
  if (completedJobs.length === 0) return 0;
  
  let totalTime = 0;
  let count = 0;
  
  for (const job of completedJobs) {
    if (job.startedAt && job.completedAt) {
      totalTime += job.completedAt.getTime() - job.startedAt.getTime();
      count++;
    }
  }
  
  return count > 0 ? Math.round(totalTime / count) : 0;
}

/**
 * Get average message delivery time from the message broker
 */
async function getAverageMessageDeliveryTime(): Promise<number> {
  // In a real implementation, this would query actual metrics
  // For now, return a sample value
  return 12; // milliseconds
}

/**
 * Get message throughput from the message broker
 */
async function getMessageThroughput(): Promise<{
  messagesPerSecond: number;
  totalMessages: number;
}> {
  // In a real implementation, this would query actual metrics
  // For now, return sample values
  return {
    messagesPerSecond: 42,
    totalMessages: 18245
  };
}

/**
 * Get rate limit statistics
 */
async function getRateLimitStats(): Promise<Record<string, { total: number, limited: number, remaining: number }>> {
  // In a real implementation, this would fetch stats from the rate limiters
  return {
    '/api/auth/*': {
      total: 1243,
      limited: 17,
      remaining: 183
    },
    '/api/ml/*': {
      total: 421,
      limited: 12,
      remaining: 88
    },
    '/api/agents/*': {
      total: 892,
      limited: 8,
      remaining: 292
    },
    '/api/pdf/*': {
      total: 56,
      limited: 2,
      remaining: 3
    }
  };
}

export default router;
import { Request, Response, NextFunction, PerformanceMetrics, CPU, RedisConfig, Redis, os } from '../types/middleware';
import createLogger from '../utils/logger';

const logger = createLogger('PerformanceMonitoring');

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics;
  private redis: Redis | null = null;
  private readonly metricsKey = 'kai:performance:metrics';
  
  private constructor() {
    this.metrics = {
      requestCount: 0,
      averageResponseTime: 0,
      errorRate: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      activeConnections: 0
    };
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  public async connectRedis(config: RedisConfig) {
    try {
      this.redis = new Redis(config);
      logger.info('Connected to Redis for performance metrics');
    } catch (error) {
      logger.error(`Failed to connect to Redis: ${error}`);
    }
  }

  private async updateMetrics(metrics: Partial<PerformanceMetrics>) {
    Object.assign(this.metrics, metrics);
    
    if (this.redis) {
      try {
        await this.redis.set(this.metricsKey, JSON.stringify(this.metrics));
      } catch (error) {
        logger.error(`Failed to update Redis metrics: ${error}`);
      }
    }
  }

  public async getMetrics(): Promise<PerformanceMetrics> {
    if (this.redis) {
      try {
        const cachedMetrics = await this.redis.get(this.metricsKey);
        if (cachedMetrics) {
          return JSON.parse(cachedMetrics);
        }
      } catch (error) {
        logger.error(`Failed to get Redis metrics: ${error}`);
      }
    }
    return this.metrics;
  }

  public trackRequest(responseTime: number, isError: boolean) {
    this.metrics.requestCount++;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.requestCount - 1) + responseTime) 
      / this.metrics.requestCount;
    
    if (isError) {
      this.metrics.errorRate = 
        (this.metrics.errorRate * (this.metrics.requestCount - 1) + 1) 
        / this.metrics.requestCount;
    }
  }

  public updateSystemMetrics() {
    const cpus = os.cpus() as CPU[];
    let totalCPUUsage = 0;
    
    cpus.forEach((cpu: CPU) => {
      const total = Object.values(cpu.times).reduce((acc: number, time: number) => acc + time, 0);
      const idle = cpu.times.idle;
      totalCPUUsage += (total - idle) / total;
    });

    this.updateMetrics({
      cpuUsage: (totalCPUUsage / cpus.length) * 100,
      memoryUsage: (os.totalmem() - os.freemem()) / os.totalmem() * 100
    });
  }

  public updateConnections(count: number) {
    this.updateMetrics({ activeConnections: count });
  }
}

// Middleware factory
export const createPerformanceMiddleware = (redisConfig?: RedisConfig) => {
  const monitor = PerformanceMonitor.getInstance();
  
  if (redisConfig) {
    monitor.connectRedis(redisConfig);
  }

  // Update system metrics every minute
  setInterval(() => {
    monitor.updateSystemMetrics();
  }, 60000);

  return (_req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Track response
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      const isError = res.statusCode >= 400;
      
      monitor.trackRequest(responseTime, isError);
    });

    next();
  };
};

// Metrics endpoint middleware
export const metricsEndpoint = async (_req: Request, res: Response) => {
  const monitor = PerformanceMonitor.getInstance();
  const metrics = await monitor.getMetrics();
  res.json(metrics);
};

export default createPerformanceMiddleware;
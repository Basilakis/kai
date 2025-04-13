/**
 * Health Check Monitoring Service
 * 
 * Provides comprehensive health monitoring for the application and its dependencies.
 * This service enables regular health checks of critical system components and
 * exposes methods to query system health status.
 */

import os from 'os';
import { logger } from '../../utils/logger';
import supabaseClient from '../supabase/supabaseClient';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: {
    seconds: number;
    formatted: string;
  };
  memory: {
    used: string;
    free: string;
    total: string;
    rss: string;
    heapTotal: string;
    heapUsed: string;
  };
  cpu: {
    loadAvg: number[];
    cores: number;
    model: string;
    usage: number;
  };
  services: {
    database: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      responseTime?: number;
      connectedAt?: string;
      message?: string;
    };
    storage: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      responseTime?: number;
      message?: string;
    };
    websockets: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      activeConnections?: number;
      message?: string;
    };
    cache: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      responseTime?: number;
      message?: string;
    };
  };
}

/**
 * Class that provides health monitoring capabilities
 */
export class HealthCheckService {
  private static instance: HealthCheckService;
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private intervalMs: number = 60000; // Default: check every minute
  private lastHealthStatus: HealthStatus | null = null;

  // Track service response times for trend analysis
  private responseTimes: {
    database: number[];
    storage: number[];
    cache: number[];
  } = {
    database: [],
    storage: [],
    cache: []
  };

  // Maximum number of response times to keep for trend analysis
  private readonly MAX_RESPONSE_TIMES = 100;

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  /**
   * Get the singleton instance of the health check service
   */
  public static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  /**
   * Start the monitoring process
   * @param intervalMs Interval between health checks in milliseconds
   */
  public startMonitoring(intervalMs: number = this.intervalMs): void {
    if (this.isMonitoring) {
      logger.warn('Health monitoring is already active');
      return;
    }

    this.intervalMs = intervalMs;
    this.isMonitoring = true;

    // Perform initial health check
    this.performHealthCheck()
      .then(status => {
        this.lastHealthStatus = status;
        logger.info(`Initial health check complete: ${status.status}`);
      })
      .catch(err => {
        logger.error('Failed to perform initial health check:', err);
      });

    // Schedule regular health checks
    this.monitoringInterval = setInterval(async () => {
      try {
        this.lastHealthStatus = await this.performHealthCheck();
        
        // Log only if there are issues
        if (this.lastHealthStatus.status !== 'healthy') {
          logger.warn(`Health check status: ${this.lastHealthStatus.status}`, {
            healthCheck: this.lastHealthStatus
          });
        }
      } catch (err) {
        logger.error('Failed to perform health check:', err);
      }
    }, this.intervalMs);

    logger.info(`Health monitoring started with ${this.intervalMs}ms interval`);
  }

  /**
   * Stop the monitoring process
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring || !this.monitoringInterval) {
      logger.warn('Health monitoring is not active');
      return;
    }

    clearInterval(this.monitoringInterval);
    this.monitoringInterval = null;
    this.isMonitoring = false;
    logger.info('Health monitoring stopped');
  }

  /**
   * Get the latest health status
   */
  public getHealth(): Promise<HealthStatus> | HealthStatus {
    if (!this.lastHealthStatus) {
      // If no health check has been performed yet, do one immediately
      logger.info('No previous health status, performing check now');
      return this.performHealthCheck();
    }
    return this.lastHealthStatus;
  }

  /**
   * Get detailed health metrics
   */
  public async getDetailedHealth(): Promise<HealthStatus & { 
    trends: { 
      database: { mean: number; median: number; last10Mean: number };
      storage: { mean: number; median: number; last10Mean: number };
      cache: { mean: number; median: number; last10Mean: number };
    };
    systemDetails: {
      hostname: string;
      platform: string;
      arch: string;
      nodeVersion: string;
      networkInterfaces: any;
    };
  }> {
    const status = await this.performHealthCheck();
    
    // Calculate trends
    const trends = {
      database: this.calculateTrends(this.responseTimes.database),
      storage: this.calculateTrends(this.responseTimes.storage),
      cache: this.calculateTrends(this.responseTimes.cache)
    };
    
    // Add detailed system information
    const systemDetails = {
      hostname: os.hostname(),
      platform: os.platform(),
      // Use explicit type assertions for Node.js APIs
      arch: (process as any).arch || 'unknown',
      nodeVersion: process.version,
      networkInterfaces: (os as any).networkInterfaces ? (os as any).networkInterfaces() : {}
    };
    
    return {
      ...status,
      trends,
      systemDetails
    };
  }

  /**
   * Perform a health check of all components
   */
  public async performHealthCheck(): Promise<HealthStatus> {
    // Use process.hrtime() with an explicit any type assertion
    const startTime = ((process as any).hrtime as () => [number, number])();
    
    // Start with a basic health check
    const status: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: this.getUptime(),
      memory: this.getMemoryInfo(),
      cpu: await this.getCpuInfo(),
      services: {
        database: { status: 'unhealthy' },
        storage: { status: 'unhealthy' },
        websockets: { status: 'unhealthy' },
        cache: { status: 'unhealthy' }
      }
    };
    
    // Check each service in parallel for efficiency
    const [dbStatus, storageStatus, wsStatus, cacheStatus] = await Promise.allSettled([
      this.checkDatabaseHealth(),
      this.checkStorageHealth(),
      this.checkWebSocketHealth(),
      this.checkCacheHealth()
    ]);
    
    // Assign results based on promise outcomes
    status.services.database = dbStatus.status === 'fulfilled' 
      ? dbStatus.value 
      : { status: 'unhealthy', message: `Check failed: ${dbStatus.reason}` };
      
    status.services.storage = storageStatus.status === 'fulfilled' 
      ? storageStatus.value 
      : { status: 'unhealthy', message: `Check failed: ${storageStatus.reason}` };
      
    status.services.websockets = wsStatus.status === 'fulfilled' 
      ? wsStatus.value 
      : { status: 'unhealthy', message: `Check failed: ${wsStatus.reason}` };
      
    status.services.cache = cacheStatus.status === 'fulfilled' 
      ? cacheStatus.value 
      : { status: 'unhealthy', message: `Check failed: ${cacheStatus.reason}` };
    
    // Determine overall system status based on component statuses
    if (
      status.services.database.status === 'unhealthy' ||
      status.services.storage.status === 'unhealthy'
    ) {
      // Critical services are unhealthy
      status.status = 'unhealthy';
    } else if (
      status.services.database.status === 'degraded' ||
      status.services.storage.status === 'degraded' ||
      status.services.websockets.status === 'unhealthy' ||
      status.services.cache.status === 'unhealthy'
    ) {
      // Non-critical failures or degraded performance
      status.status = 'degraded';
    }
    
    // Calculate total health check execution time with explicit any type assertion
    const [seconds, nanoseconds] = ((process as any).hrtime as (time: [number, number]) => [number, number])(startTime);
    const totalMs = (seconds * 1000) + (nanoseconds / 1000000);
    
    // Log health check completion with timing information
    if (status.status !== 'healthy') {
      logger.warn(`Health check completed in ${totalMs.toFixed(2)}ms with status: ${status.status}`);
    } else {
      logger.debug(`Health check completed in ${totalMs.toFixed(2)}ms with status: ${status.status}`);
    }
    
    return status;
  }

  /**
   * Get system uptime information
   */
  private getUptime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    return {
      seconds: Math.floor(uptime),
      formatted: `${hours}h ${minutes}m ${seconds}s`
    };
  }

  /**
   * Get memory usage information
   */
  private getMemoryInfo() {
    const memoryUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    return {
      used: `${Math.round((totalMem - freeMem) / 1024 / 1024)} MB`,
      free: `${Math.round(freeMem / 1024 / 1024)} MB`,
      total: `${Math.round(totalMem / 1024 / 1024)} MB`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
    };
  }

  /**
   * Get CPU information
   */
  private async getCpuInfo() {
    const cpuInfo = os.cpus();
    
    // Get CPU usage percentage across all cores
    // This is a simple approximation
    let totalIdle = 0;
    let totalTick = 0;
    
    cpuInfo.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });
    
    const usage = 100 - (totalIdle / totalTick * 100);
    
    return {
      loadAvg: os.loadavg(),
      cores: cpuInfo.length,
      model: cpuInfo[0]?.model || 'Unknown',
      usage: parseFloat(usage.toFixed(2))
    };
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth() {
    const startTime = Date.now();
    
    try {
      // Check if Supabase client is initialized
      if (!supabaseClient.isInitialized()) {
        return {
          status: 'unhealthy' as const,
          message: 'Supabase client is not initialized'
        };
      }
      
      // Perform a simple query to test the connection
      // Use type assertion for client since Supabase typings may not include it
      const client = (supabaseClient.getClient() as any).client;
      const { error, data } = await client.from('_health_check').select('count').single();
      
      const responseTime = Date.now() - startTime;
      this.addResponseTime('database', responseTime);
      
      if (error) {
        // Database is accessible but query failed
        return {
          status: 'degraded' as const,
          responseTime,
          message: `Database query failed: ${error.message}`
        };
      }
      
      // Database is healthy
      return {
        status: 'healthy' as const,
        responseTime,
        connectedAt: new Date().toISOString()
      };
    } catch (error) {
      // Database is completely inaccessible
      const responseTime = Date.now() - startTime;
      return {
        status: 'unhealthy' as const,
        responseTime,
        message: `Database check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Check storage health
   */
  private async checkStorageHealth() {
    const startTime = Date.now();
    
    try {
      // Check if environment variables for storage are set
      if (!process.env.S3_ENDPOINT || !process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY) {
        return {
          status: 'degraded' as const,
          message: 'Storage credentials not configured'
        };
      }
      
      // Perform a basic check - in a real implementation, you would
      // test an actual storage operation, but we'll simulate here
      const storageAvailable = !!process.env.S3_BUCKET;
      const responseTime = Date.now() - startTime;
      this.addResponseTime('storage', responseTime);
      
      if (!storageAvailable) {
        return {
          status: 'degraded' as const,
          responseTime,
          message: 'Storage connection simulated as degraded'
        };
      }
      
      return {
        status: 'healthy' as const,
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: 'unhealthy' as const,
        responseTime,
        message: `Storage check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Check WebSocket health
   */
  private async checkWebSocketHealth() {
    // Get active WebSocket connections count
    // This would need to integrate with your actual WebSocket services
    
    try {
      // Simulate WebSocket check - in a real implementation, you would check
      // the actual WebSocket servers
      const activeConnections = 12; // Simulated value
      
      // Using explicit comparison to avoid type mismatch
      if (activeConnections <= 0) {
        return {
          status: 'degraded' as const,
          activeConnections,
          message: 'No active WebSocket connections'
        };
      }
      
      return {
        status: 'healthy' as const,
        activeConnections
      };
    } catch (error) {
      return {
        status: 'unhealthy' as const,
        activeConnections: 0,
        message: `WebSocket check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Check cache health
   */
  private async checkCacheHealth() {
    const startTime = Date.now();
    
    try {
      // Simulate cache check - in a real implementation, you would 
      // check your actual cache service (Redis, etc.)
      
      // Simulate a cache check result
      const cacheAvailable = true; // Simulated value
      const responseTime = Date.now() - startTime;
      this.addResponseTime('cache', responseTime);
      
      if (!cacheAvailable) {
        return {
          status: 'degraded' as const,
          responseTime,
          message: 'Cache service is degraded'
        };
      }
      
      return {
        status: 'healthy' as const,
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: 'unhealthy' as const,
        responseTime,
        message: `Cache check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * Add response time to the tracking array for trend analysis
   */
  private addResponseTime(service: 'database' | 'storage' | 'cache', time: number): void {
    this.responseTimes[service].push(time);
    
    // Trim the array if it exceeds the maximum size
    if (this.responseTimes[service].length > this.MAX_RESPONSE_TIMES) {
      this.responseTimes[service] = this.responseTimes[service].slice(-this.MAX_RESPONSE_TIMES);
    }
  }
  
  /**
   * Calculate statistical trends from response times
   */
  private calculateTrends(times: number[]) {
    if (times.length === 0) {
      return { mean: 0, median: 0, last10Mean: 0 };
    }
    
    // Calculate mean
    const sum = times.reduce((acc, time) => acc + time, 0);
    const mean = sum / times.length;
    
    // Calculate median with null safety
    const sortedTimes = [...times].sort((a, b) => a - b);
    const middle = Math.floor(sortedTimes.length / 2);
    
    // Handle potential undefined values
    let median = 0;
    if (sortedTimes.length > 0) {
      if (sortedTimes.length % 2 === 0 && middle > 0 && 
          middle < sortedTimes.length && middle - 1 >= 0) {
        // Ensure both indices are valid and values are numbers
        const midLow = sortedTimes[middle - 1] as number;
        const midHigh = sortedTimes[middle] as number;
        if (typeof midLow === 'number' && typeof midHigh === 'number') {
          median = (midLow + midHigh) / 2;
        }
      } else if (middle >= 0 && middle < sortedTimes.length) {
        // Ensure the middle index is valid and value is a number
        const midValue = sortedTimes[middle];
        if (typeof midValue === 'number') {
          median = midValue;
        }
      }
    }
    
    // Calculate mean of last 10 samples
    const last10 = times.slice(-10);
    const last10Sum = last10.reduce((acc, time) => acc + time, 0);
    const last10Mean = last10.length > 0 ? last10Sum / last10.length : 0;
    
    return {
      mean: parseFloat(mean.toFixed(2)),
      median: parseFloat(median.toFixed(2)),
      last10Mean: parseFloat(last10Mean.toFixed(2))
    };
  }
}

export default HealthCheckService.getInstance();
/**
 * Supabase Connection Pool
 *
 * This utility provides connection pooling for Supabase clients to improve
 * performance and reduce connection overhead.
 *
 * Enhanced with dynamic scaling and metrics integration.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { logger } from '../../utils/logger';
import { recordGauge, recordHistogram } from '../monitoring/prometheusMetrics';

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  idleTimeoutMs: number;
  acquireTimeoutMs: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  metricsEnabled: boolean;
  dynamicScalingEnabled: boolean;
}

/**
 * Pool metrics interface
 */
export interface PoolMetrics {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  maxConnections: number;
  utilizationRate: number;
  waitingAcquires: number;
  acquireSuccessRate: number;
  averageAcquireTime: number;
  connectionErrors: number;
  lastScalingAction?: {
    action: 'scale_up' | 'scale_down' | 'none';
    timestamp: number;
    reason: string;
  };
}

/**
 * Default connection pool configuration
 */
const DEFAULT_CONFIG: ConnectionPoolConfig = {
  maxConnections: 20,
  minConnections: 3,
  idleTimeoutMs: 30000, // 30 seconds
  acquireTimeoutMs: 5000, // 5 seconds
  scaleUpThreshold: 0.7, // Scale up when 70% of connections are in use
  scaleDownThreshold: 0.3, // Scale down when less than 30% of connections are in use
  metricsEnabled: true,
  dynamicScalingEnabled: true
};

/**
 * Connection with metadata
 */
interface PooledConnection {
  client: SupabaseClient;
  lastUsed: number;
  inUse: boolean;
  createdAt: number;
  acquireCount: number;
  lastAcquireTime?: number;
  lastReleaseTime?: number;
}

/**
 * Supabase Connection Pool
 */
export class SupabaseConnectionPool {
  private static instance: SupabaseConnectionPool;
  private connections: PooledConnection[] = [];
  private config: ConnectionPoolConfig;
  private maintenanceInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  // Metrics tracking
  private acquireAttempts: number = 0;
  private acquireSuccesses: number = 0;
  private acquireTimes: number[] = [];
  private connectionErrors: number = 0;
  private waitingAcquires: number = 0;
  private lastScalingAction: {
    action: 'scale_up' | 'scale_down' | 'none';
    timestamp: number;
    reason: string;
  } = { action: 'none', timestamp: Date.now(), reason: 'Initial state' };

  /**
   * Create a new connection pool
   */
  private constructor(config: Partial<ConnectionPoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Start maintenance routine
    this.startMaintenance();

    // Start metrics collection if enabled
    if (this.config.metricsEnabled) {
      this.startMetricsCollection();
    }

    // Initialize with minimum connections if dynamic scaling is enabled
    if (this.config.dynamicScalingEnabled && this.config.minConnections > 0) {
      this.initializeMinConnections();
    }

    logger.debug('Supabase connection pool initialized', {
      maxConnections: this.config.maxConnections,
      minConnections: this.config.minConnections,
      idleTimeout: this.config.idleTimeoutMs,
      acquireTimeout: this.config.acquireTimeoutMs,
      dynamicScaling: this.config.dynamicScalingEnabled,
      metricsEnabled: this.config.metricsEnabled
    });
  }

  /**
   * Initialize the minimum number of connections
   */
  private async initializeMinConnections(): Promise<void> {
    try {
      const initialConnections = Math.min(this.config.minConnections, this.config.maxConnections);
      logger.debug(`Initializing ${initialConnections} minimum connections`);

      const creationPromises = [];

      for (let i = 0; i < initialConnections; i++) {
        creationPromises.push(this.createConnection());
      }

      await Promise.all(creationPromises);

      logger.debug(`Successfully initialized ${initialConnections} connections`);
    } catch (error) {
      logger.error('Failed to initialize minimum connections', { error });
      this.connectionErrors++;
    }
  }

  /**
   * Create a new connection
   */
  private async createConnection(): Promise<PooledConnection> {
    try {
      const client = supabase.getClient();

      const connection: PooledConnection = {
        client,
        lastUsed: Date.now(),
        inUse: false,
        createdAt: Date.now(),
        acquireCount: 0
      };

      this.connections.push(connection);

      return connection;
    } catch (error) {
      this.connectionErrors++;
      logger.error('Error creating connection', { error });
      throw error;
    }
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(config?: Partial<ConnectionPoolConfig>): SupabaseConnectionPool {
    if (!SupabaseConnectionPool.instance) {
      SupabaseConnectionPool.instance = new SupabaseConnectionPool(config);
    } else if (config) {
      // Update config if provided
      SupabaseConnectionPool.instance.updateConfig(config);
    }

    return SupabaseConnectionPool.instance;
  }

  /**
   * Update the pool configuration
   */
  public updateConfig(config: Partial<ConnectionPoolConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug('Supabase connection pool configuration updated', this.config);
  }

  /**
   * Acquire a connection from the pool
   */
  public async acquire(): Promise<SupabaseClient> {
    const startTime = Date.now();
    this.acquireAttempts++;
    this.waitingAcquires++;

    try {
      // First, try to find an idle connection
      const idleConnection = this.connections.find(conn => !conn.inUse);

      if (idleConnection) {
        idleConnection.inUse = true;
        idleConnection.lastUsed = Date.now();
        idleConnection.lastAcquireTime = Date.now();
        idleConnection.acquireCount++;

        this.recordAcquireSuccess(startTime);
        return idleConnection.client;
      }

      // If no idle connection and we haven't reached max connections, create a new one
      if (this.connections.length < this.config.maxConnections) {
        const connection = await this.createConnection();

        connection.inUse = true;
        connection.lastAcquireTime = Date.now();
        connection.acquireCount++;

        logger.debug('Created new connection in pool for immediate use', {
          poolSize: this.connections.length,
          maxSize: this.config.maxConnections
        });

        this.recordAcquireSuccess(startTime);

        // Check if we should scale up the pool based on load
        this.checkAndAdjustPoolSize();

        return connection.client;
      }

      // If we've reached max connections, wait for one to become available
      return new Promise((resolve, reject) => {
        const waitStartTime = Date.now();

        const checkForConnection = () => {
          // Check if we've exceeded the acquire timeout
          if (Date.now() - waitStartTime > this.config.acquireTimeoutMs) {
            this.waitingAcquires--;
            this.connectionErrors++;
            reject(new Error('Timeout acquiring connection from pool'));
            return;
          }

          // Try to find an idle connection
          const idleConnection = this.connections.find(conn => !conn.inUse);

          if (idleConnection) {
            idleConnection.inUse = true;
            idleConnection.lastUsed = Date.now();
            idleConnection.lastAcquireTime = Date.now();
            idleConnection.acquireCount++;

            this.recordAcquireSuccess(startTime);
            resolve(idleConnection.client);
          } else {
            // Try again in 100ms
            setTimeout(checkForConnection, 100);
          }
        };

        checkForConnection();
      });
    } catch (error) {
      this.waitingAcquires--;
      this.connectionErrors++;
      logger.error('Error acquiring connection', { error });
      throw error;
    }
  }

  /**
   * Record a successful connection acquisition
   */
  private recordAcquireSuccess(startTime: number): void {
    this.waitingAcquires--;
    this.acquireSuccesses++;
    const acquireTime = Date.now() - startTime;
    this.acquireTimes.push(acquireTime);

    // Keep only the last 100 acquisition times
    if (this.acquireTimes.length > 100) {
      this.acquireTimes.shift();
    }
  }

  /**
   * Release a connection back to the pool
   */
  public release(client: SupabaseClient): void {
    const connection = this.connections.find(conn => conn.client === client);

    if (connection) {
      connection.inUse = false;
      connection.lastUsed = Date.now();
      connection.lastReleaseTime = Date.now();

      // Check if we should adjust the pool size after releasing a connection
      if (this.config.dynamicScalingEnabled) {
        this.checkAndAdjustPoolSize();
      }
    }
  }

  /**
   * Start the maintenance routine
   */
  private startMaintenance(): void {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
    }

    // Run maintenance every 10 seconds
    this.maintenanceInterval = setInterval(() => {
      this.performMaintenance();
    }, 10000);
  }

  /**
   * Start the metrics collection routine
   */
  private startMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Record metrics every 30 seconds
    this.metricsInterval = setInterval(() => {
      this.recordPoolMetrics();
    }, 30000);
  }

  /**
   * Record pool metrics to Prometheus
   */
  private recordPoolMetrics(): void {
    if (!this.config.metricsEnabled) {
      return;
    }

    const metrics = this.getPoolMetrics();

    // Log metrics at debug level
    logger.debug('Supabase connection pool metrics', metrics);

    // Record metrics to Prometheus
    recordGauge('supabase_connection_pool_active', metrics.activeConnections);
    recordGauge('supabase_connection_pool_idle', metrics.idleConnections);
    recordGauge('supabase_connection_pool_total', metrics.totalConnections);
    recordGauge('supabase_connection_pool_utilization', metrics.utilizationRate * 100);
    recordGauge('supabase_connection_pool_waiting_acquires', metrics.waitingAcquires);
    recordGauge('supabase_connection_pool_acquire_success_rate', metrics.acquireSuccessRate * 100);
    recordGauge('supabase_connection_pool_average_acquire_time', metrics.averageAcquireTime);
    recordGauge('supabase_connection_pool_connection_errors', metrics.connectionErrors);

    // Record connection age distribution
    const now = Date.now();
    this.connections.forEach(conn => {
      const ageMs = now - conn.createdAt;
      recordHistogram('supabase_connection_pool_connection_age_ms', ageMs);
    });

    // Record acquisition count distribution
    this.connections.forEach(conn => {
      recordHistogram('supabase_connection_pool_acquisition_count', conn.acquireCount);
    });
  }

  /**
   * Check and adjust the pool size based on current utilization
   */
  private checkAndAdjustPoolSize(): void {
    if (!this.config.dynamicScalingEnabled) {
      return;
    }

    const total = this.connections.length;
    const inUse = this.connections.filter(conn => conn.inUse).length;
    const utilizationRate = total > 0 ? inUse / total : 0;

    // Scale up if utilization is above threshold and we're not at max connections
    if (utilizationRate >= this.config.scaleUpThreshold && total < this.config.maxConnections) {
      const newConnections = Math.min(
        Math.ceil(total * 0.25), // Add 25% more connections
        this.config.maxConnections - total // Don't exceed max connections
      );

      if (newConnections > 0) {
        this.scaleUp(newConnections);
      }
    }
    // Scale down if utilization is below threshold and we're above min connections
    else if (utilizationRate <= this.config.scaleDownThreshold && total > this.config.minConnections) {
      const connectionsToRemove = Math.min(
        Math.ceil(total * 0.2), // Remove up to 20% of connections
        total - this.config.minConnections // Don't go below min connections
      );

      if (connectionsToRemove > 0) {
        this.scaleDown(connectionsToRemove);
      }
    }
  }

  /**
   * Scale up the connection pool
   */
  private async scaleUp(count: number): Promise<void> {
    logger.info(`Scaling up connection pool by ${count} connections`, {
      current: this.connections.length,
      target: this.connections.length + count,
      max: this.config.maxConnections
    });

    this.lastScalingAction = {
      action: 'scale_up',
      timestamp: Date.now(),
      reason: `Utilization above threshold (${this.config.scaleUpThreshold * 100}%)`
    };

    try {
      const creationPromises = [];

      for (let i = 0; i < count; i++) {
        creationPromises.push(this.createConnection());
      }

      await Promise.all(creationPromises);

      logger.info(`Successfully scaled up connection pool to ${this.connections.length} connections`);
    } catch (error) {
      logger.error('Failed to scale up connection pool', { error });
    }
  }

  /**
   * Scale down the connection pool
   */
  private scaleDown(count: number): void {
    logger.info(`Scaling down connection pool by ${count} connections`, {
      current: this.connections.length,
      target: this.connections.length - count,
      min: this.config.minConnections
    });

    this.lastScalingAction = {
      action: 'scale_down',
      timestamp: Date.now(),
      reason: `Utilization below threshold (${this.config.scaleDownThreshold * 100}%)`
    };

    // Find idle connections to remove
    const idleConnections = this.connections.filter(conn => !conn.inUse);
    const connectionsToRemove = idleConnections.slice(0, count);

    // Remove connections
    this.connections = this.connections.filter(conn => !connectionsToRemove.includes(conn));

    logger.info(`Successfully scaled down connection pool to ${this.connections.length} connections`);
  }

  /**
   * Perform maintenance on the connection pool
   */
  private performMaintenance(): void {
    const now = Date.now();

    // Close idle connections that have exceeded the idle timeout
    // but don't go below minConnections if dynamic scaling is enabled
    const initialCount = this.connections.length;
    const minToKeep = this.config.dynamicScalingEnabled ? this.config.minConnections : 0;

    // Count idle connections
    const idleConnections = this.connections.filter(conn => !conn.inUse);

    // If we have more idle connections than needed, close the oldest ones
    if (idleConnections.length > minToKeep) {
      // Sort idle connections by last used time (oldest first)
      idleConnections.sort((a, b) => a.lastUsed - b.lastUsed);

      // Determine how many connections we can close
      const maxToClose = idleConnections.length - minToKeep;

      // Find connections to close (idle and exceeded timeout)
      const connectionsToClose = idleConnections
        .filter(conn => now - conn.lastUsed > this.config.idleTimeoutMs)
        .slice(0, maxToClose);

      if (connectionsToClose.length > 0) {
        // Remove connections from the pool
        this.connections = this.connections.filter(
          conn => !connectionsToClose.includes(conn)
        );

        logger.debug('Closed idle connections during maintenance', {
          closed: connectionsToClose.length,
          remaining: this.connections.length
        });
      }
    }

    // Check if we need to adjust the pool size
    if (this.config.dynamicScalingEnabled) {
      this.checkAndAdjustPoolSize();
    }
  }

  /**
   * Get detailed pool metrics
   */
  public getPoolMetrics(): PoolMetrics {
    const total = this.connections.length;
    const inUse = this.connections.filter(conn => conn.inUse).length;
    const idle = total - inUse;
    const utilizationRate = total > 0 ? inUse / total : 0;
    const acquireSuccessRate = this.acquireAttempts > 0
      ? this.acquireSuccesses / this.acquireAttempts
      : 1;
    const averageAcquireTime = this.acquireTimes.length > 0
      ? this.acquireTimes.reduce((sum, time) => sum + time, 0) / this.acquireTimes.length
      : 0;

    return {
      activeConnections: inUse,
      idleConnections: idle,
      totalConnections: total,
      maxConnections: this.config.maxConnections,
      utilizationRate,
      waitingAcquires: this.waitingAcquires,
      acquireSuccessRate,
      averageAcquireTime,
      connectionErrors: this.connectionErrors,
      lastScalingAction: this.lastScalingAction
    };
  }

  /**
   * Get the current pool statistics (legacy method for backward compatibility)
   */
  public getStats(): {
    total: number;
    inUse: number;
    idle: number;
    maxConnections: number;
  } {
    const metrics = this.getPoolMetrics();

    return {
      total: metrics.totalConnections,
      inUse: metrics.activeConnections,
      idle: metrics.idleConnections,
      maxConnections: metrics.maxConnections
    };
  }

  /**
   * Close all connections in the pool
   */
  public async close(): Promise<void> {
    // Stop maintenance interval
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }

    // Stop metrics collection interval
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    // Record final metrics before closing
    if (this.config.metricsEnabled) {
      this.recordPoolMetrics();
    }

    // Clear all connections
    this.connections = [];

    logger.debug('Closed all connections in pool');
  }

  /**
   * Adjust the pool size dynamically based on load
   * @param currentLoad A number between 0 and 1 representing the current load
   */
  public adjustPoolSize(currentLoad: number): void {
    if (!this.config.dynamicScalingEnabled) {
      return;
    }

    // Ensure load is between 0 and 1
    currentLoad = Math.max(0, Math.min(1, currentLoad));

    // Calculate target connections based on load
    const targetConnections = Math.max(
      this.config.minConnections,
      Math.min(
        Math.ceil(this.config.maxConnections * currentLoad),
        this.config.maxConnections
      )
    );

    const currentConnections = this.connections.length;

    // If we need to scale up
    if (targetConnections > currentConnections) {
      const connectionsToAdd = targetConnections - currentConnections;
      this.scaleUp(connectionsToAdd);
    }
    // If we need to scale down
    else if (targetConnections < currentConnections) {
      const connectionsToRemove = currentConnections - targetConnections;
      this.scaleDown(connectionsToRemove);
    }
  }
}

/**
 * Singleton instance of the connection pool
 */
export const connectionPool = SupabaseConnectionPool.getInstance();

/**
 * Execute a function with a connection from the pool
 */
export async function withConnection<T>(
  fn: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  const client = await connectionPool.acquire();

  try {
    return await fn(client);
  } finally {
    connectionPool.release(client);
  }
}

export default {
  connectionPool,
  withConnection
};

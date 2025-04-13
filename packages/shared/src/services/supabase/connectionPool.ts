/**
 * Supabase Connection Pool
 * 
 * This utility provides connection pooling for Supabase clients to improve
 * performance and reduce connection overhead.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { logger } from '../../utils/logger';

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  maxConnections: number;
  idleTimeoutMs: number;
  acquireTimeoutMs: number;
}

/**
 * Default connection pool configuration
 */
const DEFAULT_CONFIG: ConnectionPoolConfig = {
  maxConnections: 10,
  idleTimeoutMs: 30000, // 30 seconds
  acquireTimeoutMs: 5000 // 5 seconds
};

/**
 * Connection with metadata
 */
interface PooledConnection {
  client: SupabaseClient;
  lastUsed: number;
  inUse: boolean;
}

/**
 * Supabase Connection Pool
 */
export class SupabaseConnectionPool {
  private static instance: SupabaseConnectionPool;
  private connections: PooledConnection[] = [];
  private config: ConnectionPoolConfig;
  private maintenanceInterval: NodeJS.Timeout | null = null;
  
  /**
   * Create a new connection pool
   */
  private constructor(config: Partial<ConnectionPoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Start maintenance routine
    this.startMaintenance();
    
    logger.debug('Supabase connection pool initialized', {
      maxConnections: this.config.maxConnections,
      idleTimeout: this.config.idleTimeoutMs,
      acquireTimeout: this.config.acquireTimeoutMs
    });
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
    // First, try to find an idle connection
    const idleConnection = this.connections.find(conn => !conn.inUse);
    
    if (idleConnection) {
      idleConnection.inUse = true;
      idleConnection.lastUsed = Date.now();
      return idleConnection.client;
    }
    
    // If no idle connection and we haven't reached max connections, create a new one
    if (this.connections.length < this.config.maxConnections) {
      const client = supabase.getClient();
      
      const connection: PooledConnection = {
        client,
        lastUsed: Date.now(),
        inUse: true
      };
      
      this.connections.push(connection);
      
      logger.debug('Created new connection in pool', {
        poolSize: this.connections.length,
        maxSize: this.config.maxConnections
      });
      
      return client;
    }
    
    // If we've reached max connections, wait for one to become available
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkForConnection = () => {
        // Check if we've exceeded the acquire timeout
        if (Date.now() - startTime > this.config.acquireTimeoutMs) {
          reject(new Error('Timeout acquiring connection from pool'));
          return;
        }
        
        // Try to find an idle connection
        const idleConnection = this.connections.find(conn => !conn.inUse);
        
        if (idleConnection) {
          idleConnection.inUse = true;
          idleConnection.lastUsed = Date.now();
          resolve(idleConnection.client);
        } else {
          // Try again in 100ms
          setTimeout(checkForConnection, 100);
        }
      };
      
      checkForConnection();
    });
  }
  
  /**
   * Release a connection back to the pool
   */
  public release(client: SupabaseClient): void {
    const connection = this.connections.find(conn => conn.client === client);
    
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = Date.now();
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
   * Perform maintenance on the connection pool
   */
  private performMaintenance(): void {
    const now = Date.now();
    
    // Close idle connections that have exceeded the idle timeout
    const initialCount = this.connections.length;
    
    this.connections = this.connections.filter(conn => {
      // Keep all connections that are in use
      if (conn.inUse) {
        return true;
      }
      
      // Check if the connection has exceeded the idle timeout
      const idleTime = now - conn.lastUsed;
      
      if (idleTime > this.config.idleTimeoutMs) {
        logger.debug('Closing idle connection', {
          idleTime,
          idleTimeoutMs: this.config.idleTimeoutMs
        });
        
        return false;
      }
      
      return true;
    });
    
    const closedCount = initialCount - this.connections.length;
    
    if (closedCount > 0) {
      logger.debug('Closed idle connections', {
        closed: closedCount,
        remaining: this.connections.length
      });
    }
  }
  
  /**
   * Get the current pool statistics
   */
  public getStats(): {
    total: number;
    inUse: number;
    idle: number;
    maxConnections: number;
  } {
    const total = this.connections.length;
    const inUse = this.connections.filter(conn => conn.inUse).length;
    
    return {
      total,
      inUse,
      idle: total - inUse,
      maxConnections: this.config.maxConnections
    };
  }
  
  /**
   * Close all connections in the pool
   */
  public async close(): Promise<void> {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }
    
    this.connections = [];
    
    logger.debug('Closed all connections in pool');
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

/**
 * Database Service
 * 
 * Provides a centralized service for database operations.
 * Uses the dependency injection container pattern.
 */

import { logger } from '../../utils/logger';
import config from '../../config/config';
import container from '../../container';

/**
 * Database connection interface
 */
export interface DatabaseConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  query<T>(query: string, params?: any[]): Promise<T[]>;
}

/**
 * Database service interface
 */
export interface DatabaseService {
  initialize(): Promise<void>;
  getConnection(): DatabaseConnection;
  shutdown(): Promise<void>;
  healthCheck(): Promise<{ 
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }>;
  
  /**
   * Get detailed metrics about the database service
   * Used for health monitoring and diagnostics
   */
  getDetailedMetrics(): Promise<{
    status: string;
    metrics: Record<string, any>;
    performance?: Record<string, any>;
    connections?: number;
    uptime?: number;
  }>;
  
  /**
   * Close database connections
   * Alias for shutdown() for backward compatibility
   */
  close(): Promise<void>;
}

/**
 * Mock database connection implementation for demonstration
 */
class MockDatabaseConnection implements DatabaseConnection {
  private connected = false;
  
  async connect(): Promise<void> {
    // Simulate connection latency
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.connected = true;
    logger.info('Database connected');
  }
  
  async disconnect(): Promise<void> {
    // Simulate disconnection latency
    await new Promise((resolve) => setTimeout(resolve, 50));
    this.connected = false;
    logger.info('Database disconnected');
  }
  
  isConnected(): boolean {
    return this.connected;
  }
  
  async query<T>(query: string, params?: any[]): Promise<T[]> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }
    
    logger.debug(`Executing query: ${query}`, { params });
    
    // Mock implementation - in a real scenario, this would use a real database client
    return [] as T[];
  }
}

/**
 * Database service implementation
 */
export class DatabaseServiceImpl implements DatabaseService {
  private connection?: DatabaseConnection;
  
  constructor(private readonly dbConfig = config.getDatabaseConfig()) {}
  
  async initialize(): Promise<void> {
    logger.info('Initializing database service');
    
    // Create database connection using configuration
    this.connection = new MockDatabaseConnection();
    
    try {
      await this.connection.connect();
      logger.info('Database service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database service', { error });
      throw error;
    }
  }
  
  getConnection(): DatabaseConnection {
    if (!this.connection) {
      throw new Error('Database service not initialized');
    }
    
    return this.connection;
  }
  
  async shutdown(): Promise<void> {
    if (this.connection) {
      await this.connection.disconnect();
      this.connection = undefined;
      logger.info('Database service shut down');
    }
  }
  
  async healthCheck(): Promise<{ 
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    if (!this.connection) {
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          reason: 'Database service not initialized',
        }
      };
    }
    
    const isConnected = this.connection.isConnected();
    
    return {
      status: isConnected ? 'healthy' : 'unhealthy',
      details: {
        connected: isConnected,
        type: 'mock', // In a real implementation, this would be the database type
        config: {
          ...this.dbConfig,
          // Mask sensitive information
          password: this.dbConfig?.password ? '******' : undefined,
        }
      }
    };
  }
  
  /**
   * Get detailed metrics about the database service
   * This provides comprehensive information for system monitoring
   */
  async getDetailedMetrics(): Promise<{
    status: string;
    metrics: Record<string, any>;
    performance?: Record<string, any>;
    connections?: number;
    uptime?: number;
  }> {
    // Start with basic health check
    const health = await this.healthCheck();
    
    // For a real implementation, this would include:
    // - Query performance metrics
    // - Connection pool status
    // - Index health
    // - Database size metrics
    
    return {
      status: health.status,
      metrics: {
        ...health.details,
        queriesPerSecond: 0, // Mock metric
        averageQueryTime: 15, // Mock metric in ms
        slowQueries: 0, // Mock metric
        errorRate: 0, // Mock metric
      },
      performance: {
        readLatency: 5, // Mock metric in ms
        writeLatency: 10, // Mock metric in ms
        indexUsage: 100, // Mock metric percentage
      },
      connections: 1, // Mock active connections
      uptime: 1000, // Mock uptime in seconds
    };
  }
  
  /**
   * Alias for shutdown() for backward compatibility
   */
  async close(): Promise<void> {
    return this.shutdown();
  }
}

// Register the database service with the DI container
container.register('databaseService', () => {
  const service = new DatabaseServiceImpl();
  // Note: We don't initialize here - that should be done during app startup
  return service;
});

// Export a function to get the database service from the container
export const getDatabaseService = (): DatabaseService => 
  container.get<DatabaseService>('databaseService');

export default getDatabaseService;
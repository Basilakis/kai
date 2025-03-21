/**
 * Redis Client Connector
 * 
 * Provides a singleton Redis client for the application with 
 * connection management, error handling, and reconnection support.
 */

import { createClient } from 'redis';
import type { RedisClientType, RedisClientOptions } from 'redis';
import { logger } from '../../utils/logger';

// Redis client configuration options with default values
export interface RedisConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  database?: number;
  maxRetries?: number;
  retryStrategy?: (retries: number) => number;
}

// Default Redis configuration
const DEFAULT_CONFIG: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  database: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetries: 10
};

/**
 * Redis Client Manager
 */
export class RedisClientManager {
  private static instance: RedisClientManager;
  private client: RedisClientType | null = null;
  private subscriberClient: RedisClientType | null = null;
  private publisherClient: RedisClientType | null = null;
  private config: RedisConfig;
  private isConnecting: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  /**
   * Create a new Redis Client Manager
   * @param config Redis configuration
   */
  private constructor(config: Partial<RedisConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the Redis Client Manager singleton instance
   * @param config Optional Redis configuration
   * @returns Redis Client Manager instance
   */
  public static getInstance(config?: Partial<RedisConfig>): RedisClientManager {
    if (!RedisClientManager.instance) {
      RedisClientManager.instance = new RedisClientManager(config);
    } else if (config) {
      // If config is provided, update the existing instance's config
      RedisClientManager.instance.config = { ...RedisClientManager.instance.config, ...config };
    }
    return RedisClientManager.instance;
  }

  /**
   * Get the Redis URL from the configuration
   * @returns Redis URL
   */
  private getRedisUrl(): string {
    const { host, port, username, password, database } = this.config;
    let url = 'redis://';
    
    if (username && password) {
      url += `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`;
    } else if (password) {
      url += `:${encodeURIComponent(password)}@`;
    }
    
    url += `${host}:${port}`;
    
    if (database !== undefined) {
      url += `/${database}`;
    }
    
    return url;
  }

  /**
   * Initialize a Redis client
   * @returns Redis client
   */
  private initClient(): RedisClientType {
    const url = this.getRedisUrl();
    const client = createClient({
      url,
      socket: {
        reconnectStrategy: (retries: number) => {
          if (this.config.retryStrategy) {
            return this.config.retryStrategy(retries);
          }
          
          // Default exponential backoff
          const delay = Math.min(Math.pow(2, retries) * 100, 30000);
          logger.info(`Reconnecting to Redis in ${delay}ms (attempt ${retries + 1})`);
          return delay;
        }
      }
    });
    
    client.on('error', (err: Error) => {
      logger.error(`Redis client error: ${err}`);
    });
    
    client.on('connect', () => {
      logger.info('Redis client connected');
    });
    
    client.on('reconnecting', () => {
      logger.info('Redis client reconnecting');
    });
    
    client.on('end', () => {
      logger.info('Redis client connection closed');
    });
    
    return client;
  }

  /**
   * Get the shared Redis client, connecting if necessary
   * @returns Redis client
   */
  public async getClient(): Promise<RedisClientType> {
    // If already connecting, wait for the connection to complete
    if (this.isConnecting && this.connectionPromise) {
      await this.connectionPromise;
      return this.client!;
    }
    
    // If client doesn't exist or is disconnected, create and connect
    if (!this.client || !this.client.isOpen) {
      this.isConnecting = true;
      this.client = this.initClient();
      
      this.connectionPromise = this.client.connect()
        .then(() => {
          this.isConnecting = false;
          logger.info('Connected to Redis server');
        })
        .catch((err: Error) => {
          this.isConnecting = false;
          logger.error(`Failed to connect to Redis: ${err}`);
          throw err;
        });
      
      await this.connectionPromise;
    }
    
    return this.client;
  }

  /**
   * Get a dedicated subscriber client for pub/sub operations
   * @returns Redis client configured for subscribing
   */
  public async getSubscriberClient(): Promise<RedisClientType> {
    if (!this.subscriberClient || !this.subscriberClient.isOpen) {
      this.subscriberClient = this.initClient();
      await this.subscriberClient.connect();
      logger.info('Redis subscriber client connected');
    }
    return this.subscriberClient;
  }

  /**
   * Get a dedicated publisher client for pub/sub operations
   * @returns Redis client configured for publishing
   */
  public async getPublisherClient(): Promise<RedisClientType> {
    if (!this.publisherClient || !this.publisherClient.isOpen) {
      this.publisherClient = this.initClient();
      await this.publisherClient.connect();
      logger.info('Redis publisher client connected');
    }
    return this.publisherClient;
  }

  /**
   * Disconnect all Redis clients
   */
  public async disconnect(): Promise<void> {
    const disconnectPromises = [];
    
    if (this.client && this.client.isOpen) {
      disconnectPromises.push(this.client.disconnect());
    }
    
    if (this.subscriberClient && this.subscriberClient.isOpen) {
      disconnectPromises.push(this.subscriberClient.disconnect());
    }
    
    if (this.publisherClient && this.publisherClient.isOpen) {
      disconnectPromises.push(this.publisherClient.disconnect());
    }
    
    if (disconnectPromises.length > 0) {
      await Promise.all(disconnectPromises);
      logger.info('All Redis clients disconnected');
    }
    
    this.client = null;
    this.subscriberClient = null;
    this.publisherClient = null;
  }
}

// Export a default instance
export const redisClient = RedisClientManager.getInstance();
export default redisClient;
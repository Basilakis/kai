/**
 * Centralized Configuration Management System
 * Provides type-safe configuration management with validation
 */

import { logger } from '../utils/logger';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Configuration interfaces
 */
export interface DatabaseConfig {
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  name?: string;
  ssl: boolean;
  maxConnections: number;
  connectionTimeout: number;
}

export interface SupabaseConfig {
  url: string;
  key: string;
  serviceRoleKey?: string;
}

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  ssl: boolean;
  db: number;
}

export interface S3Config {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
  publicUrl?: string;
}

export interface SecurityConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  rateLimitWindow: number;
  rateLimitMax: number;
  corsOrigins: string[];
  maxUploadSize: number;
}

export interface ServerConfig {
  port: number;
  nodeEnv: 'development' | 'test' | 'production';
  logLevel: 'error' | 'warn' | 'info' | 'http' | 'debug';
  baseUrl?: string;
}

export interface MonitoringConfig {
  healthCheckInterval: number;
  metricsEnabled: boolean;
  metricsPort: number;
}

export interface MLConfig {
  huggingfaceApiKey?: string;
  huggingfaceEndpoint?: string;
  ocrModelPath?: string;
  maxProcessingTime: number;
  modelCachePath?: string;
}

export interface AppConfig {
  server: ServerConfig;
  database?: DatabaseConfig;
  supabase: SupabaseConfig;
  redis?: RedisConfig;
  s3: S3Config;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
  ml?: MLConfig;
}

/**
 * Validation helper functions
 */
class ValidationError extends Error {
  public issues: Array<{ path: string[]; message: string; code: string }>;
  
  constructor(message: string, issues: Array<{ path: string[]; message: string; code: string }>) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
  
  format(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const issue of this.issues) {
      const path = issue.path.join('.');
      result[path] = { message: issue.message, code: issue.code };
    }
    
    return result;
  }
}

/**
 * Simple validation for required fields
 */
function validateRequired(obj: any, path: string[], fields: string[]): Array<{ path: string[]; message: string; code: string }> {
  const issues: Array<{ path: string[]; message: string; code: string }> = [];
  
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      issues.push({
        path: [...path, field],
        message: `Required field ${field} is missing or empty`,
        code: 'required_field',
      });
    }
  }
  
  return issues;
}

/**
 * Configuration class that provides access to all application configuration
 * with validation at startup.
 */
export class Config {
  private static instance: Config;
  private config: AppConfig;
  private envVars: Record<string, string | undefined> = {};

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    // Store all environment variables for reference
    this.envVars = { ...process.env };
    
    // Initialize configuration
    this.config = this.loadConfig();
  }

  /**
   * Get the singleton configuration instance
   */
  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  /**
   * Load and validate application configuration
   */
  private loadConfig(): AppConfig {
    try {
      // Map environment variables to our configuration schema
      const rawConfig: AppConfig = {
        server: {
          port: parseInt(process.env.PORT || '3000', 10),
          nodeEnv: (process.env.NODE_ENV || 'development') as 'development' | 'test' | 'production',
          logLevel: (process.env.LOG_LEVEL || 'info') as 'error' | 'warn' | 'info' | 'http' | 'debug',
          baseUrl: process.env.BASE_URL,
        },
        supabase: {
          url: process.env.SUPABASE_URL!,
          key: process.env.SUPABASE_KEY!,
          serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        },
        s3: {
          endpoint: process.env.S3_ENDPOINT!,
          accessKey: process.env.S3_ACCESS_KEY!,
          secretKey: process.env.S3_SECRET_KEY!,
          bucket: process.env.S3_BUCKET!,
          region: process.env.S3_REGION || 'us-east-1',
          publicUrl: process.env.S3_PUBLIC_URL,
        },
        security: {
          jwtSecret: process.env.JWT_SECRET!,
          jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
          rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
          rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
          corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),
          maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE || String(50 * 1024 * 1024), 10),
        },
        monitoring: {
          healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '120000', 10),
          metricsEnabled: process.env.METRICS_ENABLED === 'true',
          metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
        },
        ml: process.env.HUGGINGFACE_API_KEY ? {
          huggingfaceApiKey: process.env.HUGGINGFACE_API_KEY,
          huggingfaceEndpoint: process.env.HUGGINGFACE_ENDPOINT,
          ocrModelPath: process.env.OCR_MODEL_PATH,
          maxProcessingTime: parseInt(process.env.ML_MAX_PROCESSING_TIME || '300000', 10),
          modelCachePath: process.env.MODEL_CACHE_PATH,
        } : undefined,
        redis: process.env.REDIS_URL || process.env.REDIS_HOST ? {
          url: process.env.REDIS_URL,
          host: process.env.REDIS_HOST,
          port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined,
          password: process.env.REDIS_PASSWORD,
          ssl: process.env.REDIS_SSL === 'true',
          db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0,
        } : undefined,
        database: process.env.DATABASE_URL || process.env.DATABASE_HOST ? {
          url: process.env.DATABASE_URL,
          host: process.env.DATABASE_HOST,
          port: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT, 10) : undefined,
          username: process.env.DATABASE_USER,
          password: process.env.DATABASE_PASSWORD,
          name: process.env.DATABASE_NAME,
          ssl: process.env.DATABASE_SSL === 'true',
          maxConnections: process.env.DATABASE_MAX_CONNECTIONS 
            ? parseInt(process.env.DATABASE_MAX_CONNECTIONS, 10) 
            : 10,
          connectionTimeout: process.env.DATABASE_CONNECTION_TIMEOUT 
            ? parseInt(process.env.DATABASE_CONNECTION_TIMEOUT, 10) 
            : 30000,
        } : undefined,
      };

      // Validate configuration
      const issues: Array<{ path: string[]; message: string; code: string }> = [];
      
      // Validate required Supabase fields
      issues.push(...validateRequired(rawConfig.supabase, ['supabase'], ['url', 'key']));
      
      // Validate required S3 fields
      issues.push(...validateRequired(rawConfig.s3, ['s3'], ['endpoint', 'accessKey', 'secretKey', 'bucket']));
      
      // Validate required security fields
      issues.push(...validateRequired(rawConfig.security, ['security'], ['jwtSecret']));
      
      // Check for validation issues
      if (issues.length > 0) {
        const error = new ValidationError('Configuration validation failed', issues);
        
        logger.error('Configuration validation failed', { 
          errorFormat: error.format(),
          issues: error.issues,
        });
        
        throw new Error(`Configuration validation failed: ${issues.length} issues found`);
      }

      return rawConfig;
    } catch (error) {
      if (error instanceof ValidationError) {
        // Already logged in the validation block
        throw new Error(`Configuration validation failed: ${error.message}`);
      }
      
      // Log and re-throw any other errors
      logger.error('Configuration error', { error });
      throw error;
    }
  }

  /**
   * Get the full configuration object
   */
  public getConfig(): AppConfig {
    return this.config;
  }

  /**
   * Get server configuration
   */
  public getServerConfig(): ServerConfig {
    return this.config.server;
  }

  /**
   * Get Supabase configuration
   */
  public getSupabaseConfig(): SupabaseConfig {
    return this.config.supabase;
  }

  /**
   * Get S3 configuration
   */
  public getS3Config(): S3Config {
    return this.config.s3;
  }

  /**
   * Get security configuration
   */
  public getSecurityConfig(): SecurityConfig {
    return this.config.security;
  }

  /**
   * Get monitoring configuration
   */
  public getMonitoringConfig(): MonitoringConfig {
    return this.config.monitoring;
  }

  /**
   * Get ML configuration
   */
  public getMLConfig(): MLConfig | undefined {
    return this.config.ml;
  }

  /**
   * Get Redis configuration
   */
  public getRedisConfig(): RedisConfig | undefined {
    return this.config.redis;
  }

  /**
   * Get database configuration
   */
  public getDatabaseConfig(): DatabaseConfig | undefined {
    return this.config.database;
  }

  /**
   * Get environment variable by key
   * @param key The environment variable key
   * @param defaultValue Optional default value if not found
   */
  public getEnv(key: string, defaultValue?: string): string | undefined {
    return this.envVars[key] || defaultValue;
  }

  /**
   * Check if the application is running in production mode
   */
  public isProduction(): boolean {
    return this.config.server.nodeEnv === 'production';
  }

  /**
   * Check if the application is running in development mode
   */
  public isDevelopment(): boolean {
    return this.config.server.nodeEnv === 'development';
  }

  /**
   * Check if the application is running in test mode
   */
  public isTest(): boolean {
    return this.config.server.nodeEnv === 'test';
  }
}

// Export a singleton instance
const config = Config.getInstance();
export default config;
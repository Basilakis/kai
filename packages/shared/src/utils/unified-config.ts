/**
 * Unified Configuration System
 * 
 * This module provides a centralized configuration system for the application.
 * It consolidates duplicate configuration implementations across packages.
 * 
 * Features:
 * - Environment-specific configuration
 * - Hierarchical configuration with overrides
 * - Type-safe configuration access
 * - Default values for missing configuration
 */

import { createLogger } from './unified-logger';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const logger = createLogger('UnifiedConfig');

/**
 * Configuration schema
 */
export interface ConfigSchema {
  // Server configuration
  server: {
    port: number;
    host: string;
    baseUrl: string;
    nodeEnv: 'development' | 'production' | 'test';
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  
  // API configuration
  api: {
    url: string;
    timeout: number;
    version: string;
  };
  
  // Supabase configuration
  supabase: {
    url: string;
    key: string;
    storageBucket: string;
  };
  
  // S3 configuration
  s3: {
    endpoint?: string;
    region: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    publicUrl?: string;
  };
  
  // Authentication configuration
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
    rateLimitWindow: number;
    rateLimitMax: number;
    corsOrigins: string[];
  };
  
  // ML configuration
  ml: {
    pythonPath: string;
    mcpServerUrl: string;
    useMcpServer: boolean;
    mcpHealthCheckTimeout: number;
    huggingfaceApiKey?: string;
    huggingfaceEndpoint?: string;
    ocrModelPath?: string;
    maxProcessingTime: number;
  };
  
  // Storage configuration
  storage: {
    provider: 'supabase' | 's3';
    defaultBucket: string;
    maxUploadSize: number;
  };
  
  // Monitoring configuration
  monitoring: {
    healthCheckInterval: number;
    metricsEnabled: boolean;
    metricsPort: number;
  };
  
  // Feature flags
  features: {
    enableCrawlerCredentials: boolean;
    enablePdfProcessing: boolean;
    enableOfflineMode: boolean;
  };
  
  // External services
  services: {
    kaiApiUrl: string;
    vectorDbUrl: string;
    mlServiceUrl: string;
    mlApiUrl: string;
    apiKey?: string;
    enableMockFallback: boolean;
  };
  
  // OpenAI configuration
  openai: {
    apiKey?: string;
    defaultModel: string;
    temperature: number;
  };
  
  // Redis configuration
  redis: {
    url: string;
    password?: string;
    db: number;
  };
  
  // Client configuration
  client: {
    appName: string;
    version: string;
    defaultLocale: string;
    storageUrl: string;
    wsUrl: string;
  };
}

/**
 * Default configuration values
 */
const defaultConfig: ConfigSchema = {
  server: {
    port: 3000,
    host: 'localhost',
    baseUrl: 'http://localhost:3000',
    nodeEnv: 'development',
    logLevel: 'info',
  },
  api: {
    url: 'http://localhost:3000/api',
    timeout: 30000,
    version: '1.0.0',
  },
  supabase: {
    url: '',
    key: '',
    storageBucket: 'materials',
  },
  s3: {
    region: 'us-east-1',
    accessKey: '',
    secretKey: '',
    bucket: 'kai-storage',
  },
  auth: {
    jwtSecret: 'your-secret-key',
    jwtExpiresIn: '1d',
    rateLimitWindow: 15 * 60 * 1000, // 15 minutes
    rateLimitMax: 100,
    corsOrigins: ['http://localhost:3000', 'http://localhost:8000'],
  },
  ml: {
    pythonPath: 'python',
    mcpServerUrl: 'http://localhost:8000',
    useMcpServer: false,
    mcpHealthCheckTimeout: 5000,
    maxProcessingTime: 300000, // 5 minutes
  },
  storage: {
    provider: 'supabase',
    defaultBucket: 'materials',
    maxUploadSize: 50 * 1024 * 1024, // 50MB
  },
  monitoring: {
    healthCheckInterval: 60000, // 1 minute
    metricsEnabled: true,
    metricsPort: 9090,
  },
  features: {
    enableCrawlerCredentials: true,
    enablePdfProcessing: true,
    enableOfflineMode: false,
  },
  services: {
    kaiApiUrl: 'http://localhost:3000/api',
    vectorDbUrl: 'http://localhost:5000/api/vector',
    mlServiceUrl: 'http://localhost:7000/api/ml',
    mlApiUrl: 'http://localhost:3001/api',
    enableMockFallback: true,
  },
  openai: {
    defaultModel: 'gpt-4',
    temperature: 0.7,
  },
  redis: {
    url: 'redis://localhost:6379',
    db: 0,
  },
  client: {
    appName: 'KAI Platform',
    version: '1.0.0',
    defaultLocale: 'en',
    storageUrl: 'http://localhost:3000/storage',
    wsUrl: 'ws://localhost:3000',
  },
};

/**
 * Unified Configuration Manager
 */
export class UnifiedConfig {
  private static instance: UnifiedConfig;
  private config: Partial<ConfigSchema>;
  private initialized: boolean = false;
  
  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.config = { ...defaultConfig };
    logger.info('UnifiedConfig initialized with default values');
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): UnifiedConfig {
    if (!UnifiedConfig.instance) {
      UnifiedConfig.instance = new UnifiedConfig();
    }
    return UnifiedConfig.instance;
  }
  
  /**
   * Initialize configuration from environment variables and .env files
   */
  public init(options: { 
    envPath?: string; 
    environment?: 'development' | 'production' | 'test';
    overrides?: Partial<ConfigSchema>;
  } = {}): void {
    if (this.initialized) {
      logger.warn('Configuration already initialized');
      return;
    }
    
    try {
      // Determine environment
      const environment = options.environment || process.env.NODE_ENV as any || 'development';
      
      // Load .env files
      this.loadEnvFiles(options.envPath, environment);
      
      // Load configuration from environment variables
      this.loadFromEnvironment();
      
      // Apply overrides
      if (options.overrides) {
        this.config = this.mergeConfigs(this.config, options.overrides);
      }
      
      this.initialized = true;
      logger.info(`Configuration initialized for environment: ${environment}`);
    } catch (error) {
      logger.error('Failed to initialize configuration', error);
      throw error;
    }
  }
  
  /**
   * Load environment variables from .env files
   */
  private loadEnvFiles(envPath?: string, environment?: string): void {
    try {
      const rootDir = envPath || process.cwd();
      
      // Load default .env file
      const defaultEnvPath = path.join(rootDir, '.env');
      if (fs.existsSync(defaultEnvPath)) {
        dotenv.config({ path: defaultEnvPath });
        logger.debug(`Loaded environment variables from ${defaultEnvPath}`);
      }
      
      // Load environment-specific .env file
      if (environment) {
        const envSpecificPath = path.join(rootDir, `.env.${environment}`);
        if (fs.existsSync(envSpecificPath)) {
          dotenv.config({ path: envSpecificPath });
          logger.debug(`Loaded environment variables from ${envSpecificPath}`);
        }
      }
    } catch (error) {
      logger.error('Failed to load environment variables', error);
    }
  }
  
  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): void {
    // Server configuration
    this.config.server = {
      ...this.config.server,
      port: parseInt(process.env.PORT || String(this.config.server?.port), 10),
      host: process.env.HOST || this.config.server?.host || 'localhost',
      baseUrl: process.env.BASE_URL || this.config.server?.baseUrl || '',
      nodeEnv: (process.env.NODE_ENV as any) || this.config.server?.nodeEnv || 'development',
      logLevel: (process.env.LOG_LEVEL as any) || this.config.server?.logLevel || 'info',
    };
    
    // API configuration
    this.config.api = {
      ...this.config.api,
      url: process.env.API_URL || this.config.api?.url || '',
      timeout: parseInt(process.env.API_TIMEOUT || String(this.config.api?.timeout), 10),
      version: process.env.API_VERSION || this.config.api?.version || '1.0.0',
    };
    
    // Supabase configuration
    this.config.supabase = {
      ...this.config.supabase,
      url: process.env.SUPABASE_URL || process.env.GATSBY_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || this.config.supabase?.url || '',
      key: process.env.SUPABASE_KEY || process.env.GATSBY_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || this.config.supabase?.key || '',
      storageBucket: process.env.SUPABASE_STORAGE_BUCKET || this.config.supabase?.storageBucket || 'materials',
    };
    
    // S3 configuration
    this.config.s3 = {
      ...this.config.s3,
      endpoint: process.env.S3_ENDPOINT || process.env.AWS_S3_ENDPOINT || this.config.s3?.endpoint,
      region: process.env.S3_REGION || process.env.AWS_REGION || this.config.s3?.region || 'us-east-1',
      accessKey: process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || this.config.s3?.accessKey || '',
      secretKey: process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || this.config.s3?.secretKey || '',
      bucket: process.env.S3_BUCKET || this.config.s3?.bucket || 'kai-storage',
      publicUrl: process.env.S3_PUBLIC_URL || this.config.s3?.publicUrl,
    };
    
    // Storage configuration
    this.config.storage = {
      ...this.config.storage,
      provider: (process.env.STORAGE_PROVIDER as any) || this.config.storage?.provider || 'supabase',
      defaultBucket: process.env.STORAGE_DEFAULT_BUCKET || this.config.storage?.defaultBucket || 'materials',
      maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE || String(this.config.storage?.maxUploadSize), 10),
    };
    
    // ML configuration
    this.config.ml = {
      ...this.config.ml,
      pythonPath: process.env.PYTHON_PATH || this.config.ml?.pythonPath || 'python',
      mcpServerUrl: process.env.MCP_SERVER_URL || this.config.ml?.mcpServerUrl || 'http://localhost:8000',
      useMcpServer: process.env.USE_MCP_SERVER === 'true' || this.config.ml?.useMcpServer || false,
      mcpHealthCheckTimeout: parseInt(process.env.MCP_HEALTH_CHECK_TIMEOUT || String(this.config.ml?.mcpHealthCheckTimeout), 10),
      huggingfaceApiKey: process.env.HUGGINGFACE_API_KEY || this.config.ml?.huggingfaceApiKey,
      huggingfaceEndpoint: process.env.HUGGINGFACE_ENDPOINT || this.config.ml?.huggingfaceEndpoint,
      ocrModelPath: process.env.OCR_MODEL_PATH || this.config.ml?.ocrModelPath,
      maxProcessingTime: parseInt(process.env.ML_MAX_PROCESSING_TIME || String(this.config.ml?.maxProcessingTime), 10),
    };
    
    // Services configuration
    this.config.services = {
      ...this.config.services,
      kaiApiUrl: process.env.KAI_API_URL || this.config.services?.kaiApiUrl || 'http://localhost:3000/api',
      vectorDbUrl: process.env.KAI_VECTOR_DB_URL || this.config.services?.vectorDbUrl || 'http://localhost:5000/api/vector',
      mlServiceUrl: process.env.KAI_ML_SERVICE_URL || this.config.services?.mlServiceUrl || 'http://localhost:7000/api/ml',
      mlApiUrl: process.env.ML_API_URL || this.config.services?.mlApiUrl || 'http://localhost:3001/api',
      apiKey: process.env.KAI_API_KEY || this.config.services?.apiKey,
      enableMockFallback: process.env.ENABLE_MOCK_FALLBACK !== 'false',
    };
    
    // OpenAI configuration
    this.config.openai = {
      ...this.config.openai,
      apiKey: process.env.OPENAI_API_KEY || this.config.openai?.apiKey,
      defaultModel: process.env.OPENAI_DEFAULT_MODEL || this.config.openai?.defaultModel || 'gpt-4',
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || String(this.config.openai?.temperature)),
    };
    
    // Redis configuration
    this.config.redis = {
      ...this.config.redis,
      url: process.env.REDIS_URL || this.config.redis?.url || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD || this.config.redis?.password,
      db: parseInt(process.env.REDIS_DB || String(this.config.redis?.db), 10),
    };
    
    // Client configuration
    this.config.client = {
      ...this.config.client,
      appName: process.env.GATSBY_APP_NAME || process.env.NEXT_PUBLIC_APP_NAME || this.config.client?.appName || 'KAI Platform',
      version: process.env.REACT_APP_VERSION || process.env.NEXT_PUBLIC_VERSION || this.config.client?.version || '1.0.0',
      defaultLocale: process.env.GATSBY_DEFAULT_LOCALE || process.env.NEXT_PUBLIC_DEFAULT_LOCALE || this.config.client?.defaultLocale || 'en',
      storageUrl: process.env.GATSBY_STORAGE_URL || process.env.NEXT_PUBLIC_STORAGE_URL || this.config.client?.storageUrl || '',
      wsUrl: process.env.GATSBY_WS_URL || process.env.NEXT_PUBLIC_WS_URL || this.config.client?.wsUrl || '',
    };
  }
  
  /**
   * Merge configurations
   */
  private mergeConfigs<T>(base: Partial<T>, override: Partial<T>): T {
    const result = { ...base } as any;
    
    for (const key in override) {
      if (override.hasOwnProperty(key)) {
        if (
          typeof override[key] === 'object' && 
          override[key] !== null && 
          !Array.isArray(override[key]) &&
          typeof base[key] === 'object' &&
          base[key] !== null
        ) {
          result[key] = this.mergeConfigs(base[key] as any, override[key] as any);
        } else {
          result[key] = override[key];
        }
      }
    }
    
    return result as T;
  }
  
  /**
   * Get the entire configuration
   */
  public getConfig(): Partial<ConfigSchema> {
    return this.config;
  }
  
  /**
   * Get a specific configuration value
   */
  public get<K extends keyof ConfigSchema>(key: K): ConfigSchema[K] {
    return this.config[key] as ConfigSchema[K];
  }
  
  /**
   * Set a specific configuration value
   */
  public set<K extends keyof ConfigSchema>(key: K, value: ConfigSchema[K]): void {
    this.config[key] = value;
  }
  
  /**
   * Update configuration with partial values
   */
  public update(config: Partial<ConfigSchema>): void {
    this.config = this.mergeConfigs(this.config, config);
  }
  
  /**
   * Reset configuration to defaults
   */
  public reset(): void {
    this.config = { ...defaultConfig };
    this.initialized = false;
  }
}

// Export singleton instance
export const config = UnifiedConfig.getInstance();

// Export default for convenience
export default config;

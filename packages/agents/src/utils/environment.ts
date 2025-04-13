/**
 * Environment Configuration Manager
 *
 * Loads and validates environment variables for the agent system.
 * This allows the agents to connect to the necessary services and APIs.
 */

import * as dotenv from 'dotenv';
import { createLogger } from './logger';

const logger = createLogger('Environment');

// Load environment variables
dotenv.config();

/**
 * Environment variables validation result
 */
interface ValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Validate required environment variables
 */
function validateEnvironment(): ValidationResult {
  // Critical variables that are absolutely required
  const required = [
    'OPENAI_API_KEY',
  ];

  // Variables that should be present but can have fallbacks
  const recommended = [
    'KAI_API_URL',
    'KAI_VECTOR_DB_URL',
    'KAI_ML_SERVICE_URL', // For image analysis etc.
    'ML_API_URL',         // For LLM fallback API
  ];

  const missing: string[] = [];
  const warnings: string[] = [];

  // Check for required variables
  required.forEach(variable => {
    if (!process.env[variable]) {
      missing.push(variable);
    }
  });

  // Check for recommended variables
  recommended.forEach(variable => {
    if (!process.env[variable]) {
      warnings.push(`${variable} is not set. Some functionality may be limited.`);
    }
  });

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

// Validate environment variables and log results
const validation = validateEnvironment();

if (!validation.valid) {
  logger.error(`Missing required environment variables: ${validation.missing.join(', ')}`);
  logger.error('Please set these variables in your .env file or environment.');
  logger.error('Check the .env.example file for reference.');
} else {
  logger.info('Environment validation successful');
}

if (validation.warnings.length > 0) {
  validation.warnings.forEach(warning => {
    logger.warn(warning);
  });
}

/**
 * Environment configuration object
 * Provides access to environment variables with proper typing and defaults
 */
export const env = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4',
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || 'logs/agent.log',
    consoleOutput: process.env.LOG_CONSOLE_OUTPUT !== 'false',
  },
  services: {
    kaiApiUrl: process.env.KAI_API_URL || 'http://localhost:3000/api',
    vectorDbUrl: process.env.KAI_VECTOR_DB_URL || 'http://localhost:5000/api/vector',
    mlServiceUrl: process.env.KAI_ML_SERVICE_URL || 'http://localhost:7000/api/ml', // Specific ML (image?) service
    mlApiUrl: process.env.ML_API_URL || 'http://localhost:3001/api', // LLM Fallback API URL
    apiKey: process.env.KAI_API_KEY,
    enableMockFallback: process.env.ENABLE_MOCK_FALLBACK !== 'false',
  },
  agent: {
    timeout: parseInt(process.env.AGENT_TIMEOUT || '30000', 10),
    maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '10', 10),
  },
  // Function to check if the environment is valid
  isValid: (): boolean => validation.valid,
};

/**
 * Configure logging based on environment variables
 */
export function configureLoggingFromEnvironment(): void {
  try {
    const { configureLogger } = require('./logger');

    configureLogger({
      level: env.logging.level,
      filePath: env.logging.filePath,
      consoleOutput: env.logging.consoleOutput,
    });

    logger.info(`Logging configured with level: ${env.logging.level}`);
  } catch (error) {
    console.error('Failed to configure logging:', error);
  }
}

export default {
  env,
  isValid: env.isValid,
  configureLoggingFromEnvironment,
};
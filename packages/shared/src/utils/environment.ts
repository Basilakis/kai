/**
 * Centralized shared environment object, removing explicit dotenv import
 * to avoid lint errors in the environment not having dotenv installed.
 * We'll rely on environment variables being loaded at a higher level.
 */

/**
 * Configure logging from environment variables (stub or minimal),
 * so agentSystem.ts references do not break.
 */
export function configureLoggingFromEnvironment(): void {
  // Minimal stub for agentSystem usage.
}

// Provide an environment object that matches usage in agentSystem (env.openai, env.redis, etc.)
export const env = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4',
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  },
  redis: {
    url: process.env.REDIS_URL || '',
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  nodeEnv: process.env.NODE_ENV || 'development',
  ml: {
    pythonPath: process.env.PYTHON_PATH || 'python',
    mcpServerUrl: process.env.MCP_SERVER_URL || 'http://localhost:8000',
    useMcpServer: process.env.USE_MCP_SERVER === 'true',
    mcpHealthCheckTimeout: parseInt(process.env.MCP_HEALTH_CHECK_TIMEOUT || '5000', 10)
  },
  services: {
    kaiApiUrl: process.env.KAI_API_URL || 'http://localhost:3000',
    vectorDbUrl: process.env.KAI_VECTOR_DB_URL || 'http://localhost:5000/api/vector',
    mlServiceUrl: process.env.KAI_ML_SERVICE_URL || 'http://localhost:7000/api/ml',
    mlApiUrl: process.env.ML_API_URL || 'http://localhost:3001/api',
    apiKey: process.env.KAI_API_KEY || '',
    enableMockFallback: process.env.ENABLE_MOCK_FALLBACK !== 'false',
  },
};
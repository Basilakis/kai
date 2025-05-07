/**
 * Unified Services Export
 * 
 * This file exports all the unified services from the shared package
 * for use throughout the ml package.
 */

// Export auth service
export { 
  auth, 
  initializeAuth, 
  User, 
  LoginCredentials, 
  RegisterCredentials, 
  AuthResult 
} from '@kai/shared';

// Export API client
export { 
  apiClient, 
  createApiClient, 
  ApiClientConfig, 
  ApiError,
  BaseService,
  ServiceConfig
} from '@kai/shared';

// Export MCP client
export { 
  mcpClient, 
  createMCPClient 
} from '@kai/shared';

// Export Supabase client
export { 
  supabase 
} from '@kai/shared';

// Export storage service
export { 
  storage, 
  initializeStorage, 
  StorageProvider 
} from '@kai/shared';

// Export logger
export { 
  createLogger, 
  LogLevel 
} from '@kai/shared';

// Export config
export { 
  config 
} from '@kai/shared';

/**
 * Initialize all services
 * 
 * This function initializes all the unified services.
 * It should be called early in the application lifecycle.
 */
export function initializeServices(): void {
  // Initialize auth service
  initializeAuth();
  
  // Initialize storage service
  initializeStorage();
  
  // Log that services have been initialized
  const logger = createLogger('Services');
  logger.info('Unified services initialized');
}

/**
 * Check if MCP server is enabled
 * 
 * @returns Whether MCP server is enabled
 */
export function isMCPEnabled(): boolean {
  return config.get('ml.useMcpServer');
}

/**
 * Check if MCP server is available
 * 
 * @returns Whether MCP server is available
 */
export async function checkMCPServerAvailability(): Promise<boolean> {
  try {
    const client = createMCPClient();
    await client.checkHealth();
    return true;
  } catch (error) {
    const logger = createLogger('MCP');
    logger.error('MCP server health check failed', error as Error);
    return false;
  }
}

/**
 * Unified Services Export
 * 
 * This file exports all the unified services from the shared package
 * for use throughout the agents package.
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

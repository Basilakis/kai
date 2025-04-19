/**
 * Service Factory
 * 
 * Provides a standardized way to create and manage service instances across packages.
 * Centralizes service configuration, initialization, and instance management.
 */

import { BaseService, ServiceConfig, AuthProvider } from './baseService';
import { env } from '../../utils/environment';
import { createLogger } from '../../utils/unified-logger';

const logger = createLogger('ServiceFactory');

/**
 * Registry of service instances for singleton management
 */
interface ServiceRegistry {
  [key: string]: any;
}

/**
 * Base configuration for services
 */
export interface BaseServiceConfig {
  [key: string]: ServiceConfig;
}

/**
 * Generic ServiceFactory to create and manage services
 * Can be extended for specific service domains (e.g., ApiServiceFactory, MLServiceFactory)
 */
export class ServiceFactory<T extends BaseServiceConfig> {
  protected registry: ServiceRegistry = {};
  protected defaultConfigs: T;
  protected authProvider?: AuthProvider;

  /**
   * Create a new service factory
   * 
   * @param defaultConfigs Default configuration for services
   * @param authProvider Optional authentication provider
   */
  constructor(defaultConfigs: T, authProvider?: AuthProvider) {
    this.defaultConfigs = defaultConfigs;
    this.authProvider = authProvider;
    logger.info('Service factory initialized');
  }

  /**
   * Get or create a service instance
   * 
   * @param serviceKey Key for service in registry and default configs
   * @param ServiceClass Service class constructor
   * @param config Optional override config
   * @returns Service instance
   */
  protected getOrCreateService<S extends BaseService>(
    serviceKey: keyof T,
    ServiceClass: new (config: ServiceConfig, authProvider?: AuthProvider) => S,
    config?: Partial<ServiceConfig>
  ): S {
    if (!this.registry[serviceKey as string]) {
      const serviceConfig = {
        ...this.defaultConfigs[serviceKey],
        ...(config || {}),
      };

      logger.debug(`Creating service instance for ${String(serviceKey)}`);
      this.registry[serviceKey as string] = new ServiceClass(serviceConfig, this.authProvider);
    }

    return this.registry[serviceKey as string] as S;
  }

  /**
   * Reset a specific service instance, forcing a new instance on next request
   * 
   * @param serviceKey Key for service to reset
   */
  resetService(serviceKey: keyof T): void {
    if (this.registry[serviceKey as string]) {
      logger.debug(`Resetting service instance for ${String(serviceKey)}`);
      delete this.registry[serviceKey as string];
    }
  }

  /**
   * Reset all service instances
   */
  resetAllServices(): void {
    logger.debug('Resetting all service instances');
    this.registry = {};
  }

  /**
   * Set global authentication provider
   * 
   * @param authProvider Authentication provider to use
   */
  setAuthProvider(authProvider: AuthProvider): void {
    this.authProvider = authProvider;
    // Reset services to use the new auth provider on next request
    this.resetAllServices();
  }

  /**
   * Update default configuration for a service
   * 
   * @param serviceKey Key for service to update
   * @param config Configuration to merge with existing defaults
   */
  updateServiceConfig(serviceKey: keyof T, config: Partial<ServiceConfig>): void {
    logger.debug(`Updating default config for ${String(serviceKey)}`);
    this.defaultConfigs[serviceKey] = {
      ...this.defaultConfigs[serviceKey],
      ...config,
    };
    
    // Reset the service to use the new config on next request
    this.resetService(serviceKey);
  }
}

/**
 * Create a default configuration object from environment variables
 * This provides consistent service URLs across packages
 */
export function createDefaultServiceConfig(): Record<string, ServiceConfig> {
  return {
    api: {
      baseURL: env.services.kaiApiUrl + '/api' || 'http://localhost:3000/api',
      timeout: 30000,
      useAuth: true,
    },
    ml: {
      baseURL: env.services.mlServiceUrl || 'http://localhost:7000/api',
      timeout: 60000,
      useAuth: true,
    },
    vector: {
      baseURL: env.services.vectorDbUrl || 'http://localhost:5000/api/vector',
      timeout: 45000,
      useAuth: true,
    },
    storage: {
      baseURL: env.services.kaiApiUrl + '/storage' || 'http://localhost:3000/api/storage',
      timeout: 60000,
      useAuth: true, 
    },
  };
}

/**
 * Create a service factory with default configuration
 * 
 * @param authProvider Optional authentication provider
 * @returns Configured service factory
 */
export function createServiceFactory<T extends BaseServiceConfig>(
  config: T,
  authProvider?: AuthProvider
): ServiceFactory<T> {
  return new ServiceFactory<T>(config, authProvider);
}
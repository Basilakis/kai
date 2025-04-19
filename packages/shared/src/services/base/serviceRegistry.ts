/**
 * Service Registry
 * 
 * Centralized service registration and access mechanism.
 * Provides a consistent way to access service implementations across packages.
 */

import { ServiceFactory, BaseServiceConfig, createDefaultServiceConfig } from './serviceFactory';
import { AuthProvider } from './baseService';
import { createLogger } from '../../utils/unified-logger';

const logger = createLogger('ServiceRegistry');

/**
 * Service registry singleton class
 * Provides a global point of access to all services
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private factories: Map<string, ServiceFactory<any>> = new Map();
  private authProviders: Map<string, AuthProvider> = new Map();
  private defaultConfig: Record<string, any>;

  /**
   * Private constructor for singleton implementation
   */
  private constructor() {
    this.defaultConfig = createDefaultServiceConfig();
    logger.info('Service registry initialized');
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /**
   * Register a service factory for a specific domain
   * 
   * @param domain Domain name to register factory for (e.g., 'api', 'ml')
   * @param factory ServiceFactory instance
   */
  public registerFactory<T extends BaseServiceConfig>(domain: string, factory: ServiceFactory<T>): void {
    logger.debug(`Registering service factory for domain: ${domain}`);
    this.factories.set(domain, factory);
  }

  /**
   * Get service factory for a specific domain, creating it if it doesn't exist
   * 
   * @param domain Domain name to get factory for (e.g., 'api', 'ml')
   * @param config Optional configuration for factory
   * @returns ServiceFactory instance
   */
  public getFactory<T extends BaseServiceConfig>(domain: string, config?: T): ServiceFactory<T> {
    if (!this.factories.has(domain)) {
      logger.debug(`Creating service factory for domain: ${domain}`);
      
      // Use domain-specific configuration or default
      const factoryConfig = config || this.defaultConfig;
      const authProvider = this.authProviders.get(domain);
      
      // Create new factory with configuration
      const factory = new ServiceFactory<T>(factoryConfig as T, authProvider);
      this.factories.set(domain, factory);
    }
    
    return this.factories.get(domain) as ServiceFactory<T>;
  }

  /**
   * Register an auth provider for a specific domain
   * 
   * @param domain Domain name to register auth provider for
   * @param provider AuthProvider implementation
   */
  public registerAuthProvider(domain: string, provider: AuthProvider): void {
    logger.debug(`Registering auth provider for domain: ${domain}`);
    this.authProviders.set(domain, provider);
    
    // Update factory if it exists
    if (this.factories.has(domain)) {
      const factory = this.factories.get(domain);
      if (factory) {
        factory.setAuthProvider(provider);
      }
    }
  }

  /**
   * Reset factory for a specific domain, forcing recreation on next get
   * 
   * @param domain Domain name to reset factory for
   */
  public resetFactory(domain: string): void {
    if (this.factories.has(domain)) {
      logger.debug(`Resetting service factory for domain: ${domain}`);
      this.factories.delete(domain);
    }
  }

  /**
   * Reset all factories, forcing recreation on next get
   */
  public resetAllFactories(): void {
    logger.debug('Resetting all service factories');
    this.factories.clear();
  }
}

/**
 * Get the global service registry instance
 * @returns ServiceRegistry singleton instance
 */
export function getServiceRegistry(): ServiceRegistry {
  return ServiceRegistry.getInstance();
}

/**
 * Helper function to get a service factory for a specific domain
 * 
 * @param domain Domain name to get factory for (e.g., 'api', 'ml')
 * @param config Optional configuration for factory
 * @returns ServiceFactory instance
 */
export function getServiceFactory<T extends BaseServiceConfig>(
  domain: string, 
  config?: T
): ServiceFactory<T> {
  return getServiceRegistry().getFactory<T>(domain, config);
}

// Export singleton instance
export default getServiceRegistry();
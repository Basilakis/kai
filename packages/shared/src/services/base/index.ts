/**
 * Shared Services Base Module
 * 
 * Centralized exports for service base classes, interfaces, and factories.
 * This provides a consistent way for all packages to access the standardized
 * service implementation patterns.
 */

// Export base service and related types
export { BaseService, ApiError } from './baseService';
export type { ServiceConfig, AuthProvider } from './baseService';

// Export service factory and related types
export { ServiceFactory, createDefaultServiceConfig, createServiceFactory } from './serviceFactory';
export type { BaseServiceConfig } from './serviceFactory';

// Export service registry and related functions
export {
  ServiceRegistry,
  getServiceRegistry,
  getServiceFactory
} from './serviceRegistry';

// Default export the service registry for convenience
export { default } from './serviceRegistry';
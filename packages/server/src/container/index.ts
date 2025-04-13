/**
 * Dependency Injection Container
 * 
 * This module provides a centralized container for managing service instances
 * and their dependencies throughout the application. It improves testability,
 * decouples components, and makes services easier to mock in tests.
 */

import config from '../config/config';
import { logger } from '../utils/logger';

/**
 * Container interface for managing service instances
 */
export interface Container {
  /**
   * Register a factory function for creating a service
   * @param name The service name
   * @param factory The factory function to create the service
   */
  register<T>(name: string, factory: (container: Container) => T): void;
  
  /**
   * Get a service instance, creating it if it doesn't exist
   * @param name The service name
   * @returns The service instance
   */
  get<T>(name: string): T;
  
  /**
   * Check if a service is registered
   * @param name The service name
   * @returns True if the service is registered
   */
  has(name: string): boolean;
  
  /**
   * Replace a service with a mock implementation (useful for testing)
   * @param name The service name
   * @param instance The mock instance
   */
  mock<T>(name: string, instance: T): void;
}

/**
 * Dependency Injection Container implementation
 */
class DIContainer implements Container {
  private factories: Map<string, (container: Container) => any> = new Map();
  private instances: Map<string, any> = new Map();
  
  /**
   * Register a factory function for creating a service
   */
  register<T>(name: string, factory: (container: Container) => T): void {
    if (this.factories.has(name)) {
      logger.warn(`Service "${name}" is already registered, replacing existing registration`);
    }
    
    this.factories.set(name, factory);
    
    // Clear any existing instance when re-registering
    if (this.instances.has(name)) {
      this.instances.delete(name);
    }
  }
  
  /**
   * Get a service instance, creating it if it doesn't exist
   */
  get<T>(name: string): T {
    // Return cached instance if available
    if (this.instances.has(name)) {
      return this.instances.get(name) as T;
    }
    
    // Check if factory exists
    if (!this.factories.has(name)) {
      throw new Error(`Service "${name}" is not registered in the container`);
    }
    
    // Create the instance using the factory
    const factory = this.factories.get(name)!;
    const instance = factory(this);
    
    // Cache the instance
    this.instances.set(name, instance);
    
    return instance as T;
  }
  
  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.factories.has(name);
  }
  
  /**
   * Replace a service with a mock implementation (useful for testing)
   */
  mock<T>(name: string, instance: T): void {
    this.instances.set(name, instance);
  }
  
  /**
   * Clear all registered services and instances
   * Primarily used for testing
   */
  clear(): void {
    this.factories.clear();
    this.instances.clear();
  }
}

// Create the container singleton
const container = new DIContainer();

// Register built-in services
container.register('config', () => config);
container.register('logger', () => logger);

// Export the container instance
export default container;
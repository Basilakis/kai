/**
 * Service Factory
 * 
 * Provides a centralized way to create service instances with proper configuration.
 * Ensures services are properly initialized based on the environment configuration.
 */

import { env } from '../utils/environment';
import { ServiceConfig } from './baseService';
import { MaterialService } from './materialService';
import { MLService } from './mlService';
import { VectorService } from './vectorService';
import { AnalyticsService } from './analyticsService';

// Default service configurations
const defaultServiceConfigs = {
  material: {
    baseURL: env.services.kaiApiUrl,
    timeout: 30000,
  },
  vector: {
    baseURL: env.services.vectorDbUrl,
    timeout: 45000,
  },
  ml: {
    baseURL: env.services.mlServiceUrl,
    timeout: 60000,
  },
  analytics: {
    baseURL: env.services.kaiApiUrl,
    timeout: 30000,
  },
};

/**
 * Service factory to create service instances
 */
export class ServiceFactory {
  // Singleton instances
  private static materialService: MaterialService | null = null;
  private static mlService: MLService | null = null;
  private static vectorService: VectorService | null = null;
  private static analyticsService: AnalyticsService | null = null;

  /**
   * Get or create a MaterialService instance
   */
  static getMaterialService(config?: Partial<ServiceConfig>): MaterialService {
    if (!this.materialService) {
      this.materialService = new MaterialService({
        ...defaultServiceConfigs.material,
        ...(config || {}),
      });
    }
    return this.materialService;
  }

  /**
   * Get or create an MLService instance
   */
  static getMLService(config?: Partial<ServiceConfig>): MLService {
    if (!this.mlService) {
      this.mlService = new MLService({
        ...defaultServiceConfigs.ml,
        ...(config || {}),
      });
    }
    return this.mlService;
  }

  /**
   * Get or create a VectorService instance
   */
  static getVectorService(config?: Partial<ServiceConfig>): VectorService {
    if (!this.vectorService) {
      this.vectorService = new VectorService({
        ...defaultServiceConfigs.vector,
        ...(config || {}),
      });
    }
    return this.vectorService;
  }

  /**
   * Get or create an AnalyticsService instance
   */
  static getAnalyticsService(config?: Partial<ServiceConfig>): AnalyticsService {
    if (!this.analyticsService) {
      this.analyticsService = new AnalyticsService({
        ...defaultServiceConfigs.analytics,
        ...(config || {}),
      });
    }
    return this.analyticsService;
  }

  /**
   * Reset all service instances
   * Useful for testing or when configuration changes
   */
  static resetServices(): void {
    this.materialService = null;
    this.mlService = null;
    this.vectorService = null;
    this.analyticsService = null;
  }
}

/**
 * Get a configured MaterialService instance
 */
export function getMaterialService(config?: Partial<ServiceConfig>): MaterialService {
  return ServiceFactory.getMaterialService(config);
}

/**
 * Get a configured MLService instance
 */
export function getMLService(config?: Partial<ServiceConfig>): MLService {
  return ServiceFactory.getMLService(config);
}

/**
 * Get a configured VectorService instance
 */
export function getVectorService(config?: Partial<ServiceConfig>): VectorService {
  return ServiceFactory.getVectorService(config);
}

/**
 * Get a configured AnalyticsService instance
 */
export function getAnalyticsService(config?: Partial<ServiceConfig>): AnalyticsService {
  return ServiceFactory.getAnalyticsService(config);
}

export default ServiceFactory;
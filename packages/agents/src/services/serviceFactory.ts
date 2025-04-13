/**
 * Service Factory
 * 
 * Provides a centralized way to create service instances with proper configuration.
 * Ensures services are properly initialized based on the environment configuration.
 */

import { env } from '../../../shared/src/utils/environment';
import { ServiceConfig } from './baseService';
import { MaterialService } from './materialService';
import { MLService } from './mlService'; // Image analysis etc.
import { LLMService } from './llmService'; // LLM specific tasks
import { VectorService } from './vectorService';
import { analyticsService } from './analyticsService';

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
    baseURL: env.services.mlServiceUrl, // URL for image analysis etc.
    timeout: 60000,
  },
  llm: {
    baseURL: env.services.mlApiUrl, // URL for LLM fallback API
    timeout: 60000, // Match original adapter fallback timeout
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
  private static mlService: MLService | null = null; // Image analysis etc.
  private static llmService: LLMService | null = null; // LLM specific tasks
  private static vectorService: VectorService | null = null;
  private static analyticsService: typeof analyticsService = analyticsService;

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
   * Get or create an LLMService instance
   */
  static getLLMService(config?: Partial<ServiceConfig>): LLMService {
    if (!this.llmService) {
      this.llmService = new LLMService({
        ...defaultServiceConfigs.llm,
        ...(config || {}),
      });
    }
    return this.llmService;
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
  static getAnalyticsService(_config?: Partial<ServiceConfig>): typeof analyticsService {
    return this.analyticsService;
  }

  /**
   * Reset all service instances
   * Useful for testing or when configuration changes
   */
  static resetServices(): void {
    this.materialService = null;
    this.mlService = null;
    this.llmService = null; // Reset LLMService too
    this.vectorService = null;
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
 * Get a configured LLMService instance
 */
export function getLLMService(config?: Partial<ServiceConfig>): LLMService {
  return ServiceFactory.getLLMService(config);
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
export function getAnalyticsService(config?: Partial<ServiceConfig>): typeof analyticsService {
  return ServiceFactory.getAnalyticsService(config);
}

export default ServiceFactory;
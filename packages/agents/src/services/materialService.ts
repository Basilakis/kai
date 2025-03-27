/**
 * Material Service Connector
 * 
 * Provides methods for interacting with the KAI materials API.
 * Used by agents to search and retrieve material information.
 */

import { BaseService, ServiceConfig, ApiError } from './baseService';
import { createLogger } from '../utils/logger';

const logger = createLogger('MaterialService');

/**
 * Material search parameters
 */
export interface MaterialSearchParams {
  query: string;
  filters?: Record<string, any>;
  limit?: number;
  includeMetadata?: boolean;
}

/**
 * Material search result item
 */
export interface MaterialSearchResult {
  id: string;
  name: string;
  description?: string;
  type?: string;
  properties?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Material search response
 */
export interface MaterialSearchResponse {
  results: MaterialSearchResult[];
  totalCount: number;
  metadata?: Record<string, any>;
}

/**
 * Material service for interacting with KAI materials API
 */
export class MaterialService extends BaseService {
  /**
   * Create a new MaterialService instance
   */
  constructor(config: ServiceConfig) {
    super(config);
    logger.info(`MaterialService initialized with base URL: ${this.baseURL}`);
  }

  /**
   * Search for materials using text query and filters
   */
  async searchMaterials(params: MaterialSearchParams): Promise<MaterialSearchResponse> {
    logger.info(`Searching materials with query: "${params.query}"`);
    
    try {
      const response = await this.post<MaterialSearchResponse>('/materials/search', {
        query: params.query,
        filters: params.filters || {},
        limit: params.limit || 10,
        includeMetadata: params.includeMetadata !== false,
      });
      
      logger.debug(`Search returned ${response.results.length} results out of ${response.totalCount} total`);
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error(`Error searching materials: ${error.message} (${error.statusCode})`);
      } else {
        logger.error(`Error searching materials: ${error}`);
      }
      throw error;
    }
  }

  /**
   * Get a specific material by ID
   */
  async getMaterial(id: string): Promise<MaterialSearchResult> {
    logger.info(`Getting material details for ID: ${id}`);
    
    try {
      const response = await this.get<MaterialSearchResult>(`/materials/${id}`);
      logger.debug(`Retrieved material: ${response.name}`);
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error(`Error getting material: ${error.message} (${error.statusCode})`);
      } else {
        logger.error(`Error getting material: ${error}`);
      }
      throw error;
    }
  }

  /**
   * Compare multiple materials
   */
  async compareMaterials(ids: string[]): Promise<Record<string, MaterialSearchResult>> {
    logger.info(`Comparing materials: ${ids.join(', ')}`);
    
    try {
      const response = await this.post<Record<string, MaterialSearchResult>>('/materials/compare', {
        materialIds: ids,
      });
      
      logger.debug(`Compared ${Object.keys(response).length} materials`);
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error(`Error comparing materials: ${error.message} (${error.statusCode})`);
      } else {
        logger.error(`Error comparing materials: ${error}`);
      }
      throw error;
    }
  }

  /**
   * Get similar materials
   */
  async getSimilarMaterials(id: string, limit: number = 5): Promise<MaterialSearchResult[]> {
    logger.info(`Finding similar materials for ID: ${id}`);
    
    try {
      const response = await this.get<MaterialSearchResult[]>(`/materials/${id}/similar`, {
        params: { limit },
      });
      
      logger.debug(`Found ${response.length} similar materials`);
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error(`Error finding similar materials: ${error.message} (${error.statusCode})`);
      } else {
        logger.error(`Error finding similar materials: ${error}`);
      }
      throw error;
    }
  }
}
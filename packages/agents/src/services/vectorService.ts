/**
 * Vector Search Service
 * 
 * Provides methods for performing semantic similarity searches using vector embeddings.
 * Used by agents to find materials with similar properties and characteristics.
 */

import { BaseService, ServiceConfig, ApiError } from './baseService';
import { createLogger } from '../utils/logger';

const logger = createLogger('VectorService');

/**
 * Vector search parameters
 */
export interface VectorSearchParams {
  query: string | number[];
  limit?: number;
  threshold?: number;
  filterBy?: Record<string, any>;
  includeMetadata?: boolean;
}

/**
 * Similar materials search parameters
 */
export interface SimilarMaterialsParams {
  materialId: string;
  limit?: number;
  includeMetadata?: boolean;
  sameMaterialType?: boolean;
}

/**
 * Vector search result
 */
export interface VectorSearchResult {
  id: string;
  name: string;
  manufacturer?: string;
  similarity: number;
  vector?: number[];
  metadata?: Record<string, any>;
}

/**
 * Similar materials response
 */
export interface SimilarMaterialsResponse {
  baseMaterial: VectorSearchResult;
  similarMaterials: VectorSearchResult[];
}

/**
 * Vector service for semantic similarity searches
 */
export class VectorService extends BaseService {
  /**
   * Create a new VectorService instance
   */
  constructor(config: ServiceConfig) {
    super(config);
    logger.info(`VectorService initialized with base URL: ${this.baseURL}`);
  }

  /**
   * Search for materials using vector embeddings
   */
  async searchByVector(params: VectorSearchParams): Promise<VectorSearchResult[]> {
    logger.info(`Performing vector search for: ${typeof params.query === 'string' ? params.query : 'vector data'}`);
    
    try {
      const response = await this.post<VectorSearchResult[]>('/search', {
        query: params.query,
        limit: params.limit || 5,
        threshold: params.threshold || 0.7,
        filterBy: params.filterBy || {},
        includeMetadata: params.includeMetadata !== false,
      });
      
      logger.debug(`Vector search returned ${response.length} results`);
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error(`API error in vector search: ${error.message} (${error.statusCode})`);
      } else {
        logger.error(`Error in vector search: ${error}`);
      }
      throw error;
    }
  }

  /**
   * Find similar materials to a given material ID
   */
  async findSimilarMaterials(params: SimilarMaterialsParams): Promise<SimilarMaterialsResponse> {
    logger.info(`Finding similar materials to: ${params.materialId}`);
    
    try {
      const response = await this.get<SimilarMaterialsResponse>(`/similar/${params.materialId}`, {
        params: {
          limit: params.limit || 5,
          includeMetadata: params.includeMetadata !== false,
          sameMaterialType: params.sameMaterialType || false,
        },
      });
      
      logger.debug(`Similar materials search returned ${response.similarMaterials.length} results`);
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error(`API error finding similar materials: ${error.message} (${error.statusCode})`);
      } else {
        logger.error(`Error finding similar materials: ${error}`);
      }
      throw error;
    }
  }

  /**
   * Generate text embedding vector
   */
  async generateEmbedding(text: string): Promise<number[]> {
    logger.info(`Generating embedding for text: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
    
    try {
      const response = await this.post<{ embedding: number[] }>('/embeddings', {
        text,
      });
      
      logger.debug(`Generated embedding with ${response.embedding.length} dimensions`);
      return response.embedding;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error(`API error generating embedding: ${error.message} (${error.statusCode})`);
      } else {
        logger.error(`Error generating embedding: ${error}`);
      }
      throw error;
    }
  }

  /**
   * Compare similarity between two texts
   */
  async compareSimilarity(text1: string, text2: string): Promise<number> {
    logger.info(`Comparing similarity between texts`);
    
    try {
      const response = await this.post<{ similarity: number }>('/compare', {
        text1,
        text2,
      });
      
      logger.debug(`Similarity score: ${response.similarity}`);
      return response.similarity;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error(`API error comparing similarity: ${error.message} (${error.statusCode})`);
      } else {
        logger.error(`Error comparing similarity: ${error}`);
      }
      throw error;
    }
  }
}
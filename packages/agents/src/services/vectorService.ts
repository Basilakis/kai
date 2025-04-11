import { BaseService, ServiceConfig } from './baseService';
import { MaterialDetails, MaterialSearchResult, SearchOptions, SearchResponse } from './materialService';

/**
 * Parameters for vector search operations
 */
export interface VectorSearchParams {
  query: string | number[];
  limit?: number;
  threshold?: number;
  filterBy?: Record<string, any>;
  includeMetadata?: boolean;
}

/**
 * Parameters for similar materials search
 */
export interface SimilarMaterialsParams {
  materialId: string;
  limit?: number;
  includeMetadata?: boolean;
  sameMaterialType?: boolean;
}

/**
 * Vector search result interface
 */
export interface VectorSearchResult {
  id: string;
  name: string;
  manufacturer?: string;
  similarity: number;
  metadata?: Record<string, any>;
}

/**
 * Similar materials response interface
 */
export interface SimilarMaterialsResponse {
  baseMaterial: VectorSearchResult;
  similarMaterials: VectorSearchResult[];
}

/**
 * Vector database service for semantic similarity operations
 */
export class VectorService extends BaseService {
  constructor(config: ServiceConfig) {
    super(config);
  }

  /**
   * Search for materials using vector embeddings
   * @param options Search options
   * @returns Search response with results
   */
  async searchMaterials(options: SearchOptions): Promise<SearchResponse> {
    return this.post<SearchResponse>('/vector/materials/search', options);
  }

  /**
   * Find similar materials by ID
   * @param id Material ID to find similar items for
   * @param options Search options
   * @returns Similar materials response
   */
  async getSimilar(id: string, options?: { limit?: number }): Promise<SearchResponse> {
    return this.get<SearchResponse>(
      `/vector/materials/${id}/similar${options?.limit ? `?limit=${options.limit}` : ''}`
    );
  }

  /**
   * Update vector embedding for a material
   * @param id Material ID
   * @param content Content to generate embedding from
   */
  async updateEmbedding(id: string, content: string): Promise<void> {
    await this.put<void>(`/vector/materials/${id}/embedding`, { content });
  }

  /**
   * Search by vector embedding or text
   * @param params Vector search parameters
   * @returns Vector search results
   */
  async searchByVector(params: VectorSearchParams): Promise<VectorSearchResult[]> {
    return this.post<VectorSearchResult[]>('/vector/search', params);
  }

  /**
   * Find materials similar to a given material
   * @param params Similar materials search parameters
   * @returns Similar materials response
   */
  async findSimilarMaterials(params: SimilarMaterialsParams): Promise<SimilarMaterialsResponse> {
    return this.get<SimilarMaterialsResponse>(
      `/vector/materials/${params.materialId}/similar`, {
        params: {
          limit: params.limit,
          includeMetadata: params.includeMetadata,
          sameMaterialType: params.sameMaterialType
        }
      }
    );
  }

  /**
   * Compare similarity between two texts
   * @param text1 First text
   * @param text2 Second text
   * @returns Similarity score between 0 and 1
   */
  async compareSimilarity(text1: string, text2: string): Promise<number> {
    const result = await this.post<{ similarity: number }>('/vector/compare', {
      text1,
      text2
    });
    return result.similarity;
  }
}

export default VectorService;
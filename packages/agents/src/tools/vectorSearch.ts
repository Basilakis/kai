/**
 * Vector Search Tool
 * 
 * A specialized tool for performing semantic similarity searches using vector embeddings.
 * This tool helps agents find materials with similar properties based on their vector representations.
 * 
 * When MCP integration is enabled, this tool uses the MCP server for vector operations.
 * Otherwise, it falls back to the local implementation.
 */

import { Tool } from 'crewai';
import { createLogger } from '../utils/logger';
import { ApiError } from '../services/baseService';
import { 
  VectorSearchParams, 
  SimilarMaterialsParams,
  VectorSearchResult, 
  SimilarMaterialsResponse 
} from '../services/vectorService';
import * as vectorSearchAdapter from '../services/adapters/vectorSearchMcpAdapter';

// Logger instance
const logger = createLogger('VectorSearchTool');

/**
 * Create a vector search tool for semantic similarity matching
 */
export async function createVectorSearchTool(): Promise<Tool> {
  logger.info('Creating vector search tool');

  // Initialize the vector search MCP adapter
  await vectorSearchAdapter.initializeVectorSearchMcpAdapter();
  
  // Log whether we're using MCP for vector search
  if (vectorSearchAdapter.isMcpEnabledForVectorSearch()) {
    logger.info('Vector search tool will use MCP server when available');
  } else {
    logger.info('Vector search tool will use local implementation');
  }

  /**
   * Search for materials using vector embeddings
   * 
   * @param query The search query or vector to match against
   * @param options Additional options for the vector search
   * @returns Materials matched by vector similarity
   */
  const searchByVector = async (
    query: string | number[], 
    options: { 
      limit?: number;
      threshold?: number;
      filterBy?: Record<string, any>;
      includeMetadata?: boolean;
    } = {}
  ): Promise<VectorSearchResult[]> => {
    logger.info(`Performing vector search for: ${typeof query === 'string' ? query : 'vector data'}`);
    
    try {
      // Create search parameters
      const params: VectorSearchParams = {
        query,
        limit: options.limit,
        threshold: options.threshold,
        filterBy: options.filterBy,
        includeMetadata: options.includeMetadata
      };
      
      // Use the adapter to perform the search (which will use MCP if available)
      const results = await vectorSearchAdapter.searchByVector(params);
      logger.debug(`Vector search returned ${results.length} results`);
      return results;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error(`API error in vector search: ${error.message} (${error.statusCode})`);
        // If service is unavailable, fallback to mock implementation
        if (error.statusCode === 503 || error.statusCode === 404) {
          logger.warn('Vector service unavailable, using fallback mock implementation');
          return createMockVectorSearchResults(query, options);
        }
      }
      throw error;
    }
  };

  /**
   * Find similar materials to a given material ID
   * 
   * @param materialId The ID of the material to find similar items for
   * @param options Additional options for the similarity search
   * @returns Similar materials ranked by similarity
   */
  const findSimilarMaterials = async (
    materialId: string, 
    options: { 
      limit?: number;
      includeMetadata?: boolean;
      sameMaterialType?: boolean;
    } = {}
  ): Promise<SimilarMaterialsResponse> => {
    logger.info(`Finding similar materials to: ${materialId}`);
    
    try {
      // Create search parameters
      const params: SimilarMaterialsParams = {
        materialId,
        limit: options.limit,
        includeMetadata: options.includeMetadata,
        sameMaterialType: options.sameMaterialType
      };
      
      // Use the adapter to find similar materials (which will use MCP if available)
      const results = await vectorSearchAdapter.findSimilarMaterials(params);
      logger.debug(`Similar materials search returned ${results.similarMaterials.length} results`);
      return results;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error(`API error finding similar materials: ${error.message} (${error.statusCode})`);
        // If service is unavailable, fallback to mock implementation
        if (error.statusCode === 503 || error.statusCode === 404) {
          logger.warn('Vector service unavailable, using fallback mock implementation');
          return createMockSimilarMaterialsResponse(materialId, options);
        }
      }
      throw error;
    }
  };
  
  // Create and return the crewAI tool
  return new Tool({
    name: 'vector_search',
    description: 'Search for materials using vector embeddings for semantic similarity',
    func: async (args: string) => {
      try {
        const { operation, query, materialId, options } = JSON.parse(args);
        
        switch (operation) {
          case 'search':
            return JSON.stringify(await searchByVector(query, options));
          case 'find_similar':
            return JSON.stringify(await findSimilarMaterials(materialId, options));
          case 'compare':
            if (typeof query === 'string' && materialId && typeof materialId === 'string') {
              // Compare two texts for similarity
              try {
                // Use the adapter to compare similarity (which will use MCP if available)
                const similarity = await vectorSearchAdapter.compareSimilarity(query, materialId);
                return JSON.stringify({ similarity });
              } catch (error) {
                logger.error(`Error comparing similarity: ${error}`);
                return JSON.stringify({ 
                  error: 'Error comparing similarity',
                  message: error instanceof Error ? error.message : String(error),
                  similarity: 0.5 // Fallback value
                });
              }
            } else {
              return JSON.stringify({ 
                error: 'Invalid parameters for compare operation',
                message: 'Both query and materialId must be strings'
              });
            }
          default:
            return JSON.stringify({ error: `Unknown operation: ${operation}` });
        }
      } catch (error) {
        logger.error(`Error in vector search tool: ${error}`);
        return JSON.stringify({ 
          error: 'Error processing vector search',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });
}

/**
 * Create mock vector search results (used as fallback when service is unavailable)
 */
function createMockVectorSearchResults(
  query: string | number[],
  options: { 
    limit?: number;
    threshold?: number;
    filterBy?: Record<string, any>;
    includeMetadata?: boolean;
  } = {}
): VectorSearchResult[] {
  // Default options
  const opts = {
    limit: 5,
    threshold: 0.7,
    includeMetadata: true,
    ...options
  };
  
  // Mock results
  const results: VectorSearchResult[] = [
    {
      id: 'mat-001',
      name: 'Carrara Marble',
      manufacturer: 'Italian Stone Works',
      similarity: 0.95,
      metadata: {
        material: 'Marble',
        color: 'White',
        finish: 'Polished',
        size: '12" x 24"',
        price: 85.99,
        origin: 'Italy',
        sustainability: 'Medium'
      }
    },
    {
      id: 'mat-042',
      name: 'Calacatta Gold',
      manufacturer: 'Premium Surfaces',
      similarity: 0.92,
      metadata: {
        material: 'Marble',
        color: 'White/Gold',
        finish: 'Polished',
        size: '24" x 24"',
        price: 129.99,
        origin: 'Italy',
        sustainability: 'Low'
      }
    },
    {
      id: 'mat-118',
      name: 'Nordic White Marble-Look',
      manufacturer: 'EcoTile',
      similarity: 0.89,
      metadata: {
        material: 'Porcelain',
        color: 'White',
        finish: 'Polished',
        size: '24" x 48"',
        price: 45.99,
        origin: 'Spain',
        sustainability: 'High'
      }
    },
    {
      id: 'mat-205',
      name: 'Urban White Quartz',
      manufacturer: 'Modern Surfaces',
      similarity: 0.84,
      metadata: {
        material: 'Quartz',
        color: 'White',
        finish: 'Matte',
        size: '30" x 30"',
        price: 75.50,
        origin: 'USA',
        sustainability: 'Medium'
      }
    },
    {
      id: 'mat-156',
      name: 'Alabaster White',
      manufacturer: 'Stone Republic',
      similarity: 0.81,
      metadata: {
        material: 'Limestone',
        color: 'White',
        finish: 'Honed',
        size: '12" x 12"',
        price: 52.75,
        origin: 'Portugal',
        sustainability: 'Medium'
      }
    }
  ];
  
  // Filter results based on threshold
  const filteredResults = results.filter(r => r.similarity >= opts.threshold);
  
  // Apply any additional filters
  let finalResults = filteredResults;
  if (opts.filterBy) {
    Object.entries(opts.filterBy).forEach(([key, value]) => {
      finalResults = finalResults.filter(r => 
        r.metadata && (r.metadata as Record<string, any>)[key] === value
      );
    });
  }
  
  // Limit the results
  finalResults = finalResults.slice(0, opts.limit);
  
  // Remove metadata if not requested
  if (!opts.includeMetadata) {
    finalResults = finalResults.map(({ id, name, manufacturer, similarity }) => 
      ({ id, name, manufacturer, similarity })
    ) as VectorSearchResult[];
  }
  
  return finalResults;
}

/**
 * Create a mock similar materials response (used as fallback when service is unavailable)
 */
function createMockSimilarMaterialsResponse(
  materialId: string,
  options: { 
    limit?: number;
    includeMetadata?: boolean;
    sameMaterialType?: boolean;
  } = {}
): SimilarMaterialsResponse {
  // Default options
  const opts = {
    limit: 5,
    includeMetadata: true,
    sameMaterialType: false,
    ...options
  };
  
  // Mock base material
  const baseMaterial: VectorSearchResult = {
    id: materialId,
    name: 'Carrara Marble',
    manufacturer: 'Italian Stone Works',
    similarity: 1.0,
    metadata: {
      material: 'Marble',
      color: 'White',
      finish: 'Polished',
      size: '12" x 24"',
      price: 85.99,
      origin: 'Italy'
    }
  };
  
  // Mock similar materials
  const similarMaterials: VectorSearchResult[] = [
    {
      id: 'mat-042',
      name: 'Calacatta Gold',
      manufacturer: 'Premium Surfaces',
      similarity: 0.92,
      metadata: {
        material: 'Marble',
        color: 'White/Gold',
        finish: 'Polished',
        size: '24" x 24"',
        price: 129.99,
        origin: 'Italy'
      }
    },
    {
      id: 'mat-118',
      name: 'Nordic White Marble-Look',
      manufacturer: 'EcoTile',
      similarity: 0.89,
      metadata: {
        material: 'Porcelain',
        color: 'White',
        finish: 'Polished',
        size: '24" x 48"',
        price: 45.99,
        origin: 'Spain'
      }
    },
    {
      id: 'mat-205',
      name: 'Urban White Quartz',
      manufacturer: 'Modern Surfaces',
      similarity: 0.84,
      metadata: {
        material: 'Quartz',
        color: 'White',
        finish: 'Matte',
        size: '30" x 30"',
        price: 75.50,
        origin: 'USA'
      }
    },
    {
      id: 'mat-156',
      name: 'Alabaster White',
      manufacturer: 'Stone Republic',
      similarity: 0.81,
      metadata: {
        material: 'Limestone',
        color: 'White',
        finish: 'Honed',
        size: '12" x 12"',
        price: 52.75,
        origin: 'Portugal'
      }
    },
    {
      id: 'mat-073',
      name: 'Bianco Venatino',
      manufacturer: 'Marble Masters',
      similarity: 0.78,
      metadata: {
        material: 'Marble',
        color: 'White/Gray',
        finish: 'Polished',
        size: '18" x 18"',
        price: 92.25,
        origin: 'Italy'
      }
    }
  ];
  
  // Filter by material type if requested
  let filteredResults = similarMaterials;
  if (opts.sameMaterialType && baseMaterial.metadata && 'material' in baseMaterial.metadata) {
    const materialType = baseMaterial.metadata['material'];
    filteredResults = similarMaterials.filter(m => 
      m.metadata && 'material' in m.metadata && m.metadata['material'] === materialType
    );
  }
  
  // Limit the results
  filteredResults = filteredResults.slice(0, opts.limit);
  
  // Remove metadata if not requested
  if (!opts.includeMetadata) {
    filteredResults = filteredResults.map(({ id, name, manufacturer, similarity }) => 
      ({ id, name, manufacturer, similarity })
    ) as VectorSearchResult[];
    
    return {
      baseMaterial: { 
        id: baseMaterial.id, 
        name: baseMaterial.name, 
        manufacturer: baseMaterial.manufacturer || '',
        similarity: 1.0
      },
      similarMaterials: filteredResults
    };
  }
  
  return {
    baseMaterial,
    similarMaterials: filteredResults
  };
}

export default {
  createVectorSearchTool
};
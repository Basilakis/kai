/**
 * Vector Search MCP Adapter
 * 
 * This adapter provides integration between vector search operations and the MCP server.
 * When MCP is enabled for vector search, it proxies operations to the MCP server.
 * Otherwise, it falls back to the original implementation.
 */

import { createLogger } from '../../utils/logger';
import { getVectorService } from '../serviceFactory';
import { 
  VectorSearchParams, 
  SimilarMaterialsParams,
  VectorSearchResult, 
  SimilarMaterialsResponse
} from '../vectorService';
import { 
  isMCPEnabledForComponent, 
  withMCPFallback, 
  callMCPEndpoint
} from '../../utils/mcpIntegration';

// Create a logger for the adapter
const logger = createLogger('VectorSearchMcpAdapter');

/**
 * Search for materials using vector embeddings with MCP support
 * 
 * @param params Search parameters
 * @returns Vector search results
 */
export async function searchByVector(params: VectorSearchParams): Promise<VectorSearchResult[]> {
  return withMCPFallback(
    'vectorSearch',
    async (p: VectorSearchParams) => {
      logger.debug('Executing vector search via MCP');
      return callMCPEndpoint<VectorSearchResult[]>('vectorSearch', 'search', p);
    },
    async (p: VectorSearchParams) => {
      logger.debug('Executing vector search via local implementation');
      const vectorService = getVectorService();
      return vectorService.searchByVector(p);
    },
    params
  );
}

/**
 * Find similar materials to a given material ID with MCP support
 * 
 * @param params Similar materials search parameters
 * @returns Similar materials search results
 */
export async function findSimilarMaterials(params: SimilarMaterialsParams): Promise<SimilarMaterialsResponse> {
  return withMCPFallback(
    'vectorSearch',
    async (p: SimilarMaterialsParams) => {
      logger.debug('Finding similar materials via MCP');
      return callMCPEndpoint<SimilarMaterialsResponse>('vectorSearch', 'findSimilar', p);
    },
    async (p: SimilarMaterialsParams) => {
      logger.debug('Finding similar materials via local implementation');
      const vectorService = getVectorService();
      return vectorService.findSimilarMaterials(p);
    },
    params
  );
}

/**
 * Compare similarity between two texts or vectors with MCP support
 * 
 * @param text1 First text or vector
 * @param text2 Second text or vector
 * @returns Similarity score between 0 and 1
 */
export async function compareSimilarity(text1: string, text2: string): Promise<number> {
  return withMCPFallback(
    'vectorSearch',
    async (t1: string, t2: string) => {
      logger.debug('Comparing similarity via MCP');
      return callMCPEndpoint<{ similarity: number }>('vectorSearch', 'compare', { text1: t1, text2: t2 })
        .then(result => result.similarity);
    },
    async (t1: string, t2: string) => {
      logger.debug('Comparing similarity via local implementation');
      const vectorService = getVectorService();
      return vectorService.compareSimilarity(t1, t2);
    },
    text1, text2
  );
}

/**
 * Check if MCP is enabled for vector search
 * 
 * @returns True if MCP is enabled for vector search
 */
export function isMcpEnabledForVectorSearch(): boolean {
  return isMCPEnabledForComponent('vectorSearch');
}

/**
 * Initialize the vector search MCP adapter
 * This can be called at startup to prepare the adapter
 */
export async function initializeVectorSearchMcpAdapter(): Promise<void> {
  if (isMcpEnabledForVectorSearch()) {
    logger.info('Initializing vector search MCP adapter');
    
    try {
      // Check if MCP is available for vector search
      const testResult = await searchByVector({ 
        query: 'test', 
        limit: 1 
      }).catch(error => {
        logger.warn(`Vector search MCP test failed: ${error}`);
        return null;
      });
      
      if (testResult) {
        logger.info('Vector search MCP adapter initialized successfully');
      } else {
        logger.warn('Vector search MCP adapter initialization failed, using local implementation');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error initializing vector search MCP adapter: ${errorMessage}`);
    }
  } else {
    logger.info('Vector search MCP adapter is disabled, using local implementation');
  }
}

export default {
  searchByVector,
  findSimilarMaterials,
  compareSimilarity,
  isMcpEnabledForVectorSearch,
  initializeVectorSearchMcpAdapter
};
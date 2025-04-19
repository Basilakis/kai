/**
 * Enhanced Vector Controller
 *
 * This controller provides API endpoints for the enhanced vector search capabilities
 * that support the RAG system. It includes endpoints for generating embeddings,
 * searching based on text queries or embeddings, and managing vector search configurations.
 * Now enhanced with knowledge base integration features for bidirectional linking,
 * material relationship mapping, and semantic indexing.
 */

import { Request, Response, NextFunction } from 'express';
import { enhancedVectorService as enhancedVectorServiceBase } from '../services/supabase/enhanced-vector-service';
import { logger } from '../utils/logger';
import { knowledgeBaseService } from '../services/knowledgeBase/knowledgeBaseService';
import mcpClientService from '../services/mcp/mcpClientService';
import { EnhancedVectorService } from '../types/enhancedVector.types';

// Import the service instance (assuming it now correctly matches the interface)
const enhancedVectorService: EnhancedVectorService = enhancedVectorServiceBase;
import {
  validateGenerateEmbeddingsRequest,
  validateStoreEmbeddingsRequest,
  validateSearchMaterialsRequest,
  validateFindSimilarMaterialsRequest,
  validateSearchWithKnowledgeRequest,
  validateFindSimilarWithKnowledgeRequest,
  validateRouteQueryRequest,
  validateGetMaterialKnowledgeRequest,
  validateAssembleContextRequest,
  validateCreateSemanticOrganizationRequest,
  validateCompareSimilarityRequest,
  validateUpdateSearchConfigRequest,
  validateDeleteSearchConfigRequest
} from '../utils/enhancedVectorValidation';
import {
  sendSuccessResponse,
  sendErrorResponse,
  sendInsufficientCreditsResponse,
  ErrorCodes
} from '../utils/responseFormatter';

// Initialize knowledge base service in the enhanced vector service
enhancedVectorService.setKnowledgeBaseService(knowledgeBaseService);

/**
 * Get embeddings for text
 *
 * @route POST /api/vector/enhanced/embeddings
 */
export const generateEmbeddings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request
    const { text, options } = validateGenerateEmbeddingsRequest(req);
    const userId = req.user?.id;

    // Check if MCP is available and user ID is provided
    const mcpAvailable = await mcpClientService.isMCPAvailable();

    if (mcpAvailable && userId) {
      try {
        // Generate embedding using MCP
        const mcpResult = await mcpClientService.generateTextEmbedding(
          userId,
          text,
          { model: 'text-embedding-3-small' }
        );

        sendSuccessResponse(res, {
          dense_vector: mcpResult.embedding,
          dense_dimensions: mcpResult.dimensions,
          method: 'dense',
          material_category: options.materialCategory,
          processing_time: 0 // MCP doesn't provide processing time yet
        });
        return;
      } catch (mcpError: unknown) {
        const error = mcpError as Error;
        // If MCP fails with insufficient credits, return 402
        if (error.message === 'Insufficient credits') {
          sendInsufficientCreditsResponse(res);
          return;
        }

        // For other MCP errors, log and fall back to direct implementation
        logger.warn(`MCP embedding generation failed, falling back to direct implementation: ${error.message}`);
      }
    }

    // Fall back to direct implementation if MCP is not available or failed
    const result = await enhancedVectorService.generateEmbedding(text, options);

    sendSuccessResponse(res, result);
  } catch (error) {
    logger.error(`Error generating embeddings: ${error}`);
    next(error);
  }
};

/**
 * Store embeddings for a material
 *
 * @route POST /api/vector/enhanced/materials/:id/embeddings
 */
export const storeEmbeddings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request
    const { id, text } = validateStoreEmbeddingsRequest(req);
    const { embeddingResult, materialCategory } = req.body;

    // If embedding result is provided, use it, otherwise generate it
    let embeddings = embeddingResult;
    if (!embeddings) {
      embeddings = await enhancedVectorService.generateEmbedding(text, {
        materialCategory
      });
    }

    const success = await enhancedVectorService.storeEmbedding(id, embeddings, text);

    if (success) {
      sendSuccessResponse(res, { success: true, materialId: id });
    } else {
      sendErrorResponse(res, 'Failed to store embeddings', 500, ErrorCodes.INTERNAL_ERROR);
    }
  } catch (error) {
    logger.error(`Error storing embeddings: ${error}`);
    next(error);
  }
};

/**
 * Search materials using text query
 *
 * @route GET /api/vector/enhanced/search
 */
export const searchMaterials = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request
    const searchOptions = validateSearchMaterialsRequest(req);
    const userId = req.user?.id;

    // Check if MCP is available and user ID is provided
    const mcpAvailable = await mcpClientService.isMCPAvailable();

    if (mcpAvailable && userId) {
      try {
        // Search vector database using MCP
        const mcpResults = await mcpClientService.searchVectorDatabase(
          userId,
          searchOptions.query,
          {
            collection: 'materials',
            limit: searchOptions.limit ?? 10,
            filter: searchOptions.materialType ? { material_type: searchOptions.materialType } : {}
          }
        );

        sendSuccessResponse(res, {
          materials: mcpResults,
          count: mcpResults.length,
          query: searchOptions.query,
          materialType: searchOptions.materialType
        });
        return;
      } catch (mcpError: unknown) {
        const error = mcpError as Error;
        // If MCP fails with insufficient credits, return 402
        if (error.message === 'Insufficient credits') {
          sendInsufficientCreditsResponse(res);
          return;
        }

        // For other MCP errors, log and fall back to direct implementation
        logger.warn(`MCP vector search failed, falling back to direct implementation: ${error.message}`);
      }
    }

    // Fall back to direct implementation if MCP is not available or failed
    const results = await enhancedVectorService.searchMaterials(searchOptions);

    sendSuccessResponse(res, {
      results,
      query: searchOptions.query,
      materialType: searchOptions.materialType,
      count: results.length
    });
  } catch (error) {
    logger.error(`Error searching materials: ${error}`);
    next(error);
  }
};

/**
 * Find similar materials
 *
 * @route GET /api/vector/enhanced/materials/:id/similar
 */
export const findSimilarMaterials = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request
    const { id, options } = validateFindSimilarMaterialsRequest(req);

    const results = await enhancedVectorService.findSimilarMaterials(id, options);

    sendSuccessResponse(res, {
      results,
      materialId: id,
      count: results.length
    });
  } catch (error) {
    logger.error(`Error finding similar materials: ${error}`);
    next(error);
  }
};

/**
 * Search materials with knowledge base integration
 *
 * @route GET /api/vector/enhanced/knowledge/search
 */
export const searchMaterialsWithKnowledge = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request
    const { query, materialType, limit, includeKnowledge, includeRelationships } = validateSearchWithKnowledgeRequest(req);

    const results = await enhancedVectorService.searchMaterialsWithKnowledge(
      query,
      materialType,
      undefined, // filters - could be added as needed
      limit,
      includeKnowledge,
      includeRelationships
    );

    sendSuccessResponse(res, {
      ...results,
      query,
      materialType,
      count: results.materials.length,
      knowledgeCount: results.knowledgeEntries.length,
      relationshipsCount: results.relationships.length
    });
  } catch (error) {
    logger.error(`Error searching materials with knowledge: ${error}`);
    next(error);
  }
};

/**
 * Find similar materials with knowledge base integration
 *
 * @route GET /api/vector/enhanced/knowledge/materials/:id/similar
 */
export const findSimilarMaterialsWithKnowledge = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request
    const { id, materialType, limit, includeKnowledge } = validateFindSimilarWithKnowledgeRequest(req);

    const results = await enhancedVectorService.findSimilarMaterialsWithKnowledge(
      id,
      materialType,
      limit,
      includeKnowledge
    );

    sendSuccessResponse(res, {
      ...results,
      materialId: id,
      count: results.materials.length,
      knowledgeCount: results.knowledgeEntries.length,
      relationshipsCount: results.relationships.length
    });
  } catch (error) {
    logger.error(`Error finding similar materials with knowledge: ${error}`);
    next(error);
  }
};

/**
 * Route a query between vector search and knowledge base
 *
 * @route POST /api/vector/enhanced/knowledge/route
 */
export const routeQuery = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request
    const options = validateRouteQueryRequest(req);

    const results = await enhancedVectorService.routeQuery(options);

    sendSuccessResponse(res, {
      ...results,
      query: options.query,
      materialType: options.materialType,
      count: results.materials.length,
      knowledgeCount: results.knowledgeEntries.length,
      routingStrategy: results.metadata?.searchStrategy || 'hybrid'
    });
  } catch (error) {
    logger.error(`Error routing query: ${error}`);
    next(error);
  }
};

/**
 * Get knowledge entries related to a material
 *
 * @route GET /api/vector/enhanced/knowledge/materials/:id
 */
export const getMaterialKnowledge = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request
    const { id, query, limit } = validateGetMaterialKnowledgeRequest(req);

    const result = await enhancedVectorService.getMaterialKnowledge(
      id,
      query,
      limit
    );

    sendSuccessResponse(res, {
      ...result,
      materialId: id,
      entriesCount: result.entries?.length || 0,
      relationshipsCount: result.relationships?.length || 0
    });
  } catch (error) {
    logger.error(`Error getting material knowledge: ${error}`);
    next(error);
  }
};

/**
 * Assemble context from materials and knowledge entries
 *
 * @route POST /api/vector/enhanced/knowledge/context
 */
export const assembleContext = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request
    const { materials, query, userContext } = validateAssembleContextRequest(req);

    const result = await enhancedVectorService.assembleContext(
      materials,
      query,
      userContext
    );

    sendSuccessResponse(res, result);
  } catch (error) {
    logger.error(`Error assembling context: ${error}`);
    next(error);
  }
};

/**
 * Create semantic organization for knowledge entries
 *
 * @route POST /api/vector/enhanced/knowledge/organize
 */
export const createSemanticOrganization = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request
    const { knowledgeEntries, query } = validateCreateSemanticOrganizationRequest(req);

    const result = await enhancedVectorService.createSemanticKnowledgeOrganization(
      knowledgeEntries,
      query
    );

    sendSuccessResponse(res, result);
  } catch (error) {
    logger.error(`Error creating semantic organization: ${error}`);
    next(error);
  }
};

/**
 * Compare similarity between two texts
 *
 * @route POST /api/vector/enhanced/compare
 */
export const compareSimilarity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request
    const { text1, text2 } = validateCompareSimilarityRequest(req);

    const similarity = await enhancedVectorService.compareSimilarity(text1, text2);

    sendSuccessResponse(res, { similarity });
  } catch (error) {
    logger.error(`Error comparing similarity: ${error}`);
    next(error);
  }
};

/**
 * Refresh vector materialized views
 *
 * @route POST /api/vector/enhanced/refresh-views
 */
export const refreshVectorViews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const success = await enhancedVectorService.refreshVectorViews();

    if (success) {
      sendSuccessResponse(res, { success: true });
    } else {
      sendErrorResponse(res, 'Failed to refresh vector views', 500, ErrorCodes.INTERNAL_ERROR);
    }
  } catch (error) {
    logger.error(`Error refreshing vector views: ${error}`);
    next(error);
  }
};

/**
 * Get vector search performance statistics
 *
 * @route GET /api/vector/enhanced/performance
 */
export const getPerformanceStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await enhancedVectorService.getPerformanceStats();

    sendSuccessResponse(res, stats);
  } catch (error) {
    logger.error(`Error getting performance stats: ${error}`);
    next(error);
  }
};

/**
 * Get vector search configurations
 *
 * @route GET /api/vector/enhanced/configs
 */
export const getSearchConfigs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const configs = await enhancedVectorService.getSearchConfigs();

    sendSuccessResponse(res, configs);
  } catch (error) {
    logger.error(`Error getting search configs: ${error}`);
    next(error);
  }
};

/**
 * Update vector search configuration
 *
 * @route PUT /api/vector/enhanced/configs/:name
 */
export const updateSearchConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request
    const { name, configData } = validateUpdateSearchConfigRequest(req);

    // Merge name from URL with config data
    const config = await enhancedVectorService.updateSearchConfig({
      ...configData,
      name
    });

    sendSuccessResponse(res, config);
  } catch (error) {
    logger.error(`Error updating search config: ${error}`);
    next(error);
  }
};

/**
 * Delete vector search configuration
 *
 * @route DELETE /api/vector/enhanced/configs/:name
 */
export const deleteSearchConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request
    const { name } = validateDeleteSearchConfigRequest(req);

    const success = await enhancedVectorService.deleteSearchConfig(name);

    if (success) {
      sendSuccessResponse(res, { success: true });
    } else {
      sendErrorResponse(res, `Failed to delete configuration: ${name}`, 500, ErrorCodes.INTERNAL_ERROR);
    }
  } catch (error) {
    logger.error(`Error deleting search config: ${error}`);
    next(error);
  }
};

export default {
  generateEmbeddings,
  storeEmbeddings,
  searchMaterials,
  searchMaterialsWithKnowledge,
  findSimilarMaterials,
  findSimilarMaterialsWithKnowledge,
  routeQuery,
  getMaterialKnowledge,
  assembleContext,
  createSemanticOrganization,
  compareSimilarity,
  refreshVectorViews,
  getPerformanceStats,
  getSearchConfigs,
  updateSearchConfig,
  deleteSearchConfig
};
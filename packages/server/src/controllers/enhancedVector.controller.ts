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
import { enhancedVectorService } from '../services/supabase/enhanced-vector-service';
import { logger } from '../utils/logger';
import { knowledgeBaseService } from '../services/knowledgeBase/knowledgeBaseService';

// Initialize knowledge base service in the enhanced vector service
enhancedVectorService.setKnowledgeBaseService(knowledgeBaseService);
/**
 * Get embeddings for text
 * 
 * @route POST /api/vector/enhanced/embeddings
 */
export const generateEmbeddings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { text, method, materialCategory } = req.body;
    
    if (!text) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }
    
    const result = await enhancedVectorService.generateEmbedding(text, {
      method: method || 'hybrid',
      materialCategory
    });
    
    res.json(result);
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
    const { id } = req.params;
    const { text, embeddingResult } = req.body;
    
    if (!id) {
      res.status(400).json({ error: 'Material ID is required' });
      return;
    }
    
    if (!text) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }
    
    // If embedding result is provided, use it, otherwise generate it
    let embeddings = embeddingResult;
    if (!embeddings) {
      embeddings = await enhancedVectorService.generateEmbedding(text, {
        materialCategory: req.body.materialCategory
      });
    }
    
    const success = await enhancedVectorService.storeEmbedding(id, embeddings, text);
    
    if (success) {
      res.json({ success: true, materialId: id });
    } else {
      res.status(500).json({ error: 'Failed to store embeddings' });
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
    const { query, materialType, limit, threshold, denseWeight, useSpecializedIndex } = req.query;
    
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }
    
    const results = await enhancedVectorService.searchMaterials({
      query: query as string,
      materialType: materialType as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      threshold: threshold ? parseFloat(threshold as string) : undefined,
      denseWeight: denseWeight ? parseFloat(denseWeight as string) : undefined,
      useSpecializedIndex: useSpecializedIndex === 'true'
    });
    
    res.json({
      results,
      query,
      materialType,
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
    const { id } = req.params;
    const { limit, threshold, sameMaterialType, denseWeight } = req.query;
    
    if (!id) {
      res.status(400).json({ error: 'Material ID is required' });
      return;
    }
    
    const results = await enhancedVectorService.findSimilarMaterials(id, {
      limit: limit ? parseInt(limit as string, 10) : undefined,
      threshold: threshold ? parseFloat(threshold as string) : undefined,
      sameMaterialType: sameMaterialType === 'true',
      denseWeight: denseWeight ? parseFloat(denseWeight as string) : undefined
    });
    
    res.json({
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
    const { query, materialType, limit, includeKnowledge, includeRelationships } = req.query;
    
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }
    
    const results = await enhancedVectorService.searchMaterialsWithKnowledge(
      query as string,
      materialType as string | undefined,
      undefined, // filters - could be added as needed
      limit ? parseInt(limit as string, 10) : 10,
      includeKnowledge === 'false' ? false : true,
      includeRelationships === 'false' ? false : true
    );
    
    res.json({
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
    const { id } = req.params;
    const { materialType, limit, includeKnowledge } = req.query;
    
    if (!id) {
      res.status(400).json({ error: 'Material ID is required' });
      return;
    }
    
    const results = await enhancedVectorService.findSimilarMaterialsWithKnowledge(
      id,
      materialType as string | undefined,
      limit ? parseInt(limit as string, 10) : 10,
      includeKnowledge === 'false' ? false : true
    );
    
    res.json({
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
    const { query, materialType, filters, strategy } = req.body;
    
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }
    
    const results = await enhancedVectorService.routeQuery({
      query,
      materialType,
      filters,
      strategy: strategy || 'hybrid'
    });
    
    res.json({
      ...results,
      query,
      materialType,
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
    const { id } = req.params;
    const { query, limit } = req.query;
    
    if (!id) {
      res.status(400).json({ error: 'Material ID is required' });
      return;
    }
    
    const result = await enhancedVectorService.getMaterialKnowledge(
      id,
      query as string | undefined,
      limit ? parseInt(limit as string, 10) : 5
    );
    
    res.json({
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
    const { materials, query, userContext } = req.body;
    
    if (!materials || !Array.isArray(materials)) {
      res.status(400).json({ error: 'Materials array is required' });
      return;
    }
    
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }
    
    const result = await enhancedVectorService.assembleContext(
      materials,
      query,
      userContext
    );
    
    res.json(result);
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
    const { knowledgeEntries, query } = req.body;
    
    if (!knowledgeEntries || !Array.isArray(knowledgeEntries)) {
      res.status(400).json({ error: 'Knowledge entries array is required' });
      return;
    }
    
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }
    
    const result = await enhancedVectorService.createSemanticKnowledgeOrganization(
      knowledgeEntries,
      query
    );
    
    res.json(result);
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
    const { text1, text2 } = req.body;
    
    if (!text1 || !text2) {
      res.status(400).json({ error: 'Both text1 and text2 are required' });
      return;
    }
    
    const similarity = await enhancedVectorService.compareSimilarity(text1, text2);
    
    res.json({ similarity });
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
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to refresh vector views' });
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
    
    res.json(stats);
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
    
    res.json(configs);
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
    const { name } = req.params;
    const configData = req.body;
    
    if (!name) {
      res.status(400).json({ error: 'Configuration name is required' });
      return;
    }
    
    // Merge name from URL with config data
    const config = await enhancedVectorService.updateSearchConfig({
      ...configData,
      name
    });
    
    res.json(config);
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
    const { name } = req.params;
    
    if (!name) {
      res.status(400).json({ error: 'Configuration name is required' });
      return;
    }
    
    const success = await enhancedVectorService.deleteSearchConfig(name);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to delete configuration' });
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
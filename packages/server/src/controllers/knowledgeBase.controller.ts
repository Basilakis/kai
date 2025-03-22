/**
 * Knowledge Base Controller
 * 
 * This controller provides REST API endpoints for knowledge base operations,
 * exposing the functionality of the Knowledge Base Service to the admin panel.
 */

import { Request, Response } from 'express';
import { knowledgeBaseService } from '../services/knowledgeBase/knowledgeBaseService';
import { logger } from '../utils/logger';

/**
 * Search materials
 * 
 * @param req Request
 * @param res Response
 */
export const searchMaterials = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      query,
      materialType,
      collectionId,
      seriesId,
      tags,
      fields,
      filter,
      sort,
      limit,
      skip,
      includeVersions,
      useVectorSearch,
      searchStrategy
    } = req.query;
    
    // Convert array parameters from CSV to arrays
    const parsedTags = typeof tags === 'string' ? tags.split(',') : undefined;
    const parsedMaterialType = typeof materialType === 'string' 
      ? materialType.split(',') 
      : materialType;
    
    // Convert limit and skip to numbers
    const parsedLimit = limit ? parseInt(limit as string, 10) : undefined;
    const parsedSkip = skip ? parseInt(skip as string, 10) : undefined;
    
    // Convert boolean parameters
    const parsedIncludeVersions = includeVersions === 'true';
    const parsedUseVectorSearch = useVectorSearch === 'true';
    
    // Parse sort parameter
    let parsedSort: Record<string, 1 | -1> | undefined;
    if (sort) {
      parsedSort = {};
      const sortParts = (sort as string).split(',');
      for (const part of sortParts) {
        const [field, direction] = part.split(':');
        if (field) { // Add null check for field
          parsedSort[field] = direction === 'desc' ? -1 : 1;
        }
      }
    }
    
    // Parse filter and fields as JSON if provided
    const parsedFilter = filter ? JSON.parse(filter as string) : undefined;
    const parsedFields = fields ? JSON.parse(fields as string) : undefined;
    
    const results = await knowledgeBaseService.searchMaterials({
      query: query as string,
      materialType: parsedMaterialType as string | string[],
      collectionId: collectionId as string,
      seriesId: seriesId as string,
      tags: parsedTags,
      fields: parsedFields,
      filter: parsedFilter,
      sort: parsedSort,
      limit: parsedLimit,
      skip: parsedSkip,
      includeVersions: parsedIncludeVersions,
      useVectorSearch: parsedUseVectorSearch,
      searchStrategy: searchStrategy as 'text' | 'vector' | 'metadata' | 'combined'
    });
    
    res.json(results);
  } catch (err) {
    logger.error(`Error in searchMaterials: ${err}`);
    res.status(500).json({
      error: 'Failed to search materials',
      message: err instanceof Error ? err.message : String(err)
    });
  }
};

/**
 * Get collections
 * 
 * @param req Request
 * @param res Response
 */
export const getCollections = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      parentId,
      includeEmpty,
      limit,
      skip,
      sort
    } = req.query;
    
    // Convert limit and skip to numbers
    const parsedLimit = limit ? parseInt(limit as string, 10) : undefined;
    const parsedSkip = skip ? parseInt(skip as string, 10) : undefined;
    
    // Convert boolean parameters
    const parsedIncludeEmpty = includeEmpty === 'true';
    
    // Parse sort parameter
    let parsedSort: Record<string, 1 | -1> | undefined;
    if (sort) {
      parsedSort = {};
      const sortParts = (sort as string).split(',');
      for (const part of sortParts) {
        const [field, direction] = part.split(':');
        if (field) { // Add null check for field
          parsedSort[field] = direction === 'desc' ? -1 : 1;
        }
      }
    }
    
    const results = await knowledgeBaseService.getCollections({
      parentId: parentId as string,
      includeEmpty: parsedIncludeEmpty,
      limit: parsedLimit,
      skip: parsedSkip,
      sort: parsedSort
    });
    
    res.json(results);
  } catch (err) {
    logger.error(`Error in getCollections: ${err}`);
    res.status(500).json({
      error: 'Failed to get collections',
      message: err instanceof Error ? err.message : String(err)
    });
  }
};

/**
 * Create material revision
 * 
 * @param req Request
 * @param res Response
 */
export const createMaterialRevision = async (req: Request, res: Response): Promise<void> => {
  try {
    const { materialId } = req.params;
    const updateData = req.body;
    const userId = req.user?.id; // From auth middleware
    
    if (!userId) {
      res.status(401).json({ error: 'User ID is required' });
      return;
    }
    
    const updatedMaterial = await knowledgeBaseService.createMaterialRevision(
      materialId || '', // Provide default empty string if undefined
      updateData,
      userId
    );
    
    res.json(updatedMaterial);
  } catch (err) {
    logger.error(`Error in createMaterialRevision: ${err}`);
    res.status(500).json({
      error: 'Failed to create material revision',
      message: err instanceof Error ? err.message : String(err)
    });
  }
};

/**
 * Revert material to a previous version
 * 
 * @param req Request
 * @param res Response
 */
export const revertMaterialVersion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { materialId, versionId } = req.params;
    const userId = req.user?.id; // From auth middleware
    
    if (!userId) {
      res.status(401).json({ error: 'User ID is required' });
      return;
    }
    
    const revertedMaterial = await knowledgeBaseService.revertMaterialVersion(
      materialId || '', // Provide default empty string if undefined
      versionId || '', // Provide default empty string if undefined
      userId
    );
    
    res.json(revertedMaterial);
  } catch (err) {
    logger.error(`Error in revertMaterialVersion: ${err}`);
    res.status(500).json({
      error: 'Failed to revert material version',
      message: err instanceof Error ? err.message : String(err)
    });
  }
};

/**
 * Get material version history
 * 
 * @param req Request
 * @param res Response
 */
export const getMaterialVersionHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { materialId } = req.params;
    
    const versions = await knowledgeBaseService.getMaterialVersionHistory(materialId || ''); // Provide default empty string if undefined
    
    res.json(versions);
  } catch (err) {
    logger.error(`Error in getMaterialVersionHistory: ${err}`);
    res.status(500).json({
      error: 'Failed to get material version history',
      message: err instanceof Error ? err.message : String(err)
    });
  }
};

/**
 * Create a search index
 * 
 * @param req Request
 * @param res Response
 */
export const createSearchIndex = async (req: Request, res: Response): Promise<void> => {
  try {
    const indexData = req.body;
    const userId = req.user?.id; // From auth middleware
    
    if (!userId) {
      res.status(401).json({ error: 'User ID is required' });
      return;
    }
    
    // Add the user ID as the creator
    indexData.createdBy = userId;
    
    const searchIndex = await knowledgeBaseService.createSearchIndex(indexData);
    
    res.json(searchIndex);
  } catch (err) {
    logger.error(`Error in createSearchIndex: ${err}`);
    res.status(500).json({
      error: 'Failed to create search index',
      message: err instanceof Error ? err.message : String(err)
    });
  }
};

/**
 * Get search indexes
 * 
 * @param req Request
 * @param res Response
 */
export const getSearchIndexes = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      entityType,
      indexType,
      status,
      limit,
      skip
    } = req.query;
    
    // Convert limit and skip to numbers
    const parsedLimit = limit ? parseInt(limit as string, 10) : undefined;
    const parsedSkip = skip ? parseInt(skip as string, 10) : undefined;
    
    const indexes = await knowledgeBaseService.getSearchIndexes({
      entityType: entityType as string,
      indexType: indexType as string,
      status: status as string,
      limit: parsedLimit,
      skip: parsedSkip
    });
    
    res.json(indexes);
  } catch (err) {
    logger.error(`Error in getSearchIndexes: ${err}`);
    res.status(500).json({
      error: 'Failed to get search indexes',
      message: err instanceof Error ? err.message : String(err)
    });
  }
};

/**
 * Rebuild a search index
 * 
 * @param req Request
 * @param res Response
 */
export const rebuildSearchIndex = async (req: Request, res: Response): Promise<void> => {
  try {
    const { indexId } = req.params;
    
    const updatedIndex = await knowledgeBaseService.rebuildSearchIndex(indexId || ''); // Provide default empty string if undefined
    
    res.json(updatedIndex);
  } catch (err) {
    logger.error(`Error in rebuildSearchIndex: ${err}`);
    res.status(500).json({
      error: 'Failed to rebuild search index',
      message: err instanceof Error ? err.message : String(err)
    });
  }
};

/**
 * Get knowledge base statistics
 * 
 * @param req Request
 * @param res Response
 */
export const getKnowledgeBaseStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await knowledgeBaseService.getKnowledgeBaseStats();
    
    res.json(stats);
  } catch (err) {
    logger.error(`Error in getKnowledgeBaseStats: ${err}`);
    res.status(500).json({
      error: 'Failed to get knowledge base stats',
      message: err instanceof Error ? err.message : String(err)
    });
  }
};

/**
 * Bulk import materials
 * 
 * @param req Request
 * @param res Response
 */
export const bulkImportMaterials = async (req: Request, res: Response): Promise<void> => {
  try {
    const { materials, options } = req.body;
    const userId = req.user?.id; // From auth middleware
    
    if (!userId) {
      res.status(401).json({ error: 'User ID is required' });
      return;
    }
    
    if (!Array.isArray(materials) || materials.length === 0) {
      res.status(400).json({ error: 'Materials array is required and cannot be empty' });
      return;
    }
    
    const importOptions = {
      skipExisting: options?.skipExisting === true,
      updateExisting: options?.updateExisting === true,
      validateOnly: options?.validateOnly === true,
      collectionId: options?.collectionId
    };
    
    const result = await knowledgeBaseService.bulkImportMaterials(materials, userId, importOptions);
    
    res.json(result);
  } catch (err) {
    logger.error(`Error in bulkImportMaterials: ${err}`);
    res.status(500).json({
      error: 'Failed to bulk import materials',
      message: err instanceof Error ? err.message : String(err)
    });
  }
};

/**
 * Bulk update materials
 * 
 * @param req Request
 * @param res Response
 */
export const bulkUpdateMaterials = async (req: Request, res: Response): Promise<void> => {
  try {
    const { updates, filter } = req.body;
    const userId = req.user?.id; // From auth middleware
    
    if (!userId) {
      res.status(401).json({ error: 'User ID is required' });
      return;
    }
    
    if (!updates || Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'Updates object is required and cannot be empty' });
      return;
    }
    
    const result = await knowledgeBaseService.bulkUpdateMaterials(updates, filter, userId);
    
    res.json(result);
  } catch (err) {
    logger.error(`Error in bulkUpdateMaterials: ${err}`);
    res.status(500).json({
      error: 'Failed to bulk update materials',
      message: err instanceof Error ? err.message : String(err)
    });
  }
};

/**
 * Bulk delete materials
 * 
 * @param req Request
 * @param res Response
 */
export const bulkDeleteMaterials = async (req: Request, res: Response): Promise<void> => {
  try {
    const { materialIds, filter } = req.body;
    const userId = req.user?.id; // From auth middleware
    
    if (!userId) {
      res.status(401).json({ error: 'User ID is required' });
      return;
    }
    
    if (!materialIds && !filter) {
      res.status(400).json({ error: 'Either materialIds array or filter object is required' });
      return;
    }
    
    const result = await knowledgeBaseService.bulkDeleteMaterials(materialIds, filter, userId);
    
    res.json(result);
  } catch (err) {
    logger.error(`Error in bulkDeleteMaterials: ${err}`);
    res.status(500).json({
      error: 'Failed to bulk delete materials',
      message: err instanceof Error ? err.message : String(err)
    });
  }
};

/**
 * Bulk export materials
 * 
 * @param req Request
 * @param res Response
 */
export const bulkExportMaterials = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filter, format, includeRelationships, includeVersions } = req.body;
    
    const exportOptions = {
      format: format || 'json',
      includeRelationships: includeRelationships === true,
      includeVersions: includeVersions === true
    };
    
    const result = await knowledgeBaseService.bulkExportMaterials(filter, exportOptions);
    
    if (exportOptions.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=materials-export.csv');
      res.send(result.data);
    } else {
      res.json(result);
    }
  } catch (err) {
    logger.error(`Error in bulkExportMaterials: ${err}`);
    res.status(500).json({
      error: 'Failed to export materials',
      message: err instanceof Error ? err.message : String(err)
    });
  }
};

/**
 * Create relationships in bulk
 * 
 * @param req Request
 * @param res Response
 */
export const bulkCreateRelationships = async (req: Request, res: Response): Promise<void> => {
  try {
    const { relationships } = req.body;
    const userId = req.user?.id; // From auth middleware
    
    if (!userId) {
      res.status(401).json({ error: 'User ID is required' });
      return;
    }
    
    if (!Array.isArray(relationships) || relationships.length === 0) {
      res.status(400).json({ error: 'Relationships array is required and cannot be empty' });
      return;
    }
    
    const result = await knowledgeBaseService.bulkCreateRelationships(relationships, userId);
    
    res.json(result);
  } catch (err) {
    logger.error(`Error in bulkCreateRelationships: ${err}`);
    res.status(500).json({
      error: 'Failed to create relationships in bulk',
      message: err instanceof Error ? err.message : String(err)
    });
  }
};

export const knowledgeBaseController = {
  searchMaterials,
  getCollections,
  createMaterialRevision,
  revertMaterialVersion,
  getMaterialVersionHistory,
  createSearchIndex,
  getSearchIndexes,
  rebuildSearchIndex,
  getKnowledgeBaseStats,
  bulkImportMaterials,
  bulkUpdateMaterials,
  bulkDeleteMaterials,
  bulkExportMaterials,
  bulkCreateRelationships
};

export default knowledgeBaseController;
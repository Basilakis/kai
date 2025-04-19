/**
 * Enhanced Vector Validation Utilities
 *
 * This file provides validation functions for enhanced vector operations,
 * ensuring request parameters and body data are properly validated before processing.
 */

import { Request } from 'express';
import { ApiError } from '../middleware/error.middleware';
import {
  SearchOptions,
  SimilarMaterialsOptions,
  EmbeddingGenerationOptions,
  QueryRoutingOptions,
  KnowledgeEntry
} from '../types/enhancedVector.types';

/**
 * Validate the Generate Embeddings request
 * @param req Express request object
 * @returns Validated data for embedding generation
 */
export function validateGenerateEmbeddingsRequest(req: Request): {
  text: string;
  options: EmbeddingGenerationOptions;
} {
  const { text, method, materialCategory } = req.body;

  if (!text || typeof text !== 'string') {
    throw new ApiError(400, 'Text is required and must be a string');
  }

  if (text.trim().length === 0) {
    throw new ApiError(400, 'Text cannot be empty');
  }

  const options: EmbeddingGenerationOptions = {};

  if (method) {
    if (method !== 'dense' && method !== 'sparse' && method !== 'hybrid') {
      throw new ApiError(400, 'Method must be "dense", "sparse", or "hybrid"');
    }
    options.method = method;
  }

  if (materialCategory) {
    if (typeof materialCategory !== 'string') {
      throw new ApiError(400, 'Material category must be a string');
    }
    options.materialCategory = materialCategory;
  }

  return { text, options };
}

/**
 * Validate the Store Embeddings request
 * @param req Express request object
 * @returns Validated material ID and text
 */
export function validateStoreEmbeddingsRequest(req: Request): {
  id: string;
  text: string;
} {
  const { id } = req.params;
  const { text } = req.body;

  if (!id || typeof id !== 'string') {
    throw new ApiError(400, 'Material ID is required and must be a string');
  }

  if (!text || typeof text !== 'string') {
    throw new ApiError(400, 'Text is required and must be a string');
  }

  if (text.trim().length === 0) {
    throw new ApiError(400, 'Text cannot be empty');
  }

  return { id, text };
}

/**
 * Validate and parse the Search Materials request
 * @param req Express request object
 * @returns Validated search options
 */
export function validateSearchMaterialsRequest(req: Request): SearchOptions {
  const { query, materialType, limit, threshold, denseWeight, useSpecializedIndex } = req.query;

  if (!query || typeof query !== 'string') {
    throw new ApiError(400, 'Query is required and must be a string');
  }

  if (query.trim().length === 0) {
    throw new ApiError(400, 'Query cannot be empty');
  }

  const options: SearchOptions = { query };

  if (materialType !== undefined) {
    if (typeof materialType !== 'string') {
      throw new ApiError(400, 'Material type must be a string');
    }
    options.materialType = materialType;
  }

  if (limit !== undefined) {
    const parsedLimit = parseInt(limit as string, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      throw new ApiError(400, 'Limit must be a positive integer');
    }
    options.limit = parsedLimit;
  }

  if (threshold !== undefined) {
    const parsedThreshold = parseFloat(threshold as string);
    if (isNaN(parsedThreshold) || parsedThreshold < 0 || parsedThreshold > 1) {
      throw new ApiError(400, 'Threshold must be a number between 0 and 1');
    }
    options.threshold = parsedThreshold;
  }

  if (denseWeight !== undefined) {
    const parsedDenseWeight = parseFloat(denseWeight as string);
    if (isNaN(parsedDenseWeight) || parsedDenseWeight < 0 || parsedDenseWeight > 1) {
      throw new ApiError(400, 'Dense weight must be a number between 0 and 1');
    }
    options.denseWeight = parsedDenseWeight;
  }

  if (useSpecializedIndex !== undefined) {
    options.useSpecializedIndex = useSpecializedIndex === 'true';
  }

  return options;
}

/**
 * Validate and parse the Find Similar Materials request
 * @param req Express request object
 * @returns Validated material ID and options
 */
export function validateFindSimilarMaterialsRequest(req: Request): {
  id: string;
  options: SimilarMaterialsOptions;
} {
  const { id } = req.params;
  const { limit, threshold, sameMaterialType, denseWeight } = req.query;

  if (!id || typeof id !== 'string') {
    throw new ApiError(400, 'Material ID is required and must be a string');
  }

  const options: SimilarMaterialsOptions = {};

  if (limit !== undefined) {
    const parsedLimit = parseInt(limit as string, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      throw new ApiError(400, 'Limit must be a positive integer');
    }
    options.limit = parsedLimit;
  }

  if (threshold !== undefined) {
    const parsedThreshold = parseFloat(threshold as string);
    if (isNaN(parsedThreshold) || parsedThreshold < 0 || parsedThreshold > 1) {
      throw new ApiError(400, 'Threshold must be a number between 0 and 1');
    }
    options.threshold = parsedThreshold;
  }

  if (sameMaterialType !== undefined) {
    options.sameMaterialType = sameMaterialType === 'true';
  }

  if (denseWeight !== undefined) {
    const parsedDenseWeight = parseFloat(denseWeight as string);
    if (isNaN(parsedDenseWeight) || parsedDenseWeight < 0 || parsedDenseWeight > 1) {
      throw new ApiError(400, 'Dense weight must be a number between 0 and 1');
    }
    options.denseWeight = parsedDenseWeight;
  }

  return { id, options };
}

/**
 * Validate and parse the Search Materials with Knowledge request
 * @param req Express request object
 * @returns Validated query, type, and options
 */
export function validateSearchWithKnowledgeRequest(req: Request): {
  query: string;
  materialType?: string;
  limit: number;
  includeKnowledge: boolean;
  includeRelationships: boolean;
} {
  const { query, materialType, limit, includeKnowledge, includeRelationships } = req.query;

  if (!query || typeof query !== 'string') {
    throw new ApiError(400, 'Query is required and must be a string');
  }

  if (query.trim().length === 0) {
    throw new ApiError(400, 'Query cannot be empty');
  }

  let parsedLimit = 10; // Default
  if (limit !== undefined) {
    parsedLimit = parseInt(limit as string, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      throw new ApiError(400, 'Limit must be a positive integer');
    }
  }

  let validMaterialType: string | undefined;
  if (materialType !== undefined) {
    if (typeof materialType !== 'string') {
      throw new ApiError(400, 'Material type must be a string');
    }
    validMaterialType = materialType;
  }

  const includeKnowledgeValue = includeKnowledge !== 'false';
  const includeRelationshipsValue = includeRelationships !== 'false';

  return {
    query,
    materialType: validMaterialType,
    limit: parsedLimit,
    includeKnowledge: includeKnowledgeValue,
    includeRelationships: includeRelationshipsValue,
  };
}

/**
 * Validate and parse the Find Similar Materials with Knowledge request
 * @param req Express request object
 * @returns Validated material ID, type, and options
 */
export function validateFindSimilarWithKnowledgeRequest(req: Request): {
  id: string;
  materialType?: string;
  limit: number;
  includeKnowledge: boolean;
} {
  const { id } = req.params;
  const { materialType, limit, includeKnowledge } = req.query;

  if (!id || typeof id !== 'string') {
    throw new ApiError(400, 'Material ID is required and must be a string');
  }

  let parsedLimit = 10; // Default
  if (limit !== undefined) {
    parsedLimit = parseInt(limit as string, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      throw new ApiError(400, 'Limit must be a positive integer');
    }
  }

  let validMaterialType: string | undefined;
  if (materialType !== undefined) {
    if (typeof materialType !== 'string') {
      throw new ApiError(400, 'Material type must be a string');
    }
    validMaterialType = materialType;
  }

  const includeKnowledgeValue = includeKnowledge !== 'false';

  return {
    id,
    materialType: validMaterialType,
    limit: parsedLimit,
    includeKnowledge: includeKnowledgeValue,
  };
}

/**
 * Validate the Route Query request
 * @param req Express request object
 * @returns Validated query routing options
 */
export function validateRouteQueryRequest(req: Request): QueryRoutingOptions {
  const { query, materialType, filters, strategy } = req.body;

  if (!query || typeof query !== 'string') {
    throw new ApiError(400, 'Query is required and must be a string');
  }

  if (query.trim().length === 0) {
    throw new ApiError(400, 'Query cannot be empty');
  }

  const options: QueryRoutingOptions = { query };

  if (materialType !== undefined) {
    if (typeof materialType !== 'string') {
      throw new ApiError(400, 'Material type must be a string');
    }
    options.materialType = materialType;
  }

  if (filters !== undefined) {
    if (typeof filters !== 'object' || filters === null) {
      throw new ApiError(400, 'Filters must be an object');
    }
    options.filters = filters;
  }

  if (strategy !== undefined) {
    if (strategy !== 'hybrid' && strategy !== 'vector_first' && strategy !== 'knowledge_first' && strategy !== 'balanced') {
      throw new ApiError(400, 'Strategy must be "hybrid", "vector_first", "knowledge_first", or "balanced"');
    }
    options.strategy = strategy;
  }

  return options;
}

/**
 * Validate the Get Material Knowledge request
 * @param req Express request object
 * @returns Validated material ID, query, and limit
 */
export function validateGetMaterialKnowledgeRequest(req: Request): {
  id: string;
  query?: string;
  limit: number;
} {
  const { id } = req.params;
  const { query, limit } = req.query;

  if (!id || typeof id !== 'string') {
    throw new ApiError(400, 'Material ID is required and must be a string');
  }

  let validQuery: string | undefined;
  if (query !== undefined) {
    if (typeof query !== 'string') {
      throw new ApiError(400, 'Query must be a string');
    }
    validQuery = query;
  }

  let parsedLimit = 5; // Default
  if (limit !== undefined) {
    parsedLimit = parseInt(limit as string, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      throw new ApiError(400, 'Limit must be a positive integer');
    }
  }

  return {
    id,
    query: validQuery,
    limit: parsedLimit,
  };
}

/**
 * Validate the Assemble Context request
 * @param req Express request object
 * @returns Validated materials, query, and user context
 */
export function validateAssembleContextRequest(req: Request): {
  materials: any[];
  query: string;
  userContext?: Record<string, any>;
} {
  const { materials, query, userContext } = req.body;

  if (!materials || !Array.isArray(materials) || materials.length === 0) {
    throw new ApiError(400, 'Materials array is required and cannot be empty');
  }

  if (!query || typeof query !== 'string') {
    throw new ApiError(400, 'Query is required and must be a string');
  }

  if (query.trim().length === 0) {
    throw new ApiError(400, 'Query cannot be empty');
  }

  let validUserContext: Record<string, any> | undefined;
  if (userContext !== undefined) {
    if (typeof userContext !== 'object' || userContext === null) {
      throw new ApiError(400, 'User context must be an object');
    }
    validUserContext = userContext;
  }

  return {
    materials,
    query,
    userContext: validUserContext,
  };
}

/**
 * Validate the Create Semantic Organization request
 * @param req Express request object
 * @returns Validated knowledge entries and query
 */
export function validateCreateSemanticOrganizationRequest(req: Request): {
  knowledgeEntries: KnowledgeEntry[];
  query: string;
} {
  const { knowledgeEntries, query } = req.body;

  if (!knowledgeEntries || !Array.isArray(knowledgeEntries) || knowledgeEntries.length === 0) {
    throw new ApiError(400, 'Knowledge entries array is required and cannot be empty');
  }

  if (!query || typeof query !== 'string') {
    throw new ApiError(400, 'Query is required and must be a string');
  }

  if (query.trim().length === 0) {
    throw new ApiError(400, 'Query cannot be empty');
  }

  // Validate each knowledge entry has the required properties
  for (const entry of knowledgeEntries) {
    if (!entry.id || typeof entry.id !== 'string') {
      throw new ApiError(400, 'Each knowledge entry must have a string ID');
    }
    if (!entry.materialId || typeof entry.materialId !== 'string') {
      throw new ApiError(400, 'Each knowledge entry must have a string materialId');
    }
    if (!entry.content || typeof entry.content !== 'string') {
      throw new ApiError(400, 'Each knowledge entry must have string content');
    }
    if (typeof entry.confidence !== 'number' || entry.confidence < 0 || entry.confidence > 1) {
      throw new ApiError(400, 'Each knowledge entry must have a confidence value between 0 and 1');
    }
    if (typeof entry.relevance !== 'number' || entry.relevance < 0 || entry.relevance > 1) {
      throw new ApiError(400, 'Each knowledge entry must have a relevance value between 0 and 1');
    }
  }

  return { knowledgeEntries, query };
}

/**
 * Validate the Compare Similarity request
 * @param req Express request object
 * @returns Validated text1 and text2
 */
export function validateCompareSimilarityRequest(req: Request): {
  text1: string;
  text2: string;
} {
  const { text1, text2 } = req.body;

  if (!text1 || typeof text1 !== 'string') {
    throw new ApiError(400, 'Text1 is required and must be a string');
  }

  if (text1.trim().length === 0) {
    throw new ApiError(400, 'Text1 cannot be empty');
  }

  if (!text2 || typeof text2 !== 'string') {
    throw new ApiError(400, 'Text2 is required and must be a string');
  }

  if (text2.trim().length === 0) {
    throw new ApiError(400, 'Text2 cannot be empty');
  }

  return { text1, text2 };
}

/**
 * Validate the Update Search Config request
 * @param req Express request object
 * @returns Validated config name and data
 */
export function validateUpdateSearchConfigRequest(req: Request): {
  name: string;
  configData: Record<string, any>;
} {
  const { name } = req.params;
  const configData = req.body;

  if (!name || typeof name !== 'string') {
    throw new ApiError(400, 'Configuration name is required and must be a string');
  }

  if (!configData || typeof configData !== 'object' || configData === null) {
    throw new ApiError(400, 'Configuration data is required and must be an object');
  }

  // Required fields for search config
  if (configData.denseWeight !== undefined) {
    if (typeof configData.denseWeight !== 'number' || configData.denseWeight < 0 || configData.denseWeight > 1) {
      throw new ApiError(400, 'Dense weight must be a number between 0 and 1');
    }
  }

  if (configData.indexType !== undefined) {
    if (typeof configData.indexType !== 'string') {
      throw new ApiError(400, 'Index type must be a string');
    }
  }

  if (configData.indexParameters !== undefined) {
    if (typeof configData.indexParameters !== 'object' || configData.indexParameters === null) {
      throw new ApiError(400, 'Index parameters must be an object');
    }
  }

  return { name, configData };
}

/**
 * Validate the Delete Search Config request
 * @param req Express request object
 * @returns Validated config name
 */
export function validateDeleteSearchConfigRequest(req: Request): { name: string } {
  const { name } = req.params;

  if (!name || typeof name !== 'string') {
    throw new ApiError(400, 'Configuration name is required and must be a string');
  }

  // Don't allow deleting the default config
  if (name === 'default') {
    throw new ApiError(400, 'Cannot delete the default configuration');
  }

  return { name };
}
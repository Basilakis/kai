/**
 * Unified Search Controller
 * 
 * This controller provides a single entry point for searching across all resource types.
 * It dispatches search requests to the appropriate service based on the resource type.
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { knowledgeBaseService } from '../services/knowledgeBase/knowledgeBaseService';
import searchIndexQueue from '../services/knowledgeBase/searchIndexQueue';
import queryUnderstandingService from '../services/search/query-understanding-service';

// Import other service dependencies as needed
// import modelsService from '...';
// import historyService from '...';

/**
 * Unified search across all resource types
 * 
 * @param req Request with resource type and search parameters
 * @param res Response with search results
 */
export const unifiedSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.query;
    if (!type) {
      res.status(400).json({
        error: 'Missing required parameter: type',
        message: 'Resource type must be specified'
      });
      return;
    }

    let results;
    const resourceType = type as string;

    // Enhance query using semantic understanding if query parameter is present
    let enhancedQuery = req.query.query as string;
    if (enhancedQuery) {
      try {
        const enhancedQueryResult = await queryUnderstandingService.enhanceQuery(
          enhancedQuery,
          {
            expandSynonyms: true,
            // Use only supported options
            domainContext: 'material'
          },
          { userId: req.user?.id }
        );
        
        // Update the query with the enhanced version
        enhancedQuery = enhancedQueryResult.enhancedQuery;
        
        // Add related terms as response metadata
        res.setHeader('X-Related-Terms', enhancedQueryResult.relatedTerms.join(','));
      } catch (err) {
        logger.warn(`Query enhancement failed, using original query: ${err}`);
        // Continue with original query if enhancement fails
      }
    }

    // Dispatch to appropriate service based on resource type
    switch (resourceType.toLowerCase()) {
      case 'material':
      case 'materials':
        // Convert query parameters to options expected by knowledgeBaseService
        const materialOptions = convertQueryToMaterialOptions(req.query);
        materialOptions.query = enhancedQuery; // Use enhanced query if available
        results = await knowledgeBaseService.searchMaterials(materialOptions);
        break;

      case 'collection':
      case 'collections':
        // Convert query parameters to options expected by knowledgeBaseService
        const collectionOptions = convertQueryToCollectionOptions(req.query);
        results = await knowledgeBaseService.getCollections(collectionOptions);
        break;

      case 'model':
      case 'models':
        // This would call the models service in a real implementation
        // results = await modelsService.searchModels(convertQueryToModelOptions(req.query));
        results = {
          data: [],
          message: 'Model search not implemented yet'
        };
        break;

      case 'history':
        // This would call the history service in a real implementation
        // results = await historyService.searchHistory(convertQueryToHistoryOptions(req.query));
        results = {
          data: [],
          message: 'History search not implemented yet'
        };
        break;

      case 'index':
      case 'indexes':
      case 'search-index':
      case 'search-indexes':
        const indexOptions = convertQueryToIndexOptions(req.query);
        results = await knowledgeBaseService.getSearchIndexes(indexOptions);
        break;

      case 'queue':
      case 'jobs':
        // Get queue jobs with filtering
        results = {
          data: await searchIndexQueue.getAll(),
          counts: await searchIndexQueue.getCounts()
        };
        break;

      default:
        res.status(400).json({
          error: 'Invalid resource type',
          message: `Resource type '${resourceType}' is not supported`
        });
        return;
    }

    res.json(results);
  } catch (err) {
    logger.error(`Error in unifiedSearch: ${err}`);
    
    // Use type-safe error handling without relying on ApiError
    const error = err as Error;
    const statusCode = (error as any).statusCode || 500;
    
    if (statusCode !== 500) {
      res.status(statusCode).json({
        error: error.name || 'SearchError',
        message: error.message
      });
    } else {
      res.status(500).json({
        error: 'SearchError',
        message: err instanceof Error ? err.message : String(err)
      });
    }
  }
};

/**
 * Convert generic query parameters to material search options
 */
function convertQueryToMaterialOptions(queryParams: any): any {
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
  } = queryParams;
  
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
  
  return {
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
    searchStrategy: searchStrategy as string
  };
}

/**
 * Convert generic query parameters to collection options
 */
function convertQueryToCollectionOptions(queryParams: any): any {
  const {
    parentId,
    includeEmpty,
    limit,
    skip,
    sort
  } = queryParams;
  
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
  
  return {
    parentId: parentId as string,
    includeEmpty: parsedIncludeEmpty,
    limit: parsedLimit,
    skip: parsedSkip,
    sort: parsedSort
  };
}

/**
 * Convert generic query parameters to index options
 */
function convertQueryToIndexOptions(queryParams: any): any {
  const {
    entityType,
    indexType,
    status,
    limit,
    skip
  } = queryParams;
  
  // Convert limit and skip to numbers
  const parsedLimit = limit ? parseInt(limit as string, 10) : undefined;
  const parsedSkip = skip ? parseInt(skip as string, 10) : undefined;
  
  return {
    entityType: entityType as string,
    indexType: indexType as string,
    status: status as string,
    limit: parsedLimit,
    skip: parsedSkip
  };
}

export const searchController = {
  unifiedSearch
};

export default searchController;
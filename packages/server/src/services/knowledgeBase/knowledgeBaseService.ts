/**
 * Knowledge Base Service
 * 
 * This service provides a unified interface for interacting with the knowledge base,
 * including materials, collections, metadata fields, and search capabilities.
 */

import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { logger } from '../../utils/logger';
import { messageBrokerFactory } from '../messaging/messageBrokerFactory';
import { entityLinkingService } from './entityLinking.service';

// Get broker instance
const broker = messageBrokerFactory.createBroker();
import { modelRouter } from '../ai/modelRouter';
import { 
  createMaterialRelationship,
  getMaterialRelationships,
  MaterialRelationshipType 
} from '../../models/materialRelationship.model';
import {
  NotFoundError,
  ExternalServiceError,
  IndexingError,
  ErrorHandler
} from './errors';

// Import models
import { MaterialType, findSimilarMaterials } from '../../models/material.model';
import { CollectionDocument } from '../../models/collection.model';
import { VersionDocument } from '../../models/version.model';
import SearchIndex, { SearchIndexDocument } from '../../models/searchIndex.model';
import { 
  createCollectionMembership
} from '../../models/collectionMembership.model';
import searchIndexQueue from './searchIndexQueue'; // Import the search index queue

/**
 * Knowledge Base Service
 * 
 * Provides unified APIs for managing the material knowledge base
 */
/**
 * Search strategy enum for material search
 */
enum SearchStrategy {
  TEXT = 'text',
  VECTOR = 'vector',
  METADATA = 'metadata',
  COMBINED = 'combined'
}

/**
 * Search options interface for material search
 */
interface MaterialSearchOptions {
  query?: string;
  materialType?: string | string[];
  collectionId?: string;
  seriesId?: string;
  tags?: string[];
  fields?: Record<string, any>;
  filter?: Record<string, any>;
  sort?: Record<string, 1 | -1>;
  limit?: number;
  skip?: number;
  includeVersions?: boolean;
  useVectorSearch?: boolean;
  searchStrategy?: SearchStrategy | string;
}

/**
 * Search pagination options
 */
interface SearchPaginationOptions {
  limit: number;
  skip: number;
  sort: Record<string, 1 | -1>;
  includeVersions: boolean;
}


/**
 * Search results interface for material search
 */
interface MaterialSearchResults {
  materials: MaterialType[];
  total: number;
  facets?: Record<string, any>;
}

export class KnowledgeBaseService {
  private static instance: KnowledgeBaseService;

  private constructor() {
    // Initialize service
    logger.info('Knowledge Base Service initialized');
  }

  /**
   * Get the Knowledge Base Service singleton instance
   * 
   * @returns Knowledge Base Service instance
   */
  public static getInstance(): KnowledgeBaseService {
    if (!KnowledgeBaseService.instance) {
      KnowledgeBaseService.instance = new KnowledgeBaseService();
    }
    return KnowledgeBaseService.instance;
  }

  /**
   * Search materials using multiple strategies
   * 
   * @param options Search options
   * @returns Search results
   */
  public async searchMaterials(options: MaterialSearchOptions): Promise<MaterialSearchResults> {
    try {
      const {
        query,
        materialType,
        limit = 10,
        skip = 0,
        useVectorSearch = false,
        searchStrategy = SearchStrategy.TEXT,
        includeVersions = false,
        sort = { updatedAt: -1 }
      } = options;

      // Create pagination options for reuse
      const paginationOptions: SearchPaginationOptions = {
        limit,
        skip,
        sort,
        includeVersions
      };

      // Determine which search strategy to use
      const effectiveStrategy = this.determineSearchStrategy(
        query, 
        useVectorSearch, 
        searchStrategy
      );

      // Execute the appropriate search strategy
      if (effectiveStrategy === SearchStrategy.VECTOR) {
        return this.vectorSearch({ 
          query: query || '', 
          materialType, 
          limit, 
          skip 
        });
      }

      // Standard search flow for non-vector searches
      return this.executeStandardSearch(
        options, 
        effectiveStrategy, 
        paginationOptions
      );
      
    } catch (err) {
      logger.error(`Failed to search materials: ${err}`);
      // Use the ErrorHandler to convert to appropriate error type
      throw ErrorHandler.handleError(err);
    }
  }

  /**
   * Determine which search strategy to use based on parameters
   * 
   * @param query Search query text
   * @param useVectorSearch Whether vector search was explicitly requested
   * @param requestedStrategy The requested search strategy
   * @returns The effective search strategy to use
   */
  private determineSearchStrategy(
    query?: string, 
    useVectorSearch = false, 
    requestedStrategy: SearchStrategy | string = SearchStrategy.TEXT
  ): SearchStrategy {
    // Vector search takes precedence if explicitly requested with a query
    if (useVectorSearch && query) {
      return SearchStrategy.VECTOR;
    }
    
    // Otherwise use the requested strategy (normalizing string to enum)
    return (requestedStrategy as SearchStrategy) || SearchStrategy.TEXT;
  }

  /**
   * Execute standard (non-vector) search
   * 
   * @param options Search options
   * @param strategy Search strategy to use
   * @param paginationOptions Pagination options
   * @returns Search results
   */
  private async executeStandardSearch(
    options: MaterialSearchOptions,
    strategy: SearchStrategy,
    paginationOptions: SearchPaginationOptions
  ): Promise<MaterialSearchResults> {
    // Build search filter based on criteria
    const searchFilter = this.buildSearchFilter(options, strategy);

    // Get the Material model
    const Material = mongoose.model('Material');

    // Execute the search with proper pagination and projection
    const { materials, total } = await this.executeSearch(
      Material, 
      searchFilter, 
      paginationOptions
    );

    // Calculate facets if metadata or combined search strategy is used
    let facets: Record<string, any> | undefined;
    if (
      strategy === SearchStrategy.METADATA || 
      strategy === SearchStrategy.COMBINED
    ) {
      facets = await this.calculateFacets(searchFilter);
    }

    return { materials, total, facets };
  }

  /**
   * Build search filter based on search criteria
   * 
   * @param options Search options
   * @param strategy The search strategy being used
   * @returns MongoDB query filter
   */
  private buildSearchFilter(
    options: MaterialSearchOptions, 
    strategy: SearchStrategy = SearchStrategy.TEXT
  ): Record<string, any> {
    const {
      query,
      materialType,
      collectionId,
      seriesId,
      tags,
      fields,
      filter = {}
    } = options;

    // Start with the base filter
    const searchFilter: Record<string, any> = { ...filter };

    // Apply text search based on strategy
    if (query) {
      if (strategy === SearchStrategy.TEXT || strategy === SearchStrategy.COMBINED) {
        // Use MongoDB text index search for better performance
        searchFilter.$text = { $search: query };
      } else {
        // Fallback to regex search when text index is not preferred or available
        searchFilter.$or = [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ];
      }
    }

    // Apply materialType filter (support both single and array)
    if (materialType) {
      searchFilter.materialType = Array.isArray(materialType)
        ? { $in: materialType }
        : materialType;
    }

    // Apply collection filter
    if (collectionId) {
      searchFilter.collectionId = collectionId;
    }

    // Apply series filter
    if (seriesId) {
      searchFilter.seriesId = seriesId;
    }

    // Apply tags filter (all tags must match)
    if (tags && tags.length > 0) {
      searchFilter.tags = { $all: tags };
    }

    // Apply additional field filters
    if (fields) {
      Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchFilter[key] = value;
        }
      });
    }

    return searchFilter;
  }

  /**
   * Execute the search query with pagination and projection
   * 
   * @param Model The Mongoose model to query
   * @param filter MongoDB query filter
   * @param options Pagination and projection options
   * @returns Search results
   */
  private async executeSearch(
    Model: any,
    filter: Record<string, any>,
    options: {
      limit: number;
      skip: number;
      sort: Record<string, 1 | -1>;
      includeVersions: boolean;
    }
  ): Promise<{ materials: MaterialType[]; total: number }> {
    const { limit, skip, sort, includeVersions } = options;

    // Determine projection (whether to include version history)
    const projection = includeVersions ? {} : { versions: 0 };

    // Execute query with pagination
    const materials = await Model.find(filter, projection)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const total = await Model.countDocuments(filter);

    return { materials, total };
  }

  /**
   * Search materials using vector similarity
   * 
   * @param options Search options
   * @returns Similar materials
   */
  private async vectorSearch(options: {
    query: string;
    materialType?: string | string[];
    threshold?: number;
    limit?: number;
    skip?: number;
  }): Promise<{
    materials: MaterialType[];
    total: number;
  }> {
    try {
      const {
        query,
        materialType,
        threshold = 0.7,
        limit = 10,
        skip = 0
      } = options;

      // Convert query to vector embedding
      // In a real implementation, this would call an embeddings API
      const queryVector = await this.generateQueryEmbedding(query);

      // Use the existing similar materials function
      const similarMaterials = await findSimilarMaterials(
        queryVector,
        {
          threshold,
          materialType,
          limit: limit + skip
        }
      );

      // Apply pagination
      const paginatedResults = similarMaterials.slice(skip, skip + limit);

      return {
        materials: paginatedResults.map(result => result.material),
        total: similarMaterials.length
      };
    } catch (err) {
      logger.error(`Failed to perform vector search: ${err}`);
      throw new Error(`Failed to perform vector search: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Generate a vector embedding for a query string
   * 
   * @param query Query string
   * @returns Vector embedding
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      logger.debug(`Generating embedding for query: "${query}"`);
      // Route the request through the ModelRouter
      const embeddingResult = await modelRouter.routeEmbeddingGeneration(query, {
        taskType: 'embedding', // Specify task type
        encoderType: 'text'     // Specify encoder type
      });
      
      logger.debug(`Embedding generated successfully for query: "${query}"`);
      return embeddingResult.result; // Return the embedding vector
    } catch (err) {
      logger.error(`Failed to generate query embedding via ModelRouter: ${err}`);
      // Use specialized external service error
      throw new ExternalServiceError(
        'ModelRouter', 
        'generateEmbedding', 
        err instanceof Error ? err : new Error(String(err)),
        { query }
      );
    }
  }

  /**
   * Calculate facets for a search query
   * 
   * @param filter Search filter
   * @returns Facet values
   */
  private async calculateFacets(filter: Record<string, any>): Promise<Record<string, any>> {
    try {
      // Get the Material model
      const Material = mongoose.model('Material');

      // Perform facet aggregation
      const facetAggregation = await Material.aggregate([
        { $match: filter },
        {
          $facet: {
            materialTypes: [
              { $group: { _id: '$materialType', count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ],
            manufacturers: [
              { $group: { _id: '$manufacturer', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 20 }
            ],
            colors: [
              { $group: { _id: '$color.name', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 20 }
            ],
            finishes: [
              { $group: { _id: '$finish', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 20 }
            ],
            tags: [
              { $unwind: '$tags' },
              { $group: { _id: '$tags', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 30 }
            ]
          }
        }
      ]);

      return facetAggregation[0];
    } catch (err) {
      logger.error(`Failed to calculate facets: ${err}`);
      return {};
    }
  }

  /**
   * Get collections with their materials count using an efficient aggregation pipeline.
   * 
   * @param options Query options
   * @returns Collections with count
   */
  public async getCollections(options: {
    parentId?: string;
    includeEmpty?: boolean;
    limit?: number;
    skip?: number;
    sort?: Record<string, 1 | -1>;
  }): Promise<{
    collections: Array<CollectionDocument & { materialCount: number }>;
    total: number;
  }> {
    try {
      const {
        parentId,
        includeEmpty = false,
        limit = 20,
        skip = 0,
        sort = { name: 1 }
      } = options;

      // Get Mongoose models
      const Collection = mongoose.model('Collection');
      const Material = mongoose.model('Material'); // Needed for lookup

      // Base filter for collections
      const matchFilter: Record<string, any> = {};
      if (parentId) {
        matchFilter.parentId = parentId;
      } else {
        matchFilter.parentId = { $exists: false }; // Top-level collections
      }

      // Define base aggregation pipeline stages (before filtering empty and pagination)
      const basePipeline: any[] = [
        { $match: matchFilter }, // Filter collections first
        {
          $lookup: { // Join with materials to count them
            from: Material.collection.name, // Use actual collection name from model
            localField: 'id', // Assuming 'id' is the field in Collection model
            foreignField: 'collectionId', // Assuming 'collectionId' is the field in Material model
            as: 'materials'
          }
        },
        {
          $addFields: { // Calculate materialCount
            materialCount: { $size: '$materials' }
          }
        },
        { $project: { materials: 0 } } // Remove the joined materials array
      ];

      // Define pipeline for counting total matching collections (respecting includeEmpty)
      const countPipeline: any[] = [...basePipeline];
      if (!includeEmpty) {
        // Apply the empty filter *before* counting
        countPipeline.push({ $match: { materialCount: { $gt: 0 } } });
      }
      countPipeline.push({ $count: 'total' });

      // Define pipeline for fetching paginated results
      const resultsPipeline: any[] = [...basePipeline];
      if (!includeEmpty) {
        // Apply the empty filter before pagination
        resultsPipeline.push({ $match: { materialCount: { $gt: 0 } } });
      }
      // Apply sorting, skipping, limiting
      resultsPipeline.push({ $sort: sort });
      resultsPipeline.push({ $skip: skip });
      resultsPipeline.push({ $limit: limit });

      // Execute both pipelines (count and results)
      // Using $facet might be slightly more efficient if DB supports it well,
      // but running two separate aggregations is often clearer.
      const [totalResult, collectionsWithCount] = await Promise.all([
        Collection.aggregate(countPipeline),
        Collection.aggregate(resultsPipeline)
      ]);

      const total = totalResult.length > 0 ? totalResult[0].total : 0;

      // Ensure the result type matches the expected return type
      // Mongoose aggregate returns plain objects, not full documents by default
      // If full document methods are needed later, consider hydrating the results
      const typedCollections = collectionsWithCount as Array<CollectionDocument & { materialCount: number }>;

      return {
        collections: typedCollections,
        total
      };
    } catch (err) {
      logger.error(`Failed to get collections: ${err}`);
      // Ensure error message is a string
      const errorMessage = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to get collections: ${errorMessage}`);
    }
  }

  /**
   * Create a material revision and track changes
   * 
   * @param materialId Material ID
   * @param updateData Update data
   * @param userId User ID
   * @returns Updated material document
   */
  public async createMaterialRevision(
    materialId: string,
    updateData: Partial<MaterialType>,
    userId: string
  ): Promise<MaterialType> {
    try {
      // Get the Material model
      const Material = mongoose.model('Material');
      const Version = mongoose.model('Version');
      
      // Find current material
      const currentMaterial = await Material.findOne({ id: materialId });
      if (!currentMaterial) {
        throw new Error(`Material not found: ${materialId}`);
      }
      
      // Create version record
      const versionId = uuidv4();
      const version = new Version({
        id: versionId,
        entityId: materialId,
        entityType: 'material',
        previousData: currentMaterial.toObject(),
        createdBy: userId,
        changeDescription: updateData.metadata?.changeDescription || 'Material updated'
      });
      
      await version.save();
      
      // Update material and add version reference
      const updatedMaterial = await Material.findOneAndUpdate(
        { id: materialId },
        { 
          ...updateData,
          updatedAt: new Date(),
          $push: { 
            versions: {
              versionId,
              createdAt: new Date(),
              createdBy: userId
            }
          }
        },
        { new: true }
      );
      
      // Update search indexes
      await this.updateSearchIndexes('material', materialId);
      
      return updatedMaterial as MaterialType;
    } catch (err) {
      logger.error(`Failed to create material revision: ${err}`);
      throw new Error(`Failed to create material revision: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Revert a material to a previous version
   * 
   * @param materialId Material ID
   * @param versionId Version ID to revert to
   * @param userId User ID
   * @returns Reverted material document
   */
  public async revertMaterialVersion(
    materialId: string,
    versionId: string,
    userId: string
  ): Promise<MaterialType> {
    try {
      // Get the Material and Version models
      const Material = mongoose.model('Material');
      const Version = mongoose.model('Version');
      
      // Find version to revert to
      const version = await Version.findOne({ id: versionId, entityId: materialId });
      if (!version) {
        throw new NotFoundError('Version', versionId, { materialId });
      }
      
      // Find current material
      const currentMaterial = await Material.findOne({ id: materialId });
      if (!currentMaterial) {
        throw new NotFoundError('Material', materialId);
      }
      
      // Create new version record for the revert operation
      const newVersionId = uuidv4();
      const newVersion = new Version({
        id: newVersionId,
        entityId: materialId,
        entityType: 'material',
        previousData: currentMaterial.toObject(),
        createdBy: userId,
        changeDescription: `Reverted to version ${versionId}`
      });
      
      await newVersion.save();
      
      // Extract previous data, but preserve certain fields
      const previousData = version.previousData as Record<string, any>;
      
      // Update material and add version reference
      const updatedMaterial = await Material.findOneAndUpdate(
        { id: materialId },
        { 
          ...previousData,
          updatedAt: new Date(),
          $push: { 
            versions: {
              versionId: newVersionId,
              createdAt: new Date(),
              createdBy: userId
            }
          }
        },
        { new: true }
      );
      
      // Update search indexes
      await this.updateSearchIndexes('material', materialId);
      
      return updatedMaterial as MaterialType;
    } catch (err) {
      logger.error(`Failed to revert material version: ${err}`);
      // Use error handler to create appropriate error
      throw ErrorHandler.handleError(err);
    }
  }

  /**
   * Get material version history
   * 
   * @param materialId Material ID
   * @returns Array of versions
   */
  public async getMaterialVersionHistory(materialId: string): Promise<VersionDocument[]> {
    try {
      // Get the Version model
      const Version = mongoose.model('Version');
      
      // Find all versions for this material
      const versions = await Version.find({ 
        entityId: materialId,
        entityType: 'material'
      }).sort({ createdAt: -1 });
      
      return versions as VersionDocument[];
    } catch (err) {
      logger.error(`Failed to get material version history: ${err}`);
      throw new Error(`Failed to get material version history: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Update search indexes for an entity
   * 
   * @param entityType Entity type
   * @param entityId Entity ID
   */
  private async updateSearchIndexes(entityType: string, entityId: string): Promise<void> {
    try {
      // Get indexes for this entity type
      const indexes = await SearchIndex.find({ 
        entityType,
        status: 'ready'
      });
      
      if (indexes.length === 0) {
        return;
      }
      
      // Add update job to the queue for each index
      for (const index of indexes) {
        // Mark index as updating
        await SearchIndex.updateOne(
          { id: index.id },
          { 
            status: 'updating',
            lastUpdateTime: new Date()
          }
        );
        
        // Add job to update queue
        try {
          const jobId = await searchIndexQueue.addUpdateJob(
            index.id,
            entityType,
            entityId,
            { priority: 'normal' }
          );
          
          logger.info(`Added index update job to queue: ${index.id} for ${entityType}/${entityId} (Job ID: ${jobId})`);
        } catch (queueErr) {
          logger.error(`Failed to queue index update job: ${queueErr}`);
          // If queue fails, mark index back as ready
          await SearchIndex.updateOne(
            { id: index.id },
            { status: 'ready' }
          );
        }
      }
    } catch (err) {
      logger.error(`Failed to update search indexes: ${err}`);
    }
  }

  /**
   * Create a new search index
   * 
   * @param indexData Search index data
   * @returns Created search index
   */
  public async createSearchIndex(indexData: Partial<SearchIndexDocument>): Promise<SearchIndexDocument> {
    try {
      // Create the search index
      const searchIndex = await SearchIndex.create({
        ...indexData,
        status: 'building', // Start in building status
        createdAt: new Date(),
        lastUpdateTime: new Date(),
        documentCount: 0
      });
      
      // Queue a job to build the index in the background
      try {
        const jobId = await searchIndexQueue.addCreateJob(
          {
            ...indexData,
            id: searchIndex.id
          },
          { priority: 'normal' }
        );
        
        logger.info(`Added create index job to queue: ${searchIndex.name} (Job ID: ${jobId})`);
      } catch (queueErr) {
        logger.error(`Failed to queue index creation job: ${queueErr}`);
        // If queue fails, mark index as ready but empty
        await SearchIndex.updateOne(
          { id: searchIndex.id },
          { status: 'ready' }
        );
      }
      
      return searchIndex;
    } catch (err) {
      logger.error(`Failed to create search index: ${err}`);
      throw new Error(`Failed to create search index: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get search indexes
   * 
   * @param options Query options
   * @returns Array of search indexes
   */
  public async getSearchIndexes(options: {
    entityType?: string;
    indexType?: string;
    status?: string;
    limit?: number;
    skip?: number;
  } = {}): Promise<{
    indexes: SearchIndexDocument[];
    total: number;
  }> {
    try {
      const {
        entityType,
        indexType,
        status,
        limit = 10,
        skip = 0
      } = options;
      
      // Build query
      const filter: Record<string, any> = {};
      
      if (entityType) {
        filter.entityType = entityType;
      }
      
      if (indexType) {
        filter.indexType = indexType;
      }
      
      if (status) {
        filter.status = status;
      }
      
      // Get indexes
      const indexes = await SearchIndex.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit);
      
      const total = await SearchIndex.countDocuments(filter);
      
      return { indexes, total };
    } catch (err) {
      logger.error(`Failed to get search indexes: ${err}`);
      throw new Error(`Failed to get search indexes: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Rebuild a search index
   * 
   * @param indexId Search index ID
   * @returns Rebuilt search index
   */
  public async rebuildSearchIndex(indexId: string): Promise<SearchIndexDocument> {
    try {
      const index = await SearchIndex.findOne({ id: indexId });
      if (!index) {
        throw new NotFoundError('SearchIndex', indexId);
      }
      
      // Mark index as updating
      await SearchIndex.updateOne(
        { id: indexId },
        { 
          status: 'updating',
          lastUpdateTime: new Date()
        }
      );
      
      // Queue the rebuild job in the background
      try {
        const jobId = await searchIndexQueue.addRebuildJob(
          indexId,
          { priority: 'high' } // Rebuilds are higher priority
        );
        
        logger.info(`Added index rebuild job to queue: ${indexId} (Job ID: ${jobId})`);
        
        // Return the updated index status
        const updatedIndex = await SearchIndex.findOne({ id: indexId });
        if (!updatedIndex) {
          throw new NotFoundError('SearchIndex', indexId, { stage: 'post-update-check' });
        }
        return updatedIndex;
      } catch (queueErr) {
        // If queue fails, revert the index status to ready
        logger.error(`Failed to queue index rebuild job: ${queueErr}`);
        await SearchIndex.updateOne(
          { id: indexId },
          { status: 'ready' }
        );
        throw new IndexingError(
          `Failed to queue index rebuild job`, 
          indexId, 
          'rebuild',
          { originalError: queueErr instanceof Error ? queueErr.message : String(queueErr) }
        );
      }
    } catch (err) {
      logger.error(`Failed to rebuild search index: ${err}`);
      // Use the error handler to convert to appropriate error type
      throw ErrorHandler.handleError(err);
    }
  }


  /**
   * Send real-time notification about knowledge base changes
   * 
   * @param eventType Event type
   * @param data Event data
   */
  private async sendKnowledgeBaseEvent(
    eventType: 'material-created' | 'material-updated' | 'material-deleted' | 
              'collection-created' | 'collection-updated' | 'collection-deleted' |
              'relationship-created' | 'relationship-updated' | 'relationship-deleted',
    data: any
  ): Promise<void> {
    try {
      await broker.publish('system', 'knowledge-base-event', {
        type: eventType,
        data,
        timestamp: Date.now()
      });
      
      logger.debug(`Sent knowledge base event: ${eventType}`);
    } catch (err) {
      logger.error(`Failed to send knowledge base event: ${err}`);
      // Don't throw - this should not break the main operation
    }
  }

  /**
   * Bulk import materials
   * 
   * @param materials Materials to import
   * @param userId User ID
   * @param options Import options
   * @returns Import results
   */
  public async bulkImportMaterials(
    materials: Array<Partial<MaterialType>>,
    userId: string,
    options: {
      updateExisting?: boolean;
      detectDuplicates?: boolean;
      validateSchema?: boolean;
      collectionId?: string;
      batchSize?: number;
    } = {}
  ): Promise<{
    imported: number;
    updated: number;
    failed: number;
    errors: Array<{ index: number; error: string }>;
    materialIds: string[];
  }> {
    try {
      const {
        updateExisting = false,
        detectDuplicates = true,
        collectionId,
        batchSize = 100 // Default batch size
      } = options;
      
      // Get the Material model
      const Material = mongoose.model('Material');
      
      // Initialize results
      const results = {
        imported: 0,
        updated: 0,
        failed: 0,
        errors: [] as Array<{ index: number; error: string }>,
        materialIds: [] as string[]
      };
      
      // Validate materials first
      const validMaterials: Array<{index: number; data: Partial<MaterialType>}> = [];
      const invalidMaterials: Array<{index: number; error: string}> = [];
      
      // Initial validation pass
      for (let i = 0; i < materials.length; i++) {
        const materialData = materials[i];
        
        // Add explicit check for undefined to satisfy linter
        if (!materialData) {
          invalidMaterials.push({ 
            index: i, 
            error: 'Material data is undefined' 
          });
          continue; 
        }
        
        // Validate material has a name
        if (!materialData.name) {
          invalidMaterials.push({ 
            index: i, 
            error: 'Material name is required' 
          });
          continue;
        }
        
        // Add required fields, ensuring materialData is defined
        materialData.id = materialData.id || uuidv4();
        materialData.createdBy = materialData.createdBy || userId;
        materialData.updatedAt = new Date();
        
        // Add to collection if specified
        if (collectionId) {
          materialData.collectionId = collectionId;
        }
        
        // Add to valid materials
        validMaterials.push({ index: i, data: materialData });
      }
      
      // Record invalid materials
      for (const invalid of invalidMaterials) {
        results.failed++;
        results.errors.push(invalid);
      }
      
      // Process valid materials in batches
      for (let i = 0; i < validMaterials.length; i += batchSize) {
        const batch = validMaterials.slice(i, i + batchSize);
        
        try {
          // Step 1: Check for duplicates if needed (get all potentially duplicate materials)
          let existingMaterials: Record<string, MaterialType> = {};
          
          if (detectDuplicates) {
            const ids = batch.map(item => item.data.id).filter(Boolean);
            const names = batch.map(item => item.data.name).filter(Boolean);
            
            const query: any = { $or: [] };
            if (ids.length > 0) {
              query.$or.push({ id: { $in: ids } });
            }
            if (names.length > 0) {
              query.$or.push({ name: { $in: names } });
            }
            
            if (query.$or.length > 0) {
              const existingDocs = await Material.find(query);
              
              // Create lookup maps for fast access
              existingMaterials = existingDocs.reduce((acc: Record<string, MaterialType>, doc: MaterialType) => {
                acc[doc.id] = doc;
                acc[doc.name] = doc;
                return acc;
              }, {});
            }
          }
          
          // Step 2: Prepare bulk operations
          interface BulkWriteOperation {
            updateOne?: {
              filter: Record<string, any>;
              update: Record<string, any>;
            };
            insertOne?: {
              document: Record<string, any>;
            };
          }
          
          const bulkOperations: BulkWriteOperation[] = [];
          const batchSuccess: Array<{
            index: number;
            id: string;
            isNew: boolean;
            name: string;
            collectionId?: string;
            description?: string;
          }> = [];
          const batchErrors: Array<{index: number; error: string}> = [];
          
          // Process each material in the batch
          for (const item of batch) {
            const { index, data } = item;
            
            try {
              // Check for duplicate
              const existingByName = existingMaterials[data.name as string];
              const existingById = data.id ? existingMaterials[data.id] : undefined;
              const existingMaterial = existingById || existingByName;
              
              if (existingMaterial) {
                if (updateExisting) {
                  // Prepare update operation
                  bulkOperations.push({
                    updateOne: {
                      filter: { id: existingMaterial.id },
                      update: { 
                        $set: {
                          ...data,
                          createdAt: (existingMaterial as any).createdAt,
                          createdBy: existingMaterial.createdBy,
                          updatedAt: new Date()
                        }
                      }
                    }
                  });
                  
                  batchSuccess.push({
                    index,
                    id: existingMaterial.id,
                    isNew: false,
                    name: data.name as string,
                    collectionId: data.collectionId,
                    description: data.description
                  });
                } else {
                  // Record as error
                  batchErrors.push({
                    index,
                    error: `Duplicate material found: ${data.name}`
                  });
                }
              } else {
                // Prepare insert operation
                bulkOperations.push({
                  insertOne: {
                    document: {
                      ...data,
                      createdAt: new Date()
                    }
                  }
                });
                
                batchSuccess.push({
                  index,
                  id: data.id as string,
                  isNew: true,
                  name: data.name as string,
                  collectionId: data.collectionId,
                  description: data.description
                });
              }
            } catch (err) {
              batchErrors.push({
                index,
                error: err instanceof Error ? err.message : String(err)
              });
            }
          }
          
          // Step 3: Execute bulk operation if there are operations
          if (bulkOperations.length > 0) {
            await Material.bulkWrite(bulkOperations, { ordered: false });
          }
          
          // Step 4: Process collection memberships in batch (if needed)
          if (collectionId) {
            const membershipOperations = batchSuccess
              .filter(item => item.isNew && item.collectionId && item.collectionId !== collectionId)
              .map(item => ({
                materialId: item.id,
                collectionId,
                addedBy: userId
              }));
            
            if (membershipOperations.length > 0) {
              // Create memberships in batch (if method supports it)
              // Otherwise, can fall back to individual creation
              for (const membership of membershipOperations) {
                await createCollectionMembership(membership);
              }
            }
          }
          
          // Step 5: Process entity linking in batch if possible (or sequentially)
          // Since entity linking might have dependencies, process sequentially for now
          for (const item of batchSuccess) {
            if (item.description) {
              try {
                await entityLinkingService.linkEntitiesInDescription(
                  item.id,
                  item.description,
                  { 
                    linkMaterials: true,
                    linkCollections: true,
                    createRelationships: true,
                    userId
                  }
                );
              } catch (err) {
                logger.warn(`Entity linking failed for material ${item.id}: ${err}`);
                // Don't fail the entire import for entity linking issues
              }
            }
          }
          
          // Step 6: Send notifications in batch when possible
          // Prepare events for newly created materials
          const createdEvents = batchSuccess
            .filter(item => item.isNew)
            .map(item => ({
              type: 'material-created' as const,
              data: {
                materialId: item.id,
                name: item.name,
                collectionId: item.collectionId
              }
            }));
          
          // Prepare events for updated materials
          const updatedEvents = batchSuccess
            .filter(item => !item.isNew)
            .map(item => ({
              type: 'material-updated' as const,
              data: {
                materialId: item.id,
                name: item.name
              }
            }));
          
          // Send events in batches if a batch method is available
          // Otherwise fall back to individual notifications
          for (const event of [...createdEvents, ...updatedEvents]) {
            try {
              await this.sendKnowledgeBaseEvent(
                event.type,
                event.data
              );
            } catch (err) {
              logger.warn(`Failed to send event for material ${event.data.materialId}: ${err}`);
              // Don't fail the entire import for notification issues
            }
          }
          
          // Step 7: Update results
          for (const item of batchSuccess) {
            if (item.isNew) {
              results.imported++;
            } else {
              results.updated++;
            }
            results.materialIds.push(item.id);
          }
          
          for (const error of batchErrors) {
            results.failed++;
            results.errors.push(error);
          }
          
        } catch (batchErr) {
          // Handle batch-level errors
          logger.error(`Batch processing error: ${batchErr}`);
          
          // Record all materials in this batch as failed
          for (const item of batch) {
            results.failed++;
            results.errors.push({
              index: item.index,
              error: `Batch processing error: ${batchErr instanceof Error ? batchErr.message : String(batchErr)}`
            });
          }
        }
      }
      
      return results;
    } catch (err) {
      logger.error(`Failed to bulk import materials: ${err}`);
      throw ErrorHandler.handleError(err);
    }
  }

  /**
   * Bulk update materials
   * 
   * @param updates Update data
   * @param filter Filter
   * @param userId User ID
   * @returns Update results
   */
  public async bulkUpdateMaterials(
    updates: Partial<MaterialType>,
    filter: Record<string, any>,
    userId: string
  ): Promise<{
    matched: number;
    updated: number;
    materialIds: string[];
  }> {
    try {
      // Get the Material model
      const Material = mongoose.model('Material');
      
      // Find matching materials
      const matchingMaterials = await Material.find(filter, { id: 1 });
      // Add explicit type to map parameter
      const materialIds = matchingMaterials.map((m: MaterialType) => m.id);
      
      // Skip if no materials match
      if (materialIds.length === 0) {
        return { matched: 0, updated: 0, materialIds: [] };
      }
      
      // Prepare update data
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      
      // Apply update
      const result = await Material.updateMany(
        { id: { $in: materialIds } },
        { $set: updateData }
      );
      
      // Send real-time notifications for each updated material
      for (const materialId of materialIds) {
        await this.sendKnowledgeBaseEvent('material-updated', {
          materialId,
          updates: Object.keys(updates)
        });
      }
      
      // Process entity linking if description is updated
      if (updates.description) {
        for (const materialId of materialIds) {
          await entityLinkingService.linkEntitiesInDescription(
            materialId,
            updates.description,
            { 
              linkMaterials: true,
              linkCollections: true,
              createRelationships: true,
              userId
            }
          );
        }
      }
      
      return { 
        matched: result.matchedCount || 0,
        updated: result.modifiedCount || 0,
        materialIds
      };
    } catch (err) {
      logger.error(`Failed to bulk update materials: ${err}`);
      throw new Error(`Failed to bulk update materials: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Bulk delete materials
   * 
   * @param materialIds Material IDs
   * @param filter Filter
   * @param userId User ID
   * @returns Delete results
   */
  public async bulkDeleteMaterials(
    materialIds?: string[],
    filter?: Record<string, any>
  ): Promise<{
    deleted: number;
    materialIds: string[];
  }> {
    try {
      // Get the Material model
      const Material = mongoose.model('Material');
      
      let idsToDelete: string[] = [];
      
      // Determine which materials to delete
      if (materialIds && materialIds.length > 0) {
        idsToDelete = materialIds;
      } else if (filter) {
        const matchingMaterials = await Material.find(filter, { id: 1 });
        // Add explicit type to map parameter
        idsToDelete = matchingMaterials.map((m: MaterialType) => m.id);
      } else {
        throw new Error('Either materialIds or filter must be provided');
      }
      
      // Skip if no materials match
      if (idsToDelete.length === 0) {
        return { deleted: 0, materialIds: [] };
      }
      
      // Delete materials
      const result = await Material.deleteMany({ id: { $in: idsToDelete } });
      
      // Send real-time notifications for each deleted material
      for (const materialId of idsToDelete) {
        await this.sendKnowledgeBaseEvent('material-deleted', {
          materialId
        });
      }
      
      return { 
        deleted: result.deletedCount || 0,
        materialIds: idsToDelete
      };
    } catch (err) {
      logger.error(`Failed to bulk delete materials: ${err}`);
      throw new Error(`Failed to bulk delete materials: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Bulk export materials
   * 
   * @param filter Filter
   * @param options Export options
   * @returns Export results
   */
  public async bulkExportMaterials(
    filter: Record<string, any>,
    options: {
      format?: 'json' | 'csv';
      includeRelationships?: boolean;
      includeVersions?: boolean;
    } = {}
  ): Promise<{
    count: number;
    data: any;
    error?: string; // Optional error property for fallback scenarios
  }> {
    try {
      const {
        format = 'json',
        includeRelationships = false,
        includeVersions = false
      } = options;
      
      // Get the Material model
      const Material = mongoose.model('Material');
      
      // Get materials
      const projection = includeVersions ? {} : { versions: 0 };
      const materials = await Material.find(filter, projection);
      
      // Get relationships if requested
      let materialsWithRelationships = materials;
      
      if (includeRelationships) {
        materialsWithRelationships = await Promise.all(
          // Add explicit type to map parameter
          materials.map(async (material: MaterialType) => {
            const materialObj = (material as any).toObject();
            const relationships = await getMaterialRelationships(material.id);
            return {
              ...materialObj,
              relationships
            };
          })
        );
      }
      
      // Convert to CSV if requested
      if (format === 'csv') {
        try {
          // Sanitize and flatten the material data
          const sanitizedMaterials = materialsWithRelationships.map((material: any) => {
            const sanitized: Record<string, any> = {};
            
            // Process each field
            Object.entries(material).forEach(([key, value]) => {
              if (value === undefined) return;
              
              if (typeof value === 'object' && value !== null) {
                try {
                  if (Array.isArray(value) && value.every(item => typeof item !== 'object')) {
                    sanitized[key] = value.join('; ');
                  } else {
                    sanitized[key] = JSON.stringify(value);
                  }
                } catch (e) {
                  sanitized[key] = '[Complex Object]';
                }
              } else {
                sanitized[key] = value;
              }
            });
            
            return sanitized;
          });
          
          // Generate CSV using native JavaScript
          if (sanitizedMaterials.length === 0) {
            return {
              count: 0,
              data: ''
            };
          }
          
          // Get headers from the first object
          const headers = Object.keys(sanitizedMaterials[0]);
          
          // Helper function to properly escape and quote CSV values
          const escapeCsvValue = (val: any): string => {
            const stringVal = String(val ?? '');
            // If value contains commas, quotes, or newlines, it needs quoting
            if (/[",\n\r]/.test(stringVal)) {
              // Escape quotes by doubling them
              return `"${stringVal.replace(/"/g, '""')}"`;
            }
            return stringVal;
          };
          
          // Create CSV header row
          const headerRow = headers.map(escapeCsvValue).join(',');
          
          // Create data rows
          const rows = sanitizedMaterials.map((obj: Record<string, any>) => {
            return headers.map(header => {
              const value = obj[header];
              return escapeCsvValue(value);
            }).join(',');
          });
          
          // Combine header and rows
          const csvData = [headerRow, ...rows].join('\n');
          
          return {
            count: materials.length,
            data: csvData
          };
        } catch (err) {
          // Log error but don't fail the export - fall back to JSON
          logger.error(`Failed to convert materials to CSV: ${err}`);
          return {
            count: materials.length,
            data: materialsWithRelationships,
            error: 'CSV conversion failed, returning JSON data'
          };
        }
      }
      
      return {
        count: materials.length,
        data: materialsWithRelationships
      };
    } catch (err) {
      logger.error(`Failed to bulk export materials: ${err}`);
      throw new Error(`Failed to bulk export materials: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Bulk create material relationships
   * 
   * @param relationships Relationships to create
   * @param userId User ID
   * @returns Creation results
   */
  public async bulkCreateRelationships(
    relationships: Array<{
      sourceMaterialId: string;
      targetMaterialId: string;
      relationshipType: MaterialRelationshipType;
      strength?: number;
      bidirectional?: boolean;
      metadata?: Record<string, any>;
    }>,
    userId: string
  ): Promise<{
    created: number;
    failed: number;
    errors: Array<{ index: number; error: string }>;
    relationshipIds: string[];
  }> {
    try {
      // Initialize results
      const results = {
        created: 0,
        failed: 0,
        errors: [] as Array<{ index: number; error: string }>,
        relationshipIds: [] as string[]
      };
      
      // Process each relationship
      for (let i = 0; i < relationships.length; i++) {
        const relationshipData = relationships[i];

        // Add explicit check for undefined to satisfy linter
        if (!relationshipData) {
            results.failed++;
            results.errors.push({ index: i, error: 'Relationship data is undefined' });
            continue;
        }
        
        try {
          // Validate relationship data (safe to access now)
          if (!relationshipData.sourceMaterialId || !relationshipData.targetMaterialId) {
            throw new Error('Source and target material IDs are required');
          }
          
          // Create the relationship
          const relationship = await createMaterialRelationship({
            ...relationshipData,
            createdBy: userId
          });
          
          // Send real-time notification
          await this.sendKnowledgeBaseEvent('relationship-created', {
            relationshipId: relationship.id,
            sourceMaterialId: relationship.sourceMaterialId,
            targetMaterialId: relationship.targetMaterialId,
            relationshipType: relationship.relationshipType
          });
          
          // Track result
          results.created++;
          results.relationshipIds.push(relationship.id);
        } catch (err) {
          results.failed++;
          results.errors.push({
            index: i,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
      
      return results;
    } catch (err) {
      logger.error(`Failed to bulk create relationships: ${err}`);
      throw new Error(`Failed to bulk create relationships: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Generate knowledge base statistics
   * 
   * @returns Knowledge base statistics
   */
  public async getKnowledgeBaseStats(): Promise<{
    materialCount: number;
    collectionCount: number;
    materialsByType: Record<string, number>;
    materialsByCollection: Array<{ collection: string; count: number }>;
    recentUpdates: number;
    indexingStatus: Record<string, number>;
  }> {
    try {
      // Get models
      const Material = mongoose.model('Material');
      const Collection = mongoose.model('Collection');
      
      // Get counts
      const materialCount = await Material.countDocuments();
      const collectionCount = await Collection.countDocuments();
      
      // Get materials by type
      const materialsByTypeAgg = await Material.aggregate([
        { $group: { _id: '$materialType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      const materialsByType: Record<string, number> = {};
      materialsByTypeAgg.forEach((item: any) => {
        materialsByType[item._id] = item.count;
      });
      
      // Get materials by collection
      const materialsByCollectionAgg = await Material.aggregate([
        { $match: { collectionId: { $exists: true, $ne: null } } },
        { $group: { _id: '$collectionId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
      
      // Get collection names
      const collectionIds = materialsByCollectionAgg.map((item: any) => item._id);
      const collections = await Collection.find({ id: { $in: collectionIds } });
      
      const collectionsMap: Record<string, string> = {};
      collections.forEach((collection: any) => {
        collectionsMap[collection.id] = collection.name;
      });
      
      const materialsByCollection = materialsByCollectionAgg.map((item: any) => ({
        collection: collectionsMap[item._id] || item._id,
        count: item.count
      }));
      
      // Count recent updates
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const recentUpdates = await Material.countDocuments({
        updatedAt: { $gte: oneWeekAgo }
      });
      
      // Get indexing status
      const indexingStatusAgg = await SearchIndex.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      
      const indexingStatus: Record<string, number> = {};
      indexingStatusAgg.forEach((item: any) => {
        indexingStatus[item._id] = item.count;
      });
      
      return {
        materialCount,
        collectionCount,
        materialsByType,
        materialsByCollection,
        recentUpdates,
        indexingStatus
      };
    } catch (err) {
      logger.error(`Failed to get knowledge base stats: ${err}`);
      throw new Error(`Failed to get knowledge base stats: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// Export singleton instance
export const knowledgeBaseService = KnowledgeBaseService.getInstance();

export default knowledgeBaseService;
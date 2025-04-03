/**
 * Knowledge Base Service
 * 
 * This service provides a unified interface for interacting with the knowledge base,
 * including materials, collections, metadata fields, and search capabilities.
 */

import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { logger } from '../../utils/logger';
import { messageBroker } from '../messaging/messageBroker';
import { entityLinkingService } from './entityLinking.service';
import { modelRouter } from '../ai/modelRouter';
import { 
  createMaterialRelationship,
  getMaterialRelationships,
  MaterialRelationshipType 
} from '../../models/materialRelationship.model';

// Import models
import { MaterialDocument, findSimilarMaterials } from '../../models/material.model';
import { CollectionDocument } from '../../models/collection.model';
import { VersionDocument } from '../../models/version.model';
import SearchIndex, { SearchIndexDocument } from '../../models/searchIndex.model';
import { 
  createCollectionMembership
} from '../../models/collectionMembership.model';

/**
 * Knowledge Base Service
 * 
 * Provides unified APIs for managing the material knowledge base
 */
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
  public async searchMaterials(options: {
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
    searchStrategy?: 'text' | 'vector' | 'metadata' | 'combined';
  }): Promise<{
    materials: MaterialDocument[];
    total: number;
    facets?: Record<string, any>;
  }> {
    try {
      const {
        query,
        materialType,
        collectionId,
        seriesId,
        tags,
        fields,
        filter = {},
        sort = { updatedAt: -1 },
        limit = 10,
        skip = 0,
        includeVersions = false,
        useVectorSearch = false,
        searchStrategy = 'text'
      } = options;

      // Choose search strategy
      if (useVectorSearch && query) {
        return this.vectorSearch({ query, materialType, limit, skip });
      }

      // Build query
      const searchFilter: Record<string, any> = { ...filter };

      // Apply text search
      if (query) {
        if (searchStrategy === 'text' || searchStrategy === 'combined') {
          searchFilter.$text = { $search: query };
        } else {
          searchFilter.$or = [
            { name: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } },
            { tags: { $in: [new RegExp(query, 'i')] } }
          ];
        }
      }

      // Apply materialType filter
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

      // Apply tags filter
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

      // Get the Material model
      const Material = mongoose.model('Material');

      // Execute query
      const projection = includeVersions ? {} : { versions: 0 };
      const materials = await Material.find(searchFilter, projection)
        .sort(sort)
        .skip(skip)
        .limit(limit);

      const total = await Material.countDocuments(searchFilter);

      // Calculate facets if metadata search
      let facets: Record<string, any> | undefined;
      if (searchStrategy === 'metadata' || searchStrategy === 'combined') {
        facets = await this.calculateFacets(searchFilter);
      }

      return { materials, total, facets };
    } catch (err) {
      logger.error(`Failed to search materials: ${err}`);
      throw new Error(`Failed to search materials: ${err instanceof Error ? err.message : String(err)}`);
    }
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
    materials: MaterialDocument[];
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
      // Fallback or re-throw depending on desired behavior
      // For now, re-throwing to indicate failure
      throw new Error(`Failed to generate query embedding: ${err instanceof Error ? err.message : String(err)}`);
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
    updateData: Partial<MaterialDocument>,
    userId: string
  ): Promise<MaterialDocument> {
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
      
      return updatedMaterial as MaterialDocument;
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
  ): Promise<MaterialDocument> {
    try {
      // Get the Material and Version models
      const Material = mongoose.model('Material');
      const Version = mongoose.model('Version');
      
      // Find version to revert to
      const version = await Version.findOne({ id: versionId, entityId: materialId });
      if (!version) {
        throw new Error(`Version not found: ${versionId}`);
      }
      
      // Find current material
      const currentMaterial = await Material.findOne({ id: materialId });
      if (!currentMaterial) {
        throw new Error(`Material not found: ${materialId}`);
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
      
      return updatedMaterial as MaterialDocument;
    } catch (err) {
      logger.error(`Failed to revert material version: ${err}`);
      throw new Error(`Failed to revert material version: ${err instanceof Error ? err.message : String(err)}`);
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
      
      // Mark indexes as needing update
      for (const index of indexes) {
        await SearchIndex.updateOne(
          { id: index.id },
          { 
            status: 'updating',
            lastUpdateTime: new Date()
          }
        );
        
        // This would normally trigger an async process to update the indexes
        // For now, we just log that it needs to be updated
        logger.info(`Search index ${index.id} for ${entityType} needs update for entity ${entityId}`);
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
      const searchIndex = await SearchIndex.create(indexData);
      
      // In a real implementation, this would trigger a background job
      // to build the index asynchronously
      
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
        throw new Error(`Search index not found: ${indexId}`);
      }
      
      // Mark index as updating
      await SearchIndex.updateOne(
        { id: indexId },
        { 
          status: 'updating',
          lastUpdateTime: new Date()
        }
      );
      
      // In a real implementation, this would trigger a background job
      // For now we just simulate it being done immediately
      const updatedIndex = await SearchIndex.findOneAndUpdate(
        { id: indexId },
        {
          status: 'ready',
          lastBuildTime: new Date(),
          lastUpdateTime: new Date(),
          documentCount: await this.countDocumentsForIndex(index)
        },
        { new: true }
      );
      
      return updatedIndex as SearchIndexDocument;
    } catch (err) {
      logger.error(`Failed to rebuild search index: ${err}`);
      throw new Error(`Failed to rebuild search index: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Count documents for an index
   * 
   * @param index Search index
   * @returns Document count
   */
  private async countDocumentsForIndex(index: SearchIndexDocument): Promise<number> {
    try {
      const Model = mongoose.model(index.entityType.charAt(0).toUpperCase() + index.entityType.slice(1));
      return await Model.countDocuments();
    } catch (err) {
      logger.error(`Failed to count documents for index: ${err}`);
      return 0;
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
      await messageBroker.publish('system', 'knowledge-base-event', {
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
    materials: Array<Partial<MaterialDocument>>,
    userId: string,
    options: {
      updateExisting?: boolean;
      detectDuplicates?: boolean;
      validateSchema?: boolean;
      collectionId?: string;
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
        collectionId
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
      
      // Process each material
      for (let i = 0; i < materials.length; i++) {
        const materialData = materials[i];

        // Add explicit check for undefined to satisfy linter, though loop condition should prevent it
        if (!materialData) {
            results.failed++;
            results.errors.push({ index: i, error: 'Material data is undefined' });
            continue; 
        }
        
        try {
          // Check name after ensuring materialData is defined
          if (!materialData.name) {
            throw new Error('Material name is required');
          }
          
          // Add required fields, ensuring materialData is defined
          materialData.id = materialData.id || uuidv4();
          materialData.createdBy = materialData.createdBy || userId;
          // Removed potentially problematic createdAt assignment:
          // materialData.createdAt = materialData.createdAt || new Date(); 
          materialData.updatedAt = new Date();
          
          // Add to collection if specified
          if (collectionId) {
            materialData.collectionId = collectionId;
          }
          
          // Check for duplicates if needed
          if (detectDuplicates) {
            const existingMaterial = await Material.findOne({ 
              $or: [
                { id: materialData.id },
                { name: materialData.name }
              ]
            });
            
            if (existingMaterial) {
              if (updateExisting) {
                // Update existing material
                await Material.updateOne(
                  { id: existingMaterial.id },
                  { 
                    ...materialData,
                    createdAt: existingMaterial.createdAt,
                    createdBy: existingMaterial.createdBy,
                    updatedAt: new Date()
                  }
                );
                
                results.updated++;
                results.materialIds.push(existingMaterial.id);
                continue;
              } else {
                throw new Error(`Duplicate material found: ${materialData.name}`);
              }
            }
          }
          
          // Create the material
          const material = new Material(materialData);
          await material.save();
          
          // Send real-time notification
          await this.sendKnowledgeBaseEvent('material-created', {
            materialId: material.id,
            name: material.name,
            collectionId: material.collectionId
          });
          
          // Track result
          results.imported++;
          results.materialIds.push(material.id);
          
          // Add to collection membership if different from direct collection
          if (collectionId && materialData.collectionId && collectionId !== materialData.collectionId) {
            await createCollectionMembership({
              materialId: material.id,
              collectionId,
              addedBy: userId
            });
          }
          
          // Process entity linking if description is provided (check materialData first)
          if (materialData.description) {
            await entityLinkingService.linkEntitiesInDescription(
              material.id,
              materialData.description, // Safe to access now
              { 
                linkMaterials: true,
                linkCollections: true,
                createRelationships: true,
                userId
              }
            );
          }
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
      logger.error(`Failed to bulk import materials: ${err}`);
      throw new Error(`Failed to bulk import materials: ${err instanceof Error ? err.message : String(err)}`);
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
    updates: Partial<MaterialDocument>,
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
      const materialIds = matchingMaterials.map((m: MaterialDocument) => m.id); 
      
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
        idsToDelete = matchingMaterials.map((m: MaterialDocument) => m.id); 
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
          materials.map(async (material: MaterialDocument) => { 
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
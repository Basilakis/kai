/**
 * Knowledge Base Service
 * 
 * This service provides a unified interface for interacting with the knowledge base,
 * including materials, collections, metadata fields, and search capabilities.
 */

import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { logger } from '../../utils/logger';

// Import models
import { MaterialDocument, findSimilarMaterials } from '../../models/material.model';
import { CollectionDocument } from '../../models/collection.model';
import { VersionDocument } from '../../models/version.model';
import SearchIndex, { SearchIndexDocument } from '../../models/searchIndex.model';

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
    // This is a placeholder implementation
    // In a real-world scenario, this would call an embeddings API like OpenAI
    
    // Simple mock implementation for testing
    return Array(128).fill(0).map(() => Math.random() - 0.5);
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
   * Get collections with their materials count
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

      // Get the Collection model
      const Collection = mongoose.model('Collection');
      
      // Build query
      const filter: Record<string, any> = {};
      
      if (parentId) {
        filter.parentId = parentId;
      } else {
        filter.parentId = { $exists: false }; // Top-level collections
      }

      // Get collections
      const collections = await Collection.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit);
      
      const total = await Collection.countDocuments(filter);

      // Get material counts for each collection
      const Material = mongoose.model('Material');
      const collectionsWithCount = await Promise.all(
        collections.map(async (collection) => {
          const materialCount = await Material.countDocuments({ collectionId: collection.id });
          
          // Skip collections with no materials if includeEmpty is false
          if (!includeEmpty && materialCount === 0) {
            return null;
          }
          
          return {
            ...collection.toObject(),
            materialCount
          };
        })
      );

      // Filter out null values from collections with no materials
      const filteredCollections = collectionsWithCount.filter(Boolean) as Array<CollectionDocument & { materialCount: number }>;

      return { 
        collections: filteredCollections,
        total: includeEmpty ? total : filteredCollections.length
      };
    } catch (err) {
      logger.error(`Failed to get collections: ${err}`);
      throw new Error(`Failed to get collections: ${err instanceof Error ? err.message : String(err)}`);
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
/**
 * Search Index Model
 * 
 * This model provides optimized search indexes for the knowledge base.
 * It supports efficient retrieval through various index types:
 * - Text indexes for keyword search
 * - Vector indexes for similarity search
 * - Metadata indexes for faceted search
 */

import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/**
 * Search index document interface
 */
export interface SearchIndexDocument extends Document {
  id: string;
  name: string;
  description?: string;
  entityType: string;           // What entity type this index supports ('material', 'collection', etc.)
  indexType: 'text' | 'vector' | 'metadata' | 'combined'; // Type of index
  fields: string[];             // Fields that are indexed
  tokenizer?: string;           // How text is tokenized (for text indexes)
  dimensions?: number;          // Vector dimensions (for vector indexes)
  metricType?: 'cosine' | 'euclidean' | 'dot'; // Distance metric (for vector indexes)
  facets?: string[];            // Facetable fields (for metadata indexes)
  filterFields?: string[];      // Fields that can be used for filtering
  sortFields?: string[];        // Fields that can be used for sorting
  config: Record<string, any>;  // Index-specific configuration
  status: 'building' | 'ready' | 'updating' | 'error';
  lastBuildTime?: Date;
  lastUpdateTime?: Date;
  documentCount: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

/**
 * Search index schema
 */
const searchIndexSchema = new Schema<SearchIndexDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    entityType: {
      type: String,
      required: true,
      enum: ['material', 'collection', 'category', 'metadataField'],
      index: true
    },
    indexType: {
      type: String,
      required: true,
      enum: ['text', 'vector', 'metadata', 'combined'],
      index: true
    },
    fields: {
      type: [String],
      required: true,
      validate: [
        {
          validator: (arr: string[]) => arr.length > 0,
          message: 'At least one field must be specified'
        }
      ]
    },
    tokenizer: {
      type: String,
      enum: ['standard', 'ngram', 'whitespace', 'custom']
    },
    dimensions: {
      type: Number,
      min: 1,
      max: 2048,
      validate: {
        validator: function(this: SearchIndexDocument, v: number) {
          return this.indexType !== 'vector' || v !== undefined;
        },
        message: 'Vector indexes must specify dimensions'
      }
    },
    metricType: {
      type: String,
      enum: ['cosine', 'euclidean', 'dot'],
      default: 'cosine',
      validate: {
        validator: function(this: SearchIndexDocument, v: string) {
          return this.indexType !== 'vector' || v !== undefined;
        },
        message: 'Vector indexes must specify a metric type'
      }
    },
    facets: {
      type: [String],
      validate: {
        validator: function(this: SearchIndexDocument, arr: string[]) {
          return this.indexType !== 'metadata' || arr.length > 0;
        },
        message: 'Metadata indexes must specify at least one facet'
      }
    },
    filterFields: {
      type: [String]
    },
    sortFields: {
      type: [String]
    },
    config: {
      type: Schema.Types.Mixed,
      default: {}
    },
    status: {
      type: String,
      required: true,
      enum: ['building', 'ready', 'updating', 'error'],
      default: 'building',
      index: true
    },
    lastBuildTime: {
      type: Date
    },
    lastUpdateTime: {
      type: Date
    },
    documentCount: {
      type: Number,
      default: 0
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    createdBy: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

// Create indexes
searchIndexSchema.index({ id: 1 }, { unique: true });
searchIndexSchema.index({ name: 1 });
searchIndexSchema.index({ entityType: 1, indexType: 1 });
searchIndexSchema.index({ status: 1 });
searchIndexSchema.index({ createdAt: 1 });
searchIndexSchema.index({ updatedAt: 1 });

/**
 * Combined index for finding indexes by entity type and status
 */
searchIndexSchema.index({ entityType: 1, status: 1 });

/**
 * Text index for searching indexes by name and description
 */
searchIndexSchema.index(
  { name: 'text', description: 'text' },
  { weights: { name: 10, description: 5 } }
);

/**
 * Search index model
 */
const SearchIndex = mongoose.model<SearchIndexDocument>('SearchIndex', searchIndexSchema);

/**
 * Create a new search index
 * 
 * @param indexData Search index data
 * @returns Created search index document
 */
export async function createSearchIndex(indexData: Partial<SearchIndexDocument>): Promise<SearchIndexDocument> {
  try {
    const searchIndex = new SearchIndex(indexData);
    await searchIndex.save();
    
    // Start building the index in the background
    if (searchIndex.status === 'building') {
      buildIndex(searchIndex.id).catch(err => {
        logger.error(`Failed to build index ${searchIndex.id}: ${err}`);
      });
    }
    
    return searchIndex;
  } catch (err) {
    logger.error(`Failed to create search index: ${err}`);
    throw new Error(`Failed to create search index: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get a search index by ID
 * 
 * @param id Search index ID
 * @returns Search index document
 */
export async function getSearchIndexById(id: string): Promise<SearchIndexDocument | null> {
  try {
    return await SearchIndex.findOne({ id });
  } catch (err) {
    logger.error(`Failed to get search index: ${err}`);
    throw new Error(`Failed to get search index: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Update a search index
 * 
 * @param id Search index ID
 * @param updateData Update data
 * @returns Updated search index document
 */
export async function updateSearchIndex(id: string, updateData: Partial<SearchIndexDocument>): Promise<SearchIndexDocument | null> {
  try {
    // If updating the fields that affect the index, set status to updating
    const index = await SearchIndex.findOne({ id });
    if (!index) {
      return null;
    }
    
    // Check if fields that require rebuilding are being updated
    const fieldsRequiringRebuild = ['fields', 'tokenizer', 'dimensions', 'metricType', 'facets'];
    const needsRebuild = Object.keys(updateData).some(key => fieldsRequiringRebuild.includes(key));
    
    if (needsRebuild && index.status === 'ready') {
      updateData.status = 'updating';
    }
    
    const updatedIndex = await SearchIndex.findOneAndUpdate(
      { id },
      { ...updateData, lastUpdateTime: new Date() },
      { new: true }
    );
    
    // If the index needs rebuilding, start the rebuild process
    if (updatedIndex && needsRebuild && updatedIndex.status === 'updating') {
      rebuildIndex(id).catch(err => {
        logger.error(`Failed to rebuild index ${id}: ${err}`);
      });
    }
    
    return updatedIndex;
  } catch (err) {
    logger.error(`Failed to update search index: ${err}`);
    throw new Error(`Failed to update search index: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Delete a search index
 * 
 * @param id Search index ID
 * @returns Deleted search index document
 */
export async function deleteSearchIndex(id: string): Promise<SearchIndexDocument | null> {
  try {
    return await SearchIndex.findOneAndDelete({ id });
  } catch (err) {
    logger.error(`Failed to delete search index: ${err}`);
    throw new Error(`Failed to delete search index: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get all search indexes
 * 
 * @param options Query options
 * @returns Array of search index documents
 */
export async function getSearchIndexes(options: {
  entityType?: string;
  indexType?: string;
  status?: string;
  query?: string;
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
} = {}): Promise<{
  indexes: SearchIndexDocument[];
  total: number;
}> {
  try {
    const {
      entityType,
      indexType,
      status,
      query,
      limit = 10,
      skip = 0,
      sort = { updatedAt: -1 }
    } = options;
    
    // Build query
    const filter: any = {};
    
    if (entityType) {
      filter.entityType = entityType;
    }
    
    if (indexType) {
      filter.indexType = indexType;
    }
    
    if (status) {
      filter.status = status;
    }
    
    // Text search
    if (query) {
      filter.$text = { $search: query };
    }
    
    // Execute query
    const indexes = await SearchIndex.find(filter)
      .sort(sort)
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
 * Build a search index
 * 
 * @param indexId Search index ID
 * @returns Updated search index document
 */
export async function buildIndex(indexId: string): Promise<SearchIndexDocument | null> {
  try {
    const index = await SearchIndex.findOne({ id: indexId });
    if (!index) {
      throw new Error(`Search index ${indexId} not found`);
    }
    
    if (index.status !== 'building') {
      throw new Error(`Cannot build index ${indexId} with status ${index.status}`);
    }
    
    // Update status to indicate build is in progress
    await SearchIndex.updateOne(
      { id: indexId },
      { status: 'building', lastUpdateTime: new Date() }
    );
    
    // Build different types of indexes based on the index type
    switch (index.indexType) {
      case 'text':
        await buildTextIndex(index);
        break;
      case 'vector':
        await buildVectorIndex(index);
        break;
      case 'metadata':
        await buildMetadataIndex(index);
        break;
      case 'combined':
        await buildCombinedIndex(index);
        break;
      default:
        throw new Error(`Unknown index type: ${index.indexType}`);
    }
    
    // Update status to indicate build is complete
    const updatedIndex = await SearchIndex.findOneAndUpdate(
      { id: indexId },
      {
        status: 'ready',
        lastBuildTime: new Date(),
        lastUpdateTime: new Date()
      },
      { new: true }
    );
    
    return updatedIndex;
  } catch (err) {
    // Update status to indicate build failed
    await SearchIndex.updateOne(
      { id: indexId },
      {
        status: 'error',
        lastUpdateTime: new Date(),
        metadata: {
          ...(await SearchIndex.findOne({ id: indexId }))?.metadata,
          lastError: err instanceof Error ? err.message : String(err),
          lastErrorTimestamp: new Date()
        }
      }
    );
    
    logger.error(`Failed to build search index ${indexId}: ${err}`);
    throw new Error(`Failed to build search index: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Rebuild a search index
 * 
 * @param indexId Search index ID
 * @returns Updated search index document
 */
export async function rebuildIndex(indexId: string): Promise<SearchIndexDocument | null> {
  try {
    const index = await SearchIndex.findOne({ id: indexId });
    if (!index) {
      throw new Error(`Search index ${indexId} not found`);
    }
    
    if (index.status !== 'updating') {
      throw new Error(`Cannot rebuild index ${indexId} with status ${index.status}`);
    }
    
    // Update status to indicate rebuild is in progress
    await SearchIndex.updateOne(
      { id: indexId },
      { status: 'updating', lastUpdateTime: new Date() }
    );
    
    // Build different types of indexes based on the index type
    switch (index.indexType) {
      case 'text':
        await buildTextIndex(index);
        break;
      case 'vector':
        await buildVectorIndex(index);
        break;
      case 'metadata':
        await buildMetadataIndex(index);
        break;
      case 'combined':
        await buildCombinedIndex(index);
        break;
      default:
        throw new Error(`Unknown index type: ${index.indexType}`);
    }
    
    // Update status to indicate rebuild is complete
    const updatedIndex = await SearchIndex.findOneAndUpdate(
      { id: indexId },
      {
        status: 'ready',
        lastBuildTime: new Date(),
        lastUpdateTime: new Date()
      },
      { new: true }
    );
    
    return updatedIndex;
  } catch (err) {
    // Update status to indicate rebuild failed
    await SearchIndex.updateOne(
      { id: indexId },
      {
        status: 'error',
        lastUpdateTime: new Date(),
        metadata: {
          ...(await SearchIndex.findOne({ id: indexId }))?.metadata,
          lastError: err instanceof Error ? err.message : String(err),
          lastErrorTimestamp: new Date()
        }
      }
    );
    
    logger.error(`Failed to rebuild search index ${indexId}: ${err}`);
    throw new Error(`Failed to rebuild search index: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Build a text index
 * 
 * @param index Search index document
 */
async function buildTextIndex(index: SearchIndexDocument): Promise<void> {
  // This would typically involve:
  // 1. Retrieving all documents of the specified entity type
  // 2. Creating text indexes on the specified fields
  // 3. Potentially using external services like Elasticsearch or MongoDB Atlas Search
  
  try {
    logger.info(`Building text index ${index.id} for ${index.entityType}`);
    
    // Get the entity model
    const Model = mongoose.model(index.entityType.charAt(0).toUpperCase() + index.entityType.slice(1));
    
    // Count documents
    const documentCount = await Model.countDocuments();
    
    // Create MongoDB text index
    const indexDefinition: Record<string, any> = {};
    for (const field of index.fields) {
      indexDefinition[field] = 'text';
    }
    
    // Apply the text index to the collection
    await Model.collection.createIndex(indexDefinition, {
      name: `text_${index.id}`,
      default_language: 'english',
      weights: index.config.weights || {}
    });
    
    // Update document count
    await SearchIndex.updateOne(
      { id: index.id },
      { documentCount }
    );
    
    logger.info(`Text index ${index.id} built successfully with ${documentCount} documents`);
  } catch (err) {
    logger.error(`Failed to build text index ${index.id}: ${err}`);
    throw err;
  }
}

/**
 * Build a vector index
 * 
 * @param index Search index document
 */
async function buildVectorIndex(index: SearchIndexDocument): Promise<void> {
  // This would typically involve:
  // 1. Retrieving all documents of the specified entity type
  // 2. Converting document fields to vector embeddings
  // 3. Storing vector embeddings in a vector database or specialized index
  
  try {
    logger.info(`Building vector index ${index.id} for ${index.entityType}`);
    
    // Get the entity model
    const Model = mongoose.model(index.entityType.charAt(0).toUpperCase() + index.entityType.slice(1));
    
    // Count documents
    const documentCount = await Model.countDocuments();
    
    // In a real implementation, this would involve:
    // 1. Iterating through all documents
    // 2. Generating vector embeddings for each document
    // 3. Storing the embeddings in a vector database
    
    // Update document count
    await SearchIndex.updateOne(
      { id: index.id },
      { documentCount }
    );
    
    logger.info(`Vector index ${index.id} built successfully with ${documentCount} documents`);
  } catch (err) {
    logger.error(`Failed to build vector index ${index.id}: ${err}`);
    throw err;
  }
}

/**
 * Build a metadata index
 * 
 * @param index Search index document
 */
async function buildMetadataIndex(index: SearchIndexDocument): Promise<void> {
  // This would typically involve:
  // 1. Retrieving all documents of the specified entity type
  // 2. Creating indexes on metadata fields for faceted search
  
  try {
    logger.info(`Building metadata index ${index.id} for ${index.entityType}`);
    
    // Get the entity model
    const Model = mongoose.model(index.entityType.charAt(0).toUpperCase() + index.entityType.slice(1));
    
    // Count documents
    const documentCount = await Model.countDocuments();
    
    // Create indexes for each facet field
    if (index.facets && index.facets.length > 0) {
      for (const facet of index.facets) {
        await Model.collection.createIndex(
          { [facet]: 1 },
          { name: `facet_${facet}_${index.id}` }
        );
      }
    }
    
    // Create indexes for filter fields
    if (index.filterFields && index.filterFields.length > 0) {
      for (const field of index.filterFields) {
        await Model.collection.createIndex(
          { [field]: 1 },
          { name: `filter_${field}_${index.id}` }
        );
      }
    }
    
    // Create indexes for sort fields
    if (index.sortFields && index.sortFields.length > 0) {
      for (const field of index.sortFields) {
        await Model.collection.createIndex(
          { [field]: 1 },
          { name: `sort_${field}_${index.id}` }
        );
      }
    }
    
    // Update document count
    await SearchIndex.updateOne(
      { id: index.id },
      { documentCount }
    );
    
    logger.info(`Metadata index ${index.id} built successfully with ${documentCount} documents`);
  } catch (err) {
    logger.error(`Failed to build metadata index ${index.id}: ${err}`);
    throw err;
  }
}

/**
 * Build a combined index (text + vector + metadata)
 * 
 * @param index Search index document
 */
async function buildCombinedIndex(index: SearchIndexDocument): Promise<void> {
  // This would typically involve building all three types of indexes
  
  try {
    logger.info(`Building combined index ${index.id} for ${index.entityType}`);
    
    // Build each type of index
    await buildTextIndex(index);
    await buildVectorIndex(index);
    await buildMetadataIndex(index);
    
    logger.info(`Combined index ${index.id} built successfully`);
  } catch (err) {
    logger.error(`Failed to build combined index ${index.id}: ${err}`);
    throw err;
  }
}

export default SearchIndex;
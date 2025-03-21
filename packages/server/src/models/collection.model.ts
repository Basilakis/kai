/**
 * Collection Model
 * 
 * This model represents collections or series of materials in the system.
 * It allows for organizing materials into logical groupings (e.g., product lines, series)
 * beyond the category system, supporting the material knowledge base structure.
 */

import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface CollectionDocument extends Document {
  id: string;
  name: string;
  description?: string;
  manufacturer: string;
  year?: number;
  season?: string;
  isActive: boolean;
  materialType?: string[];
  categoryIds?: string[];
  coverImageUrl?: string;
  thumbnailUrl?: string;
  tags: string[];
  
  // Additional metadata
  properties?: Record<string, any>;
  
  // Relationships
  parentCollectionId?: string;
  childCollections?: string[];
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Collection schema
 */
const collectionSchema = new Schema<CollectionDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      default: () => uuidv4()
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
    manufacturer: {
      type: String,
      required: true,
      trim: true
    },
    year: {
      type: Number
    },
    season: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    materialType: {
      type: [String],
      default: []
    },
    categoryIds: {
      type: [String],
      default: []
    },
    coverImageUrl: {
      type: String
    },
    thumbnailUrl: {
      type: String
    },
    tags: {
      type: [String],
      default: []
    },
    properties: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {}
    },
    parentCollectionId: {
      type: String
    },
    childCollections: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Create indexes
collectionSchema.index({ id: 1 }, { unique: true });
collectionSchema.index({ name: 1, manufacturer: 1 }, { unique: true });
collectionSchema.index({ manufacturer: 1 });
collectionSchema.index({ materialType: 1 });
collectionSchema.index({ categoryIds: 1 });
collectionSchema.index({ tags: 1 });
collectionSchema.index({ isActive: 1 });
collectionSchema.index({ year: 1 });
collectionSchema.index({ parentCollectionId: 1 });

/**
 * Collection model
 */
const Collection = mongoose.model<CollectionDocument>('Collection', collectionSchema);

/**
 * Create a new collection
 * 
 * @param collectionData Collection data
 * @returns Created collection document
 */
export async function createCollection(collectionData: Partial<CollectionDocument>): Promise<CollectionDocument> {
  try {
    const collection = new Collection(collectionData);
    await collection.save();
    
    // If this collection has a parent, update the parent's childCollections array
    if (collection.parentCollectionId) {
      await Collection.findOneAndUpdate(
        { id: collection.parentCollectionId },
        { $addToSet: { childCollections: collection.id } }
      );
    }
    
    return collection;
  } catch (err) {
    logger.error(`Failed to create collection: ${err}`);
    throw new Error(`Failed to create collection: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get a collection by ID
 * 
 * @param id Collection ID
 * @returns Collection document
 */
export async function getCollection(id: string): Promise<CollectionDocument | null> {
  try {
    return await Collection.findOne({ id });
  } catch (err) {
    logger.error(`Failed to get collection: ${err}`);
    throw new Error(`Failed to get collection: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Update a collection
 * 
 * @param id Collection ID
 * @param updateData Update data
 * @returns Updated collection document
 */
export async function updateCollection(id: string, updateData: Partial<CollectionDocument>): Promise<CollectionDocument | null> {
  try {
    // Handle parent collection changes
    const existingCollection = await Collection.findOne({ id });
    if (existingCollection && 'parentCollectionId' in updateData && existingCollection.parentCollectionId !== updateData.parentCollectionId) {
      // Remove from old parent's childCollections if it exists
      if (existingCollection.parentCollectionId) {
        await Collection.findOneAndUpdate(
          { id: existingCollection.parentCollectionId },
          { $pull: { childCollections: id } }
        );
      }
      
      // Add to new parent's childCollections if it exists
      if (updateData.parentCollectionId) {
        await Collection.findOneAndUpdate(
          { id: updateData.parentCollectionId },
          { $addToSet: { childCollections: id } }
        );
      }
    }
    
    // Update the collection
    return await Collection.findOneAndUpdate(
      { id },
      { $set: updateData },
      { new: true }
    );
  } catch (err) {
    logger.error(`Failed to update collection: ${err}`);
    throw new Error(`Failed to update collection: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Delete a collection
 * 
 * @param id Collection ID
 * @returns Deleted collection document
 */
export async function deleteCollection(id: string): Promise<CollectionDocument | null> {
  try {
    const collection = await Collection.findOne({ id });
    
    if (!collection) {
      return null;
    }
    
    // Remove from parent's childCollections if it exists
    if (collection.parentCollectionId) {
      await Collection.findOneAndUpdate(
        { id: collection.parentCollectionId },
        { $pull: { childCollections: id } }
      );
    }
    
    // If it has children, update their parentCollectionId to null
    await Collection.updateMany(
      { parentCollectionId: id },
      { $set: { parentCollectionId: null } }
    );
    
    // Delete the collection
    return await Collection.findOneAndDelete({ id });
  } catch (err) {
    logger.error(`Failed to delete collection: ${err}`);
    throw new Error(`Failed to delete collection: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get collections by filter criteria
 * 
 * @param options Query options
 * @returns Array of collection documents
 */
export async function getCollections({
  limit = 100,
  offset = 0,
  sort = { createdAt: -1 },
  filter = {},
}: {
  limit?: number;
  offset?: number;
  sort?: Record<string, any>;
  filter?: Record<string, any>;
} = {}): Promise<{
  collections: CollectionDocument[];
  total: number;
}> {
  try {
    const collections = await Collection.find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit);
    
    const total = await Collection.countDocuments(filter);
    
    return { collections, total };
  } catch (err) {
    logger.error(`Failed to get collections: ${err}`);
    throw new Error(`Failed to get collections: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get collection tree from root to leaf nodes
 * 
 * @param rootId Optional root collection ID (if not provided, all root collections are returned)
 * @returns Tree structure of collections
 */
export async function getCollectionTree(rootId?: string): Promise<any[]> {
  try {
    const buildTree = async (parentId: string | null): Promise<any[]> => {
      const filter = parentId ? { parentCollectionId: parentId } : { parentCollectionId: { $exists: false } };
      const collections = await Collection.find(filter);
      
      const result = [];
      for (const collection of collections) {
        const children = await buildTree(collection.id);
        result.push({
          id: collection.id,
          name: collection.name,
          manufacturer: collection.manufacturer,
          isActive: collection.isActive,
          children
        });
      }
      
      return result;
    };
    
    if (rootId) {
      const rootCollection = await Collection.findOne({ id: rootId });
      if (!rootCollection) {
        return [];
      }
      
      const children = await buildTree(rootId);
      return [{
        id: rootCollection.id,
        name: rootCollection.name,
        manufacturer: rootCollection.manufacturer,
        isActive: rootCollection.isActive,
        children
      }];
    }
    
    return await buildTree(null);
  } catch (err) {
    logger.error(`Failed to get collection tree: ${err}`);
    throw new Error(`Failed to get collection tree: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export default Collection;
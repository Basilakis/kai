/**
 * Collection Model
 * 
 * This model represents collections or series of materials in the system.
 * It allows for organizing materials into logical groupings (e.g., product lines, series)
 * beyond the category system, supporting the material knowledge base structure.
 */

import mongoose from 'mongoose';
import type { Document } from 'mongoose';
import { Schema } from 'mongoose';
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
  
  // Relationships - Enhanced to support multiple parents
  parentCollectionIds?: string[];
  childCollections?: string[];
  hierarchyPath?: string; // Stores the full path in the hierarchy for efficient traversal
  hierarchyLevel?: number; // Depth in the collection hierarchy
  
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
    parentCollectionIds: {
      type: [String],
      default: []
    },
    hierarchyPath: {
      type: String,
      default: ''
    },
    hierarchyLevel: {
      type: Number,
      default: 0
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
collectionSchema.index({ parentCollectionIds: 1 });
collectionSchema.index({ hierarchyPath: 1 });
collectionSchema.index({ hierarchyLevel: 1 });

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
    
    // If this collection has parents, update the parents' childCollections array
    if (collection.parentCollectionIds && collection.parentCollectionIds.length > 0) {
      // Update each parent's childCollections array
      await Promise.all(collection.parentCollectionIds.map((parentId: string) =>
        Collection.findOneAndUpdate(
          { id: parentId },
          { $addToSet: { childCollections: collection.id } }
        )
      ));
      
      // Calculate and update hierarchy path and level
      await updateHierarchyInfo(collection.id);
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
    if (existingCollection && 'parentCollectionIds' in updateData) {
      // Get old and new parent IDs
      const oldParentIds = existingCollection.parentCollectionIds || [];
      const newParentIds = updateData.parentCollectionIds || [];
      
      // Find parents to remove this collection from
      const parentsToRemove = oldParentIds.filter((id: string) => !newParentIds.includes(id));
      
      // Find parents to add this collection to
      const parentsToAdd = newParentIds.filter(id => !oldParentIds.includes(id));
      
      // Remove from old parents' childCollections
      for (const parentId of parentsToRemove) {
        await Collection.findOneAndUpdate(
          { id: parentId },
          { $pull: { childCollections: id } }
        );
      }
      
      // Add to new parents' childCollections
      for (const parentId of parentsToAdd) {
        await Collection.findOneAndUpdate(
          { id: parentId },
          { $addToSet: { childCollections: id } }
        );
      }
      
      // Update hierarchy information after parents change
      if (parentsToAdd.length > 0 || parentsToRemove.length > 0) {
        await updateHierarchyInfo(id);
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
    
    // Remove from all parents' childCollections
    if (collection.parentCollectionIds && collection.parentCollectionIds.length > 0) {
      await Promise.all(collection.parentCollectionIds.map((parentId: string) =>
        Collection.findOneAndUpdate(
          { id: parentId },
          { $pull: { childCollections: id } }
        )
      ));
    }
    
    // If it has children, update their parentCollectionIds to remove this collection
    await Collection.updateMany(
      { parentCollectionIds: id },
      { $pull: { parentCollectionIds: id } }
    );
    
    // Update hierarchy information for all affected children
    if (collection.childCollections && collection.childCollections.length > 0) {
      for (const childId of collection.childCollections) {
        await updateHierarchyInfo(childId);
      }
    }
    
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
/**
 * Calculate and update hierarchy information for a collection
 * 
 * @param collectionId Collection ID to update hierarchy info for
 */
async function updateHierarchyInfo(collectionId: string): Promise<void> {
  try {
    const collection = await Collection.findOne({ id: collectionId });
    if (!collection) {
      return;
    }
    
    // Get parent collections
    const parentIds = collection.parentCollectionIds || [];
    if (parentIds.length === 0) {
      // This is a root collection
      await Collection.updateOne(
        { id: collectionId },
        { 
          hierarchyPath: `/${collectionId}`, 
          hierarchyLevel: 0 
        }
      );
      return;
    }
    
    // Find the parent with the shortest path (to optimize hierarchy)
    const parents = await Collection.find({ id: { $in: parentIds } });
    if (parents.length === 0) {
      // Fallback - set as root if parents not found
      await Collection.updateOne(
        { id: collectionId },
        { 
          hierarchyPath: `/${collectionId}`, 
          hierarchyLevel: 0 
        }
      );
      return;
    }
    
    // Find parent with the shortest path
    let shortestPathParent = parents[0];
    for (const parent of parents) {
      if ((parent.hierarchyPath?.length || 0) < (shortestPathParent.hierarchyPath?.length || 0)) {
        shortestPathParent = parent;
      }
    }
    
    // Calculate new hierarchy path and level
    const hierarchyPath = `${shortestPathParent.hierarchyPath || ''}/${collectionId}`;
    const hierarchyLevel = (shortestPathParent.hierarchyLevel || 0) + 1;
    
    // Update the collection
    await Collection.updateOne(
      { id: collectionId },
      { hierarchyPath, hierarchyLevel }
    );
    
    // Recursively update all children
    if (collection.childCollections && collection.childCollections.length > 0) {
      for (const childId of collection.childCollections) {
        await updateHierarchyInfo(childId);
      }
    }
  } catch (err) {
    logger.error(`Failed to update hierarchy info for collection ${collectionId}: ${err}`);
  }
}

/**
 * Get collection tree with support for multiple parents
 * 
 * @param rootId Optional root collection ID (if not provided, all root collections are returned)
 * @param includeSharedCollections Whether to include collections that appear in multiple places
 * @returns Tree structure of collections
 */
export async function getCollectionTree(
  rootId?: string,
  includeSharedCollections: boolean = true
): Promise<any[]> {
  try {
    // Create a map to track processed collections to handle multiple parents
    const processedCollections = new Map<string, boolean>();
    
    const buildTree = async (
      parentId: string | null,
      currentPath: string[] = []
    ): Promise<any[]> => {
      // Find collections with this parent
      const filter = parentId 
        ? { parentCollectionIds: parentId }
        : { parentCollectionIds: { $size: 0 } }; // Collections with no parents
        
      const collections = await Collection.find(filter);
      
      const result = [];
      for (const collection of collections) {
        // Check for circular references
        if (currentPath.includes(collection.id)) {
          logger.warn(`Circular reference detected in collection hierarchy: ${currentPath.join(' -> ')} -> ${collection.id}`);
          continue;
        }
        
        // If we're not including shared collections and this has been processed, skip it
        if (!includeSharedCollections && processedCollections.has(collection.id)) {
          continue;
        }
        
        // Mark collection as processed
        processedCollections.set(collection.id, true);
        
        // Build children tree
        const newPath = [...currentPath, collection.id];
        const children = await buildTree(collection.id, newPath);
        
        result.push({
          id: collection.id,
          name: collection.name,
          manufacturer: collection.manufacturer,
          isActive: collection.isActive,
          hierarchyLevel: collection.hierarchyLevel || 0,
          parents: collection.parentCollectionIds || [],
          children
        });
      }
      
      // Sort collections by name
      return result.sort((a, b) => a.name.localeCompare(b.name));
    };
    
    if (rootId) {
      const rootCollection = await Collection.findOne({ id: rootId });
      if (!rootCollection) {
        return [];
      }
      
      const children = await buildTree(rootId, [rootId]);
      return [{
        id: rootCollection.id,
        name: rootCollection.name,
        manufacturer: rootCollection.manufacturer,
        isActive: rootCollection.isActive,
        hierarchyLevel: rootCollection.hierarchyLevel || 0,
        parents: rootCollection.parentCollectionIds || [],
        children
      }];
    }
    
    return await buildTree(null);
  } catch (err) {
    logger.error(`Failed to get collection tree: ${err}`);
    throw new Error(`Failed to get collection tree: ${err instanceof Error ? err.message : String(err)}`);
  }
}
/**
 * Get all collections that contain a specific collection
 * 
 * @param collectionId Collection ID
 * @returns Array of parent collections
 */
export async function getCollectionParents(collectionId: string): Promise<CollectionDocument[]> {
  try {
    const collection = await Collection.findOne({ id: collectionId });
    if (!collection || !collection.parentCollectionIds || collection.parentCollectionIds.length === 0) {
      return [];
    }
    
    return await Collection.find({ id: { $in: collection.parentCollectionIds } });
  } catch (err) {
    logger.error(`Failed to get collection parents: ${err}`);
    throw new Error(`Failed to get collection parents: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get all ancestor collections of a specific collection
 * 
 * @param collectionId Collection ID
 * @returns Array of ancestor collections
 */
export async function getCollectionAncestors(collectionId: string): Promise<CollectionDocument[]> {
  try {
    const collection = await Collection.findOne({ id: collectionId });
    if (!collection) {
      return [];
    }
    
    // Use the hierarchy path to find all ancestors efficiently
    const hierarchyPath = collection.hierarchyPath || `/${collectionId}`;
    const pathParts = hierarchyPath.split('/').filter((p: string) => p);
    
    // Remove the last part (which is the current collection)
    pathParts.pop();
    
    if (pathParts.length === 0) {
      return [];
    }
    
    // Find all ancestors
    return await Collection.find({ id: { $in: pathParts } }).sort({ hierarchyLevel: 1 });
  } catch (err) {
    logger.error(`Failed to get collection ancestors: ${err}`);
    throw new Error(`Failed to get collection ancestors: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Find collections at a specific hierarchy level
 * 
 * @param level Hierarchy level (0 = root)
 * @param filter Additional filter criteria
 * @returns Array of collections at the specified level
 */
export async function getCollectionsByLevel(
  level: number,
  filter: Record<string, any> = {}
): Promise<CollectionDocument[]> {
  try {
    return await Collection.find({
      ...filter,
      hierarchyLevel: level
    }).sort({ name: 1 });
  } catch (err) {
    logger.error(`Failed to get collections by level: ${err}`);
    throw new Error(`Failed to get collections by level: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Add a collection to a parent collection
 * 
 * @param collectionId Collection ID to add
 * @param parentId Parent collection ID
 * @returns Updated collection
 */
export async function addCollectionToParent(
  collectionId: string,
  parentId: string
): Promise<CollectionDocument | null> {
  try {
    // Check if both collections exist
    const [collection, parent] = await Promise.all([
      Collection.findOne({ id: collectionId }),
      Collection.findOne({ id: parentId })
    ]);
    
    if (!collection || !parent) {
      throw new Error('Collection or parent not found');
    }
    
    // Check for circular references
    if (await isCircularReference(collectionId, parentId)) {
      throw new Error('Adding this parent would create a circular reference in the collection hierarchy');
    }
    
    // Add parent to collection's parentCollectionIds
    const updatedCollection = await Collection.findOneAndUpdate(
      { id: collectionId },
      { $addToSet: { parentCollectionIds: parentId } },
      { new: true }
    );
    
    // Add collection to parent's childCollections
    await Collection.findOneAndUpdate(
      { id: parentId },
      { $addToSet: { childCollections: collectionId } }
    );
    
    // Update hierarchy information
    await updateHierarchyInfo(collectionId);
    
    return updatedCollection;
  } catch (err) {
    logger.error(`Failed to add collection to parent: ${err}`);
    throw new Error(`Failed to add collection to parent: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Remove a collection from a parent collection
 * 
 * @param collectionId Collection ID to remove
 * @param parentId Parent collection ID
 * @returns Updated collection
 */
export async function removeCollectionFromParent(
  collectionId: string,
  parentId: string
): Promise<CollectionDocument | null> {
  try {
    // Check if both collections exist
    const collection = await Collection.findOne({ id: collectionId });
    
    if (!collection) {
      throw new Error('Collection not found');
    }
    
    // Remove parent from collection's parentCollectionIds
    const updatedCollection = await Collection.findOneAndUpdate(
      { id: collectionId },
      { $pull: { parentCollectionIds: parentId } },
      { new: true }
    );
    
    // Remove collection from parent's childCollections
    await Collection.findOneAndUpdate(
      { id: parentId },
      { $pull: { childCollections: collectionId } }
    );
    
    // Update hierarchy information
    await updateHierarchyInfo(collectionId);
    
    return updatedCollection;
  } catch (err) {
    logger.error(`Failed to remove collection from parent: ${err}`);
    throw new Error(`Failed to remove collection from parent: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Check if adding a parent would create a circular reference
 * 
 * @param collectionId Collection ID
 * @param potentialParentId Potential parent collection ID
 * @returns Whether adding the parent would create a circular reference
 */
async function isCircularReference(collectionId: string, potentialParentId: string): Promise<boolean> {
  // If trying to add itself as a parent, it's circular
  if (collectionId === potentialParentId) {
    return true;
  }
  
  // Get the potential parent
  const potentialParent = await Collection.findOne({ id: potentialParentId });
  if (!potentialParent) {
    return false;
  }
  
  // Check if the collection is already in the parent's ancestry
  const ancestors = await getCollectionAncestors(potentialParentId);
  return ancestors.some(ancestor => ancestor.id === collectionId);
}
export default Collection;
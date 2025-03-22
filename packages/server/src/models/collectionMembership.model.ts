/**
 * Collection Membership Model
 * 
 * This model represents the membership of a material in collections,
 * supporting the membership of materials in multiple collections and
 * allowing for deeper nested hierarchies.
 */

import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/**
 * Collection membership document interface
 */
export interface CollectionMembershipDocument {
  id: string;
  materialId: string;        // Reference to material
  collectionId: string;      // Reference to collection
  primaryMembership: boolean; // Whether this is the primary collection for the material
  inheritParentProperties: boolean; // Whether to inherit properties from parent collection
  position: number;          // Display position within the collection
  addedAt: Date;
  addedBy: string;
  updatedAt: Date;
  metadata?: Record<string, any>;
  path?: string[];           // Array of collection IDs representing the path from root to this collection
  nestingLevel?: number;     // Nesting level in the collection hierarchy
}

/**
 * Collection membership schema
 */
const collectionMembershipSchema = new mongoose.Schema<CollectionMembershipDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      default: () => uuidv4()
    },
    materialId: {
      type: String,
      required: true,
      index: true
    },
    collectionId: {
      type: String,
      required: true,
      index: true
    },
    primaryMembership: {
      type: Boolean,
      default: false
    },
    inheritParentProperties: {
      type: Boolean,
      default: true
    },
    position: {
      type: Number,
      default: 0
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    addedBy: {
      type: String,
      required: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    metadata: {
      type: Object,
      default: {}
    },
    path: {
      type: [String],
      default: []
    },
    nestingLevel: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Create indexes
collectionMembershipSchema.index({ id: 1 }, { unique: true });
collectionMembershipSchema.index({ materialId: 1, collectionId: 1 }, { unique: true });
collectionMembershipSchema.index({ materialId: 1, primaryMembership: 1 });
collectionMembershipSchema.index({ collectionId: 1, position: 1 });
collectionMembershipSchema.index({ path: 1 });

/**
 * Collection membership model
 */
const CollectionMembership = mongoose.model<CollectionMembershipDocument>('CollectionMembership', collectionMembershipSchema);

/**
 * Create a new collection membership
 * 
 * @param membershipData Membership data
 * @returns Created membership document
 */
export async function createCollectionMembership(
  membershipData: Partial<CollectionMembershipDocument>
): Promise<CollectionMembershipDocument> {
  try {
    // If this is marked as primary, ensure no other primary exists for this material
    if (membershipData.primaryMembership) {
      await CollectionMembership.updateMany(
        { materialId: membershipData.materialId, primaryMembership: true },
        { $set: { primaryMembership: false } }
      );
    }
    
    // Set path and nesting level if collection has a hierarchy
    if (membershipData.collectionId) {
      await updateMembershipPath(membershipData);
    }
    
    const membership = new CollectionMembership(membershipData);
    await membership.save();
    
    return membership;
  } catch (err) {
    logger.error(`Failed to create collection membership: ${err}`);
    throw new Error(`Failed to create collection membership: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get collection membership by ID
 * 
 * @param id Membership ID
 * @returns Membership document
 */
export async function getCollectionMembershipById(id: string): Promise<CollectionMembershipDocument | null> {
  try {
    return await CollectionMembership.findOne({ id });
  } catch (err) {
    logger.error(`Failed to get collection membership: ${err}`);
    throw new Error(`Failed to get collection membership: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Update collection membership
 * 
 * @param id Membership ID
 * @param updateData Update data
 * @returns Updated membership document
 */
export async function updateCollectionMembership(
  id: string,
  updateData: Partial<CollectionMembershipDocument>
): Promise<CollectionMembershipDocument | null> {
  try {
    // If making this primary, update other memberships
    if (updateData.primaryMembership) {
      const membership = await CollectionMembership.findOne({ id });
      if (membership) {
        await CollectionMembership.updateMany(
          { materialId: membership.materialId, primaryMembership: true },
          { $set: { primaryMembership: false } }
        );
      }
    }
    
    // If collection ID changed, update path
    if (updateData.collectionId) {
      const membership = await CollectionMembership.findOne({ id });
      if (membership) {
        updateData.materialId = membership.materialId;
        await updateMembershipPath(updateData);
      }
    }
    
    return await CollectionMembership.findOneAndUpdate(
      { id },
      { ...updateData, updatedAt: new Date() },
      { new: true }
    );
  } catch (err) {
    logger.error(`Failed to update collection membership: ${err}`);
    throw new Error(`Failed to update collection membership: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Delete collection membership
 * 
 * @param id Membership ID
 * @returns Deleted membership document
 */
export async function deleteCollectionMembership(id: string): Promise<CollectionMembershipDocument | null> {
  try {
    const membership = await CollectionMembership.findOneAndDelete({ id });
    
    // If this was primary, make another membership primary if available
    if (membership && membership.primaryMembership) {
      const nextPrimary = await CollectionMembership.findOne({ materialId: membership.materialId });
      if (nextPrimary) {
        await CollectionMembership.updateOne(
          { id: nextPrimary.id },
          { $set: { primaryMembership: true } }
        );
      }
    }
    
    return membership;
  } catch (err) {
    logger.error(`Failed to delete collection membership: ${err}`);
    throw new Error(`Failed to delete collection membership: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get memberships for a material
 * 
 * @param materialId Material ID
 * @returns Array of membership documents
 */
export async function getMembershipsForMaterial(materialId: string): Promise<CollectionMembershipDocument[]> {
  try {
    return await CollectionMembership.find({ materialId }).sort({ primaryMembership: -1, position: 1 });
  } catch (err) {
    logger.error(`Failed to get memberships for material: ${err}`);
    throw new Error(`Failed to get memberships for material: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get memberships for a collection
 * 
 * @param collectionId Collection ID
 * @returns Array of membership documents
 */
export async function getMembershipsForCollection(collectionId: string): Promise<CollectionMembershipDocument[]> {
  try {
    return await CollectionMembership.find({ collectionId }).sort({ position: 1 });
  } catch (err) {
    logger.error(`Failed to get memberships for collection: ${err}`);
    throw new Error(`Failed to get memberships for collection: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get materials in a collection
 * 
 * @param collectionId Collection ID
 * @param includeSubcollections Whether to include materials from subcollections
 * @returns Array of material IDs
 */
export async function getMaterialsInCollection(
  collectionId: string,
  includeSubcollections: boolean = false
): Promise<string[]> {
  try {
    let filter: any = { collectionId };
    
    // If including subcollections, use path to find all materials
    if (includeSubcollections) {
      filter = { path: collectionId };
    }
    
    const memberships = await CollectionMembership.find(filter);
    return memberships.map(membership => membership.materialId);
  } catch (err) {
    logger.error(`Failed to get materials in collection: ${err}`);
    throw new Error(`Failed to get materials in collection: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Update membership path based on collection hierarchy
 * 
 * @param membershipData Membership data
 */
async function updateMembershipPath(membershipData: Partial<CollectionMembershipDocument>): Promise<void> {
  if (!membershipData.collectionId) {
    return;
  }
  
  try {
    // Get the Collection model
    const Collection = mongoose.model('Collection');
    
    // Find the collection
    const collection = await Collection.findOne({ id: membershipData.collectionId });
    if (!collection) {
      return;
    }
    
    // Get collection hierarchy
    const path = [];
    let currentCollection = collection;
    let nestingLevel = 0;
    
    // Build path from current collection up to root
    while (currentCollection) {
      path.unshift(currentCollection.id);
      nestingLevel++;
      
      if (!currentCollection.parentCollectionId) {
        break;
      }
      
      currentCollection = await Collection.findOne({ id: currentCollection.parentCollectionId });
    }
    
    // Set path and nesting level
    membershipData.path = path;
    membershipData.nestingLevel = nestingLevel;
  } catch (err) {
    logger.error(`Failed to update membership path: ${err}`);
  }
}

/**
 * Create or update material memberships in bulk
 * 
 * @param memberships Array of membership data
 * @param userId User ID
 * @returns Number of memberships created
 */
export async function batchCreateMemberships(
  memberships: Array<{
    materialId: string;
    collectionId: string;
    primaryMembership?: boolean;
    position?: number;
  }>,
  userId: string
): Promise<number> {
  try {
    let createdCount = 0;
    
    // Process each membership
    for (const membershipData of memberships) {
      // Check if membership already exists
      const existingMembership = await CollectionMembership.findOne({
        materialId: membershipData.materialId,
        collectionId: membershipData.collectionId
      });
      
      if (existingMembership) {
        // Update existing membership
        await updateCollectionMembership(existingMembership.id, {
          primaryMembership: membershipData.primaryMembership,
          position: membershipData.position,
          updatedAt: new Date()
        });
      } else {
        // Create new membership
        await createCollectionMembership({
          ...membershipData,
          addedBy: userId,
          addedAt: new Date(),
          updatedAt: new Date()
        });
        createdCount++;
      }
    }
    
    return createdCount;
  } catch (err) {
    logger.error(`Failed to batch create memberships: ${err}`);
    throw new Error(`Failed to batch create memberships: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export default CollectionMembership;
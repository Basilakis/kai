/**
 * Material Relationship Model
 * 
 * This model represents relationships between materials in the knowledge base.
 * It allows for enhanced cross-referencing between related materials with
 * relationship types, strengths, and metadata.
 */

import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/**
 * Relationship types for materials
 */
export type MaterialRelationshipType = 
  | 'complementary'    // Materials that work well together
  | 'alternative'      // Materials that can substitute for each other
  | 'series'           // Materials that belong to the same series
  | 'variant'          // Material variants (different colors, sizes, etc.)
  | 'accessory'        // Accessories for a material
  | 'required'         // Materials required for using another material
  | 'custom';          // Custom relationship type with description

/**
 * Material relationship document interface
 */
export interface MaterialRelationshipDocument extends Document {
  id: string;
  sourceMaterialId: string;    // ID of the source material
  targetMaterialId: string;    // ID of the target material
  relationshipType: MaterialRelationshipType;
  strength: number;            // Relationship strength (0-1)
  bidirectional: boolean;      // If true, relationship applies in both directions
  createdBy: string;           // User ID who created the relationship
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    description?: string;      // Description of the relationship
    customType?: string;       // Name for custom relationship type
    displayOrder?: number;     // Order to display relationships
    [key: string]: any;        // Additional metadata
  };
}

/**
 * Material relationship schema
 */
const materialRelationshipSchema = new Schema<MaterialRelationshipDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      default: () => uuidv4()
    },
    sourceMaterialId: {
      type: String,
      required: true,
      index: true
    },
    targetMaterialId: {
      type: String,
      required: true,
      index: true
    },
    relationshipType: {
      type: String,
      required: true,
      enum: [
        'complementary',
        'alternative',
        'series',
        'variant',
        'accessory',
        'required',
        'custom'
      ],
      default: 'complementary'
    },
    strength: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      default: 1
    },
    bidirectional: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: String,
      required: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Create indexes
materialRelationshipSchema.index({ id: 1 }, { unique: true });
materialRelationshipSchema.index({ sourceMaterialId: 1, targetMaterialId: 1, relationshipType: 1 }, { unique: true });
materialRelationshipSchema.index({ updatedAt: -1 });

/**
 * Material relationship model
 */
const MaterialRelationship = mongoose.model<MaterialRelationshipDocument>('MaterialRelationship', materialRelationshipSchema);

/**
 * Create a new material relationship
 * 
 * @param relationshipData Relationship data
 * @returns Created relationship document
 */
export async function createMaterialRelationship(
  relationshipData: Partial<MaterialRelationshipDocument>
): Promise<MaterialRelationshipDocument> {
  try {
    const relationship = new MaterialRelationship(relationshipData);
    await relationship.save();
    
    // If bidirectional, create the inverse relationship automatically
    if (relationship.bidirectional && relationship.sourceMaterialId !== relationship.targetMaterialId) {
      const inverseRelationshipData: Partial<MaterialRelationshipDocument> = {
        sourceMaterialId: relationship.targetMaterialId,
        targetMaterialId: relationship.sourceMaterialId,
        relationshipType: relationship.relationshipType,
        strength: relationship.strength,
        bidirectional: relationship.bidirectional,
        createdBy: relationship.createdBy,
        metadata: relationship.metadata
      };
      
      // Check if the inverse relationship already exists
      const exists = await MaterialRelationship.findOne({
        sourceMaterialId: inverseRelationshipData.sourceMaterialId,
        targetMaterialId: inverseRelationshipData.targetMaterialId,
        relationshipType: inverseRelationshipData.relationshipType
      });
      
      if (!exists) {
        const inverseRelationship = new MaterialRelationship(inverseRelationshipData);
        await inverseRelationship.save();
      }
    }
    
    return relationship;
  } catch (err) {
    logger.error(`Failed to create material relationship: ${err}`);
    throw new Error(`Failed to create material relationship: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get a material relationship by ID
 * 
 * @param id Relationship ID
 * @returns Relationship document
 */
export async function getMaterialRelationshipById(id: string): Promise<MaterialRelationshipDocument | null> {
  try {
    return await MaterialRelationship.findOne({ id });
  } catch (err) {
    logger.error(`Failed to get material relationship: ${err}`);
    throw new Error(`Failed to get material relationship: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Update a material relationship
 * 
 * @param id Relationship ID
 * @param updateData Update data
 * @returns Updated relationship document
 */
export async function updateMaterialRelationship(
  id: string,
  updateData: Partial<MaterialRelationshipDocument>
): Promise<MaterialRelationshipDocument | null> {
  try {
    const relationship = await MaterialRelationship.findOneAndUpdate(
      { id },
      { ...updateData, updatedAt: new Date() },
      { new: true }
    );
    
    // If bidirectional, update the inverse relationship too
    if (relationship && relationship.bidirectional && 
        relationship.sourceMaterialId !== relationship.targetMaterialId) {
      // Find the inverse relationship
      const inverseRelationship = await MaterialRelationship.findOne({
        sourceMaterialId: relationship.targetMaterialId,
        targetMaterialId: relationship.sourceMaterialId,
        relationshipType: relationship.relationshipType
      });
      
      if (inverseRelationship) {
        // Update the inverse relationship with relevant fields
        const inverseUpdateData: Partial<MaterialRelationshipDocument> = {};
        
        if ('strength' in updateData) {
          inverseUpdateData.strength = updateData.strength;
        }
        
        if ('bidirectional' in updateData) {
          inverseUpdateData.bidirectional = updateData.bidirectional;
        }
        
        if ('metadata' in updateData) {
          inverseUpdateData.metadata = updateData.metadata;
        }
        
        if (Object.keys(inverseUpdateData).length > 0) {
          await MaterialRelationship.findOneAndUpdate(
            { id: inverseRelationship.id },
            { ...inverseUpdateData, updatedAt: new Date() }
          );
        }
      }
    }
    
    return relationship;
  } catch (err) {
    logger.error(`Failed to update material relationship: ${err}`);
    throw new Error(`Failed to update material relationship: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Delete a material relationship
 * 
 * @param id Relationship ID
 * @returns Deleted relationship document
 */
export async function deleteMaterialRelationship(id: string): Promise<MaterialRelationshipDocument | null> {
  try {
    const relationship = await MaterialRelationship.findOne({ id });
    
    if (!relationship) {
      return null;
    }
    
    // If bidirectional, delete the inverse relationship too
    if (relationship.bidirectional && 
        relationship.sourceMaterialId !== relationship.targetMaterialId) {
      await MaterialRelationship.findOneAndDelete({
        sourceMaterialId: relationship.targetMaterialId,
        targetMaterialId: relationship.sourceMaterialId,
        relationshipType: relationship.relationshipType
      });
    }
    
    return await MaterialRelationship.findOneAndDelete({ id });
  } catch (err) {
    logger.error(`Failed to delete material relationship: ${err}`);
    throw new Error(`Failed to delete material relationship: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get all relationships for a material
 * 
 * @param materialId Material ID
 * @param relationshipType Optional relationship type to filter by
 * @returns Array of relationship documents
 */
export async function getMaterialRelationships(
  materialId: string,
  relationshipType?: MaterialRelationshipType
): Promise<MaterialRelationshipDocument[]> {
  try {
    const filter: any = {
      $or: [
        { sourceMaterialId: materialId },
        { targetMaterialId: materialId }
      ]
    };
    
    if (relationshipType) {
      filter.relationshipType = relationshipType;
    }
    
    return await MaterialRelationship.find(filter).sort({ 'metadata.displayOrder': 1, updatedAt: -1 });
  } catch (err) {
    logger.error(`Failed to get material relationships: ${err}`);
    throw new Error(`Failed to get material relationships: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get related materials for a material
 * 
 * @param materialId Material ID
 * @param options Query options
 * @returns Related materials with relationship info
 */
export async function getRelatedMaterials(
  materialId: string,
  options: {
    relationshipType?: MaterialRelationshipType;
    minStrength?: number;
    limit?: number;
    skip?: number;
  } = {}
): Promise<Array<{
  materialId: string;
  relationship: MaterialRelationshipDocument;
}>> {
  try {
    const {
      relationshipType,
      minStrength = 0,
      limit = 10,
      skip = 0
    } = options;
    
    // Build filter
    const filter: any = {
      $or: [
        { sourceMaterialId: materialId },
        { targetMaterialId: materialId }
      ],
      strength: { $gte: minStrength }
    };
    
    if (relationshipType) {
      filter.relationshipType = relationshipType;
    }
    
    // Get relationships
    const relationships = await MaterialRelationship.find(filter)
      .sort({ strength: -1, 'metadata.displayOrder': 1 })
      .skip(skip)
      .limit(limit);
    
    // Map relationships to related materials
    return relationships.map(relationship => {
      const relatedMaterialId = relationship.sourceMaterialId === materialId
        ? relationship.targetMaterialId
        : relationship.sourceMaterialId;
      
      return {
        materialId: relatedMaterialId,
        relationship
      };
    });
  } catch (err) {
    logger.error(`Failed to get related materials: ${err}`);
    throw new Error(`Failed to get related materials: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Create or update a batch of material relationships
 * 
 * @param relationships Array of relationship data
 * @param userId User ID who is creating/updating the relationships
 * @returns Number of relationships created
 */
export async function batchCreateMaterialRelationships(
  relationships: Array<{
    sourceMaterialId: string;
    targetMaterialId: string;
    relationshipType: MaterialRelationshipType;
    strength?: number;
    bidirectional?: boolean;
    metadata?: Record<string, any>;
  }>,
  userId: string
): Promise<number> {
  try {
    let createdCount = 0;
    
    // Process each relationship
    for (const relationshipData of relationships) {
      // Check if relationship already exists
      const existingRelationship = await MaterialRelationship.findOne({
        sourceMaterialId: relationshipData.sourceMaterialId,
        targetMaterialId: relationshipData.targetMaterialId,
        relationshipType: relationshipData.relationshipType
      });
      
      if (existingRelationship) {
        // Update existing relationship
        await updateMaterialRelationship(existingRelationship.id, {
          strength: relationshipData.strength,
          bidirectional: relationshipData.bidirectional,
          metadata: relationshipData.metadata
        });
      } else {
        // Create new relationship
        await createMaterialRelationship({
          ...relationshipData,
          createdBy: userId
        });
        createdCount++;
      }
    }
    
    return createdCount;
  } catch (err) {
    logger.error(`Failed to batch create material relationships: ${err}`);
    throw new Error(`Failed to batch create material relationships: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export default MaterialRelationship;
/**
 * Version Model
 * 
 * This model represents the versioning system for knowledge base entries.
 * It tracks changes to materials, collections, and other knowledge base entities
 * to enable auditing, comparison, and rollback capabilities.
 */

import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/**
 * Version document interface
 */
export interface VersionDocument extends Document {
  id: string;
  entityId: string;           // ID of the versioned entity (material, collection, etc.)
  entityType: string;         // Type of entity being versioned ('material', 'collection', etc.)
  versionNumber: number;      // Sequential version number
  changeType: 'create' | 'update' | 'delete'; // Type of change
  timestamp: Date;            // When the change occurred
  userId: string;             // Who made the change
  description?: string;       // Description of the change
  data: any;                  // Complete snapshot of the entity at this version
  changes?: {                 // What changed (for updates only)
    field: string;            // Field name that changed
    oldValue: any;            // Previous value
    newValue: any;            // New value
  }[];
  metadata?: {                // Additional information about the version
    source?: 'manual' | 'import' | 'extraction' | 'api';
    batchId?: string;         // For batch operations
    confidence?: number;      // For ML-extracted data
    notes?: string;           // Additional notes
  };
}

/**
 * Version schema
 */
const versionSchema = new Schema<VersionDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4
    },
    entityId: {
      type: String,
      required: true,
      index: true
    },
    entityType: {
      type: String,
      required: true,
      enum: ['material', 'collection', 'category', 'metadataField'],
      index: true
    },
    versionNumber: {
      type: Number,
      required: true,
      min: 1
    },
    changeType: {
      type: String,
      required: true,
      enum: ['create', 'update', 'delete']
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    },
    userId: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    data: {
      type: Schema.Types.Mixed,
      required: true
    },
    changes: [
      {
        field: {
          type: String,
          required: true
        },
        oldValue: Schema.Types.Mixed,
        newValue: Schema.Types.Mixed
      }
    ],
    metadata: {
      source: {
        type: String,
        enum: ['manual', 'import', 'extraction', 'api']
      },
      batchId: String,
      confidence: {
        type: Number,
        min: 0,
        max: 1
      },
      notes: String
    }
  },
  {
    timestamps: true
  }
);

// Create indexes
versionSchema.index({ id: 1 }, { unique: true });
versionSchema.index({ entityId: 1, entityType: 1 });
versionSchema.index({ entityId: 1, versionNumber: 1 });
versionSchema.index({ timestamp: 1 });
versionSchema.index({ userId: 1 });
versionSchema.index({ 'metadata.batchId': 1 });

/**
 * Compound index for efficient version history retrieval
 */
versionSchema.index({ entityId: 1, entityType: 1, versionNumber: -1 });

/**
 * Version model
 */
const Version = mongoose.model<VersionDocument>('Version', versionSchema);

/**
 * Create a new version
 * 
 * @param versionData Version data
 * @returns Created version document
 */
export async function createVersion(versionData: Partial<VersionDocument>): Promise<VersionDocument> {
  try {
    // Get the current highest version number for this entity
    const highestVersion = await Version.findOne(
      { 
        entityId: versionData.entityId, 
        entityType: versionData.entityType 
      },
      { versionNumber: 1 },
      { sort: { versionNumber: -1 } }
    );
    
    // Set the new version number
    const newVersionNumber = highestVersion ? highestVersion.versionNumber + 1 : 1;
    
    // Create the new version
    const version = new Version({
      ...versionData,
      versionNumber: newVersionNumber
    });
    
    await version.save();
    return version;
  } catch (err) {
    logger.error(`Failed to create version: ${err}`);
    throw new Error(`Failed to create version: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get a version by ID
 * 
 * @param id Version ID
 * @returns Version document
 */
export async function getVersionById(id: string): Promise<VersionDocument | null> {
  try {
    return await Version.findOne({ id });
  } catch (err) {
    logger.error(`Failed to get version: ${err}`);
    throw new Error(`Failed to get version: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get version history for an entity
 * 
 * @param entityId Entity ID
 * @param entityType Entity type
 * @param options Query options
 * @returns Array of version documents
 */
export async function getVersionHistory(
  entityId: string,
  entityType: string,
  options: {
    limit?: number;
    skip?: number;
    versionNumber?: number;
    fromDate?: Date;
    toDate?: Date;
    changeType?: 'create' | 'update' | 'delete';
  } = {}
): Promise<{
  versions: VersionDocument[];
  total: number;
}> {
  try {
    const {
      limit = 10,
      skip = 0,
      versionNumber,
      fromDate,
      toDate,
      changeType
    } = options;
    
    // Build query
    const filter: any = {
      entityId,
      entityType
    };
    
    // Version number filter
    if (versionNumber) {
      filter.versionNumber = versionNumber;
    }
    
    // Date range filter
    if (fromDate || toDate) {
      filter.timestamp = {};
      if (fromDate) {
        filter.timestamp.$gte = fromDate;
      }
      if (toDate) {
        filter.timestamp.$lte = toDate;
      }
    }
    
    // Change type filter
    if (changeType) {
      filter.changeType = changeType;
    }
    
    // Execute query
    const versions = await Version.find(filter)
      .sort({ versionNumber: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Version.countDocuments(filter);
    
    return { versions, total };
  } catch (err) {
    logger.error(`Failed to get version history: ${err}`);
    throw new Error(`Failed to get version history: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get a specific version of an entity
 * 
 * @param entityId Entity ID
 * @param entityType Entity type
 * @param versionNumber Version number
 * @returns Version document
 */
export async function getEntityVersion(
  entityId: string,
  entityType: string,
  versionNumber: number
): Promise<VersionDocument | null> {
  try {
    return await Version.findOne({
      entityId,
      entityType,
      versionNumber
    });
  } catch (err) {
    logger.error(`Failed to get entity version: ${err}`);
    throw new Error(`Failed to get entity version: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Compare two versions of an entity
 * 
 * @param entityId Entity ID
 * @param entityType Entity type
 * @param versionA First version number
 * @param versionB Second version number
 * @returns Object containing both versions and differences
 */
export async function compareVersions(
  entityId: string,
  entityType: string,
  versionA: number,
  versionB: number
): Promise<{
  versionA: VersionDocument | null;
  versionB: VersionDocument | null;
  differences: {
    field: string;
    valueA: any;
    valueB: any;
  }[];
}> {
  try {
    // Get both versions
    const [docA, docB] = await Promise.all([
      Version.findOne({ entityId, entityType, versionNumber: versionA }),
      Version.findOne({ entityId, entityType, versionNumber: versionB })
    ]);
    
    if (!docA || !docB) {
      return {
        versionA: docA,
        versionB: docB,
        differences: []
      };
    }
    
    // Compare the data objects
    const differences = compareObjects(docA.data, docB.data);
    
    return {
      versionA: docA,
      versionB: docB,
      differences
    };
  } catch (err) {
    logger.error(`Failed to compare versions: ${err}`);
    throw new Error(`Failed to compare versions: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Compare two objects and find differences
 * 
 * @param objA First object
 * @param objB Second object
 * @param path Current path (for recursion)
 * @returns Array of differences
 */
function compareObjects(
  objA: any,
  objB: any,
  path: string = ''
): Array<{
  field: string;
  valueA: any;
  valueB: any;
}> {
  // Initialize differences array
  const differences: Array<{
    field: string;
    valueA: any;
    valueB: any;
  }> = [];
  
  // Get all keys from both objects
  const keysA = objA ? Object.keys(objA) : [];
  const keysB = objB ? Object.keys(objB) : [];
  const allKeys = Array.from(new Set([...keysA, ...keysB]));
  
  // Compare each key
  for (const key of allKeys) {
    const currentPath = path ? `${path}.${key}` : key;
    const valueA = objA?.[key];
    const valueB = objB?.[key];
    
    // If the key exists in both objects
    if (objA && key in objA && objB && key in objB) {
      // If both values are objects, recurse
      if (
        typeof valueA === 'object' && 
        valueA !== null &&
        typeof valueB === 'object' && 
        valueB !== null &&
        !Array.isArray(valueA) &&
        !Array.isArray(valueB)
      ) {
        differences.push(...compareObjects(valueA, valueB, currentPath));
      }
      // If arrays, compare items
      else if (Array.isArray(valueA) && Array.isArray(valueB)) {
        if (JSON.stringify(valueA) !== JSON.stringify(valueB)) {
          differences.push({
            field: currentPath,
            valueA,
            valueB
          });
        }
      }
      // Otherwise, direct comparison
      else if (valueA !== valueB) {
        differences.push({
          field: currentPath,
          valueA,
          valueB
        });
      }
    }
    // If the key exists only in A
    else if (objA && key in objA) {
      differences.push({
        field: currentPath,
        valueA,
        valueB: undefined
      });
    }
    // If the key exists only in B
    else if (objB && key in objB) {
      differences.push({
        field: currentPath,
        valueA: undefined,
        valueB
      });
    }
  }
  
  return differences;
}

/**
 * Track a change to an entity by creating a new version
 * 
 * @param entityId Entity ID
 * @param entityType Entity type
 * @param changeType Type of change
 * @param data Current entity data
 * @param options Additional options
 * @returns Created version document
 */
export async function trackEntityChange(
  entityId: string,
  entityType: string,
  changeType: 'create' | 'update' | 'delete',
  data: any,
  options: {
    userId: string;
    description?: string;
    previousData?: any;
    metadata?: {
      source?: 'manual' | 'import' | 'extraction' | 'api';
      batchId?: string;
      confidence?: number;
      notes?: string;
    };
  }
): Promise<VersionDocument> {
  try {
    const { userId, description, previousData, metadata } = options;
    
    // Calculate changes for updates
    let changes;
    if (changeType === 'update' && previousData) {
      changes = compareObjects(previousData, data).map(diff => ({
        field: diff.field,
        oldValue: diff.valueA,
        newValue: diff.valueB
      }));
    }
    
    // Create version
    return await createVersion({
      entityId,
      entityType,
      changeType,
      data,
      userId,
      description,
      changes,
      metadata,
      timestamp: new Date()
    });
  } catch (err) {
    logger.error(`Failed to track entity change: ${err}`);
    throw new Error(`Failed to track entity change: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export default Version;
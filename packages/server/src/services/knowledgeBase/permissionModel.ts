/**
 * Knowledge Base Permission Model
 * 
 * Provides a granular permission system for the knowledge base.
 * Allows defining access controls at collection, material, and operation levels.
 */

import mongoose from 'mongoose';
import type { Document } from 'mongoose';
import { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';

/**
 * Permission levels for knowledge base entities
 */
export enum PermissionLevel {
  NONE = 'none',           // No access
  READ = 'read',           // Read-only access
  COMMENT = 'comment',     // Can read and comment
  CONTRIBUTE = 'contribute', // Can read, comment, and add new items
  EDIT = 'edit',           // Can read, comment, add, and edit items
  MANAGE = 'manage',       // Can read, comment, add, edit, and manage items
  ADMIN = 'admin'          // Full admin access
}

/**
 * Scope types for permissions
 */
export enum PermissionScope {
  GLOBAL = 'global',             // Global permissions
  COLLECTION = 'collection',     // Collection-specific permissions
  MATERIAL = 'material',         // Material-specific permissions
  CATEGORY = 'category',         // Category-specific permissions
  TAG = 'tag'                    // Tag-specific permissions
}

/**
 * Permission rules for knowledge base entities
 */
export interface PermissionRule {
  scope: PermissionScope;         // Scope of the permission
  entityId?: string;              // Entity ID for scoped permissions
  level: PermissionLevel;         // Permission level
  operations?: string[];          // Specific operations allowed
  conditions?: Record<string, any>; // Additional conditions
}

/**
 * User's role in the knowledge base
 */
export enum KnowledgeBaseRole {
  VIEWER = 'viewer',       // Basic viewer role
  CONTRIBUTOR = 'contributor', // Can contribute content
  EDITOR = 'editor',       // Can edit content
  CURATOR = 'curator',     // Can curate and organize content
  ADMIN = 'admin'          // Admin role
}

/**
 * Knowledge base user permission document interface
 */
export interface KnowledgeBasePermissionDocument extends Document {
  id: string;                    // Unique permission ID
  userId: string;                // User ID
  role: KnowledgeBaseRole;       // User's role
  rules: PermissionRule[];       // Permission rules
  createdAt: Date;               // Creation timestamp
  updatedAt: Date;               // Update timestamp
  createdBy: string;             // User who created the permission
  expiry?: Date;                 // Optional expiry date
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Knowledge base permission schema
 */
const knowledgeBasePermissionSchema = new Schema<KnowledgeBasePermissionDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      default: () => uuidv4()
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    role: {
      type: String,
      required: true,
      enum: Object.values(KnowledgeBaseRole),
      default: KnowledgeBaseRole.VIEWER
    },
    rules: [{
      scope: {
        type: String,
        required: true,
        enum: Object.values(PermissionScope)
      },
      entityId: {
        type: String
      },
      level: {
        type: String,
        required: true,
        enum: Object.values(PermissionLevel)
      },
      operations: [String],
      conditions: Schema.Types.Mixed
    }],
    createdBy: {
      type: String,
      required: true
    },
    expiry: {
      type: Date
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
knowledgeBasePermissionSchema.index({ userId: 1 });
knowledgeBasePermissionSchema.index({ 'rules.scope': 1, 'rules.entityId': 1 });
knowledgeBasePermissionSchema.index({ updatedAt: -1 });

/**
 * Knowledge base permission model
 */
const KnowledgeBasePermission = mongoose.model<KnowledgeBasePermissionDocument>(
  'KnowledgeBasePermission', 
  knowledgeBasePermissionSchema
);

/**
 * Create a new permission
 * 
 * @param permissionData Permission data
 * @returns Created permission document
 */
export async function createPermission(
  permissionData: Partial<KnowledgeBasePermissionDocument>
): Promise<KnowledgeBasePermissionDocument> {
  try {
    // Ensure the permission has an ID
    permissionData.id = permissionData.id || uuidv4();
    
    // Create the permission
    const permission = new KnowledgeBasePermission(permissionData);
    await permission.save();
    
    return permission;
  } catch (err) {
    logger.error(`Failed to create knowledge base permission: ${err}`);
    throw new Error(`Failed to create knowledge base permission: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get a permission by ID
 * 
 * @param id Permission ID
 * @returns Permission document
 */
export async function getPermissionById(id: string): Promise<KnowledgeBasePermissionDocument | null> {
  try {
    return await KnowledgeBasePermission.findOne({ id });
  } catch (err) {
    logger.error(`Failed to get knowledge base permission: ${err}`);
    throw new Error(`Failed to get knowledge base permission: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get user's permissions
 * 
 * @param userId User ID
 * @returns Array of permission documents
 */
export async function getUserPermissions(userId: string): Promise<KnowledgeBasePermissionDocument[]> {
  try {
    return await KnowledgeBasePermission.find({ userId });
  } catch (err) {
    logger.error(`Failed to get user permissions: ${err}`);
    throw new Error(`Failed to get user permissions: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Update a permission
 * 
 * @param id Permission ID
 * @param updateData Update data
 * @returns Updated permission document
 */
export async function updatePermission(
  id: string, 
  updateData: Partial<KnowledgeBasePermissionDocument>
): Promise<KnowledgeBasePermissionDocument | null> {
  try {
    // Ensure we don't update the ID
    if (updateData.id) {
      delete updateData.id;
    }
    
    // Update the permission
    return await KnowledgeBasePermission.findOneAndUpdate(
      { id },
      { $set: updateData },
      { new: true }
    );
  } catch (err) {
    logger.error(`Failed to update knowledge base permission: ${err}`);
    throw new Error(`Failed to update knowledge base permission: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Delete a permission
 * 
 * @param id Permission ID
 * @returns Deleted permission document
 */
export async function deletePermission(id: string): Promise<KnowledgeBasePermissionDocument | null> {
  try {
    return await KnowledgeBasePermission.findOneAndDelete({ id });
  } catch (err) {
    logger.error(`Failed to delete knowledge base permission: ${err}`);
    throw new Error(`Failed to delete knowledge base permission: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get all permissions for an entity
 * 
 * @param entityType Entity type
 * @param entityId Entity ID
 * @returns Array of permission documents
 */
export async function getEntityPermissions(
  scope: PermissionScope,
  entityId: string
): Promise<KnowledgeBasePermissionDocument[]> {
  try {
    return await KnowledgeBasePermission.find({
      'rules.scope': scope,
      'rules.entityId': entityId
    });
  } catch (err) {
    logger.error(`Failed to get entity permissions: ${err}`);
    throw new Error(`Failed to get entity permissions: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Check if a user has permission for an entity
 * 
 * @param userId User ID
 * @param scope Permission scope
 * @param entityId Entity ID
 * @param requiredLevel Required permission level
 * @param operation Specific operation to check
 * @returns Whether the user has permission
 */
export async function hasPermission(
  userId: string,
  scope: PermissionScope,
  entityId: string,
  requiredLevel: PermissionLevel,
  operation?: string
): Promise<boolean> {
  try {
    // Get the user's permissions
    const permissions = await getUserPermissions(userId);
    
    // Check if the user has the required permission
    for (const permission of permissions) {
      // Check if the user is an admin (admin has all permissions)
      if (permission.role === KnowledgeBaseRole.ADMIN) {
        return true;
      }
      
      // Check each rule
      for (const rule of permission.rules) {
        // Check for global permissions
        if (rule.scope === PermissionScope.GLOBAL) {
          if (hasRequiredLevel(rule.level, requiredLevel, operation, rule.operations)) {
            return true;
          }
        }
        
        // Check for scope-specific permissions
        if (rule.scope === scope && rule.entityId === entityId) {
          if (hasRequiredLevel(rule.level, requiredLevel, operation, rule.operations)) {
            return true;
          }
        }
        
        // Check for category permissions (for material and collection permissions)
        if (scope === PermissionScope.MATERIAL || scope === PermissionScope.COLLECTION) {
          if (rule.scope === PermissionScope.CATEGORY) {
            // Check if the material/collection belongs to the category
            const belongsToCategory = await checkEntityBelongsToCategory(scope, entityId, rule.entityId || '');
            if (belongsToCategory && hasRequiredLevel(rule.level, requiredLevel, operation, rule.operations)) {
              return true;
            }
          }
        }
      }
    }
    
    return false;
  } catch (err) {
    logger.error(`Failed to check permission: ${err}`);
    return false;
  }
}

/**
 * Check if an entity belongs to a category
 * 
 * @param scope Entity scope
 * @param entityId Entity ID
 * @param categoryId Category ID
 * @returns Whether the entity belongs to the category
 */
async function checkEntityBelongsToCategory(
  scope: PermissionScope,
  entityId: string,
  categoryId: string
): Promise<boolean> {
  try {
    if (scope === PermissionScope.MATERIAL) {
      const Material = mongoose.model('Material');
      const material = await Material.findOne({ id: entityId, categoryIds: categoryId });
      return !!material;
    } else if (scope === PermissionScope.COLLECTION) {
      const Collection = mongoose.model('Collection');
      const collection = await Collection.findOne({ id: entityId, categoryIds: categoryId });
      return !!collection;
    }
    
    return false;
  } catch (err) {
    logger.error(`Failed to check entity belongs to category: ${err}`);
    return false;
  }
}

/**
 * Check if the given level meets the required level
 * 
 * @param level Given permission level
 * @param requiredLevel Required permission level
 * @param operation Specific operation to check
 * @param allowedOperations Allowed operations
 * @returns Whether the level meets the requirement
 */
function hasRequiredLevel(
  level: PermissionLevel,
  requiredLevel: PermissionLevel,
  operation?: string,
  allowedOperations?: string[]
): boolean {
  // Get numeric values for permission levels
  const levelValues: Record<PermissionLevel, number> = {
    [PermissionLevel.NONE]: 0,
    [PermissionLevel.READ]: 1,
    [PermissionLevel.COMMENT]: 2,
    [PermissionLevel.CONTRIBUTE]: 3,
    [PermissionLevel.EDIT]: 4,
    [PermissionLevel.MANAGE]: 5,
    [PermissionLevel.ADMIN]: 6
  };
  
  // Check if the level meets the required level
  if (levelValues[level] >= levelValues[requiredLevel]) {
    // Check specific operation if provided
    if (operation && allowedOperations && allowedOperations.length > 0) {
      return allowedOperations.includes(operation);
    }
    
    return true;
  }
  
  return false;
}

/**
 * Create default permissions for a new user
 * 
 * @param userId User ID
 * @param createdBy Admin user ID who created this user
 * @param role Default role (optional)
 * @returns Created permission document
 */
export async function createDefaultUserPermissions(
  userId: string,
  createdBy: string,
  role: KnowledgeBaseRole = KnowledgeBaseRole.VIEWER
): Promise<KnowledgeBasePermissionDocument> {
  try {
    // Define default permissions based on role
    const permissionData: Partial<KnowledgeBasePermissionDocument> = {
      userId,
      role,
      createdBy,
      rules: []
    };
    
    // Set default rules based on role
    switch (role) {
      case KnowledgeBaseRole.ADMIN:
        permissionData.rules = [
          {
            scope: PermissionScope.GLOBAL,
            level: PermissionLevel.ADMIN
          }
        ];
        break;
        
      case KnowledgeBaseRole.CURATOR:
        permissionData.rules = [
          {
            scope: PermissionScope.GLOBAL,
            level: PermissionLevel.MANAGE
          }
        ];
        break;
        
      case KnowledgeBaseRole.EDITOR:
        permissionData.rules = [
          {
            scope: PermissionScope.GLOBAL,
            level: PermissionLevel.EDIT
          }
        ];
        break;
        
      case KnowledgeBaseRole.CONTRIBUTOR:
        permissionData.rules = [
          {
            scope: PermissionScope.GLOBAL,
            level: PermissionLevel.CONTRIBUTE
          }
        ];
        break;
        
      case KnowledgeBaseRole.VIEWER:
      default:
        permissionData.rules = [
          {
            scope: PermissionScope.GLOBAL,
            level: PermissionLevel.READ
          }
        ];
        break;
    }
    
    // Create and return the permission
    return await createPermission(permissionData);
  } catch (err) {
    logger.error(`Failed to create default user permissions: ${err}`);
    throw new Error(`Failed to create default user permissions: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get all users with a specific permission
 * 
 * @param scope Permission scope
 * @param entityId Entity ID
 * @param level Minimum permission level
 * @returns Array of user IDs
 */
export async function getUsersWithPermission(
  scope: PermissionScope,
  entityId: string,
  level: PermissionLevel
): Promise<string[]> {
  try {
    // Find permissions that match the criteria
    const permissions = await KnowledgeBasePermission.find({
      $or: [
        { role: KnowledgeBaseRole.ADMIN },
        {
          rules: {
            $elemMatch: {
              $or: [
                {
                  scope: PermissionScope.GLOBAL,
                  level: { $in: getEqualOrHigherLevels(level) }
                },
                {
                  scope,
                  entityId,
                  level: { $in: getEqualOrHigherLevels(level) }
                }
              ]
            }
          }
        }
      ]
    });
    
    // Extract user IDs
    return permissions.map((p: any) => p.userId);
  } catch (err) {
    logger.error(`Failed to get users with permission: ${err}`);
    return [];
  }
}

/**
 * Get equal or higher permission levels
 * 
 * @param level Permission level
 * @returns Array of equal or higher permission levels
 */
function getEqualOrHigherLevels(level: PermissionLevel): PermissionLevel[] {
  const levelValues: PermissionLevel[] = [
    PermissionLevel.NONE,
    PermissionLevel.READ,
    PermissionLevel.COMMENT,
    PermissionLevel.CONTRIBUTE,
    PermissionLevel.EDIT,
    PermissionLevel.MANAGE,
    PermissionLevel.ADMIN
  ];
  
  const levelIndex = levelValues.indexOf(level);
  if (levelIndex === -1) {
    return [level];
  }
  
  return levelValues.slice(levelIndex);
}

/**
 * Check if a user has read access to a collection
 * 
 * @param userId User ID
 * @param collectionId Collection ID
 * @returns Whether the user has access
 */
export async function hasCollectionAccess(userId: string, collectionId: string): Promise<boolean> {
  return hasPermission(userId, PermissionScope.COLLECTION, collectionId, PermissionLevel.READ);
}

/**
 * Check if a user has edit access to a collection
 * 
 * @param userId User ID
 * @param collectionId Collection ID
 * @returns Whether the user has access
 */
export async function canEditCollection(userId: string, collectionId: string): Promise<boolean> {
  return hasPermission(userId, PermissionScope.COLLECTION, collectionId, PermissionLevel.EDIT);
}

/**
 * Check if a user has access to a material
 * 
 * @param userId User ID
 * @param materialId Material ID
 * @returns Whether the user has access
 */
export async function hasMaterialAccess(userId: string, materialId: string): Promise<boolean> {
  return hasPermission(userId, PermissionScope.MATERIAL, materialId, PermissionLevel.READ);
}

/**
 * Check if a user can edit a material
 * 
 * @param userId User ID
 * @param materialId Material ID
 * @returns Whether the user can edit
 */
export async function canEditMaterial(userId: string, materialId: string): Promise<boolean> {
  return hasPermission(userId, PermissionScope.MATERIAL, materialId, PermissionLevel.EDIT);
}

/**
 * Get collections a user has access to
 * 
 * @param userId User ID
 * @param level Permission level
 * @returns Array of collection IDs
 */
export async function getUserAccessibleCollections(
  userId: string,
  level: PermissionLevel = PermissionLevel.READ
): Promise<string[]> {
  try {
    // Get the user's permissions
    const permissions = await getUserPermissions(userId);
    
    // Check if the user is an admin (admin has access to all collections)
    for (const permission of permissions) {
      if (permission.role === KnowledgeBaseRole.ADMIN) {
        // Get all collection IDs
        const Collection = mongoose.model('Collection');
        const collections = await Collection.find({}, { id: 1 });
        return collections.map((c: any) => c.id);
      }
      
      // Check for global edit permission
      for (const rule of permission.rules) {
        if (rule.scope === PermissionScope.GLOBAL && 
            hasRequiredLevel(rule.level, level)) {
          // Get all collection IDs
          const Collection = mongoose.model('Collection');
          const collections = await Collection.find({}, { id: 1 });
          return collections.map((c: any) => c.id);
        }
      }
    }
    
    // Find collections the user has direct access to
    const collectionIds = new Set<string>();
    
    for (const permission of permissions) {
      for (const rule of permission.rules) {
        if (rule.scope === PermissionScope.COLLECTION && 
            hasRequiredLevel(rule.level, level)) {
          if (rule.entityId) {
            collectionIds.add(rule.entityId);
          }
        }
      }
    }
    
    // Find collections the user has category-based access to
    for (const permission of permissions) {
      for (const rule of permission.rules) {
        if (rule.scope === PermissionScope.CATEGORY && 
            hasRequiredLevel(rule.level, level)) {
          if (rule.entityId) {
            // Find collections in this category
            const Collection = mongoose.model('Collection');
            const collections = await Collection.find(
              { categoryIds: rule.entityId },
              { id: 1 }
            );
            
            for (const collection of collections) {
              collectionIds.add(collection.id);
            }
          }
        }
      }
    }
    
    return Array.from(collectionIds);
  } catch (err) {
    logger.error(`Failed to get user accessible collections: ${err}`);
    return [];
  }
}

export default KnowledgeBasePermission;
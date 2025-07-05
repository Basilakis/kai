/**
 * Knowledge Base Permission Model
 * 
 * Provides a granular permission system for the knowledge base.
 * Allows defining access controls at collection, material, and operation levels.
 */

import { supabaseClient } from '../../../../shared/src/services/supabase/supabaseClient';
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
 * Knowledge base user permission document interface for Supabase
 */
export interface KnowledgeBasePermissionDocument {
  id: string;                    // Unique permission ID
  userId: string;                // User ID
  role: KnowledgeBaseRole;       // User's role
  rules: PermissionRule[];       // Permission rules
  createdAt: string;             // Creation timestamp (ISO string)
  updatedAt: string;             // Update timestamp (ISO string)
  createdBy: string;             // User who created the permission
  expiry?: string;               // Optional expiry date (ISO string)
  metadata?: Record<string, any>; // Additional metadata
}

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
    const id = permissionData.id || uuidv4();
    
    // Prepare data for Supabase
    const now = new Date().toISOString();
    const insertData = {
      ...permissionData,
      id,
      createdAt: now,
      updatedAt: now,
      metadata: permissionData.metadata || {}
    };
    
    // Create the permission in Supabase
    const { data, error } = await supabaseClient.getClient()
      .from('knowledge_base_permissions')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return data;
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
    const { data, error } = await supabaseClient.getClient()
      .from('knowledge_base_permissions')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw error;
    }
    
    return data;
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
    const { data, error } = await supabaseClient.getClient()
      .from('knowledge_base_permissions')
      .select('*')
      .eq('userId', userId);
    
    if (error) {
      throw error;
    }
    
    return data || [];
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
    const { id: _, ...dataToUpdate } = updateData;
    
    // Add updated timestamp
    const updatePayload = {
      ...dataToUpdate,
      updatedAt: new Date().toISOString()
    };
    
    // Update the permission
    const { data, error } = await supabaseClient.getClient()
      .from('knowledge_base_permissions')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw error;
    }
    
    return data;
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
    const { data, error } = await supabaseClient.getClient()
      .from('knowledge_base_permissions')
      .delete()
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw error;
    }
    
    return data;
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
    const { data: permissions, error } = await supabaseClient.getClient()
      .from('knowledge_base_permissions')
      .select('*');

    if (error) {
      logger.error(`Failed to get entity permissions: ${error.message}`);
      throw new Error(`Failed to get entity permissions: ${error.message}`);
    }

    if (!permissions) {
      return [];
    }

    // Filter permissions based on rules scope and entityId (client-side filtering for JSON fields)
    const filteredPermissions = permissions.filter((permission: KnowledgeBasePermissionDocument) => {
      if (permission.rules && Array.isArray(permission.rules)) {
        return permission.rules.some((rule: PermissionRule) =>
          rule.scope === scope && rule.entityId === entityId
        );
      }
      return false;
    });

    return filteredPermissions;
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
      const { data: material, error } = await supabaseClient.getClient()
        .from('materials')
        .select('id')
        .eq('id', entityId)
        .contains('categoryIds', [categoryId])
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error(`Failed to check material belongs to category: ${error.message}`);
        return false;
      }

      return !!material;
    } else if (scope === PermissionScope.COLLECTION) {
      const { data: collection, error } = await supabaseClient.getClient()
        .from('collections')
        .select('id')
        .eq('id', entityId)
        .contains('categoryIds', [categoryId])
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error(`Failed to check collection belongs to category: ${error.message}`);
        return false;
      }

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
    const supabase = supabaseClient.getClient();
    
    // Get all permissions from Supabase
    const { data: permissions, error } = await supabase
      .from('knowledge_base_permissions')
      .select('*');
    
    if (error) {
      logger.error(`Failed to get users with permission: ${error.message}`);
      return [];
    }
    
    if (!permissions) {
      return [];
    }
    
    const equalOrHigherLevels = getEqualOrHigherLevels(level);
    
    // Filter permissions that match the criteria (client-side filtering for complex logic)
    const matchingPermissions = permissions.filter((permission: KnowledgeBasePermissionDocument) => {
      // Check if user has ADMIN role
      if (permission.role === KnowledgeBaseRole.ADMIN) {
        return true;
      }
      
      // Check if user has matching rules
      if (permission.rules && Array.isArray(permission.rules)) {
        return permission.rules.some((rule: any) => {
          // Check for global scope with sufficient level
          if (rule.scope === PermissionScope.GLOBAL &&
              equalOrHigherLevels.includes(rule.level)) {
            return true;
          }
          
          // Check for specific scope and entity with sufficient level
          if (rule.scope === scope &&
              rule.entityId === entityId &&
              equalOrHigherLevels.includes(rule.level)) {
            return true;
          }
          
          return false;
        });
      }
      
      return false;
    });
    
    // Extract user IDs
    return matchingPermissions.map((p: KnowledgeBasePermissionDocument) => p.userId);
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
    const supabase = supabaseClient.getClient();
    
    // Get the user's permissions
    const permissions = await getUserPermissions(userId);
    
    // Check if the user is an admin (admin has access to all collections)
    for (const permission of permissions) {
      if (permission.role === KnowledgeBaseRole.ADMIN) {
        // Get all collection IDs
        const { data: collections, error } = await supabase
          .from('collections')
          .select('id');
        
        if (error) {
          logger.error(`Failed to get all collections: ${error.message}`);
          return [];
        }
        
        return collections ? collections.map((c: any) => c.id) : [];
      }
      
      // Check for global permission
      for (const rule of permission.rules) {
        if (rule.scope === PermissionScope.GLOBAL &&
            hasRequiredLevel(rule.level, level)) {
          // Get all collection IDs
          const { data: collections, error } = await supabase
            .from('collections')
            .select('id');
          
          if (error) {
            logger.error(`Failed to get all collections: ${error.message}`);
            return [];
          }
          
          return collections ? collections.map((c: any) => c.id) : [];
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
            // Find collections in this category using Supabase
            const { data: collections, error } = await supabase
              .from('collections')
              .select('id')
              .contains('categoryIds', [rule.entityId]);
            
            if (error) {
              logger.error(`Failed to get collections by category: ${error.message}`);
              continue;
            }
            
            if (collections) {
              for (const collection of collections) {
                collectionIds.add(collection.id);
              }
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

// All functions are now exported individually - no default export needed
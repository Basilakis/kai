/**
 * Server Material Types
 *
 * Extended material type definitions specific to the server package,
 * building on the shared base material definitions.
 * 
 * This file utilizes the extension mechanisms provided by the shared types
 * to ensure consistency across packages while adding server-specific fields.
 */

import {
  Material,
  validateMaterial,
  MaterialCore,
  ServerMaterialBase
} from '../../../shared/src/types/material';
import { formatDate } from '../../../shared/src/utils/formatting';

/**
 * Legacy database fields
 * Maintained for backward compatibility during Supabase migration
 */
interface LegacyDatabaseFields {
  _id?: string;
  __v?: number;
}

/**
 * Server-specific processing fields
 */
interface ProcessingFields {
  indexStatus?: 'pending' | 'indexed' | 'failed';
  searchScore?: number;
  processingHistory?: {
    action: string;
    timestamp: Date;
    details?: string;
  }[];
}

/**
 * Access control fields
 */
interface AccessControlFields {
  accessControl?: {
    visibility: 'public' | 'private' | 'organization';
    accessList?: string[];
    owner?: string;
  };
}

/**
 * Storage and persistence fields
 */
interface StorageFields {
  storageDetails?: {
    location: string;
    size?: number;
    backupStatus?: 'none' | 'pending' | 'completed';
    lastBackup?: Date;
  };
}

/**
 * Audit and history tracking fields
 */
interface AuditFields {
  auditLog?: {
    action: string;
    performedBy: string;
    timestamp: Date;
    previousValues?: Partial<MaterialCore>;
  }[];
}

/**
 * Server-specific Material interface
 * Extends the ServerMaterialBase from shared package with additional server-specific fields
 *
 * Using the ServerMaterialBase ensures we're building on the foundation
 * defined in the shared package, but with Supabase-compatible date types.
 */
export interface ServerMaterial extends Omit<ServerMaterialBase, 'createdAt' | 'updatedAt'>,
  LegacyDatabaseFields,
  ProcessingFields,
  AccessControlFields,
  StorageFields,
  AuditFields {
  // Override date fields for Supabase compatibility
  createdAt?: string; // ISO string format
  updatedAt?: string; // ISO string format
}

/**
 * Server Material Document
 * For use with Supabase/PostgreSQL
 */
export interface MaterialDocument extends Omit<ServerMaterial, 'updatedAt'> {
  // Document properties for compatibility
  isNew?: boolean;
  updatedAt: string; // ISO string format for Supabase compatibility
}

// Helper functions for Supabase compatibility

/**
 * Convert Date objects to ISO strings for Supabase compatibility
 */
export function formatDateForSupabase(date: Date | string): string {
  if (typeof date === 'string') return date;
  return date.toISOString();
}

/**
 * Update material timestamps for Supabase operations
 */
export function updateMaterialTimestamps(material: Partial<MaterialDocument>): Partial<MaterialDocument> {
  const now = new Date().toISOString();
  return {
    ...material,
    updatedAt: now,
    ...(material.isNew && { createdAt: now })
  };
}

/**
 * Add processing history entry
 */
export function addProcessingHistoryEntry(
  material: MaterialDocument,
  action: string,
  details?: string
): MaterialDocument {
  const processingHistory = material.processingHistory || [];
  const now = new Date();
  processingHistory.push({
    action,
    timestamp: now,
    details: details || `${action} operation on ${formatDate(now)}`
  });
  
  return {
    ...material,
    processingHistory,
    updatedAt: now.toISOString()
  };
}

/**
 * Convert to API response format
 */
export function toResponseObject(material: MaterialDocument): MaterialDocument {
  // Ensure ID is always available as 'id'
  const obj = { ...material };
  obj.id = obj.id || (obj as any)._id?.toString();
  
  return obj;
}

/**
 * Validate against shared schema
 */
export function validateAgainstSharedSchema(material: MaterialDocument) {
  return validateMaterial(material);
}

// Helper function to convert between types
export function toServerMaterial(material: Material): ServerMaterial {
  // Material from shared package includes createdBy as defined in MaterialCoreSchema
  // Use type assertion to help TypeScript recognize the property
  const createdByValue = (material as any).createdBy || 'system';
  
  return {
    ...material,
    // Convert Date objects to ISO strings for Supabase compatibility
    createdAt: material.createdAt ? formatDateForSupabase(material.createdAt) : undefined,
    updatedAt: material.updatedAt ? formatDateForSupabase(material.updatedAt) : undefined,
    indexStatus: 'pending',
    accessControl: {
      visibility: 'public',
      owner: createdByValue // Use extracted value to satisfy TypeScript
    },
    storageDetails: {
      location: 'default-storage',
    }
  };
}

/**
 * Server Material With Relations
 * Extends ServerMaterial and includes relation structure from MaterialWithRelations
 * Resolves type conflicts by using ServerMaterial's string-based date types
 */
export interface ServerMaterialWithRelations extends ServerMaterial {
  // Maintain the relatedMaterials structure from MaterialWithRelations
  relatedMaterials?: {
    similar?: string[];
    complementary?: string[];
    alternatives?: string[];
    // Additional server-specific relations can be added here
  };
  
  // Additional server-specific relation data
  collection?: {
    id: string;
    name: string;
    description?: string;
  };
  category?: {
    id: string;
    name: string;
    path?: string;
    parentId?: string;
  };
  creator?: {
    id: string;
    username: string;
    email?: string;
  };
  
  // Reference to full material objects (can be used alongside IDs in relatedMaterials)
  relatedMaterialObjects?: ServerMaterial[];
}
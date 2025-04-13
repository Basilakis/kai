/**
 * Client Material Types
 * 
 * Extended material type definitions specific to the client package,
 * building on the shared base material definitions.
 */

import { Material, ExtendMaterial, MaterialWithRelations } from '../../../shared/src/types/material';

/**
 * Client-specific Material interface
 * Extends the base Material with UI-specific fields
 */
export interface ClientMaterial extends ExtendMaterial<{
  // UI display properties
  thumbnailUrl?: string;
  displayName?: string;
  displayImage?: string;
  
  // UI state
  isFavorite?: boolean;
  isSelected?: boolean;
  isCompared?: boolean;
  
  // Client-side caching
  lastViewedAt?: Date;
  cachedAt?: Date;
  
  // Client-specific metadata
  localNotes?: string;
  userTags?: string[];
  
  // UI presentation hints
  featuredIn?: string[];
  similarMaterials?: string[];
  relatedMaterials?: string[];
  
  // Device-specific properties
  renderingSettings?: {
    quality: 'low' | 'medium' | 'high';
    textureResolution?: number;
    cacheLocally?: boolean;
  };
}> {}

/**
 * Client Material With Relations
 * Extended version of MaterialWithRelations with client-specific relation data
 */
export interface ClientMaterialWithRelations extends ClientMaterial, Omit<MaterialWithRelations, keyof Material | 'relatedMaterials'> {
  // Additional client-specific relation data
  recentlyViewedWith?: string[];
  userCollections?: {
    id: string;
    name: string;
  }[];
  similarityScore?: number;
}

/**
 * Material Search Result interface
 * Represents a material returned from search operations
 */
export interface MaterialSearchResult extends ClientMaterial {
  // Search-specific properties
  matchScore: number;
  matchFields: string[];
  highlightedText?: string;
  rank?: number;
}

/**
 * Type guard to check if a material is a ClientMaterial
 */
export function isClientMaterial(material: any): material is ClientMaterial {
  return material && 
    typeof material === 'object' && 
    'id' in material &&
    'name' in material;
}

/**
 * Type guard to check if a property exists on an object
 */
function _hasProperty<T extends object, K extends string>(obj: T, prop: K): obj is T & Record<K, unknown> {
  return prop in obj;
}

/**
 * Type guard to check if a value is a non-null object
 */
function isObject<T>(value: T): value is NonNullable<T> & object {
  return typeof value === 'object' && value !== null;
}

/**
 * Convert a base Material to a ClientMaterial
 */
export function toClientMaterial(material: Material): ClientMaterial {
  // Safely check and extract name
  let displayName = 'Unnamed Material';
  if (isObject(material) && 'name' in material && material.name) {
    displayName = String(material.name);
  }
    
  // Safely check and extract thumbnail URL from images
  let thumbnailUrl: string | undefined = undefined;
  if (isObject(material) && 
      'images' in material && 
      Array.isArray(material.images) && 
      material.images.length > 0 && 
      isObject(material.images[0]) && 
      'url' in material.images[0]) {
    thumbnailUrl = String(material.images[0].url);
  }

  // Create a ClientMaterial with the properties we have properly handling undefined values
  const baseProperties = {
    ...material,
    displayName
  };

  // Only add thumbnailUrl if it's defined to satisfy exactOptionalPropertyTypes
  const clientMaterial: ClientMaterial = thumbnailUrl !== undefined
    ? { ...baseProperties, thumbnailUrl }
    : baseProperties;

  return clientMaterial;
}
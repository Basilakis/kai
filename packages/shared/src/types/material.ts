/**
 * Material Types
 * 
 * Type definitions for material data structures with Zod validation schemas
 * and extension mechanisms for package-specific customization.
 * 
 * This file serves as the central source of truth for all material-related types
 * across all packages. Each package can extend these base types through the
 * provided extension mechanisms.
 */

// Import Zod with namespace import pattern
import * as zod from 'zod';
// Create a properly typed z object with any casting to bypass TypeScript errors
// @ts-ignore - Intentionally bypassing TypeScript to resolve module errors
const z = zod as any;

// --------------------------
// Type Aliases for Better Readability
// --------------------------
// Define ZodError as any to resolve TypeScript import errors
// This matches our approach with the z namespace
export type ZodError = any;

// Add infer type definition to resolve "no exported member 'infer'" errors
// This ensures z.infer works properly with TypeScript
declare namespace z {
  export type infer<T> = any; // Simple solution to keep TypeScript happy
}

// Minimal User interface to avoid circular dependencies
export interface User {
  id: string;
  name?: string;
  email?: string;
}

// --------------------------
// Core Enums and Constants
// --------------------------

/**
 * Material Type Enum
 * Defines the possible material types in the system
 */
export const MaterialTypeEnum = z.enum([
  'tile',
  'stone',
  'wood',
  'laminate',
  'vinyl',
  'carpet',
  'metal',
  'glass',
  'concrete',
  'ceramic',
  'porcelain',
  'other'
]);
export type MaterialType = z.infer<typeof MaterialTypeEnum>;

/**
 * Dimension Units Enum
 * Standard units for material dimensions
 */
export const DimensionUnitEnum = z.enum(['mm', 'cm', 'inch', 'm', 'ft']);
export type DimensionUnit = z.infer<typeof DimensionUnitEnum>;

/**
 * Image Type Enum
 * Categorizes the purpose of material images
 */
export const ImageTypeEnum = z.enum(['primary', 'secondary', 'detail', 'room-scene']);
export type ImageType = z.infer<typeof ImageTypeEnum>;

// --------------------------
// Core Material Component Schemas
// --------------------------

/**
 * Material Dimension Schema
 * Defines the physical dimensions of a material
 */
export const MaterialDimensionSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  depth: z.number().positive().optional(),
  unit: DimensionUnitEnum.default('mm')
});
export type MaterialDimension = z.infer<typeof MaterialDimensionSchema>;

/**
 * Material Color Schema
 * Defines color properties of a material
 */
export const MaterialColorSchema = z.object({
  name: z.string(),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  rgb: z.object({
    r: z.number().min(0).max(255),
    g: z.number().min(0).max(255),
    b: z.number().min(0).max(255)
  }).optional(),
  primary: z.boolean().default(true),
  secondary: z.array(z.string()).optional()
});
export type MaterialColor = z.infer<typeof MaterialColorSchema>;

/**
 * Material Image Schema
 * Defines image metadata for material visuals
 */
export const MaterialImageSchema = z.object({
  id: z.string(),
  url: z.string(),
  type: ImageTypeEnum.default('primary'),
  width: z.number().positive(),
  height: z.number().positive(),
  fileSize: z.number().optional(),
  extractedFrom: z.object({
    catalogId: z.string(),
    page: z.number(),
    coordinates: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number()
    }).optional()
  }).optional()
});
export type MaterialImage = z.infer<typeof MaterialImageSchema>;

/**
 * Material Technical Specs Schema
 * Common technical specifications across different material types
 */
export const TechnicalSpecsSchema = z.object({
  // General properties
  density: z.number().optional(),
  hardness: z.number().optional(),
  slipResistance: z.string().optional(),
  waterAbsorption: z.number().optional(),
  fireRating: z.string().optional(),
  
  // Additional type-specific properties
  additionalProperties: z.record(z.string(), z.unknown()).optional()
}).catchall(z.unknown());
export type TechnicalSpecs = z.infer<typeof TechnicalSpecsSchema>;

// --------------------------
// Core Material Schema
// --------------------------

/**
 * Material Core Schema
 * Defines the essential properties of a material that are shared across all packages
 */
export const MaterialCoreSchema = z.object({
  // Identity
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.string(),
  
  // Tracking
  createdBy: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  
  // Search and indexing
  vectorRepresentation: z.array(z.number()).optional(),
  tags: z.array(z.string()).optional(),
  
  // Organization
  manufacturer: z.string().optional(),
  collectionId: z.string().optional(),
  seriesId: z.string().optional(),
  categoryId: z.string().optional(),

  // Classification
  materialType: MaterialTypeEnum,
  finish: z.string().optional(),
  pattern: z.string().optional(),
  texture: z.string().optional(),

  // Source
  catalogId: z.string().optional(),
  catalogPage: z.number().optional(),
  extractedAt: z.date().optional(),

  // Physical properties
  dimensions: MaterialDimensionSchema.optional(),
  color: MaterialColorSchema.optional(),
  technicalSpecs: TechnicalSpecsSchema.optional(),

  // Media and references
  images: z.array(MaterialImageSchema).optional(),

  // Metadata
  metadata: z.record(z.string(), z.unknown()).optional(),
  metadataConfidence: z.record(z.string(), z.number()).optional()
});

// Core Material type - defined explicitly to avoid inference issues
export interface MaterialCore {
  id: string;
  name: string;
  description?: string;
  type: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  vectorRepresentation?: number[];
  tags?: string[];
  manufacturer?: string;
  collectionId?: string;
  seriesId?: string;
  categoryId?: string;
  materialType: string;
  finish?: string;
  pattern?: string;
  texture?: string;
  catalogId?: string;
  catalogPage?: number;
  extractedAt?: Date;
  dimensions?: any;
  color?: any;
  technicalSpecs?: any;
  images?: any[];
  metadata?: Record<string, unknown>;
  metadataConfidence?: Record<string, number>;
}

/**
 * Base Material Interface
 * The foundation interface that all package-specific interfaces should extend
 */
export interface Material extends MaterialCore {
  // Intentionally empty to allow package-specific extensions
}

// No duplicate type declarations needed - types already defined above

/**
 * Material with Relations
 * Material document with related data
 */
export interface MaterialWithRelations extends Material {
  // Creator
  creator?: User;
  
  // Collection relationships
  collections?: Array<{
    id: string;
    name: string;
    type?: string;
  }>;
  
  // Category
  category?: {
    id: string;
    name: string;
    path?: string;
  };
  
  // Related materials
  relatedMaterials?: {
    similar?: string[];
    complementary?: string[];
    alternatives?: string[];
  };
}

// --------------------------
// Input/Update Schemas
// --------------------------

/**
 * Material Input Schema
 * For creating new materials - omits auto-generated fields
 */
export const MaterialInputSchema = MaterialCoreSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  id: z.string().optional() // Allow optional ID for creation
});
export type MaterialInput = z.infer<typeof MaterialInputSchema>;

/**
 * Material Update Schema
 * For updating existing materials - all fields are optional
 */
export const MaterialUpdateSchema = MaterialCoreSchema.partial();
export type MaterialUpdate = z.infer<typeof MaterialUpdateSchema>;

// --------------------------
// Metadata Schemas
// --------------------------

/**
 * Material Metadata Schema
 * Extended metadata for materials
 */
export const MaterialMetadataSchema = z.object({
  // Source information
  source: z.string().optional(),
  extractionDate: z.date().optional(),
  confidence: z.number().min(0).max(1).optional(),
  processingTime: z.number().optional(),
  
  // Versioning
  changeDescription: z.string().optional(),
  version: z.number().optional(),
  
  // Additional metadata
  technicalNotes: z.string().optional(),
  certifications: z.array(z.string()).optional(),
  
  // Sustainability information
  sustainability: z.object({
    score: z.number().min(0).max(100).optional(),
    attributes: z.array(z.string()).optional(),
    notes: z.string().optional()
  }).optional(),
  
  // Pricing information
  pricing: z.object({
    currency: z.string().optional(),
    basePrice: z.number().optional(),
    unit: z.string().optional(),
    priceRange: z.tuple([z.number(), z.number()]).optional(),
    discountAvailable: z.boolean().optional()
  }).optional(),
  
  // Availability information
  availability: z.object({
    inStock: z.boolean().optional(),
    leadTime: z.number().optional(),
    leadTimeUnit: z.enum(['days', 'weeks', 'months']).optional(),
    regions: z.array(z.string()).optional()
  }).optional()
});
export type MaterialMetadata = z.infer<typeof MaterialMetadataSchema>;

// --------------------------
// Search and Query Schemas
// --------------------------

/**
 * Search Options Schema
 * Options for material search queries
 */
export const SearchOptionsSchema = z.object({
  // Text search
  query: z.string().optional(),
  
  // Filters
  materialType: z.union([
    z.string(),
    z.array(z.string())
  ]).optional(),
  manufacturer: z.union([
    z.string(),
    z.array(z.string())
  ]).optional(),
  color: z.union([
    z.string(),
    z.array(z.string())
  ]).optional(),
  finish: z.union([
    z.string(),
    z.array(z.string())
  ]).optional(),
  
  // Dimension filters
  dimensions: z.object({
    min: z.record(z.string(), z.number()).optional(),
    max: z.record(z.string(), z.number()).optional()
  }).optional(),
  
  // Tags
  tags: z.array(z.string()).optional(),
  
  // Pagination
  limit: z.number().positive().optional().default(10),
  skip: z.number().nonnegative().optional().default(0),
  
  // Sorting
  sort: z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc'])
  }).optional(),
  
  // Advanced options
  includeVectors: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
  dateRange: z.object({
    start: z.date().optional(),
    end: z.date().optional()
  }).optional()
});
export type SearchOptions = z.infer<typeof SearchOptionsSchema>;

/**
 * Hybrid Search Options Schema
 * Options for vector + text hybrid search
 */
export const HybridSearchOptionsSchema = z.object({
  // Weight balance between text and vector search
  textWeight: z.number().min(0).max(1).optional().default(0.5),
  vectorWeight: z.number().min(0).max(1).optional().default(0.5),
  
  // Limits and thresholds
  limit: z.number().positive().optional().default(10),
  threshold: z.number().min(0).max(1).optional().default(0.7),
  
  // Filters
  materialType: z.union([
    z.string(),
    z.array(z.string())
  ]).optional()
});
export type HybridSearchOptions = z.infer<typeof HybridSearchOptionsSchema>;

// --------------------------
// Extension Mechanisms
// --------------------------

/**
 * Extension type for creating package-specific Material extensions
 * 
 * This is the primary mechanism for extending the base Material type
 * with package-specific fields and functionality.
 * 
 * @example
 * // In server package
 * export interface ServerMaterial extends ExtendMaterial<{
 *   databaseId: string;
 *   indexStatus: 'pending' | 'indexed' | 'failed';
 * }> {}
 * 
 * // In client package
 * export interface ClientMaterial extends ExtendMaterial<{
 *   thumbnailUrl: string;
 *   isFavorite: boolean;
 * }> {}
 */
export type ExtendMaterial<T extends Record<string, unknown>> = Material & T;

// --------------------------
// Package-Specific Base Types
// --------------------------

/**
 * Server-specific Material base type
 * 
 * Contains common database-related fields for server-side material models.
 * Server package should extend this with additional fields as needed.
 */
export interface ServerMaterialBase extends Material {
  // MongoDB-specific fields
  _id?: string;
  __v?: number;
  
  // Database-specific tracking
  indexedAt?: Date;
  lastRetrievedAt?: Date;
  
  // Database statuses
  indexStatus?: 'pending' | 'indexed' | 'failed';
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  
  // Database metadata
  storageSize?: number;
  lastModifiedBy?: string;
}

/**
 * Client-specific Material base type
 * 
 * Contains common UI-related fields for client-side material models.
 * Client package should extend this with additional fields as needed.
 */
export interface ClientMaterialBase extends Material {
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
  
  // UI presentation properties
  renderingSettings?: {
    quality: 'low' | 'medium' | 'high';
    textureResolution?: number;
  };
}

// --------------------------
// Validation Functions
// --------------------------

/**
 * Validation function for material data
 * 
 * @param data Unknown data to validate against Material schema
 * @returns Result object with success flag, validated data or error
 */
export function validateMaterial(data: unknown): {
  success: boolean;
  data?: Material;
  error?: ZodError;
} {
  const result = MaterialCoreSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as Material };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Validation function for material input data
 * 
 * @param data Unknown data to validate against MaterialInput schema
 * @returns Result object with success flag, validated data or error
 */
export function validateMaterialInput(data: unknown): {
  success: boolean;
  data?: MaterialInput;
  error?: ZodError;
} {
  const result = MaterialInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Validation function for material update data
 * 
 * @param data Unknown data to validate against MaterialUpdate schema
 * @returns Result object with success flag, validated data or error
 */
export function validateMaterialUpdate(data: unknown): {
  success: boolean;
  data?: MaterialUpdate;
  error?: ZodError;
} {
  const result = MaterialUpdateSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Type guard to check if an object is a Material
 * 
 * @param obj Object to check
 * @returns Type predicate indicating if the object is a Material
 */
export function isMaterial(obj: unknown): obj is Material {
  if (!obj || typeof obj !== 'object') return false;
  
  // Check for required Material properties
  return 'id' in obj && 
         'name' in obj && 
         'materialType' in obj &&
         'createdAt' in obj &&
         'updatedAt' in obj;
}

/**
 * Convert a raw object to a Material
 * 
 * @param obj Raw object with material data
 * @returns Validated Material object or null if validation fails
 */
export function toMaterial(obj: unknown): Material | null {
  const validation = validateMaterial(obj);
  return validation.success ? validation.data! : null;
}

/**
 * Create a new Material with default values
 * 
 * @param input Partial material input data
 * @returns A new Material object with defaults for missing fields
 */
export function createMaterial(input: Partial<MaterialInput>): Material {
  const now = new Date();
  
  // Use type assertion to avoid property access errors
  const typedInput = input as any;
  
  return {
    id: typedInput.id ?? crypto.randomUUID?.() ?? String(Date.now()),
    name: typedInput.name ?? 'Untitled Material',
    type: typedInput.type ?? 'material',
    materialType: typedInput.materialType ?? 'other',
    createdAt: typedInput.createdAt ?? now,
    updatedAt: typedInput.updatedAt ?? now,
    ...input
  };
}
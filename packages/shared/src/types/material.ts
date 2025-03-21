/**
 * Material Types
 * 
 * Type definitions for material data structures
 */

import { User } from './user';

/**
 * Material Interface
 * Represents a material in the system
 */
export interface Material {
  id: string;
  name: string;
  description?: string;
  type: string;
  properties: Record<string, any>;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  vectorRepresentation?: number[];
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Material Document Interface
 * Represents a material in the system
 */
export interface MaterialDocument {
  id: string;
  name: string;
  description?: string;
  type: string;
  properties: Record<string, any>;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  vectorRepresentation?: number[];
  tags?: string[];
  metadata?: Record<string, any>;
  
  // Organization
  manufacturer?: string;
  collectionId?: string;
  seriesId?: string;
  categoryId?: string;
  
  // Classification
  materialType?: string;
  finish?: string;
  pattern?: string;
  texture?: string;
  
  // Source
  catalogId?: string;
  catalogPage?: number;
  extractedAt?: Date;
  
  // Physical properties
  dimensions?: Record<string, any>;
  color?: Record<string, any>;
  technicalSpecs?: Record<string, any>;
  
  // Media and references
  images?: Array<Record<string, any>>;
  
  // Additional data
  metadataConfidence?: Record<string, number>;
}

/**
 * Material with Relations
 * Material document with related data
 */
export interface MaterialWithRelations extends MaterialDocument {
  creator?: User;
  collections?: string[];
}

/**
 * Material Input
 * Data required to create a new material
 */
export interface MaterialInput {
  name: string;
  description?: string;
  type: string;
  properties: Record<string, any>;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Material Update Input
 * Data required to update an existing material
 */
export interface MaterialUpdateInput {
  name?: string;
  description?: string;
  type?: string;
  properties?: Record<string, any>;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Material Metadata
 * Additional structured information about materials
 */
export interface MaterialMetadata {
  source?: string;
  extractionDate?: Date;
  confidence?: number;
  processingTime?: number;
  changeDescription?: string;
  version?: number;
  technicalNotes?: string;
  certifications?: string[];
  sustainability?: {
    score?: number;
    attributes?: string[];
    notes?: string;
  };
  pricing?: {
    currency?: string;
    basePrice?: number;
    unit?: string;
    priceRange?: [number, number];
    discountAvailable?: boolean;
  };
  availability?: {
    inStock?: boolean;
    leadTime?: number;
    leadTimeUnit?: 'days' | 'weeks' | 'months';
    regions?: string[];
  };
  [key: string]: any;
}

/**
 * Search Options for material search
 */
export interface SearchOptions {
  query?: string;
  materialType?: string | string[];
  manufacturer?: string | string[];
  color?: string | string[];
  finish?: string | string[];
  dimensions?: {
    min?: Partial<Record<string, number>>;
    max?: Partial<Record<string, number>>;
  };
  tags?: string[];
  limit?: number;
  skip?: number;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  includeVectors?: boolean;
  confidence?: number;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  [key: string]: any;
}

/**
 * Hybrid Search Options for combined vector and text search
 */
export interface HybridSearchOptions {
  /**
   * Weight for text search results (0-1)
   * Higher values prioritize keyword matches
   */
  textWeight?: number;
  
  /**
   * Weight for vector search results (0-1)
   * Higher values prioritize semantic similarity
   */
  vectorWeight?: number;
  
  /**
   * Maximum number of results to return
   */
  limit?: number;
  
  /**
   * Minimum similarity threshold (0-1)
   */
  threshold?: number;
  
  /**
   * Filter by material type
   */
  materialType?: string | string[];
}
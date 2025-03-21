/**
 * Type definitions for tile-related entities
 */

/**
 * Represents a tile with its specifications and metadata
 */
export interface Tile {
  id: string;
  name: string;
  description?: string;
  manufacturer?: string;
  collection?: string;
  series?: string;
  
  // Physical properties
  size: TileSize;
  color: TileColor;
  material: TileMaterial;
  finish: TileFinish;
  pattern?: string;
  texture?: string;
  
  // Technical specifications
  waterAbsorption?: number;
  slipResistance?: string;
  frostResistance?: boolean;
  chemicalResistance?: string;
  scratchResistance?: string;
  
  // Images
  images: TileImage[];
  
  // Metadata
  tags: string[];
  catalogId: string;
  catalogPage?: number;
  extractedAt: Date;
  updatedAt: Date;
  
  // Vector representation for similarity search
  vectorRepresentation?: number[];
}

/**
 * Represents the size of a tile
 */
export interface TileSize {
  width: number;
  height: number;
  thickness?: number;
  unit: 'mm' | 'cm' | 'inch';
}

/**
 * Represents the color of a tile
 */
export interface TileColor {
  name: string;
  hex?: string;
  rgb?: {
    r: number;
    g: number;
    b: number;
  };
  primary: boolean;
  secondary?: string[];
}

/**
 * Represents the material of a tile
 */
export type TileMaterial = 
  | 'ceramic'
  | 'porcelain'
  | 'natural stone'
  | 'glass'
  | 'metal'
  | 'concrete'
  | 'terrazzo'
  | 'mosaic'
  | 'other';

/**
 * Represents the finish of a tile
 */
export type TileFinish = 
  | 'matte'
  | 'glossy'
  | 'polished'
  | 'honed'
  | 'textured'
  | 'brushed'
  | 'lappato'
  | 'satin'
  | 'other';

/**
 * Represents an image of a tile
 */
export interface TileImage {
  id: string;
  url: string;
  type: 'primary' | 'secondary' | 'detail' | 'room-scene';
  width: number;
  height: number;
  fileSize?: number;
  extractedFrom?: {
    catalogId: string;
    page: number;
    coordinates?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
}

/**
 * Represents a tile recognition result
 */
export interface TileRecognitionResult {
  query: {
    imageUrl: string;
    uploadedAt: Date;
  };
  matches: TileMatch[];
  processingTimeMs: number;
}

/**
 * Represents a match in a tile recognition result
 */
export interface TileMatch {
  tile: Tile;
  confidence: number;
  similarityScore: number;
  matchedFeatures?: {
    color: number;
    texture: number;
    pattern: number;
    shape: number;
  };
}
/**
 * Type definitions for catalog-related entities
 */

import { Tile } from './tile';

/**
 * Represents a catalog containing tile information
 */
export interface Catalog {
  id: string;
  name: string;
  description?: string;
  manufacturer: string;
  year?: number;
  
  // File information
  originalFileName: string;
  fileSize: number;
  fileType: 'pdf' | 'image' | 'other';
  fileUrl: string;
  
  // Processing status
  status: CatalogProcessingStatus;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  processingError?: string;
  
  // Extracted content
  pageCount?: number;
  extractedTiles: string[]; // Array of tile IDs
  extractedImages: CatalogImage[];
  extractedText?: string;
  
  // Metadata
  uploadedBy: string;
  uploadedAt: Date;
  updatedAt: Date;
  tags: string[];
}

/**
 * Represents the processing status of a catalog
 */
export type CatalogProcessingStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'partially_completed';

/**
 * Represents an image extracted from a catalog
 */
export interface CatalogImage {
  id: string;
  url: string;
  page: number;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  extractedText?: string;
  associatedTileId?: string;
  confidence?: number;
}

/**
 * Represents a page in a catalog
 */
export interface CatalogPage {
  catalogId: string;
  pageNumber: number;
  imageUrl: string;
  extractedText?: string;
  extractedImages: CatalogImage[];
  tiles: Tile[];
}

/**
 * Represents a batch processing job for catalogs
 */
export interface CatalogBatchJob {
  id: string;
  name: string;
  description?: string;
  catalogs: string[]; // Array of catalog IDs
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents statistics about catalogs
 */
export interface CatalogStats {
  totalCatalogs: number;
  totalProcessedCatalogs: number;
  totalPendingCatalogs: number;
  totalFailedCatalogs: number;
  totalExtractedTiles: number;
  totalExtractedImages: number;
  averageProcessingTime: number; // in milliseconds
  catalogsByManufacturer: Record<string, number>;
  catalogsByYear: Record<string, number>;
}
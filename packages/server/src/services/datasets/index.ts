/**
 * Dataset Services Index
 * 
 * Exports all dataset-related services from a single entry point.
 * This helps avoid circular dependencies and simplifies imports.
 */

// Export types and interfaces
export interface Dataset {
  id: string;
  name: string;
  description?: string;
  sourceDatasetId?: string;
  status: 'processing' | 'ready' | 'error';
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
}

export interface DatasetClass {
  id: string;
  datasetId: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
  imageCount?: number;
}

export interface DatasetImage {
  id: string;
  datasetId: string;
  classId: string;
  url: string;
  width?: number;
  height?: number;
  format?: string;
  size?: number;
  metadata?: Record<string, any>;
}

// Export from supabase-dataset-service
export { default as supabaseDatasetService } from './supabase-dataset-service';

// Export from dataset-vector-service
export { default as datasetVectorService } from './dataset-vector-service';

// Re-export both default services
import datasetVectorService from './dataset-vector-service';
import supabaseDatasetService from './supabase-dataset-service';

// Export default as an object containing both services
export default {
  datasetVectorService,
  supabaseDatasetService
};
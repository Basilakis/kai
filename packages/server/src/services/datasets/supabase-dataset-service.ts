/**
 * Supabase Dataset Service
 *
 * Provides methods for dataset management using Supabase as the backend.
 * Includes operations for datasets, classes, and images.
 */

import { logger } from '../../utils/logger';
import { supabase } from '../supabase/supabaseClient';
import { handleSupabaseError } from '../../../shared/src/utils/supabaseErrorHandler';

/**
 * Dataset interface
 */
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

/**
 * Dataset class interface
 */
export interface DatasetClass {
  id: string;
  datasetId: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
  imageCount?: number;
}

/**
 * Dataset image interface
 */
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

/**
 * Supabase Dataset Service
 * Manages dataset operations using Supabase
 */
export class SupabaseDatasetService {
  private static instance: SupabaseDatasetService;

  private constructor() {
    logger.info('Supabase Dataset Service initialized');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SupabaseDatasetService {
    if (!SupabaseDatasetService.instance) {
      SupabaseDatasetService.instance = new SupabaseDatasetService();
    }
    return SupabaseDatasetService.instance;
  }

  /**
   * Create a new dataset
   *
   * @param datasetData Dataset data
   * @returns Created dataset
   */
  public async createDataset(datasetData: Partial<Dataset>): Promise<Dataset> {
    try {
      logger.info(`Creating dataset: ${datasetData.name}`);

      const client = supabase.getClient();

      // Prepare data
      const data = {
        ...datasetData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Insert into Supabase
      // Cast client to any to allow chained methods
      const { data: result, error } = await (client as any)
        .from('datasets')
        .insert(data)
        .select('*')
        .single();

      if (error) {
        throw handleSupabaseError(error, 'createDataset', {
          datasetName: datasetData.name,
          table: 'datasets'
        });
      }

      if (!result) {
        throw new Error('Failed to create dataset, no result returned');
      }

      // Convert to camelCase for consistency
      return this.formatDataset(result);
    } catch (error) {
      logger.error(`Failed to create dataset: ${error}`);
      throw new Error(`Failed to create dataset: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get dataset by ID
   *
   * @param datasetId Dataset ID
   * @returns Dataset or null if not found
   */
  public async getDatasetById(datasetId: string): Promise<Dataset | null> {
    try {
      logger.info(`Getting dataset by ID: ${datasetId}`);

      const client = supabase.getClient();

      // Query Supabase
      // Cast client to any to allow chained methods
      const { data, error } = await (client as any)
        .from('datasets')
        .select('*')
        .eq('id', datasetId)
        .maybeSingle();

      if (error) {
        throw handleSupabaseError(error, 'getDatasetById', {
          datasetId,
          table: 'datasets'
        });
      }

      // Return null if not found
      if (!data) {
        return null;
      }

      // Convert to camelCase for consistency
      return this.formatDataset(data);
    } catch (error) {
      throw handleSupabaseError(error, 'getDatasetById', {
        datasetId,
        table: 'datasets'
      });
    }
  }

  /**
   * Update dataset
   *
   * @param datasetId Dataset ID
   * @param updateData Update data
   * @returns Updated dataset
   */
  public async updateDataset(datasetId: string, updateData: Partial<Dataset>): Promise<Dataset> {
    try {
      logger.info(`Updating dataset ${datasetId}`);

      const client = supabase.getClient();

      // Prepare data
      const data = {
        ...updateData,
        updated_at: new Date().toISOString()
      };

      // Update in Supabase
      // Cast client to any to allow chained methods
      const { data: result, error } = await (client as any)
        .from('datasets')
        .update(data)
        .eq('id', datasetId)
        .select('*')
        .single();

      if (error) {
        throw handleSupabaseError(error, 'updateDataset', {
          datasetId,
          table: 'datasets'
        });
      }

      if (!result) {
        throw new Error(`Dataset not found: ${datasetId}`);
      }

      // Convert to camelCase for consistency
      return this.formatDataset(result);
    } catch (error) {
      throw handleSupabaseError(error, 'updateDataset', {
        datasetId,
        table: 'datasets'
      });
    }
  }

  /**
   * Get classes for a dataset
   *
   * @param datasetId Dataset ID
   * @returns Array of dataset classes
   */
  public async getDatasetClasses(datasetId: string): Promise<DatasetClass[]> {
    try {
      logger.info(`Getting classes for dataset ${datasetId}`);

      const client = supabase.getClient();

      // Query Supabase
      // Cast client to any to allow chained methods
      const { data, error } = await (client as any)
        .from('dataset_classes')
        .select('*, image_count:dataset_images(count)')
        .eq('dataset_id', datasetId);

      if (error) {
        throw handleSupabaseError(error, 'getDatasetClasses', {
          datasetId,
          table: 'dataset_classes'
        });
      }

      if (!data) {
        return [];
      }

      // Convert to camelCase for consistency
      return data.map(this.formatDatasetClass);
    } catch (error) {
      throw handleSupabaseError(error, 'getDatasetClasses', {
        datasetId,
        table: 'dataset_classes'
      });
    }
  }

  /**
   * Create dataset class
   *
   * @param classData Class data
   * @returns Created dataset class
   */
  public async createDatasetClass(classData: Partial<DatasetClass>): Promise<DatasetClass> {
    try {
      logger.info(`Creating class for dataset ${classData.datasetId}: ${classData.name}`);

      const client = supabase.getClient();

      // Prepare data
      const data = {
        dataset_id: classData.datasetId,
        name: classData.name,
        description: classData.description,
        metadata: classData.metadata
      };

      // Insert into Supabase
      // Cast client to any to allow chained methods
      const { data: result, error } = await (client as any)
        .from('dataset_classes')
        .insert(data)
        .select('*')
        .single();

      if (error) {
        throw handleSupabaseError(error, 'createDatasetClass', {
          datasetId: classData.datasetId,
          className: classData.name,
          table: 'dataset_classes'
        });
      }

      if (!result) {
        throw new Error('Failed to create dataset class, no result returned');
      }

      // Convert to camelCase for consistency
      return this.formatDatasetClass(result);
    } catch (error) {
      throw handleSupabaseError(error, 'createDatasetClass', {
        datasetId: classData.datasetId,
        className: classData.name,
        table: 'dataset_classes'
      });
    }
  }

  /**
   * Get images for a class
   *
   * @param datasetId Dataset ID
   * @param classId Class ID
   * @returns Array of dataset images
   */
  public async getClassImages(datasetId: string, classId: string): Promise<DatasetImage[]> {
    try {
      logger.info(`Getting images for dataset ${datasetId}, class ${classId}`);

      const client = supabase.getClient();

      // Query Supabase
      // Cast client to any to allow chained methods
      const { data, error } = await (client as any)
        .from('dataset_images')
        .select('*')
        .eq('dataset_id', datasetId)
        .eq('class_id', classId);

      if (error) {
        throw error;
      }

      if (!data) {
        return [];
      }

      // Convert to camelCase for consistency
      return data.map(this.formatDatasetImage);
    } catch (error) {
      logger.error(`Failed to get class images: ${error}`);
      throw new Error(`Failed to get class images: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Format dataset data to camelCase
   *
   * @param data Database dataset data
   * @returns Formatted dataset
   */
  private formatDataset(data: any): Dataset {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      sourceDatasetId: data.source_dataset_id,
      status: data.status,
      metadata: data.metadata,
      createdAt: data.created_at ? new Date(data.created_at) : undefined,
      updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
      createdBy: data.created_by
    };
  }

  /**
   * Format dataset class data to camelCase
   *
   * @param data Database dataset class data
   * @returns Formatted dataset class
   */
  private formatDatasetClass(data: any): DatasetClass {
    return {
      id: data.id,
      datasetId: data.dataset_id,
      name: data.name,
      description: data.description,
      metadata: data.metadata,
      imageCount: data.image_count
    };
  }

  /**
   * Format dataset image data to camelCase
   *
   * @param data Database dataset image data
   * @returns Formatted dataset image
   */
  private formatDatasetImage(data: any): DatasetImage {
    return {
      id: data.id,
      datasetId: data.dataset_id,
      classId: data.class_id,
      url: data.url,
      width: data.width,
      height: data.height,
      format: data.format,
      size: data.size,
      metadata: data.metadata
    };
  }
}

// Export singleton instance
export const supabaseDatasetService = SupabaseDatasetService.getInstance();
export default supabaseDatasetService;
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../supabase/supabaseClient';
import { storage } from '../storage/s3StorageAdapter';
import { logger } from '../../utils/logger';

/**
 * Dataset status types
 */
export type DatasetStatus = 'created' | 'processing' | 'ready' | 'error';

/**
 * Dataset interface
 */
export interface Dataset {
  id: string;
  name: string;
  description?: string;
  status: DatasetStatus;
  classCount: number;
  imageCount: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
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
  imageCount: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Dataset image interface
 */
export interface DatasetImage {
  id: string;
  datasetId: string;
  classId: string;
  storagePath: string;
  filename: string;
  fileSize?: number;
  width?: number;
  height?: number;
  format?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Dataset search options
 */
export interface DatasetSearchOptions {
  query?: string;
  status?: DatasetStatus | DatasetStatus[];
  limit?: number;
  offset?: number;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

/**
 * Dataset service error class
 */
export class DatasetError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'DatasetError';
  }
}

/**
 * Unified dataset service that provides a consistent interface
 * for dataset operations across different storage providers
 */
export class DatasetService {
  private static instance: DatasetService;
  private readonly storageBucket = 'datasets';

  private constructor() {
    logger.info('Dataset Service initialized');
  }

  public static getInstance(): DatasetService {
    if (!DatasetService.instance) {
      DatasetService.instance = new DatasetService();
    }
    return DatasetService.instance;
  }

  /**
   * Create a new dataset
   */
  public async createDataset(data: Partial<Dataset>): Promise<Dataset> {
    try {
      const id = data.id || uuidv4();
      const now = new Date();

      const dataset = {
        id,
        name: data.name,
        description: data.description,
        status: data.status || 'created',
        classCount: 0,
        imageCount: 0,
        metadata: data.metadata || {},
        createdAt: now,
        updatedAt: now,
        createdBy: data.createdBy
      };

      const { data: result, error } = await supabase
        .getClient()
        .from('datasets')
        .insert(this.toSnakeCase(dataset))
        .select()
        .single();

      if (error) throw new DatasetError(`Failed to create dataset: ${error.message}`, error.code);
      if (!result) throw new DatasetError('Failed to create dataset: No result returned');

      return this.toCamelCase(result);
    } catch (error) {
      logger.error('Failed to create dataset', { error });
      throw error instanceof DatasetError ? error : new DatasetError(`Failed to create dataset: ${error}`);
    }
  }

  /**
   * Get a dataset by ID
   */
  public async getDataset(id: string): Promise<Dataset | null> {
    try {
      const { data, error } = await supabase
        .getClient()
        .from('datasets')
        .select()
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw new DatasetError(`Failed to get dataset: ${error.message}`, error.code);
      }

      return data ? this.toCamelCase(data) : null;
    } catch (error) {
      logger.error('Failed to get dataset', { error, id });
      throw error instanceof DatasetError ? error : new DatasetError(`Failed to get dataset: ${error}`);
    }
  }

  /**
   * Update a dataset
   */
  public async updateDataset(id: string, data: Partial<Dataset>): Promise<Dataset> {
    try {
      const updateData = {
        ...this.toSnakeCase(data),
        updated_at: new Date()
      };

      const { data: result, error } = await supabase
        .getClient()
        .from('datasets')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new DatasetError(`Failed to update dataset: ${error.message}`, error.code);
      if (!result) throw new DatasetError(`Dataset not found: ${id}`);

      return this.toCamelCase(result);
    } catch (error) {
      logger.error('Failed to update dataset', { error, id });
      throw error instanceof DatasetError ? error : new DatasetError(`Failed to update dataset: ${error}`);
    }
  }

  /**
   * Delete a dataset
   */
  public async deleteDataset(id: string): Promise<void> {
    try {
      // Get dataset first to verify it exists
      const dataset = await this.getDataset(id);
      if (!dataset) throw new DatasetError(`Dataset not found: ${id}`);

      // Delete all associated files
      await this.deleteDatasetFiles(id);

      // Delete database records
      const { error } = await supabase.getClient().from('datasets').delete().eq('id', id);
      if (error) throw new DatasetError(`Failed to delete dataset: ${error.message}`, error.code);
    } catch (error) {
      logger.error('Failed to delete dataset', { error, id });
      throw error instanceof DatasetError ? error : new DatasetError(`Failed to delete dataset: ${error}`);
    }
  }

  /**
   * Search datasets
   */
  public async searchDatasets(options: DatasetSearchOptions = {}): Promise<{
    datasets: Dataset[];
    total: number;
  }> {
    try {
      let query = supabase.getClient().from('datasets').select('*', { count: 'exact' });

      // Apply filters
      if (options.query) {
        query = query.or(`name.ilike.%${options.query}%,description.ilike.%${options.query}%`);
      }

      if (options.status) {
        if (Array.isArray(options.status)) {
          query = query.in('status', options.status);
        } else {
          query = query.eq('status', options.status);
        }
      }

      // Apply sorting
      if (options.sort) {
        const snakeField = typeof options.sort.field === 'string' 
          ? options.sort.field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
          : options.sort.field;
        query = query.order(snakeField, {
          ascending: options.sort.direction === 'asc'
        });
      }

      // Apply pagination
      if (options.limit) {
        const offset = options.offset || 0;
        query = query.range('id', offset, offset + options.limit - 1);
      }

      const { data, error, count } = await query;

      if (error) throw new DatasetError(`Failed to search datasets: ${error.message}`, error.code);

      return {
        datasets: (data || []).map((d: Record<string, any>) => this.toCamelCase(d)),
        total: count || 0
      };
    } catch (error) {
      logger.error('Failed to search datasets', { error, options });
      throw error instanceof DatasetError ? error : new DatasetError(`Failed to search datasets: ${error}`);
    }
  }

  /**
   * Create a dataset class
   */
  public async createClass(datasetId: string, data: Partial<DatasetClass>): Promise<DatasetClass> {
    try {
      const id = data.id || uuidv4();
      const now = new Date();

      const classData = {
        id,
        dataset_id: datasetId,
        name: data.name,
        description: data.description,
        image_count: 0,
        metadata: data.metadata || {},
        created_at: now,
        updated_at: now
      };

      const { data: result, error } = await supabase
        .getClient()
        .from('dataset_classes')
        .insert(classData)
        .select()
        .single();

      if (error) throw new DatasetError(`Failed to create class: ${error.message}`, error.code);
      if (!result) throw new DatasetError('Failed to create class: No result returned');

      await this.updateDatasetCounters(datasetId);
      return this.toCamelCase(result);
    } catch (error) {
      logger.error('Failed to create dataset class', { error, datasetId });
      throw error instanceof DatasetError ? error : new DatasetError(`Failed to create dataset class: ${error}`);
    }
  }

  /**
   * Get dataset classes
   */
  public async getClasses(datasetId: string): Promise<DatasetClass[]> {
    try {
      const { data, error } = await supabase
        .getClient()
        .from('dataset_classes')
        .select()
        .eq('dataset_id', datasetId);

      if (error) throw new DatasetError(`Failed to get classes: ${error.message}`, error.code);

      return (data || []).map((c: Record<string, any>) => this.toCamelCase(c));
    } catch (error) {
      logger.error('Failed to get dataset classes', { error, datasetId });
      throw error instanceof DatasetError ? error : new DatasetError(`Failed to get dataset classes: ${error}`);
    }
  }

  /**
   * Delete a dataset class
   */
  public async deleteClass(classId: string): Promise<void> {
    try {
      // Get class first to verify it exists and get dataset ID
      const { data: classData, error: classError } = await supabase
        .getClient()
        .from('dataset_classes')
        .select()
        .eq('id', classId)
        .single();

      if (classError) {
        if (classError.code === 'PGRST116') throw new DatasetError(`Class not found: ${classId}`);
        throw new DatasetError(`Failed to get class: ${classError.message}`, classError.code);
      }

      const datasetId = classData.dataset_id;

      // Delete all class files
      await this.deleteClassFiles(classId);

      // Delete class record
      const { error } = await supabase.getClient().from('dataset_classes').delete().eq('id', classId);
      if (error) throw new DatasetError(`Failed to delete class: ${error.message}`, error.code);

      await this.updateDatasetCounters(datasetId);
    } catch (error) {
      logger.error('Failed to delete dataset class', { error, classId });
      throw error instanceof DatasetError ? error : new DatasetError(`Failed to delete dataset class: ${error}`);
    }
  }

  /**
   * Add an image to a dataset class
   */
  public async addImage(
    classId: string,
    file: File | Blob,
    metadata?: Record<string, any>
  ): Promise<DatasetImage> {
    try {
      // Get class to verify it exists and get dataset ID
      const { data: classData, error: classError } = await supabase
        .getClient()
        .from('dataset_classes')
        .select()
        .eq('id', classId)
        .single();

      if (classError) {
        if (classError.code === 'PGRST116') throw new DatasetError(`Class not found: ${classId}`);
        throw new DatasetError(`Failed to get class: ${classError.message}`, classError.code);
      }

      const datasetId = classData.dataset_id;
      const id = uuidv4();
      const filename = file instanceof File ? file.name : `${id}.bin`;
      const storagePath = `${datasetId}/${classId}/${filename}`;

      // Upload file to storage
      const uploadResult = await storage.upload(file, {
        bucket: this.storageBucket,
        path: storagePath
      });

      if (uploadResult.error) throw new DatasetError(`Failed to upload image: ${uploadResult.error.message}`);

      // Create image record
      const now = new Date();
      const imageData = {
        id,
        dataset_id: datasetId,
        class_id: classId,
        storage_path: storagePath,
        filename,
        file_size: file instanceof File ? file.size : undefined,
        metadata: metadata || {},
        created_at: now,
        updated_at: now
      };

      const { data: result, error } = await supabase
        .getClient()
        .from('dataset_images')
        .insert(imageData)
        .select()
        .single();

      if (error) throw new DatasetError(`Failed to create image record: ${error.message}`, error.code);
      if (!result) throw new DatasetError('Failed to create image record: No result returned');

      await this.updateClassImageCount(classId);
      await this.updateDatasetCounters(datasetId);

      return this.toCamelCase(result);
    } catch (error) {
      logger.error('Failed to add dataset image', { error, classId });
      throw error instanceof DatasetError ? error : new DatasetError(`Failed to add dataset image: ${error}`);
    }
  }

  /**
   * Get images for a dataset class
   */
  public async getImages(classId: string, limit = 100, offset = 0): Promise<DatasetImage[]> {
    try {
      const { data, error } = await supabase
        .getClient()
        .from('dataset_images')
        .select()
        .eq('class_id', classId)
        .range('id', offset, offset + limit - 1);

      if (error) throw new DatasetError(`Failed to get images: ${error.message}`, error.code);

      return (data || []).map((i: Record<string, any>) => this.toCamelCase(i));
    } catch (error) {
      logger.error('Failed to get dataset images', { error, classId });
      throw error instanceof DatasetError ? error : new DatasetError(`Failed to get dataset images: ${error}`);
    }
  }

  /**
   * Delete a dataset image
   */
  public async deleteImage(imageId: string): Promise<void> {
    try {
      // Get image first to verify it exists and get paths
      const { data: imageData, error: imageError } = await supabase
        .getClient()
        .from('dataset_images')
        .select()
        .eq('id', imageId)
        .single();

      if (imageError) {
        if (imageError.code === 'PGRST116') throw new DatasetError(`Image not found: ${imageId}`);
        throw new DatasetError(`Failed to get image: ${imageError.message}`, imageError.code);
      }

      const { class_id: classId, dataset_id: datasetId, storage_path: storagePath } = imageData;

      // Delete file from storage
      await storage.delete([storagePath], { bucket: this.storageBucket });

      // Delete image record
      const { error } = await supabase.getClient().from('dataset_images').delete().eq('id', imageId);
      if (error) throw new DatasetError(`Failed to delete image: ${error.message}`, error.code);

      await this.updateClassImageCount(classId);
      await this.updateDatasetCounters(datasetId);
    } catch (error) {
      logger.error('Failed to delete dataset image', { error, imageId });
      throw error instanceof DatasetError ? error : new DatasetError(`Failed to delete dataset image: ${error}`);
    }
  }

  /**
   * Get dataset statistics
   */
  public async getStats(): Promise<{
    totalDatasets: number;
    totalImages: number;
    datasetsByStatus: Record<DatasetStatus, number>;
    largestDatasets: Array<{ id: string; name: string; imageCount: number }>;
  }> {
    try {
      // Get total datasets
      const { count: datasetsCount, error: datasetsError } = await supabase
        .getClient()
        .from('datasets')
        .select('*', { count: 'exact', head: true });

      if (datasetsError) throw new DatasetError(`Failed to get dataset count: ${datasetsError.message}`);

      // Get total images
      const { count: imagesCount, error: imagesError } = await supabase
        .getClient()
        .from('dataset_images')
        .select('*', { count: 'exact', head: true });

      if (imagesError) throw new DatasetError(`Failed to get image count: ${imagesError.message}`);

      // Get datasets by status
      const { data: statusData, error: statusError } = await supabase
        .getClient()
        .from('datasets')
        .select('status, count')
        .group('status');

      if (statusError) throw new DatasetError(`Failed to get status counts: ${statusError.message}`);

      const datasetsByStatus = ((statusData || []) as Array<{ status: DatasetStatus; count: string }>).reduce((acc: Record<DatasetStatus, number>, { status, count }) => {
        acc[status as DatasetStatus] = parseInt(count, 10);
        return acc;
      }, {} as Record<DatasetStatus, number>);

      // Get largest datasets
      const { data: largestData, error: largestError } = await supabase
        .getClient()
        .from('datasets')
        .select('id, name, image_count')
        .order('image_count', { ascending: false })
        .limit(5);

      if (largestError) throw new DatasetError(`Failed to get largest datasets: ${largestError.message}`);

      return {
        totalDatasets: datasetsCount || 0,
        totalImages: imagesCount || 0,
        datasetsByStatus,
        largestDatasets: (largestData || []).map((d: { id: string; name: string; image_count: number }) => ({
          id: d.id,
          name: d.name,
          imageCount: d.image_count
        }))
      };
    } catch (error) {
      logger.error('Failed to get dataset stats', { error });
      throw error instanceof DatasetError ? error : new DatasetError(`Failed to get dataset stats: ${error}`);
    }
  }

  /**
   * Delete all files associated with a dataset
   */
  private async deleteDatasetFiles(datasetId: string): Promise<void> {
    try {
      const files = await storage.list(`${datasetId}/`, { bucket: this.storageBucket });
      if (files.files.length > 0) {
        await storage.delete(files.files, { bucket: this.storageBucket });
      }
    } catch (error) {
      logger.warn('Failed to delete dataset files', { error, datasetId });
    }
  }

  /**
   * Delete all files associated with a class
   */
  private async deleteClassFiles(classId: string): Promise<void> {
    try {
      const { data: classData } = await supabase
        .getClient()
        .from('dataset_classes')
        .select('dataset_id')
        .eq('id', classId)
        .single();

      if (classData) {
        const files = await storage.list(`${classData.dataset_id}/${classId}/`, {
          bucket: this.storageBucket
        });
        if (files.files.length > 0) {
          await storage.delete(files.files, { bucket: this.storageBucket });
        }
      }
    } catch (error) {
      logger.warn('Failed to delete class files', { error, classId });
    }
  }

  /**
   * Update a class's image count
   */
  private async updateClassImageCount(classId: string): Promise<void> {
    try {
      const { count, error: countError } = await supabase
        .getClient()
        .from('dataset_images')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', classId);

      if (countError) throw countError;

      const { error: updateError } = await supabase
        .getClient()
        .from('dataset_classes')
        .update({ image_count: count || 0, updated_at: new Date() })
        .eq('id', classId);

      if (updateError) throw updateError;
    } catch (error) {
      logger.error('Failed to update class image count', { error, classId });
    }
  }

  /**
   * Update a dataset's counters
   */
  private async updateDatasetCounters(datasetId: string): Promise<void> {
    try {
      // Count classes
      const { count: classCount, error: classError } = await supabase
        .getClient()
        .from('dataset_classes')
        .select('*', { count: 'exact', head: true })
        .eq('dataset_id', datasetId);

      if (classError) throw classError;

      // Count images
      const { count: imageCount, error: imageError } = await supabase
        .getClient()
        .from('dataset_images')
        .select('*', { count: 'exact', head: true })
        .eq('dataset_id', datasetId);

      if (imageError) throw imageError;

      // Update counters
      const { error: updateError } = await supabase
        .getClient()
        .from('datasets')
        .update({
          class_count: classCount || 0,
          image_count: imageCount || 0,
          updated_at: new Date()
        })
        .eq('id', datasetId);

      if (updateError) throw updateError;
    } catch (error) {
      logger.error('Failed to update dataset counters', { error, datasetId });
    }
  }

  /**
   * Convert object keys to snake_case
   */
  private toSnakeCase(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      result[snakeKey] = value;
    }
    return result;
  }

  /**
   * Convert object keys to camelCase
   */
  private toCamelCase(obj: Record<string, any>): any {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = value;
    }
    return result;
  }
}

// Export singleton instance
export const dataset = DatasetService.getInstance();

// Export default for convenience
export default dataset;
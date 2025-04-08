/**
 * Supabase Dataset Service
 * 
 * This service provides an interface for dataset-related operations using Supabase.
 * It follows the pattern established by the material service implementation.
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { supabaseClient } from './supabaseClient';

// Define types for Supabase data
interface SupabaseDatasetData {
  id: string;
  name: string;
  description?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  status: string;
  class_count: number;
  image_count: number;
  metadata?: any;
}

interface SupabaseDatasetClassData {
  id: string;
  dataset_id: string;
  name: string;
  description?: string;
  image_count: number;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

interface SupabaseDatasetImageData {
  id: string;
  dataset_id: string;
  class_id: string;
  storage_path: string;
  filename: string;
  file_size?: number;
  width?: number;
  height?: number;
  format?: string;
  material_id?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

// Application model types
export interface Dataset {
  id: string;
  name: string;
  description?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'created' | 'processing' | 'ready' | 'error';
  classCount: number;
  imageCount: number;
  metadata?: Record<string, any>;
}

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
  materialId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Search options
export interface DatasetSearchOptions {
  query?: string;
  status?: 'created' | 'processing' | 'ready' | 'error' | Array<'created' | 'processing' | 'ready' | 'error'>;
  source?: string;
  limit?: number;
  skip?: number;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

/**
 * Supabase Dataset Service
 * Manages dataset storage, retrieval, and search using Supabase
 */
export class SupabaseDatasetService {
  private static instance: SupabaseDatasetService;

  private constructor() {
    logger.info('Supabase Dataset Service initialized');
  }

  /**
   * Get the singleton instance
   * @returns The SupabaseDatasetService instance
   */
  public static getInstance(): SupabaseDatasetService {
    if (!SupabaseDatasetService.instance) {
      SupabaseDatasetService.instance = new SupabaseDatasetService();
    }
    return SupabaseDatasetService.instance;
  }

  /**
   * Create a new dataset
   * @param datasetData Dataset data
   * @returns Created dataset
   */
  public async createDataset(datasetData: Partial<Dataset>): Promise<Dataset> {
    try {
      // Generate UUID if not provided
      const id = datasetData.id || uuidv4();

      // Transform to Supabase format
      const supabaseData = this.transformDatasetForSupabase({
        ...datasetData,
        id,
        status: datasetData.status || 'created',
        classCount: datasetData.classCount || 0,
        imageCount: datasetData.imageCount || 0,
        createdAt: datasetData.createdAt || new Date(),
        updatedAt: new Date()
      });

      // Insert dataset into Supabase
      const { data, error } = await (supabaseClient
        .getClient()
        .from('datasets') as any)
        .insert(supabaseData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Transform back to application format
      return this.transformDatasetFromSupabase(data);
    } catch (err) {
      logger.error(`Failed to create dataset: ${err}`);
      throw new Error(`Failed to create dataset: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get a dataset by ID
   * @param id Dataset ID
   * @returns Dataset or null if not found
   */
  public async getDatasetById(id: string): Promise<Dataset | null> {
    try {
      const { data, error } = await (supabaseClient
        .getClient()
        .from('datasets') as any)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - not found
          return null;
        }
        throw error;
      }

      if (!data) {
        return null;
      }

      return this.transformDatasetFromSupabase(data);
    } catch (err) {
      logger.error(`Failed to get dataset: ${err}`);
      throw new Error(`Failed to get dataset: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Update a dataset
   * @param id Dataset ID
   * @param updateData Update data
   * @returns Updated dataset or null if not found
   */
  public async updateDataset(id: string, updateData: Partial<Dataset>): Promise<Dataset | null> {
    try {
      // Transform data for Supabase
      const supabaseData = this.transformDatasetForSupabase({
        ...updateData,
        updatedAt: new Date()
      });

      // Update dataset in Supabase
      const { data, error } = await (supabaseClient
        .getClient()
        .from('datasets') as any)
        .update(supabaseData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        return null;
      }

      return this.transformDatasetFromSupabase(data);
    } catch (err) {
      logger.error(`Failed to update dataset: ${err}`);
      throw new Error(`Failed to update dataset: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Delete a dataset
   * @param id Dataset ID
   * @returns Deleted dataset or null if not found
   */
  public async deleteDataset(id: string): Promise<Dataset | null> {
    try {
      // Get the dataset before deleting
      const dataset = await this.getDatasetById(id);
      
      if (!dataset) {
        return null;
      }

      // Start a transaction
      const deleteDataset = async (client: any) => {
        // Delete all associated images from dataset_images
        const { error: imagesError } = await (client
          .from('dataset_images')
          .delete()
          .eq('dataset_id', id) as any);

        if (imagesError) throw imagesError;

        // Delete all associated classes from dataset_classes
        const { error: classesError } = await (client
          .from('dataset_classes')
          .delete()
          .eq('dataset_id', id) as any);

        if (classesError) throw classesError;

        // Delete the dataset itself
        const { error: datasetError } = await (client
          .from('datasets')
          .delete()
          .eq('id', id) as any);

        if (datasetError) throw datasetError;
      };

      // Execute the transaction
      const client = supabaseClient.getClient();
      await deleteDataset(client);

      // Clean up storage files associated with this dataset
      // This requires listing all storage objects with path prefix matching dataset ID
      try {
        const { data: storageData, error: storageError } = await (client
          .storage
          .from('datasets')
          .list(id) as any);

        if (storageError) {
          logger.warn(`Error listing dataset storage files: ${storageError}`);
        } else if (storageData && storageData.length > 0) {
          // For each folder, recursively delete files
          for (const item of storageData) {
            if (item.id) {
              await (client.storage.from('datasets').remove([`${id}/${item.name}`]) as any);
            }
          }
        }
      } catch (storageErr) {
        logger.warn(`Error cleaning up dataset storage: ${storageErr}`);
      }

      return dataset;
    } catch (err) {
      logger.error(`Failed to delete dataset: ${err}`);
      throw new Error(`Failed to delete dataset: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Search for datasets
   * @param options Search options
   * @returns Array of datasets and total count
   */
  public async searchDatasets(options: DatasetSearchOptions = {}): Promise<{
    datasets: Dataset[];
    total: number;
  }> {
    try {
      const {
        query,
        status,
        source,
        limit = 10,
        skip = 0,
        sort = { field: 'created_at', direction: 'desc' }
      } = options;

      // Build query
      let supabaseQuery: any = (supabaseClient
        .getClient()
        .from('datasets') as any)
        .select('*', { count: 'exact' });

      // Text search
      if (query) {
        supabaseQuery = supabaseQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
      }

      // Status filter
      if (status) {
        if (Array.isArray(status)) {
          supabaseQuery = supabaseQuery.in('status', status);
        } else {
          supabaseQuery = supabaseQuery.eq('status', status);
        }
      }
      
      // Source filter
      if (source) {
        // Filter by the source field directly
        supabaseQuery = supabaseQuery.eq('source', source);
      }

      // Apply sorting
      if (sort) {
        const sortDirection = sort.direction === 'desc' ? true : false;
        supabaseQuery = supabaseQuery.order(sort.field, { ascending: !sortDirection });
      }

      // Apply pagination
      supabaseQuery = supabaseQuery.range(skip, skip + limit - 1);

      // Execute query
      const { data, error, count } = await supabaseQuery;

      if (error) {
        throw error;
      }

      // Transform results
      const datasets = (data || []).map((item: SupabaseDatasetData) => this.transformDatasetFromSupabase(item));

      return {
        datasets,
        total: count || datasets.length
      };
    } catch (err) {
      logger.error(`Failed to search datasets: ${err}`);
      throw new Error(`Failed to search datasets: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Create a dataset class
   * @param classData Class data
   * @returns Created class
   */
  public async createDatasetClass(classData: Partial<DatasetClass>): Promise<DatasetClass> {
    try {
      // Generate UUID if not provided
      const id = classData.id || uuidv4();

      // Transform to Supabase format
      const supabaseData = this.transformDatasetClassForSupabase({
        ...classData,
        id,
        imageCount: classData.imageCount || 0,
        createdAt: classData.createdAt || new Date(),
        updatedAt: new Date()
      });

      // Insert class into Supabase
      const { data, error } = await (supabaseClient
        .getClient()
        .from('dataset_classes') as any)
        .insert(supabaseData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Update the parent dataset's class count
      await this.updateDatasetCounters(classData.datasetId as string);

      // Transform back to application format
      return this.transformDatasetClassFromSupabase(data);
    } catch (err) {
      logger.error(`Failed to create dataset class: ${err}`);
      throw new Error(`Failed to create dataset class: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get classes for a dataset
   * @param datasetId Dataset ID
   * @returns Array of dataset classes
   */
  public async getDatasetClasses(datasetId: string): Promise<DatasetClass[]> {
    try {
      const { data, error } = await (supabaseClient
        .getClient()
        .from('dataset_classes') as any)
        .select('*')
        .eq('dataset_id', datasetId);

      if (error) {
        throw error;
      }

      return (data || []).map((item: SupabaseDatasetClassData) => this.transformDatasetClassFromSupabase(item));
    } catch (err) {
      logger.error(`Failed to get dataset classes: ${err}`);
      throw new Error(`Failed to get dataset classes: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Delete a dataset class
   * @param classId Class ID
   * @returns Deleted class or null if not found
   */
  public async deleteDatasetClass(classId: string): Promise<DatasetClass | null> {
    try {
      // Get the class before deleting to know the dataset ID
      const { data: classData, error: classGetError } = await (supabaseClient
        .getClient()
        .from('dataset_classes') as any)
        .select('*')
        .eq('id', classId)
        .single();

      if (classGetError) {
        if (classGetError.code === 'PGRST116') {
          return null;
        }
        throw classGetError;
      }

      const datasetId = classData.dataset_id;
      const deletedClass = this.transformDatasetClassFromSupabase(classData);

      // Delete all images in this class first
      const { error: imagesDeleteError } = await (supabaseClient
        .getClient()
        .from('dataset_images') as any)
        .delete()
        .eq('class_id', classId);

      if (imagesDeleteError) {
        throw imagesDeleteError;
      }

      // Now delete the class
      const { error: classDeleteError } = await (supabaseClient
        .getClient()
        .from('dataset_classes') as any)
        .delete()
        .eq('id', classId);

      if (classDeleteError) {
        throw classDeleteError;
      }

      // Update the parent dataset's counters
      await this.updateDatasetCounters(datasetId);

      return deletedClass;
    } catch (err) {
      logger.error(`Failed to delete dataset class: ${err}`);
      throw new Error(`Failed to delete dataset class: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Create a dataset image
   * @param imageData Image data
   * @returns Created image
   */
  public async createDatasetImage(imageData: Partial<DatasetImage>): Promise<DatasetImage> {
    try {
      // Generate UUID if not provided
      const id = imageData.id || uuidv4();

      // Transform to Supabase format
      const supabaseData = this.transformDatasetImageForSupabase({
        ...imageData,
        id,
        createdAt: imageData.createdAt || new Date(),
        updatedAt: new Date()
      });

      // Insert image into Supabase
      const { data, error } = await (supabaseClient
        .getClient()
        .from('dataset_images') as any)
        .insert(supabaseData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Update the parent class's image count and the dataset's total count
      await this.updateClassImageCount(imageData.classId as string);
      await this.updateDatasetCounters(imageData.datasetId as string);

      // Transform back to application format
      return this.transformDatasetImageFromSupabase(data);
    } catch (err) {
      logger.error(`Failed to create dataset image: ${err}`);
      throw new Error(`Failed to create dataset image: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get images for a dataset class
   * @param classId Class ID
   * @param limit Max number of images to return
   * @param offset Pagination offset
   * @returns Array of dataset images
   */
  public async getDatasetClassImages(classId: string, limit = 100, offset = 0): Promise<DatasetImage[]> {
    try {
      const { data, error } = await (supabaseClient
        .getClient()
        .from('dataset_images') as any)
        .select('*')
        .eq('class_id', classId)
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return (data || []).map((item: SupabaseDatasetImageData) => this.transformDatasetImageFromSupabase(item));
    } catch (err) {
      logger.error(`Failed to get dataset class images: ${err}`);
      throw new Error(`Failed to get dataset class images: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Delete a dataset image
   * @param imageId Image ID
   * @returns Deleted image or null if not found
   */
  public async deleteDatasetImage(imageId: string): Promise<DatasetImage | null> {
    try {
      // Get the image before deleting to know the class and dataset IDs
      const { data: imageData, error: imageGetError } = await (supabaseClient
        .getClient()
        .from('dataset_images') as any)
        .select('*')
        .eq('id', imageId)
        .single();

      if (imageGetError) {
        if (imageGetError.code === 'PGRST116') {
          return null;
        }
        throw imageGetError;
      }

      const classId = imageData.class_id;
      const datasetId = imageData.dataset_id;
      const storagePath = imageData.storage_path;
      const deletedImage = this.transformDatasetImageFromSupabase(imageData);

      // Delete the image record
      const { error: imageDeleteError } = await (supabaseClient
        .getClient()
        .from('dataset_images') as any)
        .delete()
        .eq('id', imageId);

      if (imageDeleteError) {
        throw imageDeleteError;
      }

      // Try to delete the file from storage if it exists
      try {
        if (storagePath) {
          const { error: storageError } = await (supabaseClient
            .getClient()
            .storage
            .from('datasets')
            .remove([storagePath]) as any);

          if (storageError) {
            logger.warn(`Failed to delete image file from storage: ${storageError}`);
          }
        }
      } catch (storageErr) {
        logger.warn(`Error during storage file cleanup: ${storageErr}`);
      }

      // Update the class and dataset counts
      await this.updateClassImageCount(classId);
      await this.updateDatasetCounters(datasetId);

      return deletedImage;
    } catch (err) {
      logger.error(`Failed to delete dataset image: ${err}`);
      throw new Error(`Failed to delete dataset image: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Update a class's image count
   * @param classId Class ID
   */
  private async updateClassImageCount(classId: string): Promise<void> {
    try {
      // Count images in the class
      const { count, error: countError } = await (supabaseClient
        .getClient()
        .from('dataset_images') as any)
        .select('*', { count: 'exact', head: true })
        .eq('class_id', classId);

      if (countError) {
        throw countError;
      }

      // Update the class's image count
      const { error: updateError } = await (supabaseClient
        .getClient()
        .from('dataset_classes') as any)
        .update({ image_count: count || 0, updated_at: new Date().toISOString() })
        .eq('id', classId);

      if (updateError) {
        throw updateError;
      }
    } catch (err) {
      logger.error(`Failed to update class image count: ${err}`);
      throw new Error(`Failed to update class image count: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Update a dataset's counters (class and image count)
   * @param datasetId Dataset ID
   */
  private async updateDatasetCounters(datasetId: string): Promise<void> {
    try {
      // Count classes in the dataset
      const { count: classCount, error: classCountError } = await (supabaseClient
        .getClient()
        .from('dataset_classes') as any)
        .select('*', { count: 'exact', head: true })
        .eq('dataset_id', datasetId);

      if (classCountError) {
        throw classCountError;
      }

      // Count images in the dataset
      const { count: imageCount, error: imageCountError } = await (supabaseClient
        .getClient()
        .from('dataset_images') as any)
        .select('*', { count: 'exact', head: true })
        .eq('dataset_id', datasetId);

      if (imageCountError) {
        throw imageCountError;
      }

      // Update the dataset's counters
      const { error: updateError } = await (supabaseClient
        .getClient()
        .from('datasets') as any)
        .update({
          class_count: classCount || 0,
          image_count: imageCount || 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', datasetId);

      if (updateError) {
        throw updateError;
      }
    } catch (err) {
      logger.error(`Failed to update dataset counters: ${err}`);
      throw new Error(`Failed to update dataset counters: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get a signed URL for a dataset image
   * @param storagePath Storage path
   * @param expiresIn Expiration time in seconds
   * @returns Signed URL
   */
  public async getSignedImageUrl(storagePath: string, expiresIn = 3600): Promise<string> {
    try {
      // Get a signed URL from Supabase storage
      const { data, error } = await (supabaseClient
        .getClient()
        .storage
        .from('datasets') as any)
        .createSignedUrl(storagePath, expiresIn);

      if (error) {
        throw error;
      }

      if (!data || !data.signedUrl) {
        throw new Error('Failed to create signed URL');
      }

      return data.signedUrl;
    } catch (err) {
      logger.error(`Failed to get signed image URL: ${err}`);
      throw new Error(`Failed to get signed image URL: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get dataset statistics
   * @returns Dataset statistics
   */
  public async getDatasetStats(): Promise<{
    totalDatasets: number;
    totalImages: number;
    datasetsByStatus: Record<string, number>;
    largestDatasets: Array<{ id: string; name: string; imageCount: number }>;
  }> {
    try {
      // Get total datasets count
      const { count: datasetsCount, error: datasetsError } = await (supabaseClient
        .getClient()
        .from('datasets') as any)
        .select('*', { count: 'exact', head: true });
      
      if (datasetsError) throw datasetsError;

      // Get total images count
      const { count: imagesCount, error: imagesError } = await (supabaseClient
        .getClient()
        .from('dataset_images') as any)
        .select('*', { count: 'exact', head: true });
      
      if (imagesError) throw imagesError;

      // Get datasets by status
      const { data: statusData, error: statusError } = await (supabaseClient
        .getClient()
        .from('datasets') as any)
        .select('status, count(*)')
        .group('status');
      
      if (statusError) throw statusError;

      const datasetsByStatus: Record<string, number> = {};
      (statusData || []).forEach((item: any) => {
        datasetsByStatus[item.status] = parseInt(item.count, 10);
      });

      // Get largest datasets
      const { data: largestData, error: largestError } = await (supabaseClient
        .getClient()
        .from('datasets') as any)
        .select('id, name, image_count')
        .order('image_count', { ascending: false })
        .limit(5);
      
      if (largestError) throw largestError;

      const largestDatasets = (largestData || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        imageCount: item.image_count
      }));

      return {
        totalDatasets: datasetsCount || 0,
        totalImages: imagesCount || 0,
        datasetsByStatus,
        largestDatasets
      };
    } catch (err) {
      logger.error(`Failed to get dataset stats: ${err}`);
      throw new Error(`Failed to get dataset stats: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Transform dataset to Supabase format
   * @param dataset Dataset
   * @returns Supabase-formatted dataset
   */
  private transformDatasetForSupabase(dataset: Partial<Dataset>): Record<string, any> {
    const result: Record<string, any> = {};

    // Map fields
    if (dataset.id !== undefined) result.id = dataset.id;
    if (dataset.name !== undefined) result.name = dataset.name;
    if (dataset.description !== undefined) result.description = dataset.description;
    if (dataset.createdBy !== undefined) result.created_by = dataset.createdBy;
    if (dataset.status !== undefined) result.status = dataset.status;
    if (dataset.classCount !== undefined) result.class_count = dataset.classCount;
    if (dataset.imageCount !== undefined) result.image_count = dataset.imageCount;
    if (dataset.metadata !== undefined) result.metadata = dataset.metadata;
    
    // Handle dates
    if (dataset.createdAt !== undefined) {
      result.created_at = dataset.createdAt instanceof Date 
        ? dataset.createdAt.toISOString() 
        : dataset.createdAt;
    }
    
    if (dataset.updatedAt !== undefined) {
      result.updated_at = dataset.updatedAt instanceof Date 
        ? dataset.updatedAt.toISOString() 
        : dataset.updatedAt;
    }

    return result;
  }

  /**
   * Transform Supabase data to Dataset format
   * @param data Supabase data
   * @returns Dataset
   */
  private transformDatasetFromSupabase(data: SupabaseDatasetData): Dataset {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      status: data.status as 'created' | 'processing' | 'ready' | 'error',
      classCount: data.class_count,
      imageCount: data.image_count,
      metadata: data.metadata || {}
    };
  }

  /**
   * Transform dataset class to Supabase format
   * @param datasetClass Dataset class
   * @returns Supabase-formatted dataset class
   */
  private transformDatasetClassForSupabase(datasetClass: Partial<DatasetClass>): Record<string, any> {
    const result: Record<string, any> = {};

    // Map fields
    if (datasetClass.id !== undefined) result.id = datasetClass.id;
    if (datasetClass.datasetId !== undefined) result.dataset_id = datasetClass.datasetId;
    if (datasetClass.name !== undefined) result.name = datasetClass.name;
    if (datasetClass.description !== undefined) result.description = datasetClass.description;
    if (datasetClass.imageCount !== undefined) result.image_count = datasetClass.imageCount;
    if (datasetClass.metadata !== undefined) result.metadata = datasetClass.metadata;
    
    // Handle dates
    if (datasetClass.createdAt !== undefined) {
      result.created_at = datasetClass.createdAt instanceof Date 
        ? datasetClass.createdAt.toISOString() 
        : datasetClass.createdAt;
    }
    
    if (datasetClass.updatedAt !== undefined) {
      result.updated_at = datasetClass.updatedAt instanceof Date 
        ? datasetClass.updatedAt.toISOString() 
        : datasetClass.updatedAt;
    }

    return result;
  }

  /**
   * Transform Supabase data to DatasetClass format
   * @param data Supabase data
   * @returns DatasetClass
   */
  private transformDatasetClassFromSupabase(data: SupabaseDatasetClassData): DatasetClass {
    return {
      id: data.id,
      datasetId: data.dataset_id,
      name: data.name,
      description: data.description,
      imageCount: data.image_count,
      metadata: data.metadata || {},
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  /**
   * Transform dataset image to Supabase format
   * @param datasetImage Dataset image
   * @returns Supabase-formatted dataset image
   */
  private transformDatasetImageForSupabase(datasetImage: Partial<DatasetImage>): Record<string, any> {
    const result: Record<string, any> = {};

    // Map fields
    if (datasetImage.id !== undefined) result.id = datasetImage.id;
    if (datasetImage.datasetId !== undefined) result.dataset_id = datasetImage.datasetId;
    if (datasetImage.classId !== undefined) result.class_id = datasetImage.classId;
    if (datasetImage.storagePath !== undefined) result.storage_path = datasetImage.storagePath;
    if (datasetImage.filename !== undefined) result.filename = datasetImage.filename;
    if (datasetImage.fileSize !== undefined) result.file_size = datasetImage.fileSize;
    if (datasetImage.width !== undefined) result.width = datasetImage.width;
    if (datasetImage.height !== undefined) result.height = datasetImage.height;
    if (datasetImage.format !== undefined) result.format = datasetImage.format;
    if (datasetImage.materialId !== undefined) result.material_id = datasetImage.materialId;
    if (datasetImage.metadata !== undefined) result.metadata = datasetImage.metadata;
    
    // Handle dates
    if (datasetImage.createdAt !== undefined) {
      result.created_at = datasetImage.createdAt instanceof Date 
        ? datasetImage.createdAt.toISOString() 
        : datasetImage.createdAt;
    }
    
    if (datasetImage.updatedAt !== undefined) {
      result.updated_at = datasetImage.updatedAt instanceof Date 
        ? datasetImage.updatedAt.toISOString() 
        : datasetImage.updatedAt;
    }

    return result;
  }

  /**
   * Transform Supabase data to DatasetImage format
   * @param data Supabase data
   * @returns DatasetImage
   */
  private transformDatasetImageFromSupabase(data: SupabaseDatasetImageData): DatasetImage {
    return {
      id: data.id,
      datasetId: data.dataset_id,
      classId: data.class_id,
      storagePath: data.storage_path,
      filename: data.filename,
      fileSize: data.file_size,
      width: data.width,
      height: data.height,
      format: data.format,
      materialId: data.material_id,
      metadata: data.metadata || {},
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
}

// Export singleton instance
export const supabaseDatasetService = SupabaseDatasetService.getInstance();
export default supabaseDatasetService;
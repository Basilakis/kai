import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../supabase/supabaseClient';
import { storage as baseStorage, UploadResult, ListResult } from '../storage/s3StorageAdapter';
import { BaseDatasetProvider } from './baseProvider';
import type { PostgrestError } from '@supabase/supabase-js';
import {
  Dataset,
  DatasetClass,
  DatasetImage,
  DatasetSearchOptions,
  DatasetError,
  DatasetStats,
  mapSupabaseError
} from './types';

interface PostgrestErrorWithCode extends Error {
  code: string;
  message: string;
  details?: string;
  hint?: string;
}

function asPostgrestError(error: PostgrestError): PostgrestErrorWithCode {
  return {
    name: 'PostgrestError',
    code: error.code || 'UNKNOWN',
    message: error.message,
    details: error.details,
    hint: error.hint,
    stack: new Error().stack
  };
}

interface StorageServiceWithSignedUrl {
  upload(file: File | Blob, options: { bucket: string; path: string }): Promise<UploadResult>;
  list(prefix: string, options: { bucket: string }): Promise<ListResult>;
  delete(paths: string[], options: { bucket: string }): Promise<{ error?: Error }>;
  getSignedUrl(path: string, options: { bucket: string; expiresIn: number }): Promise<{ url: string; error?: Error }>;
}

interface DatasetStatusRecord {
  status: string;
}

// Use the base storage adapter with the expected interface
const storage = baseStorage as StorageServiceWithSignedUrl;

/**
 * Supabase implementation of the dataset provider
 */
export class SupabaseDatasetProvider extends BaseDatasetProvider {
  private static instance: SupabaseDatasetProvider;
  private readonly storageBucket = 'datasets';

  private constructor() {
    super();
  }

  public static getInstance(): SupabaseDatasetProvider {
    if (!SupabaseDatasetProvider.instance) {
      SupabaseDatasetProvider.instance = new SupabaseDatasetProvider();
    }
    return SupabaseDatasetProvider.instance;
  }

  protected async createDatasetImpl(data: Partial<Dataset>): Promise<Dataset> {
    const id = data.id || uuidv4();
    const now = new Date();

    const dataset = {
      id,
      name: data.name,
      description: data.description,
      status: data.status || 'created',
      class_count: 0,
      image_count: 0,
      metadata: data.metadata || {},
      created_at: now,
      updated_at: now,
      created_by: data.createdBy
    };

    const { data: result, error } = await supabase
      .getClient()
      .from('datasets')
      .insert(dataset)
      .select()
      .single();

    if (error) throw new DatasetError(`Failed to create dataset: ${error.message}`, mapSupabaseError(error.code), asPostgrestError(error));
    if (!result) throw new DatasetError('Failed to create dataset: No result returned', 'NOT_FOUND');

    return this.toCamelCase<Dataset>(result);
  }

  protected async getDatasetImpl(id: string): Promise<Dataset | null> {
    const { data, error } = await supabase
      .getClient()
      .from('datasets')
      .select()
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatasetError(`Failed to get dataset: ${error.message}`, mapSupabaseError(error.code), asPostgrestError(error));
    }

    return data ? this.toCamelCase<Dataset>(data) : null;
  }

  protected async updateDatasetImpl(id: string, data: Partial<Dataset>): Promise<Dataset> {
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

    if (error) throw new DatasetError(`Failed to update dataset: ${error.message}`, mapSupabaseError(error.code), asPostgrestError(error));
    if (!result) throw new DatasetError(`Dataset not found: ${id}`, 'NOT_FOUND');

    return this.toCamelCase<Dataset>(result);
  }

  protected async deleteDatasetImpl(id: string): Promise<void> {
    // Delete all associated files first
    await this.deleteDatasetFiles(id);

    const { error } = await supabase.getClient().from('datasets').delete().eq('id', id);
    if (error) throw new DatasetError(`Failed to delete dataset: ${error.message}`, mapSupabaseError(error.code), asPostgrestError(error));
  }

  protected async searchDatasetsImpl(options: DatasetSearchOptions): Promise<{
    datasets: Dataset[];
    total: number;
  }> {
    let query = supabase.getClient().from('datasets').select('*', { count: 'exact' });

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

    if (options.sort) {
      const snakeField = this.toSnakeCase({ [options.sort.field]: '' });
      const field = Object.keys(snakeField)[0];
      query = query.order(field, {
        ascending: options.sort.direction === 'asc'
      });
    }

    if (options.limit) {
      const offset = options.offset || 0;
      query = query.range('id', offset, offset + options.limit - 1);
    }

    const { data, error, count } = await query;

    if (error) throw new DatasetError(`Failed to search datasets: ${error.message}`, mapSupabaseError(error.code), asPostgrestError(error));

    return {
      datasets: (data || []).map((d: Record<string, any>) => this.toCamelCase<Dataset>(d)),
      total: count || 0
    };
  }

  protected async createClassImpl(datasetId: string, data: Partial<DatasetClass>): Promise<DatasetClass> {
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

    if (error) throw new DatasetError(`Failed to create class: ${error.message}`, mapSupabaseError(error.code), asPostgrestError(error));
    if (!result) throw new DatasetError('Failed to create class: No result returned', 'NOT_FOUND');

    await this.updateDatasetCounters(datasetId);
    return this.toCamelCase<DatasetClass>(result);
  }

  protected async getClassesImpl(datasetId: string): Promise<DatasetClass[]> {
    const { data, error } = await supabase
      .getClient()
      .from('dataset_classes')
      .select()
      .eq('dataset_id', datasetId);

    if (error) throw new DatasetError(`Failed to get classes: ${error.message}`, mapSupabaseError(error.code), asPostgrestError(error));

    return (data || []).map((c: Record<string, any>) => this.toCamelCase<DatasetClass>(c));
  }

  protected async deleteClassImpl(classId: string): Promise<void> {
    // Get class first to verify it exists and get dataset ID
    const { data: classData, error: classError } = await supabase
      .getClient()
      .from('dataset_classes')
      .select()
      .eq('id', classId)
      .single();

    if (classError) {
      if (classError.code === 'PGRST116') throw new DatasetError(`Class not found: ${classId}`, 'NOT_FOUND');
      throw new DatasetError(`Failed to get class: ${classError.message}`, mapSupabaseError(classError.code), asPostgrestError(classError));
    }

    const datasetId = classData.dataset_id;

    // Delete all class files
    await this.deleteClassFiles(classId);

    // Delete class record
    const { error } = await supabase.getClient().from('dataset_classes').delete().eq('id', classId);
    if (error) throw new DatasetError(`Failed to delete class: ${error.message}`, mapSupabaseError(error.code), asPostgrestError(error));

    await this.updateDatasetCounters(datasetId);
  }

  protected async addImageImpl(
    classId: string,
    file: File | Blob,
    metadata?: Record<string, any>
  ): Promise<DatasetImage> {
    // Get class first to verify it exists and get dataset ID
    const { data: classData, error: classError } = await supabase
      .getClient()
      .from('dataset_classes')
      .select()
      .eq('id', classId)
      .single();

    if (classError) {
      if (classError.code === 'PGRST116') throw new DatasetError(`Class not found: ${classId}`, 'NOT_FOUND');
      throw new DatasetError(`Failed to get class: ${classError.message}`, mapSupabaseError(classError.code), asPostgrestError(classError));
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

    if (uploadResult.error) throw new DatasetError(`Failed to upload image: ${uploadResult.error.message}`, 'STORAGE_ERROR', uploadResult.error);

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

    if (error) throw new DatasetError(`Failed to create image record: ${error.message}`, mapSupabaseError(error.code), asPostgrestError(error));
    if (!result) throw new DatasetError('Failed to create image record: No result returned', 'NOT_FOUND');

    await this.updateClassImageCount(classId);
    await this.updateDatasetCounters(datasetId);

    return this.toCamelCase<DatasetImage>(result);
  }

  protected async getImagesImpl(classId: string, limit: number, offset: number): Promise<DatasetImage[]> {
    const { data, error } = await supabase
      .getClient()
      .from('dataset_images')
      .select()
      .eq('class_id', classId)
      .range('id', offset, offset + limit - 1);

    if (error) throw new DatasetError(`Failed to get images: ${error.message}`, mapSupabaseError(error.code), asPostgrestError(error));

    return (data || []).map((i: Record<string, any>) => this.toCamelCase<DatasetImage>(i));
  }

  protected async deleteImageImpl(imageId: string): Promise<void> {
    // Get image first to verify it exists and get paths
    const { data: imageData, error: imageError } = await supabase
      .getClient()
      .from('dataset_images')
      .select()
      .eq('id', imageId)
      .single();

    if (imageError) {
      if (imageError.code === 'PGRST116') throw new DatasetError(`Image not found: ${imageId}`, 'NOT_FOUND');
      throw new DatasetError(`Failed to get image: ${imageError.message}`, mapSupabaseError(imageError.code), asPostgrestError(imageError));
    }

    const { class_id: classId, dataset_id: datasetId, storage_path: storagePath } = imageData;

    // Delete file from storage
    await storage.delete([storagePath], { bucket: this.storageBucket });

    // Delete image record
    const { error } = await supabase.getClient().from('dataset_images').delete().eq('id', imageId);
    if (error) throw new DatasetError(`Failed to delete image: ${error.message}`, mapSupabaseError(error.code), asPostgrestError(error));

    await this.updateClassImageCount(classId);
    await this.updateDatasetCounters(datasetId);
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
      // Log but don't throw - file deletion is best effort
      this.logger.warn('Failed to delete dataset files', { error, datasetId });
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
      // Log but don't throw - file deletion is best effort
      this.logger.warn('Failed to delete class files', { error, classId });
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

      if (countError) throw new DatasetError(`Failed to get image count: ${countError.message}`, mapSupabaseError(countError.code), asPostgrestError(countError));

      const { error: updateError } = await supabase
        .getClient()
        .from('dataset_classes')
        .update({ image_count: count || 0, updated_at: new Date() })
        .eq('id', classId);

      if (updateError) throw new DatasetError(`Failed to update class image count: ${updateError.message}`, mapSupabaseError(updateError.code), asPostgrestError(updateError));
    } catch (error) {
      this.logger.error('Failed to update class image count', { error, classId });
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

      if (classError) throw new DatasetError(`Failed to get class count: ${classError.message}`, mapSupabaseError(classError.code), asPostgrestError(classError));

      // Count images
      const { count: imageCount, error: imageError } = await supabase
        .getClient()
        .from('dataset_images')
        .select('*', { count: 'exact', head: true })
        .eq('dataset_id', datasetId);

      if (imageError) throw new DatasetError(`Failed to get image count: ${imageError.message}`, mapSupabaseError(imageError.code), asPostgrestError(imageError));

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

      if (updateError) throw new DatasetError(`Failed to update dataset counters: ${updateError.message}`, mapSupabaseError(updateError.code), asPostgrestError(updateError));
    } catch (error) {
      this.logger.error('Failed to update dataset counters', { error, datasetId });
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
  private toCamelCase<T extends Record<string, any>>(obj: Record<string, any>): T {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = Array.isArray(value)
        ? value.map(item => typeof item === 'object' && item !== null ? this.toCamelCase<Record<string, any>>(item) : item)
        : typeof value === 'object' && value !== null
        ? this.toCamelCase<Record<string, any>>(value)
        : value;
    }
    return result as T;
  }
  /**
   * Get a signed URL for a dataset image
   */
  public async getSignedImageUrl(storagePath: string, expiresIn = 3600): Promise<string> {
    try {
      const result = await storage.getSignedUrl(storagePath, {
        bucket: this.storageBucket,
        expiresIn
      });

      if (result.error) {
        throw new DatasetError(`Failed to get signed URL: ${result.error.message}`, 'STORAGE_ERROR', result.error);
      }

      return result.url;
    } catch (error) {
      this.logger.error('Failed to get signed URL', { error, storagePath });
      throw this.wrapError(error, 'Failed to get signed URL');
    }
  }

  /**
   * Get dataset statistics
   */
  public async getDatasetStats(): Promise<DatasetStats> {
    try {
      // Get total datasets count
      const { count: datasetsCount, error: datasetsError } = await supabase
        .getClient()
        .from('datasets')
        .select('*', { count: 'exact', head: true });

      if (datasetsError) throw new DatasetError(`Failed to get datasets count: ${datasetsError.message}`, mapSupabaseError(datasetsError.code), asPostgrestError(datasetsError));

      // Get total images count
      const { count: imagesCount, error: imagesError } = await supabase
        .getClient()
        .from('dataset_images')
        .select('*', { count: 'exact', head: true });

      if (imagesError) throw new DatasetError(`Failed to get images count: ${imagesError.message}`, mapSupabaseError(imagesError.code), asPostgrestError(imagesError));

      // Get datasets by status
      const { data: statusData, error: statusError } = await supabase
        .getClient()
        .from('datasets')
        .select('status')
        .is('status', 'not.null');

      if (statusError) throw new DatasetError(`Failed to get datasets by status: ${statusError.message}`, mapSupabaseError(statusError.code), asPostgrestError(statusError));

      const datasetsByStatus = statusData.reduce((acc: Record<string, number>, curr: DatasetStatusRecord) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
      }, {});

      // Get largest datasets
      const { data: largestData, error: largestError } = await supabase
        .getClient()
        .from('datasets')
        .select('id,name,image_count')
        .order('image_count', { ascending: false })
        .limit(5);

      if (largestError) throw new DatasetError(`Failed to get largest datasets: ${largestError.message}`, mapSupabaseError(largestError.code), asPostgrestError(largestError));

      return {
        totalDatasets: datasetsCount || 0,
        totalImages: imagesCount || 0,
        datasetsByStatus,
        largestDatasets: largestData.map((d: Record<string, any>) => this.toCamelCase<{ id: string; name: string; imageCount: number }>(d))
      };
    } catch (error) {
      this.logger.error('Failed to get dataset stats', { error });
      throw this.wrapError(error, 'Failed to get dataset stats');
    }
  }

}

// Export singleton instance
export const supabaseDatasetProvider = SupabaseDatasetProvider.getInstance();

// Export default for convenience
export default supabaseDatasetProvider;
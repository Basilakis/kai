import { supabase } from '../supabase/supabaseClient';
import { logger } from '../../utils/logger';

interface StorageBucketApi {
  upload: (path: string, file: File | Blob | Buffer | string) => Promise<StorageResponse<{ path: string }>>;
  download: (path: string) => Promise<StorageResponse<Uint8Array>>;
  remove: (paths: string[]) => Promise<StorageResponse<void>>;
  list: (prefix?: string) => Promise<StorageResponse<StorageItem[]>>;
  getPublicUrl: (path: string) => { data: { publicUrl: string } };
}

interface StorageItem {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: Record<string, any>;
}

interface StorageResponse<T> {
  data: T | null;
  error: Error | null;
}

export interface StorageOptions {
  bucket?: string;
  path?: string;
  metadata?: Record<string, any>;
}

export interface UploadResult {
  path: string;
  url?: string;
  error?: Error;
}

export interface DownloadResult {
  data: Uint8Array | null;
  error?: Error;
}

export interface ListResult {
  files: string[];
  error?: Error;
}

/**
 * Unified storage service that provides a consistent interface
 * for file operations across different storage providers
 */
export class StorageService {
  private static instance: StorageService;
  private defaultBucket: string;

  private constructor() {
    this.defaultBucket = 'default';
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Set default bucket for storage operations
   */
  public setDefaultBucket(bucket: string): void {
    this.defaultBucket = bucket;
  }

  /**
   * Upload a file to storage
   */
  public async upload(
    file: File | Blob | Buffer | string,
    options?: StorageOptions
  ): Promise<UploadResult> {
    try {
      const bucket = options?.bucket || this.defaultBucket;
      const path = options?.path || (file instanceof File ? file.name : 'unnamed');

      const { data, error } = await supabase
        .getClient()
        .storage
        .from(bucket)
        .upload(path, file);

      if (error) throw error;

      const storage = supabase.getClient().storage.from(bucket) as StorageBucketApi;
      const { data: urlData } = storage.getPublicUrl(path);

      return {
        path: data?.path || path,
        url: urlData?.publicUrl
      };
    } catch (error) {
      logger.error('Failed to upload file', { error, options });
      return { path: '', error: error as Error };
    }
  }

  /**
   * Download a file from storage
   */
  public async download(path: string, options?: StorageOptions): Promise<DownloadResult> {
    try {
      const bucket = options?.bucket || this.defaultBucket;

      const { data, error } = await supabase
        .getClient()
        .storage
        .from(bucket)
        .download(path);

      if (error) throw error;

      return { data: data || null };
    } catch (error) {
      logger.error('Failed to download file', { error, path, options });
      return { data: null, error: error as Error };
    }
  }

  /**
   * List files in a directory
   */
  public async list(prefix?: string, options?: StorageOptions): Promise<ListResult> {
    try {
      const bucket = options?.bucket || this.defaultBucket;

      const { data, error } = await supabase
        .getClient()
        .storage
        .from(bucket)
        .list(prefix || '');

      if (error) throw error;

      return {
        files: (data as StorageItem[]).map(item => item.name)
      };
    } catch (error) {
      logger.error('Failed to list files', { error, prefix, options });
      return { files: [], error: error as Error };
    }
  }

  /**
   * Delete files from storage
   */
  public async delete(paths: string[], options?: StorageOptions): Promise<{ error?: Error }> {
    try {
      const bucket = options?.bucket || this.defaultBucket;

      const { error } = await supabase
        .getClient()
        .storage
        .from(bucket)
        .remove(paths);

      if (error) throw error;

      return {};
    } catch (error) {
      logger.error('Failed to delete files', { error, paths, options });
      return { error: error as Error };
    }
  }

  /**
   * Move a file to a new location
   */
  public async move(
    fromPath: string,
    toPath: string,
    options?: StorageOptions
  ): Promise<{ error?: Error }> {
    try {
      const bucket = options?.bucket || this.defaultBucket;
      const storage = supabase.getClient().storage.from(bucket);

      // Download the file
      const { data: fileData, error: downloadError } = await storage.download(fromPath);
      if (downloadError) throw downloadError;

      // Upload to new location
      const { error: uploadError } = await storage.upload(toPath, fileData!);
      if (uploadError) throw uploadError;

      // Delete the original
      const { error: deleteError } = await storage.remove([fromPath]);
      if (deleteError) throw deleteError;

      return {};
    } catch (error) {
      logger.error('Failed to move file', { error, fromPath, toPath, options });
      return { error: error as Error };
    }
  }

  /**
   * Copy a file to a new location
   */
  public async copy(
    fromPath: string,
    toPath: string,
    options?: StorageOptions
  ): Promise<{ error?: Error }> {
    try {
      const bucket = options?.bucket || this.defaultBucket;
      const storage = supabase.getClient().storage.from(bucket);

      // Download the file
      const { data: fileData, error: downloadError } = await storage.download(fromPath);
      if (downloadError) throw downloadError;

      // Upload to new location
      const { error: uploadError } = await storage.upload(toPath, fileData!);
      if (uploadError) throw uploadError;

      return {};
    } catch (error) {
      logger.error('Failed to copy file', { error, fromPath, toPath, options });
      return { error: error as Error };
    }
  }
}

// Export singleton instance
export const storage = StorageService.getInstance();

// Export default for convenience
export default storage;
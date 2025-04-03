import { logger } from '../../utils/logger';

// Import types only, not implementations
import { StorageProvider, StorageUploadOptions, StorageUploadResult } from './types';

/**
 * Interface to match the previous StorageService interface
 * but using the StorageProvider pattern
 */
export interface StorageOptions {
  bucket?: string;
  path?: string;
  metadata?: Record<string, any>;
  isPublic?: boolean;
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
 * S3 Storage Adapter
 * 
 * This adapter provides the same interface as the previous StorageService
 * but delegates to the S3Service implementation.
 * 
 * It's designed to be a drop-in replacement for the Supabase storage singleton.
 */
export class S3StorageAdapter {
  private static instance: S3StorageAdapter;
  private defaultBucket: string;
  private s3Provider?: StorageProvider;

  private constructor() {
    this.defaultBucket = 'default';
  }

  public static getInstance(): S3StorageAdapter {
    if (!S3StorageAdapter.instance) {
      S3StorageAdapter.instance = new S3StorageAdapter();
    }
    return S3StorageAdapter.instance;
  }

  /**
   * Set the S3 provider implementation
   * This should be called early in the application lifecycle
   */
  public setProvider(provider: StorageProvider): void {
    this.s3Provider = provider;
  }

  /**
   * Set default bucket for storage operations
   */
  public setDefaultBucket(bucket: string): void {
    this.defaultBucket = bucket;
  }

  /**
   * Ensure provider is initialized
   */
  private ensureProvider(): StorageProvider {
    if (!this.s3Provider) {
      // In real implementation, we would throw an error
      // For now, just log a warning for easier debugging
      logger.warn('S3 provider not set, storage operations will fail');
      throw new Error('S3 provider not initialized');
    }
    return this.s3Provider;
  }

  /**
   * Upload a file to storage
   */
  public async upload(
    file: File | Blob | Buffer | string,
    options?: StorageOptions
  ): Promise<UploadResult> {
    try {
      const provider = this.ensureProvider();
      const bucket = options?.bucket || this.defaultBucket;
      const path = options?.path || (file instanceof File ? file.name : 'unnamed');
      
      // Construct storage path with bucket prefix
      const storagePath = `${bucket}/${path}`;

      // Handle different file types
      if (typeof file === 'string' && file.startsWith('data:')) {
        // Handle data URLs by converting to Buffer
        const parts = file.split(',');
        // Ensure we always have a string (not undefined)
        const base64Data = parts.length > 1 ? parts[1] || '' : '';
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Extract content type safely
        const contentTypeParts = file.split(';')[0]?.split(':') || [];
        const contentType = contentTypeParts.length > 1 ? contentTypeParts[1] : 'application/octet-stream';
        
        const result = await provider.uploadBuffer(buffer, storagePath, {
          contentType,
          metadata: options?.metadata,
          isPublic: options?.isPublic
        });
        return {
          path: result.key,
          url: result.url
        };
      } else if (file instanceof Buffer) {
        // Upload Buffer
        const result = await provider.uploadBuffer(file, storagePath, {
          metadata: options?.metadata,
          isPublic: options?.isPublic
        });
        return {
          path: result.key,
          url: result.url
        };
      } else if (typeof file === 'string') {
        // Handle file paths - use uploadFile
        const result = await provider.uploadFile(file, storagePath, {
          metadata: options?.metadata,
          isPublic: options?.isPublic
        });
        return {
          path: result.key,
          url: result.url
        };
      } else {
        // Handle File/Blob - convert to Buffer and upload
        const arrayBuffer = await (file as Blob).arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const result = await provider.uploadBuffer(buffer, storagePath, {
          contentType: (file as File).type,
          metadata: options?.metadata,
          isPublic: options?.isPublic
        });
        return {
          path: result.key,
          url: result.url
        };
      }
    } catch (error) {
      logger.error('Failed to upload file', { error, options });
      return { path: '', error: error as Error };
    }
  }

  /**
   * Delete files from storage
   */
  public async delete(paths: string[], options?: StorageOptions): Promise<{ error?: Error }> {
    try {
      const provider = this.ensureProvider();
      
      // Delete objects one by one
      for (const path of paths) {
        // Extract bucket and path
        const { bucketName, objectKey } = this.extractBucketAndPath(path, options?.bucket);
        
        // Construct full storage path
        const storagePath = `${bucketName}/${objectKey}`;
        
        // Delete the object
        await provider.deleteObject(storagePath);
      }
      
      return {};
    } catch (error) {
      logger.error('Failed to delete files', { error, paths, options });
      return { error: error as Error };
    }
  }

  /**
   * List files in a directory
   */
  public async list(prefix?: string, options?: StorageOptions): Promise<ListResult> {
    try {
      const provider = this.ensureProvider();
      const bucket = options?.bucket || this.defaultBucket;
      
      // Construct full prefix path
      const fullPrefix = prefix ? `${bucket}/${prefix}` : bucket;
      
      // List objects
      const items = await provider.listObjects(fullPrefix);
      
      // Extract just the file names
      return {
        files: items.map(item => item.name)
      };
    } catch (error) {
      logger.error('Failed to list files', { error, prefix, options });
      return { files: [], error: error as Error };
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
      const provider = this.ensureProvider();
      
      // Extract bucket and paths
      const { bucketName: fromBucket, objectKey: fromKey } = 
        this.extractBucketAndPath(fromPath, options?.bucket);
      const { bucketName: toBucket, objectKey: toKey } = 
        this.extractBucketAndPath(toPath, options?.bucket);
      
      // If buckets are different, we need to do copy + delete
      if (fromBucket !== toBucket) {
        // Copy first
        await provider.copyObject(
          `${fromBucket}/${fromKey}`, 
          `${toBucket}/${toKey}`
        );
        
        // Then delete the original
        await provider.deleteObject(`${fromBucket}/${fromKey}`);
      } else {
        // Same bucket, use moveObject
        await provider.moveObject(
          `${fromBucket}/${fromKey}`,
          `${toBucket}/${toKey}`
        );
      }
      
      return {};
    } catch (error) {
      logger.error('Failed to move file', { error, fromPath, toPath, options });
      return { error: error as Error };
    }
  }

  /**
   * Get a signed URL for a file
   */
  public async getSignedUrl(
    path: string,
    options: { bucket?: string; expiresIn?: number }
  ): Promise<{ url: string; error?: Error }> {
    try {
      const provider = this.ensureProvider();
      
      // Extract bucket and path
      const { bucketName, objectKey } = this.extractBucketAndPath(path, options?.bucket);
      
      // Construct full storage path
      const storagePath = `${bucketName}/${objectKey}`;
      
      // Get signed URL from provider
      const url = await provider.getSignedUrl(storagePath, options?.expiresIn || 3600);
      
      return { url };
    } catch (error) {
      logger.error('Failed to get signed URL', { error, path, options });
      return { url: '', error: error as Error };
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
      const provider = this.ensureProvider();
      
      // Extract bucket and paths
      const { bucketName: fromBucket, objectKey: fromKey } = 
        this.extractBucketAndPath(fromPath, options?.bucket);
      const { bucketName: toBucket, objectKey: toKey } = 
        this.extractBucketAndPath(toPath, options?.bucket);
      
      // Copy the object
      await provider.copyObject(
        `${fromBucket}/${fromKey}`,
        `${toBucket}/${toKey}`
      );
      
      return {};
    } catch (error) {
      logger.error('Failed to copy file', { error, fromPath, toPath, options });
      return { error: error as Error };
    }
  }

  /**
   * Extract bucket and path from a storage path
   * If path doesn't include a bucket, uses the provided default or instance default
   */
  private extractBucketAndPath(
    path: string, 
    defaultBucket?: string
  ): { bucketName: string; objectKey: string } {
    // If the path doesn't contain a slash, treat the whole thing as an object key
    if (!path.includes('/')) {
      return {
        bucketName: defaultBucket || this.defaultBucket,
        objectKey: path
      };
    }
    
    // Otherwise, the first part is the bucket, the rest is the object key
    const slashIndex = path.indexOf('/');
    const bucketName = path.substring(0, slashIndex);
    const objectKey = path.substring(slashIndex + 1);
    
    return { bucketName, objectKey };
  }
}

// Export singleton instance
export const storage = S3StorageAdapter.getInstance();

// Export default for convenience
export default storage;
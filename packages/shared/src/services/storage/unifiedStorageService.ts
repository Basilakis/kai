/**
 * Unified Storage Service
 * 
 * This service provides a unified interface for storage operations across different providers.
 * It supports both Supabase Storage and S3-compatible storage backends through a provider pattern.
 * 
 * Features:
 * - Provider-agnostic interface for storage operations
 * - Support for multiple storage backends (Supabase, S3, etc.)
 * - Consistent error handling and retry mechanisms
 * - Type-safe operations with proper TypeScript definitions
 */

import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/unified-logger';

const logger = createLogger('UnifiedStorageService');

/**
 * Storage provider interface
 * All storage providers must implement this interface
 */
export interface StorageProvider {
  // Core operations
  uploadFile(filePath: string, storagePath: string, options?: StorageUploadOptions): Promise<StorageUploadResult>;
  uploadBuffer(buffer: Buffer, storagePath: string, options?: StorageUploadOptions): Promise<StorageUploadResult>;
  downloadFile(storagePath: string, destinationPath: string): Promise<StorageDownloadResult>;
  downloadBuffer(storagePath: string): Promise<StorageDownloadResult>;
  deleteObject(storagePath: string): Promise<StorageDeleteResult>;
  objectExists(storagePath: string): Promise<boolean>;
  
  // URL operations
  getPublicUrl(storagePath: string): Promise<string>;
  getSignedUrl(storagePath: string, expiresIn?: number): Promise<string>;
  
  // Advanced operations
  copyObject(sourcePath: string, destinationPath: string, options?: StorageUploadOptions): Promise<StorageUploadResult>;
  listObjects(directoryPath: string): Promise<StorageFileInfo[]>;
}

/**
 * Storage upload options
 */
export interface StorageUploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  isPublic?: boolean;
  upsert?: boolean;
}

/**
 * Storage upload result
 */
export interface StorageUploadResult {
  key: string;
  url: string;
  error?: Error;
}

/**
 * Storage download result
 */
export interface StorageDownloadResult {
  data?: Buffer;
  error?: Error;
}

/**
 * Storage delete result
 */
export interface StorageDeleteResult {
  success: boolean;
  error?: Error;
}

/**
 * Storage file information
 */
export interface StorageFileInfo {
  name: string;
  path: string;
  size: number;
  lastModified: Date;
  contentType?: string;
  metadata?: Record<string, any>;
}

/**
 * Unified Storage Service
 */
export class UnifiedStorageService {
  private static instance: UnifiedStorageService;
  private provider?: StorageProvider;
  private defaultBucket: string = 'default';

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    logger.info('UnifiedStorageService initialized');
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): UnifiedStorageService {
    if (!UnifiedStorageService.instance) {
      UnifiedStorageService.instance = new UnifiedStorageService();
    }
    return UnifiedStorageService.instance;
  }

  /**
   * Set the storage provider
   */
  public setProvider(provider: StorageProvider): void {
    this.provider = provider;
    logger.info('Storage provider set');
  }

  /**
   * Set the default bucket
   */
  public setDefaultBucket(bucket: string): void {
    this.defaultBucket = bucket;
    logger.info(`Default bucket set to: ${bucket}`);
  }

  /**
   * Get the current provider
   */
  private getProvider(): StorageProvider {
    if (!this.provider) {
      throw new Error('Storage provider not set. Call setProvider() first.');
    }
    return this.provider;
  }

  /**
   * Extract bucket and path from a storage path
   */
  private extractBucketAndPath(storagePath: string, defaultBucket?: string): { bucket: string; path: string } {
    const bucket = defaultBucket || this.defaultBucket;
    
    // If the path already includes a bucket prefix, extract it
    if (storagePath.includes('/')) {
      const parts = storagePath.split('/');
      // If the first part is a bucket name, use it
      if (parts.length > 1 && !parts[0].includes('.')) {
        return {
          bucket: parts[0],
          path: parts.slice(1).join('/')
        };
      }
    }
    
    // Otherwise, use the default bucket
    return {
      bucket,
      path: storagePath
    };
  }

  /**
   * Generate a unique storage key
   */
  public async generateUniqueKey(folder: string, fileName: string): Promise<string> {
    const timestamp = Date.now();
    const randomString = uuidv4().substring(0, 8);
    const extension = path.extname(fileName);
    const baseName = path.basename(fileName, extension);
    
    return `${this.defaultBucket}/${folder}/${baseName}-${timestamp}-${randomString}${extension}`;
  }

  /**
   * Upload a file to storage
   */
  public async uploadFile(
    filePath: string,
    storagePath: string,
    options?: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    try {
      const provider = this.getProvider();
      return await provider.uploadFile(filePath, storagePath, options);
    } catch (error) {
      logger.error(`Failed to upload file: ${error}`);
      return { key: storagePath, url: '', error: error as Error };
    }
  }

  /**
   * Upload a buffer to storage
   */
  public async uploadBuffer(
    buffer: Buffer,
    storagePath: string,
    options?: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    try {
      const provider = this.getProvider();
      return await provider.uploadBuffer(buffer, storagePath, options);
    } catch (error) {
      logger.error(`Failed to upload buffer: ${error}`);
      return { key: storagePath, url: '', error: error as Error };
    }
  }

  /**
   * Download a file from storage
   */
  public async downloadFile(
    storagePath: string,
    destinationPath: string
  ): Promise<StorageDownloadResult> {
    try {
      const provider = this.getProvider();
      return await provider.downloadFile(storagePath, destinationPath);
    } catch (error) {
      logger.error(`Failed to download file: ${error}`);
      return { error: error as Error };
    }
  }

  /**
   * Download a buffer from storage
   */
  public async downloadBuffer(storagePath: string): Promise<StorageDownloadResult> {
    try {
      const provider = this.getProvider();
      return await provider.downloadBuffer(storagePath);
    } catch (error) {
      logger.error(`Failed to download buffer: ${error}`);
      return { error: error as Error };
    }
  }

  /**
   * Delete an object from storage
   */
  public async deleteObject(storagePath: string): Promise<StorageDeleteResult> {
    try {
      const provider = this.getProvider();
      return await provider.deleteObject(storagePath);
    } catch (error) {
      logger.error(`Failed to delete object: ${error}`);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Check if an object exists in storage
   */
  public async objectExists(storagePath: string): Promise<boolean> {
    try {
      const provider = this.getProvider();
      return await provider.objectExists(storagePath);
    } catch (error) {
      logger.error(`Failed to check if object exists: ${error}`);
      return false;
    }
  }

  /**
   * Get a public URL for an object
   */
  public async getPublicUrl(storagePath: string): Promise<string> {
    try {
      const provider = this.getProvider();
      return await provider.getPublicUrl(storagePath);
    } catch (error) {
      logger.error(`Failed to get public URL: ${error}`);
      throw error;
    }
  }

  /**
   * Get a signed URL for an object
   */
  public async getSignedUrl(storagePath: string, expiresIn: number = 3600): Promise<string> {
    try {
      const provider = this.getProvider();
      return await provider.getSignedUrl(storagePath, expiresIn);
    } catch (error) {
      logger.error(`Failed to get signed URL: ${error}`);
      throw error;
    }
  }
}

// Export singleton instance
export const storage = UnifiedStorageService.getInstance();

// Export default for convenience
export default storage;

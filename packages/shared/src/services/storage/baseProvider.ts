import { logger } from '../../utils/logger';
import { StorageProvider, StorageUploadOptions, StorageRetryOptions, StorageUploadResult, StorageFileInfo, StorageError, StorageConfig } from './types';
import * as path from 'path';

/**
 * Base class for storage providers
 * Implements common functionality and utilities with production safeguards
 */
export abstract class BaseStorageProvider implements StorageProvider {
  protected readonly config: StorageConfig;
  protected defaultBucket: string;
  protected retryOptions: Required<StorageRetryOptions>;

  constructor(config: StorageConfig = {}) {
    this.config = config;
    this.defaultBucket = config.defaultBucket || 'default';
    this.retryOptions = {
      maxRetries: config.retryOptions?.maxRetries ?? 3,
      retryDelay: config.retryOptions?.retryDelay ?? 1000,
      timeout: config.retryOptions?.timeout ?? 30000
    };
  }

  abstract uploadFile(filePath: string, storagePath: string, options?: StorageUploadOptions & StorageRetryOptions): Promise<StorageUploadResult>;
  abstract uploadBuffer(buffer: Buffer, storagePath: string, options?: StorageUploadOptions & StorageRetryOptions): Promise<StorageUploadResult>;
  abstract getSignedUrl(storagePath: string, expiresIn?: number): Promise<string>;
  abstract getPublicUrl(storagePath: string): Promise<string>;
  abstract deleteObject(storagePath: string): Promise<void>;
  abstract objectExists(storagePath: string): Promise<boolean>;
  abstract moveObject(sourcePath: string, destinationPath: string, options?: StorageRetryOptions): Promise<StorageUploadResult>;
  abstract copyObject(sourcePath: string, destinationPath: string, options?: StorageRetryOptions): Promise<StorageUploadResult>;
  abstract listObjects(directoryPath: string): Promise<StorageFileInfo[]>;

  /**
   * Generate a unique storage key with retry mechanism
   */
  async generateUniqueKey(folder: string, fileName: string): Promise<string> {
    return await this.withRetry(async () => {
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);
      const extension = path.extname(fileName);
      const baseName = path.basename(fileName, extension);
      
      return `${this.defaultBucket}/${folder}/${baseName}-${timestamp}-${randomString}${extension}`;
    }, 'generateUniqueKey');
  }

  /**
   * Get content type based on file extension
   */
  protected getContentTypeFromExtension(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();
    
    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.zip': 'application/zip',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.wav': 'audio/wav',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.csv': 'text/csv'
    };
    
    return contentTypeMap[extension] || 'application/octet-stream';
  }

  /**
   * Extract bucket and path from storage path
   * Format: 'bucket/path/to/file.ext'
   */
  protected async extractBucketAndPath(storagePath: string): Promise<{ bucket: string; path: string }> {
    // Use default bucket if no slash in path
    if (!storagePath.includes('/')) {
      return {
        bucket: this.defaultBucket,
        path: storagePath
      };
    }
    
    const firstSlashIndex = storagePath.indexOf('/');
    const bucket = storagePath.substring(0, firstSlashIndex);
    const path = storagePath.substring(firstSlashIndex + 1);
    
    return { bucket, path };
  }

  /**
   * Wrap provider-specific errors in a common format
   */
  protected wrapError(error: unknown, operation: string): StorageError {
    const wrappedError = new Error(`Storage operation '${operation}' failed`) as StorageError;
    
    if (error instanceof Error) {
      wrappedError.stack = error.stack;
      wrappedError.name = error.name;
      if ('code' in error) wrappedError.code = (error as any).code;
      if ('details' in error) wrappedError.details = (error as any).details;
      if ('hint' in error) wrappedError.hint = (error as any).hint;
    }
    
    logger.error(`Storage error in '${operation}':`, { error });
    return wrappedError;
  }

  /**
   * Execute an operation with retry logic and timeout
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    options?: StorageRetryOptions
  ): Promise<T> {
    const retryOpts = {
      maxRetries: options?.maxRetries ?? this.retryOptions.maxRetries,
      retryDelay: options?.retryDelay ?? this.retryOptions.retryDelay,
      timeout: options?.timeout ?? this.retryOptions.timeout
    };

    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= retryOpts.maxRetries; attempt++) {
      try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Operation '${operationName}' timed out after ${retryOpts.timeout}ms`));
          }, retryOpts.timeout);
        });

        // Race between operation and timeout
        return await Promise.race([
          operation(),
          timeoutPromise
        ]);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retryOpts.maxRetries) {
          logger.warn(`Storage operation '${operationName}' failed, attempt ${attempt}/${retryOpts.maxRetries}:`, { error });
          await new Promise(resolve => setTimeout(resolve, retryOpts.retryDelay * attempt)); // Exponential backoff
          continue;
        }
      }
    }

    throw this.wrapError(lastError, operationName);
  }
}
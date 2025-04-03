/**
 * Storage Service Types
 */

export interface StorageUploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  isPublic?: boolean;
  upsert?: boolean;
}

export interface StorageRetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

export interface StorageUploadResult {
  key: string;
  url: string;
}

export interface StorageFileInfo {
  name: string;
  size: number;
  created_at: string;
  last_modified: string;
  mimetype: string;
  metadata: Record<string, any>;
  url: string;
}

export interface StorageError extends Error {
  code?: string;
  details?: string;
  hint?: string;
}

export interface StorageProvider {
  /**
   * Upload a file to storage
   * @throws {StorageError} if upload fails
   */
  uploadFile(filePath: string, storagePath: string, options?: StorageUploadOptions & StorageRetryOptions): Promise<StorageUploadResult>;

  /**
   * Upload a buffer to storage
   * @throws {StorageError} if upload fails
   */
  uploadBuffer(buffer: Buffer, storagePath: string, options?: StorageUploadOptions & StorageRetryOptions): Promise<StorageUploadResult>;

  /**
   * Get a signed URL for a storage object
   * @throws {StorageError} if URL generation fails
   */
  getSignedUrl(storagePath: string, expiresIn?: number): Promise<string>;

  /**
   * Get a public URL for a storage object
   * @throws {StorageError} if URL generation fails
   */
  getPublicUrl(storagePath: string): Promise<string>;

  /**
   * Delete an object from storage
   * @throws {StorageError} if deletion fails
   */
  deleteObject(storagePath: string): Promise<void>;

  /**
   * Check if an object exists in storage
   * @throws {StorageError} if check fails
   */
  objectExists(storagePath: string): Promise<boolean>;

  /**
   * Move a file within storage
   * @throws {StorageError} if move fails
   */
  moveObject(sourcePath: string, destinationPath: string, options?: StorageRetryOptions): Promise<StorageUploadResult>;

  /**
   * Copy a file within storage
   * @throws {StorageError} if copy fails
   */
  copyObject(sourcePath: string, destinationPath: string, options?: StorageRetryOptions): Promise<StorageUploadResult>;

  /**
   * List files in a storage directory
   * @throws {StorageError} if listing fails
   */
  listObjects(directoryPath: string): Promise<StorageFileInfo[]>;

  /**
   * Generate a unique storage key
   * @throws {StorageError} if key generation fails
   */
  generateUniqueKey(folder: string, fileName: string): Promise<string>;
}

export interface StorageConfig {
  defaultBucket?: string;
  settingsTable?: string;
  settingsKey?: string;
  retryOptions?: StorageRetryOptions;
}
/**
 * S3 Service Adapter
 *
 * This file provides a compatibility layer for the unified storage service.
 * It re-exports the unified storage service methods with the same interface
 * as the old s3Service.ts file to minimize code changes.
 */

import { storage, createLogger } from '@kai/shared';
import { StorageUploadOptions, StorageUploadResult } from '@kai/shared';

const logger = createLogger('S3ServiceAdapter');

// Re-export all methods from the unified storage adapter
export * from './unifiedStorageAdapter';

// Export singleton instance (for backward compatibility)
export const s3Service = {
  uploadFile: (filePath: string, storagePath: string, options?: StorageUploadOptions): Promise<StorageUploadResult> => {
    return storage.uploadFile(filePath, storagePath, options);
  },

  uploadBuffer: (buffer: Buffer, storagePath: string, options?: StorageUploadOptions): Promise<StorageUploadResult> => {
    return storage.uploadBuffer(buffer, storagePath, options);
  },

  getSignedUrl: (storagePath: string, expiresIn: number = 3600): Promise<string> => {
    return storage.getSignedUrl(storagePath, expiresIn);
  },

  getPublicUrl: (storagePath: string): Promise<string> => {
    return storage.getPublicUrl(storagePath);
  },

  deleteObject: (storagePath: string): Promise<void> => {
    return storage.deleteObject(storagePath).then(result => {
      if (!result.success && result.error) {
        throw result.error;
      }
    });
  },

  objectExists: (storagePath: string): Promise<boolean> => {
    return storage.objectExists(storagePath);
  },

  moveObject: (sourcePath: string, destinationPath: string): Promise<StorageUploadResult> => {
    return storage.copyObject(sourcePath, destinationPath).then(result => {
      return storage.deleteObject(sourcePath).then(() => result);
    });
  },

  copyObject: (sourcePath: string, destinationPath: string): Promise<StorageUploadResult> => {
    return storage.copyObject(sourcePath, destinationPath);
  },

  listObjects: (directoryPath: string): Promise<any[]> => {
    return storage.listObjects(directoryPath).then(files => {
      return files.map(file => ({
        name: file.name,
        size: file.size,
        created_at: file.lastModified.toISOString(),
        last_modified: file.lastModified.toISOString(),
        mimetype: file.contentType || 'application/octet-stream',
        metadata: file.metadata || {},
        url: file.path
      }));
    });
  },

  generateUniqueKey: (folder: string, fileName: string): Promise<string> => {
    return storage.generateUniqueKey(folder, fileName);
  }
};
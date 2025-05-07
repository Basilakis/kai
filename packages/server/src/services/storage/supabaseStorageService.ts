/**
 * Unified Storage Service Adapter
 *
 * This file provides a compatibility layer for the unified storage service.
 * It re-exports the unified storage service methods with the same interface
 * as the old supabaseStorageService.ts file to minimize code changes.
 */

import { storage, createLogger } from '@kai/shared';
import path from 'path';

const logger = createLogger('StorageServiceAdapter');

/**
 * Get the default storage bucket
 *
 * @returns The default storage bucket name
 */
async function getStorageBucket(): Promise<string> {
  return storage['defaultBucket'] || 'materials';
}

/**
 * Upload a file to storage
 *
 * @param filePath Path to the local file
 * @param storagePath Path in storage bucket
 * @param options Upload options
 * @returns Promise with upload result
 */
export async function uploadToStorage(
  filePath: string,
  storagePath: string,
  options: {
    contentType?: string;
    metadata?: Record<string, string>;
    isPublic?: boolean;
  } = {}
): Promise<{ key: string; url: string }> {
  try {
    logger.info(`Uploading file to storage: ${storagePath}`);

    // Use the unified storage service
    const result = await storage.uploadFile(filePath, storagePath, {
      contentType: options.contentType,
      metadata: options.metadata,
      isPublic: options.isPublic
    });

    return {
      key: storagePath,
      url: result.url
    };
  } catch (error) {
    logger.error(`Error uploading file to storage: ${error}`);
    throw error;
  }
}

/**
 * Upload a buffer to storage
 *
 * @param buffer Buffer to upload
 * @param storagePath Path in storage bucket
 * @param options Upload options
 * @returns Promise with upload result
 */
export async function uploadBufferToStorage(
  buffer: Buffer,
  storagePath: string,
  options: {
    contentType?: string;
    metadata?: Record<string, string>;
    isPublic?: boolean;
  } = {}
): Promise<{ key: string; url: string }> {
  try {
    logger.info(`Uploading buffer to storage: ${storagePath}`);

    // Use the unified storage service
    const result = await storage.uploadBuffer(buffer, storagePath, {
      contentType: options.contentType,
      metadata: options.metadata,
      isPublic: options.isPublic
    });

    return {
      key: storagePath,
      url: result.url
    };
  } catch (error) {
    logger.error(`Error uploading buffer to storage: ${error}`);
    throw error;
  }
}

/**
 * Get a signed URL for a Supabase Storage object
 *
 * @param storagePath Path in Supabase Storage bucket
 * @param expiresIn Expiration time in seconds (default: 3600)
 * @returns Promise with signed URL
 */
export async function getSignedStorageUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    // Extract bucket and path from storagePath
    const { bucket, path: filePath } = await extractBucketAndPath(storagePath);

    const storageClient = getStorageClient(bucket);
    const { data, error } = await storageClient.createSignedUrl(filePath, expiresIn);

    if (error) {
      throw error;
    }

    return data.signedUrl;
  } catch (err) {
    logger.error(`Error generating signed URL for Supabase Storage object: ${err}`);
    throw err;
  }
}

/**
 * Get a public URL for a Supabase Storage object
 *
 * @param storagePath Path in Supabase Storage bucket
 * @returns Public URL
 */
export async function getStorageUrl(storagePath: string): Promise<string> {
  const { bucket, path: filePath } = await extractBucketAndPath(storagePath);

  const storageClient = getStorageClient(bucket);
  const { data } = storageClient.getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Delete an object from Supabase Storage
 *
 * @param storagePath Path in Supabase Storage bucket
 * @returns Promise with delete result
 */
export async function deleteFromStorage(storagePath: string): Promise<void> {
  try {
    const { bucket, path: filePath } = await extractBucketAndPath(storagePath);

    logger.info(`Deleting file from Supabase Storage: ${storagePath}`);

    // Use retry operation for better reliability
    await retrySupabaseOperation(
      () => supabase
        .getClient()
        .storage
        .from(bucket)
        .remove([filePath]),
      `deleteFromStorage:${bucket}/${filePath}`,
      { maxRetries: 2 }
    );
  } catch (err) {
    // Use enhanced error handling but don't throw for not found errors
    const enhancedError = handleSupabaseError(
      err,
      'deleteFromStorage',
      { storagePath }
    );

    // Only throw if it's not a not-found error
    if (enhancedError.type !== 'not_found') {
      throw enhancedError;
    } else {
      logger.warn(`File not found when attempting to delete: ${storagePath}`);
    }
  }
}

/**
 * Check if an object exists in Supabase Storage
 *
 * @param storagePath Path in Supabase Storage bucket
 * @returns Promise with boolean indicating if object exists
 */
export async function objectExistsInStorage(storagePath: string): Promise<boolean> {
  try {
    const { bucket, path: filePath } = await extractBucketAndPath(storagePath);

    // Split the path to get the directory and filename
    const lastSlashIndex = filePath.lastIndexOf('/');
    const dirPath = lastSlashIndex >= 0 ? filePath.substring(0, lastSlashIndex) : '';
    const fileName = lastSlashIndex >= 0 ? filePath.substring(lastSlashIndex + 1) : filePath;

    // List files in the directory to check if our file exists
    const { data, error } = await supabaseClient
      .getClient()
      .storage
      .from(bucket)
      .list(dirPath);

    if (error) {
      throw error;
    }

    // Check if the filename is in the list
    return data.some((file: { name: string }) => file.name === fileName);
  } catch (err) {
    // If we get a 404 or other error, assume the file doesn't exist
    logger.error(`Error checking if object exists in Supabase Storage: ${err}`);
    return false;
  }
}

/**
 * Generate a unique storage key for a file
 *
 * @param bucket Bucket to use
 * @param folder Folder path in storage bucket
 * @param fileName Original file name
 * @returns Unique storage key
 */
export async function generateUniqueStorageKey(bucket: string, folder: string, fileName: string): Promise<string> {
  // If no bucket specified, use the configured bucket
  if (!bucket) {
    bucket = await getStorageBucket();
  }

  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension);

  return `${bucket}/${folder}/${baseName}-${timestamp}-${randomString}${extension}`;
}

/**
 * Get content type based on file extension
 *
 * @param filePath Path to the file
 * @returns Content type
 */
function getContentTypeFromExtension(filePath: string): string {
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
 *
 * @param storagePath Combined storage path
 * @returns Object with bucket and path
 */
async function extractBucketAndPath(storagePath: string): Promise<{ bucket: string, path: string }> {
  // Get configured bucket name
  const configuredBucket = await getStorageBucket();

  // Use configured Supabase bucket if no slash in path
  if (!storagePath.includes('/')) {
    return {
      bucket: configuredBucket,
      path: storagePath
    };
  }

  const firstSlashIndex = storagePath.indexOf('/');
  const bucket = storagePath.substring(0, firstSlashIndex);
  const path = storagePath.substring(firstSlashIndex + 1);

  return { bucket, path };
}

/**
 * Move a file within Supabase Storage
 *
 * @param sourcePath Source path in Supabase Storage
 * @param destinationPath Destination path in Supabase Storage
 * @returns Promise with move result
 */
export async function moveStorageFile(
  sourcePath: string,
  destinationPath: string
): Promise<{ key: string; url: string }> {
  try {
    const sourceObj = await extractBucketAndPath(sourcePath);
    const destObj = await extractBucketAndPath(destinationPath);

    // Check if buckets are different
    if (sourceObj.bucket !== destObj.bucket) {
      // Copy to new bucket then delete from old bucket
      // First download the file
      const { data: fileData, error: downloadError } = await supabaseClient
        .getClient()
        .storage
        .from(sourceObj.bucket)
        .download(sourceObj.path);

      if (downloadError) {
        throw downloadError;
      }

      // Upload to new location
      const result = await uploadBufferToStorage(
        BufferUtil.from(await fileData.arrayBuffer()) as Buffer,
        destinationPath
      );

      // Delete from old location
      await deleteFromStorage(sourcePath);

      return result;
    } else {
      // Same bucket, use download and upload since direct move might not be available
      const { data: fileData, error: downloadError } = await supabaseClient
        .getClient()
        .storage
        .from(sourceObj.bucket)
        .download(sourceObj.path);

      if (downloadError) {
        throw downloadError;
      }

      // Upload to new location
      const result = await uploadBufferToStorage(
        BufferUtil.from(await fileData.arrayBuffer()) as Buffer,
        destinationPath
      );

      // Delete original
      await deleteFromStorage(sourcePath);

      // Generate URL
      const url = await getStorageUrl(destinationPath);

      return {
        key: destinationPath,
        url
      };
    }
  } catch (err) {
    logger.error(`Error moving file in Supabase Storage: ${err}`);
    throw err;
  }
}

/**
 * Copy a file within Supabase Storage
 *
 * @param sourcePath Source path in Supabase Storage
 * @param destinationPath Destination path in Supabase Storage
 * @returns Promise with copy result
 */
export async function copyStorageFile(
  sourcePath: string,
  destinationPath: string
): Promise<{ key: string; url: string }> {
  try {
    const sourceObj = await extractBucketAndPath(sourcePath);
    const destObj = await extractBucketAndPath(destinationPath);

    // Check if buckets are different
    if (sourceObj.bucket !== destObj.bucket) {
      // Download from source bucket
      const { data: fileData, error: downloadError } = await supabaseClient
        .getClient()
        .storage
        .from(sourceObj.bucket)
        .download(sourceObj.path);

      if (downloadError) {
        throw downloadError;
      }

      // Upload to destination bucket
      return await uploadBufferToStorage(
        BufferUtil.from(await fileData.arrayBuffer()) as Buffer,
        destinationPath
      );
    } else {
      // Same bucket, use download and upload since direct copy might not be available
      const { data: fileData, error: downloadError } = await supabaseClient
        .getClient()
        .storage
        .from(sourceObj.bucket)
        .download(sourceObj.path);

      if (downloadError) {
        throw downloadError;
      }

      // Upload to new location
      return await uploadBufferToStorage(
        BufferUtil.from(await fileData.arrayBuffer()) as Buffer,
        destinationPath
      );
    }
  } catch (err) {
    logger.error(`Error copying file in Supabase Storage: ${err}`);
    throw err;
  }
}

/**
 * List files in a Supabase Storage directory
 *
 * @param directoryPath Directory path in Supabase Storage bucket
 * @returns Promise with list of files
 */
export async function listStorageFiles(directoryPath: string): Promise<Array<{
  name: string;
  size: number;
  created_at: string;
  last_modified: string;
  mimetype: string;
  metadata: Record<string, any>;
  url: string;
}>> {
  try {
    const { bucket, path: dirPath } = await extractBucketAndPath(directoryPath);

    const { data, error } = await supabaseClient
      .getClient()
      .storage
      .from(bucket)
      .list(dirPath);

    if (error) {
      throw error;
    }

    // Generate URLs and enhance metadata
    return await Promise.all(data.map(async (file: any) => {
      // Skip directories
      if (file.metadata === null) {
        return {
          name: file.name,
          size: 0,
          created_at: file.created_at,
          last_modified: file.updated_at || file.created_at,
          mimetype: 'application/directory',
          metadata: {},
          url: ''
        };
      }

      // Get URL for file
      const fullPath = dirPath ? `${dirPath}/${file.name}` : file.name;
      const storageClient = getStorageClient(bucket);
      const { data } = storageClient.getPublicUrl(fullPath);

      return {
        name: file.name,
        size: file.metadata?.size || 0,
        created_at: file.created_at,
        last_modified: file.updated_at || file.created_at,
        mimetype: file.metadata?.mimetype || getContentTypeFromExtension(file.name),
        metadata: file.metadata || {},
        url: data.publicUrl
      };
    }));
  } catch (err) {
    logger.error(`Error listing files in Supabase Storage: ${err}`);
    throw err;
  }
}

// Export a convenient alias map for dropping in as replacement for s3Service
export const uploadToS3 = uploadToStorage;
export const uploadBufferToS3 = uploadBufferToStorage;
export const getSignedS3Url = getSignedStorageUrl;
export const getS3Url = getStorageUrl;
export const deleteFromS3 = deleteFromStorage;
export const objectExistsInS3 = objectExistsInStorage;
export const generateUniqueS3Key = async (folder: string, fileName: string): Promise<string> => {
  const configuredBucket = await getStorageBucket();
  return await generateUniqueStorageKey(configuredBucket, folder, fileName);
};
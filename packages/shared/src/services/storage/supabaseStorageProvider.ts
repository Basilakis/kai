/**
 * Supabase Storage Provider
 * 
 * This provider implements the StorageProvider interface using Supabase Storage.
 * It handles all storage operations through the Supabase client.
 */

import * as fs from 'fs';
import * as path from 'path';
import { supabase } from '../supabase/supabaseClient';
import { createLogger } from '../../utils/unified-logger';
import { 
  StorageProvider, 
  StorageUploadOptions, 
  StorageUploadResult,
  StorageDownloadResult,
  StorageDeleteResult,
  StorageFileInfo
} from './unifiedStorageService';

const logger = createLogger('SupabaseStorageProvider');

/**
 * Helper for Supabase Storage API methods that might not be available in all versions
 */
interface StorageClientWrapper {
  getPublicUrl: (path: string) => { data: { publicUrl: string } };
  createSignedUrl: (path: string, expiresIn: number) => Promise<{ data: { signedUrl: string }, error: any }>;
}

/**
 * Get a wrapped storage client with fallbacks for potentially missing methods
 */
function getStorageClient(bucket: string): StorageClientWrapper {
  const storageClient = supabase.getClient().storage.from(bucket);
  
  // Ensure the client has the required methods
  return {
    getPublicUrl: (path: string) => {
      // Handle different versions of the Supabase client
      if (typeof storageClient.getPublicUrl === 'function') {
        return storageClient.getPublicUrl(path);
      }
      
      // Fallback for older versions
      return {
        data: {
          publicUrl: `${process.env.SUPABASE_URL || ''}/storage/v1/object/public/${bucket}/${path}`
        }
      };
    },
    createSignedUrl: async (path: string, expiresIn: number) => {
      // Handle different versions of the Supabase client
      if (typeof storageClient.createSignedUrl === 'function') {
        return await storageClient.createSignedUrl(path, expiresIn);
      }
      
      // Fallback for older versions
      if (typeof storageClient.createSignedUrls === 'function') {
        const result = await storageClient.createSignedUrls([path], expiresIn);
        if (result.error) return { data: { signedUrl: '' }, error: result.error };
        if (!result.data || result.data.length === 0) {
          return { data: { signedUrl: '' }, error: new Error('Failed to create signed URL') };
        }
        return { data: { signedUrl: result.data[0].signedUrl }, error: null };
      }
      
      // Last resort fallback
      return {
        data: { signedUrl: '' },
        error: new Error('createSignedUrl method not available')
      };
    }
  };
}

/**
 * Get content type based on file extension
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
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  };
  
  return contentTypeMap[extension] || 'application/octet-stream';
}

/**
 * Extract bucket and path from a storage path
 */
function extractBucketAndPath(storagePath: string, defaultBucket: string): { bucket: string; path: string } {
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
    bucket: defaultBucket,
    path: storagePath
  };
}

/**
 * Supabase Storage Provider implementation
 */
export class SupabaseStorageProvider implements StorageProvider {
  private defaultBucket: string;
  
  /**
   * Create a new SupabaseStorageProvider
   * @param defaultBucket Default bucket name
   */
  constructor(defaultBucket: string = 'default') {
    this.defaultBucket = defaultBucket;
    logger.info(`SupabaseStorageProvider initialized with bucket: ${defaultBucket}`);
  }
  
  /**
   * Upload a file to Supabase Storage
   */
  async uploadFile(
    filePath: string,
    storagePath: string,
    options?: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    try {
      // Validate file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      // Read file content
      const fileContent = fs.readFileSync(filePath);
      
      // Determine content type
      const contentType = options?.contentType || getContentTypeFromExtension(filePath);
      
      // Extract bucket and path
      const { bucket, path: fileSavePath } = extractBucketAndPath(storagePath, this.defaultBucket);
      
      // Upload to Supabase Storage
      const { data, error } = await supabase
        .getClient()
        .storage
        .from(bucket)
        .upload(fileSavePath, fileContent, {
          contentType,
          upsert: options?.upsert ?? true,
          ...(options?.metadata ? { metadata: options.metadata } : {})
        });
      
      if (error) throw error;
      
      // Generate URL based on visibility
      let url;
      if (options?.isPublic) {
        // Generate public URL
        const storageClient = getStorageClient(bucket);
        const { data } = storageClient.getPublicUrl(fileSavePath);
        url = data.publicUrl;
      } else {
        // Get signed URL with 1 hour expiry by default
        const storageClient = getStorageClient(bucket);
        const { data: signedUrlData, error: signedUrlError } = await storageClient.createSignedUrl(fileSavePath, 3600);
        
        if (signedUrlError) {
          throw signedUrlError;
        }
        
        url = signedUrlData.signedUrl;
      }
      
      return {
        key: storagePath,
        url
      };
    } catch (error) {
      logger.error(`Error uploading file to Supabase Storage: ${error}`);
      return {
        key: storagePath,
        url: '',
        error: error as Error
      };
    }
  }
  
  /**
   * Upload a buffer to Supabase Storage
   */
  async uploadBuffer(
    buffer: Buffer,
    storagePath: string,
    options?: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    try {
      // Determine content type
      const contentType = options?.contentType || getContentTypeFromExtension(storagePath);
      
      // Extract bucket and path
      const { bucket, path: fileSavePath } = extractBucketAndPath(storagePath, this.defaultBucket);
      
      // Upload to Supabase Storage
      const { data, error } = await supabase
        .getClient()
        .storage
        .from(bucket)
        .upload(fileSavePath, buffer, {
          contentType,
          upsert: options?.upsert ?? true,
          ...(options?.metadata ? { metadata: options.metadata } : {})
        });
      
      if (error) throw error;
      
      // Generate URL based on visibility
      let url;
      if (options?.isPublic) {
        // Generate public URL
        const storageClient = getStorageClient(bucket);
        const { data } = storageClient.getPublicUrl(fileSavePath);
        url = data.publicUrl;
      } else {
        // Get signed URL with 1 hour expiry by default
        const storageClient = getStorageClient(bucket);
        const { data: signedUrlData, error: signedUrlError } = await storageClient.createSignedUrl(fileSavePath, 3600);
        
        if (signedUrlError) {
          throw signedUrlError;
        }
        
        url = signedUrlData.signedUrl;
      }
      
      return {
        key: storagePath,
        url
      };
    } catch (error) {
      logger.error(`Error uploading buffer to Supabase Storage: ${error}`);
      return {
        key: storagePath,
        url: '',
        error: error as Error
      };
    }
  }
  
  /**
   * Download a file from Supabase Storage
   */
  async downloadFile(
    storagePath: string,
    destinationPath: string
  ): Promise<StorageDownloadResult> {
    try {
      // Extract bucket and path
      const { bucket, path: filePath } = extractBucketAndPath(storagePath, this.defaultBucket);
      
      // Download from Supabase Storage
      const { data, error } = await supabase
        .getClient()
        .storage
        .from(bucket)
        .download(filePath);
      
      if (error) throw error;
      if (!data) throw new Error('No data received from Supabase Storage');
      
      // Convert to Buffer
      const buffer = Buffer.from(await data.arrayBuffer());
      
      // Write to destination
      fs.writeFileSync(destinationPath, buffer);
      
      return { data: buffer };
    } catch (error) {
      logger.error(`Error downloading file from Supabase Storage: ${error}`);
      return { error: error as Error };
    }
  }
  
  /**
   * Download a buffer from Supabase Storage
   */
  async downloadBuffer(storagePath: string): Promise<StorageDownloadResult> {
    try {
      // Extract bucket and path
      const { bucket, path: filePath } = extractBucketAndPath(storagePath, this.defaultBucket);
      
      // Download from Supabase Storage
      const { data, error } = await supabase
        .getClient()
        .storage
        .from(bucket)
        .download(filePath);
      
      if (error) throw error;
      if (!data) throw new Error('No data received from Supabase Storage');
      
      // Convert to Buffer
      const buffer = Buffer.from(await data.arrayBuffer());
      
      return { data: buffer };
    } catch (error) {
      logger.error(`Error downloading buffer from Supabase Storage: ${error}`);
      return { error: error as Error };
    }
  }
  
  /**
   * Delete an object from Supabase Storage
   */
  async deleteObject(storagePath: string): Promise<StorageDeleteResult> {
    try {
      // Extract bucket and path
      const { bucket, path: filePath } = extractBucketAndPath(storagePath, this.defaultBucket);
      
      // Delete from Supabase Storage
      const { error } = await supabase
        .getClient()
        .storage
        .from(bucket)
        .remove([filePath]);
      
      if (error) throw error;
      
      return { success: true };
    } catch (error) {
      logger.error(`Error deleting object from Supabase Storage: ${error}`);
      return { success: false, error: error as Error };
    }
  }
  
  /**
   * Check if an object exists in Supabase Storage
   */
  async objectExists(storagePath: string): Promise<boolean> {
    try {
      // Extract bucket and path
      const { bucket, path: filePath } = extractBucketAndPath(storagePath, this.defaultBucket);
      
      // List objects with the same path prefix
      const { data, error } = await supabase
        .getClient()
        .storage
        .from(bucket)
        .list(path.dirname(filePath), {
          limit: 1,
          offset: 0,
          search: path.basename(filePath)
        });
      
      if (error) throw error;
      
      // Check if the file exists
      return data && data.length > 0 && data.some(item => item.name === path.basename(filePath));
    } catch (error) {
      logger.error(`Error checking if object exists in Supabase Storage: ${error}`);
      return false;
    }
  }
  
  /**
   * Get a public URL for an object
   */
  async getPublicUrl(storagePath: string): Promise<string> {
    try {
      // Extract bucket and path
      const { bucket, path: filePath } = extractBucketAndPath(storagePath, this.defaultBucket);
      
      // Get public URL
      const storageClient = getStorageClient(bucket);
      const { data } = storageClient.getPublicUrl(filePath);
      
      return data.publicUrl;
    } catch (error) {
      logger.error(`Error getting public URL from Supabase Storage: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get a signed URL for an object
   */
  async getSignedUrl(storagePath: string, expiresIn: number = 3600): Promise<string> {
    try {
      // Extract bucket and path
      const { bucket, path: filePath } = extractBucketAndPath(storagePath, this.defaultBucket);
      
      // Get signed URL
      const storageClient = getStorageClient(bucket);
      const { data, error } = await storageClient.createSignedUrl(filePath, expiresIn);
      
      if (error) throw error;
      
      return data.signedUrl;
    } catch (error) {
      logger.error(`Error getting signed URL from Supabase Storage: ${error}`);
      throw error;
    }
  }
  
  /**
   * Copy an object in Supabase Storage
   */
  async copyObject(
    sourcePath: string,
    destinationPath: string,
    options?: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    try {
      // Download the source object
      const downloadResult = await this.downloadBuffer(sourcePath);
      
      if (downloadResult.error || !downloadResult.data) {
        throw downloadResult.error || new Error('Failed to download source object');
      }
      
      // Upload to the destination
      return await this.uploadBuffer(downloadResult.data, destinationPath, options);
    } catch (error) {
      logger.error(`Error copying object in Supabase Storage: ${error}`);
      return {
        key: destinationPath,
        url: '',
        error: error as Error
      };
    }
  }
  
  /**
   * List objects in Supabase Storage
   */
  async listObjects(directoryPath: string): Promise<StorageFileInfo[]> {
    try {
      // Extract bucket and path
      const { bucket, path: dirPath } = extractBucketAndPath(directoryPath, this.defaultBucket);
      
      // List objects
      const { data, error } = await supabase
        .getClient()
        .storage
        .from(bucket)
        .list(dirPath);
      
      if (error) throw error;
      if (!data) return [];
      
      // Convert to StorageFileInfo
      return data.map(item => ({
        name: item.name,
        path: dirPath ? `${dirPath}/${item.name}` : item.name,
        size: item.metadata?.size || 0,
        lastModified: new Date(item.metadata?.lastModified || Date.now()),
        contentType: item.metadata?.contentType,
        metadata: item.metadata
      }));
    } catch (error) {
      logger.error(`Error listing objects in Supabase Storage: ${error}`);
      return [];
    }
  }
}

// Export the provider class
export default SupabaseStorageProvider;

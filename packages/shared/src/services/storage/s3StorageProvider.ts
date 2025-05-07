/**
 * S3 Storage Provider
 * 
 * This provider implements the StorageProvider interface using AWS S3 or S3-compatible storage.
 * It handles all storage operations through the AWS SDK.
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createLogger } from '../../utils/unified-logger';
import { 
  StorageProvider, 
  StorageUploadOptions, 
  StorageUploadResult,
  StorageDownloadResult,
  StorageDeleteResult,
  StorageFileInfo
} from './unifiedStorageService';

const logger = createLogger('S3StorageProvider');

/**
 * S3 configuration
 */
export interface S3Config {
  endpoint?: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  publicUrl?: string;
  forcePathStyle?: boolean;
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
 * S3 Storage Provider implementation
 */
export class S3StorageProvider implements StorageProvider {
  private s3Client: S3Client;
  private bucket: string;
  private publicUrl?: string;
  
  /**
   * Create a new S3StorageProvider
   * @param config S3 configuration
   */
  constructor(config: S3Config) {
    this.bucket = config.bucket;
    this.publicUrl = config.publicUrl;
    
    // Create S3 client
    this.s3Client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey
      },
      forcePathStyle: config.forcePathStyle ?? false
    });
    
    logger.info(`S3StorageProvider initialized with bucket: ${this.bucket}`);
  }
  
  /**
   * Upload a file to S3
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
      const { bucket, path: objectKey } = extractBucketAndPath(storagePath, this.bucket);
      
      // Upload to S3
      const uploadParams = {
        Bucket: bucket,
        Key: objectKey,
        Body: fileContent,
        ContentType: contentType,
        Metadata: options?.metadata,
        ACL: options?.isPublic ? 'public-read' : undefined
      };
      
      await this.s3Client.send(new PutObjectCommand(uploadParams));
      
      // Generate URL
      const url = options?.isPublic
        ? await this.getPublicUrl(storagePath)
        : await this.getSignedUrl(storagePath);
      
      return {
        key: storagePath,
        url
      };
    } catch (error) {
      logger.error(`Error uploading file to S3: ${error}`);
      return {
        key: storagePath,
        url: '',
        error: error as Error
      };
    }
  }
  
  /**
   * Upload a buffer to S3
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
      const { bucket, path: objectKey } = extractBucketAndPath(storagePath, this.bucket);
      
      // Upload to S3
      const uploadParams = {
        Bucket: bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: contentType,
        Metadata: options?.metadata,
        ACL: options?.isPublic ? 'public-read' : undefined
      };
      
      await this.s3Client.send(new PutObjectCommand(uploadParams));
      
      // Generate URL
      const url = options?.isPublic
        ? await this.getPublicUrl(storagePath)
        : await this.getSignedUrl(storagePath);
      
      return {
        key: storagePath,
        url
      };
    } catch (error) {
      logger.error(`Error uploading buffer to S3: ${error}`);
      return {
        key: storagePath,
        url: '',
        error: error as Error
      };
    }
  }
  
  /**
   * Download a file from S3
   */
  async downloadFile(
    storagePath: string,
    destinationPath: string
  ): Promise<StorageDownloadResult> {
    try {
      // Extract bucket and path
      const { bucket, path: objectKey } = extractBucketAndPath(storagePath, this.bucket);
      
      // Download from S3
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey
      });
      
      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error('No data received from S3');
      }
      
      // Convert to Buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      // Write to destination
      fs.writeFileSync(destinationPath, buffer);
      
      return { data: buffer };
    } catch (error) {
      logger.error(`Error downloading file from S3: ${error}`);
      return { error: error as Error };
    }
  }
  
  /**
   * Download a buffer from S3
   */
  async downloadBuffer(storagePath: string): Promise<StorageDownloadResult> {
    try {
      // Extract bucket and path
      const { bucket, path: objectKey } = extractBucketAndPath(storagePath, this.bucket);
      
      // Download from S3
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey
      });
      
      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error('No data received from S3');
      }
      
      // Convert to Buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      return { data: buffer };
    } catch (error) {
      logger.error(`Error downloading buffer from S3: ${error}`);
      return { error: error as Error };
    }
  }
  
  /**
   * Delete an object from S3
   */
  async deleteObject(storagePath: string): Promise<StorageDeleteResult> {
    try {
      // Extract bucket and path
      const { bucket, path: objectKey } = extractBucketAndPath(storagePath, this.bucket);
      
      // Delete from S3
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: objectKey
      });
      
      await this.s3Client.send(command);
      
      return { success: true };
    } catch (error) {
      logger.error(`Error deleting object from S3: ${error}`);
      return { success: false, error: error as Error };
    }
  }
  
  /**
   * Check if an object exists in S3
   */
  async objectExists(storagePath: string): Promise<boolean> {
    try {
      // Extract bucket and path
      const { bucket, path: objectKey } = extractBucketAndPath(storagePath, this.bucket);
      
      // Check if object exists
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: objectKey
      });
      
      await this.s3Client.send(command);
      
      return true;
    } catch (error) {
      // If the error is a 404, the object doesn't exist
      if ((error as any).name === 'NotFound') {
        return false;
      }
      
      logger.error(`Error checking if object exists in S3: ${error}`);
      return false;
    }
  }
  
  /**
   * Get a public URL for an object
   */
  async getPublicUrl(storagePath: string): Promise<string> {
    try {
      // Extract bucket and path
      const { bucket, path: objectKey } = extractBucketAndPath(storagePath, this.bucket);
      
      // If a custom public URL is provided, use it
      if (this.publicUrl) {
        return `${this.publicUrl}/${objectKey}`;
      }
      
      // Otherwise, construct a standard S3 URL
      const region = this.s3Client.config.region;
      return `https://${bucket}.s3.${region}.amazonaws.com/${objectKey}`;
    } catch (error) {
      logger.error(`Error getting public URL from S3: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get a signed URL for an object
   */
  async getSignedUrl(storagePath: string, expiresIn: number = 3600): Promise<string> {
    try {
      // Extract bucket and path
      const { bucket, path: objectKey } = extractBucketAndPath(storagePath, this.bucket);
      
      // Create command
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey
      });
      
      // Generate signed URL
      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      
      return url;
    } catch (error) {
      logger.error(`Error getting signed URL from S3: ${error}`);
      throw error;
    }
  }
  
  /**
   * Copy an object in S3
   */
  async copyObject(
    sourcePath: string,
    destinationPath: string,
    options?: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    try {
      // Extract source bucket and path
      const { bucket: sourceBucket, path: sourceKey } = extractBucketAndPath(sourcePath, this.bucket);
      
      // Extract destination bucket and path
      const { bucket: destinationBucket, path: destinationKey } = extractBucketAndPath(destinationPath, this.bucket);
      
      // Copy object
      const command = new CopyObjectCommand({
        CopySource: `${sourceBucket}/${sourceKey}`,
        Bucket: destinationBucket,
        Key: destinationKey,
        ACL: options?.isPublic ? 'public-read' : undefined,
        ContentType: options?.contentType,
        Metadata: options?.metadata,
        MetadataDirective: options?.metadata ? 'REPLACE' : 'COPY'
      });
      
      await this.s3Client.send(command);
      
      // Generate URL
      const url = options?.isPublic
        ? await this.getPublicUrl(destinationPath)
        : await this.getSignedUrl(destinationPath);
      
      return {
        key: destinationPath,
        url
      };
    } catch (error) {
      logger.error(`Error copying object in S3: ${error}`);
      return {
        key: destinationPath,
        url: '',
        error: error as Error
      };
    }
  }
  
  /**
   * List objects in S3
   */
  async listObjects(directoryPath: string): Promise<StorageFileInfo[]> {
    try {
      // Extract bucket and path
      const { bucket, path: prefix } = extractBucketAndPath(directoryPath, this.bucket);
      
      // List objects
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        Delimiter: '/'
      });
      
      const response = await this.s3Client.send(command);
      
      if (!response.Contents) {
        return [];
      }
      
      // Convert to StorageFileInfo
      return response.Contents.map(item => ({
        name: path.basename(item.Key || ''),
        path: item.Key || '',
        size: item.Size || 0,
        lastModified: item.LastModified || new Date(),
        contentType: undefined, // Not available in ListObjectsV2 response
        metadata: undefined // Not available in ListObjectsV2 response
      }));
    } catch (error) {
      logger.error(`Error listing objects in S3: ${error}`);
      return [];
    }
  }
}

// Export the provider class
export default S3StorageProvider;

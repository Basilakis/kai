import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import { logger } from '../../utils/logger';
import { STORAGE } from '@kai/shared';
import { BaseStorageProvider } from '../../../../shared/src/services/storage/baseProvider';
import { StorageUploadOptions, StorageUploadResult, StorageFileInfo, StorageRetryOptions } from '../../../../shared/src/services/storage/types';

/**
 * S3 Service
 * 
 * This service is responsible for interacting with AWS S3 for file storage.
 * It extends BaseStorageProvider to provide production-ready storage functionality.
 */
export class S3Service extends BaseStorageProvider {
  private s3Client: S3Client;
  private bucket: string;

  constructor() {
    super({
      defaultBucket: STORAGE.S3_BUCKET,
      retryOptions: {
        maxRetries: 3,
        retryDelay: 1000,
        timeout: 30000
      }
    });

    this.bucket = STORAGE.S3_BUCKET;
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          }
        : undefined // Use default credentials provider chain if not provided
    });
  }

  async uploadFile(
    filePath: string,
    storagePath: string,
    options?: StorageUploadOptions & StorageRetryOptions
  ): Promise<StorageUploadResult> {
    return await this.withRetry(async () => {
      // Validate file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Read file content
      const fileContent = fs.readFileSync(filePath);
      
      // Determine content type
      const contentType = options?.contentType || this.getContentTypeFromExtension(filePath);
      
      // Upload to S3
      const uploadParams = {
        Bucket: this.bucket,
        Key: storagePath,
        Body: fileContent,
        ContentType: contentType,
        Metadata: options?.metadata,
        ACL: options?.isPublic ? 'public-read' : undefined
      };
      
      logger.info(`Uploading file to S3: ${storagePath}`);
      await this.s3Client.send(new PutObjectCommand(uploadParams));
      
      // Generate URL
      const url = await this.getPublicUrl(storagePath);
      
      return {
        key: storagePath,
        url
      };
    }, 'uploadFile', options);
  }

  async uploadBuffer(
    buffer: Buffer,
    storagePath: string,
    options?: StorageUploadOptions & StorageRetryOptions
  ): Promise<StorageUploadResult> {
    return await this.withRetry(async () => {
      const contentType = options?.contentType || this.getContentTypeFromExtension(storagePath);
      
      const uploadParams = {
        Bucket: this.bucket,
        Key: storagePath,
        Body: buffer,
        ContentType: contentType,
        Metadata: options?.metadata,
        ACL: options?.isPublic ? 'public-read' : undefined
      };
      
      logger.info(`Uploading buffer to S3: ${storagePath}`);
      await this.s3Client.send(new PutObjectCommand(uploadParams));
      
      const url = await this.getPublicUrl(storagePath);
      
      return {
        key: storagePath,
        url
      };
    }, 'uploadBuffer', options);
  }

  async getSignedUrl(storagePath: string, expiresIn: number = 3600): Promise<string> {
    return await this.withRetry(async () => {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: storagePath
      });
      
      return await getSignedUrl(this.s3Client, command, { expiresIn });
    }, 'getSignedUrl');
  }

  async getPublicUrl(storagePath: string): Promise<string> {
    const region = process.env.AWS_REGION || 'us-east-1';
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${storagePath}`;
  }

  async deleteObject(storagePath: string): Promise<void> {
    await this.withRetry(async () => {
      const deleteParams = {
        Bucket: this.bucket,
        Key: storagePath
      };
      
      logger.info(`Deleting file from S3: ${storagePath}`);
      await this.s3Client.send(new DeleteObjectCommand(deleteParams));
    }, 'deleteObject');
  }

  async objectExists(storagePath: string): Promise<boolean> {
    try {
      await this.withRetry(async () => {
        await this.s3Client.send(new GetObjectCommand({
          Bucket: this.bucket,
          Key: storagePath
        }));
      }, 'objectExists');
      
      return true;
    } catch (err) {
      if ((err as any).name === 'NoSuchKey') {
        return false;
      }
      throw err;
    }
  }

  async moveObject(
    sourcePath: string,
    destinationPath: string,
    options?: StorageRetryOptions
  ): Promise<StorageUploadResult> {
    return await this.withRetry(async () => {
      // Copy to new location
      const copyResult = await this.copyObject(sourcePath, destinationPath, options);
      
      // Delete from old location
      await this.deleteObject(sourcePath);
      
      return copyResult;
    }, 'moveObject', options);
  }

  async copyObject(
    sourcePath: string,
    destinationPath: string,
    options?: StorageRetryOptions
  ): Promise<StorageUploadResult> {
    return await this.withRetry(async () => {
      // Get the object
      const { Body } = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: sourcePath
      }));

      if (!Body) {
        throw new Error(`Source object not found: ${sourcePath}`);
      }

      // Convert to buffer
      const buffer = await Body.transformToByteArray();
      
      // Upload to new location
      return await this.uploadBuffer(Buffer.from(buffer), destinationPath);
    }, 'copyObject', options);
  }

  async listObjects(directoryPath: string): Promise<StorageFileInfo[]> {
    return await this.withRetry(async () => {
      const { Contents = [] } = await this.s3Client.send(new ListObjectsCommand({
        Bucket: this.bucket,
        Prefix: directoryPath
      }));

      return await Promise.all(Contents.map(async (item: any) => ({
        name: item.Key.replace(directoryPath, '').replace(/^\//, ''),
        size: item.Size,
        created_at: item.LastModified.toISOString(),
        last_modified: item.LastModified.toISOString(),
        mimetype: this.getContentTypeFromExtension(item.Key),
        metadata: item.Metadata || {},
        url: await this.getPublicUrl(item.Key)
      })));
    }, 'listObjects');
  }
}

// Export singleton instance
export const s3Service = new S3Service();

// Export convenience methods that match the old interface
export const uploadToS3 = (filePath: string, s3Key: string, options?: StorageUploadOptions) => 
  s3Service.uploadFile(filePath, s3Key, options);

export const uploadBufferToS3 = (buffer: Buffer, s3Key: string, options?: StorageUploadOptions) =>
  s3Service.uploadBuffer(buffer, s3Key, options);

export const getSignedS3Url = (s3Key: string, expiresIn?: number) =>
  s3Service.getSignedUrl(s3Key, expiresIn);

export const getS3Url = (s3Key: string) =>
  s3Service.getPublicUrl(s3Key);

export const deleteFromS3 = (s3Key: string) =>
  s3Service.deleteObject(s3Key);

export const objectExistsInS3 = (s3Key: string) =>
  s3Service.objectExists(s3Key);

export const generateUniqueS3Key = (folder: string, fileName: string) =>
  s3Service.generateUniqueKey(folder, fileName);
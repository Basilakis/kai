/**
 * S3 Service
 * 
 * This service is responsible for interacting with AWS S3 for file storage.
 * It provides functionality to upload files, generate URLs, and manage
 * file storage in S3 buckets.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';
import { STORAGE } from '@kai/shared';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    : undefined // Use default credentials provider chain if not provided
});

/**
 * Upload a file to S3
 * 
 * @param filePath Path to the local file
 * @param s3Key Key (path) in S3 bucket
 * @param options Upload options
 * @returns Promise with upload result
 */
export async function uploadToS3(
  filePath: string,
  s3Key: string,
  options: {
    contentType?: string;
    metadata?: Record<string, string>;
    acl?: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read';
  } = {}
): Promise<{ key: string; url: string }> {
  try {
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Read file content
    const fileContent = fs.readFileSync(filePath);
    
    // Determine content type based on file extension if not provided
    const contentType = options.contentType || getContentTypeFromExtension(filePath);
    
    // Upload to S3
    const uploadParams = {
      Bucket: STORAGE.S3_BUCKET,
      Key: s3Key,
      Body: fileContent,
      ContentType: contentType,
      Metadata: options.metadata,
      ACL: options.acl
    };
    
    logger.info(`Uploading file to S3: ${s3Key}`);
    await s3Client.send(new PutObjectCommand(uploadParams));
    
    // Generate URL
    const url = getS3Url(s3Key);
    
    return {
      key: s3Key,
      url
    };
  } catch (err) {
    logger.error(`Error uploading file to S3: ${err}`);
    throw err;
  }
}

/**
 * Upload a buffer to S3
 * 
 * @param buffer Buffer to upload
 * @param s3Key Key (path) in S3 bucket
 * @param options Upload options
 * @returns Promise with upload result
 */
export async function uploadBufferToS3(
  buffer: Buffer,
  s3Key: string,
  options: {
    contentType?: string;
    metadata?: Record<string, string>;
    acl?: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read';
  } = {}
): Promise<{ key: string; url: string }> {
  try {
    // Determine content type based on file extension if not provided
    const contentType = options.contentType || getContentTypeFromExtension(s3Key);
    
    // Upload to S3
    const uploadParams = {
      Bucket: STORAGE.S3_BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
      Metadata: options.metadata,
      ACL: options.acl
    };
    
    logger.info(`Uploading buffer to S3: ${s3Key}`);
    await s3Client.send(new PutObjectCommand(uploadParams));
    
    // Generate URL
    const url = getS3Url(s3Key);
    
    return {
      key: s3Key,
      url
    };
  } catch (err) {
    logger.error(`Error uploading buffer to S3: ${err}`);
    throw err;
  }
}

/**
 * Get a signed URL for an S3 object
 * 
 * @param s3Key Key (path) in S3 bucket
 * @param expiresIn Expiration time in seconds (default: 3600)
 * @returns Promise with signed URL
 */
export async function getSignedS3Url(
  s3Key: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: STORAGE.S3_BUCKET,
      Key: s3Key
    });
    
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (err) {
    logger.error(`Error generating signed URL for S3 object: ${err}`);
    throw err;
  }
}

/**
 * Get a public URL for an S3 object
 * 
 * @param s3Key Key (path) in S3 bucket
 * @returns Public URL
 */
export function getS3Url(s3Key: string): string {
  const bucket = STORAGE.S3_BUCKET;
  const region = process.env.AWS_REGION || 'us-east-1';
  
  // Use path-style URL format
  return `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;
}

/**
 * Delete an object from S3
 * 
 * @param s3Key Key (path) in S3 bucket
 * @returns Promise with delete result
 */
export async function deleteFromS3(s3Key: string): Promise<void> {
  try {
    const deleteParams = {
      Bucket: STORAGE.S3_BUCKET,
      Key: s3Key
    };
    
    logger.info(`Deleting file from S3: ${s3Key}`);
    await s3Client.send(new DeleteObjectCommand(deleteParams));
  } catch (err) {
    logger.error(`Error deleting file from S3: ${err}`);
    throw err;
  }
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
 * Check if an object exists in S3
 * 
 * @param s3Key Key (path) in S3 bucket
 * @returns Promise with boolean indicating if object exists
 */
export async function objectExistsInS3(s3Key: string): Promise<boolean> {
  try {
    await s3Client.send(new GetObjectCommand({
      Bucket: STORAGE.S3_BUCKET,
      Key: s3Key
    }));
    
    return true;
  } catch (err) {
    if ((err as any).name === 'NoSuchKey') {
      return false;
    }
    
    logger.error(`Error checking if object exists in S3: ${err}`);
    throw err;
  }
}

/**
 * Generate a unique S3 key for a file
 * 
 * @param folder Folder path in S3 bucket
 * @param fileName Original file name
 * @returns Unique S3 key
 */
export function generateUniqueS3Key(folder: string, fileName: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension);
  
  return `${folder}/${baseName}-${timestamp}-${randomString}${extension}`;
}
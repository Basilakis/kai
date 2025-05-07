/**
 * Storage Service Initializer
 *
 * This module provides functions to initialize the unified storage service
 * with different storage providers based on configuration.
 */

import { createLogger } from '../../utils/unified-logger';
import { storage } from './unifiedStorageService';
import SupabaseStorageProvider from './supabaseStorageProvider';
import S3StorageProvider, { S3Config } from './s3StorageProvider';
import { env } from '../../utils/environment';

const logger = createLogger('StorageInitializer');

/**
 * Initialize storage with Supabase provider
 * @param bucket Default bucket name
 */
export function initializeSupabaseStorage(bucket: string = 'default'): void {
  try {
    logger.info(`Initializing Supabase storage with bucket: ${bucket}`);

    // Create Supabase storage provider
    const provider = new SupabaseStorageProvider(bucket);

    // Set provider and default bucket
    storage.setProvider(provider);
    storage.setDefaultBucket(bucket);

    logger.info('Supabase storage initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Supabase storage', error);
    throw new Error('Supabase storage initialization failed');
  }
}

/**
 * Initialize storage with S3 provider
 * @param config S3 configuration
 */
export function initializeS3Storage(config: S3Config): void {
  try {
    logger.info(`Initializing S3 storage with bucket: ${config.bucket}`);

    // Create S3 storage provider
    const provider = new S3StorageProvider(config);

    // Set provider and default bucket
    storage.setProvider(provider);
    storage.setDefaultBucket(config.bucket);

    logger.info('S3 storage initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize S3 storage', error);
    throw new Error('S3 storage initialization failed');
  }
}

/**
 * Initialize storage based on environment configuration
 */
export function initializeStorage(): void {
  try {
    logger.info('Initializing storage service based on environment configuration');

    // Check if S3 is configured
    if (process.env.S3_ENDPOINT || process.env.AWS_S3_ENDPOINT) {
      // Initialize with S3
      const s3Config: S3Config = {
        endpoint: process.env.S3_ENDPOINT || process.env.AWS_S3_ENDPOINT,
        region: process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1',
        accessKey: process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || '',
        secretKey: process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
        bucket: process.env.S3_BUCKET || 'default',
        publicUrl: process.env.S3_PUBLIC_URL,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true'
      };

      initializeS3Storage(s3Config);
    } else {
      // Initialize with Supabase
      const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'default';
      initializeSupabaseStorage(bucket);
    }

    logger.info('Storage service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize storage service', error);
    throw new Error('Storage service initialization failed');
  }
}

// Export default for convenience
export default initializeStorage;

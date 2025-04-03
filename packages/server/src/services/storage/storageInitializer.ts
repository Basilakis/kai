import { storage as s3StorageAdapter } from '../../../../shared/src/services/storage/s3StorageAdapter';
import { s3Service } from './s3Service';
import { logger } from '../../utils/logger';
import { StorageProvider } from '../../../../shared/src/services/storage/types';
import { STORAGE } from '@kai/shared';

/**
 * Initialize the S3 storage adapter with the S3Service implementation
 * This enables the shared services to use S3 without directly depending on the S3Service
 */
export function initializeStorage(): void {
  try {
    logger.info('Initializing S3 storage adapter with S3Service implementation');
    
    // Set the S3 provider implementation
    s3StorageAdapter.setProvider(s3Service as StorageProvider);
    
    // Set the default bucket
    s3StorageAdapter.setDefaultBucket(STORAGE.S3_BUCKET);
    
    logger.info('S3 storage adapter initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize S3 storage adapter', error);
    throw new Error('Storage initialization failed');
  }
}

// Export default for convenience
export default initializeStorage;
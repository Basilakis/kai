import { storage, initializeStorage as initSharedStorage, S3StorageProvider, SupabaseStorageProvider } from '@kai/shared';
import { createLogger } from '@kai/shared';
import { config } from '@kai/shared';

const logger = createLogger('ServerStorageInitializer');

/**
 * Initialize the unified storage service for the server package
 * This ensures that the server uses the same storage service as the rest of the application
 */
export function initializeStorage(): void {
  try {
    logger.info('Initializing unified storage service for server package');

    // Initialize the shared configuration if not already initialized
    if (!config['initialized']) {
      config.init({
        environment: process.env.NODE_ENV as any || 'development'
      });
    }

    // Get storage configuration
    const storageConfig = config.get('storage') || { provider: 'supabase', defaultBucket: 'materials' };
    const s3Config = config.get('s3') || {};

    // Initialize storage based on configuration
    if (storageConfig.provider === 's3' || process.env.S3_ENDPOINT || process.env.AWS_S3_ENDPOINT) {
      // Create S3 provider
      const provider = new S3StorageProvider({
        endpoint: process.env.S3_ENDPOINT || process.env.AWS_S3_ENDPOINT || s3Config.endpoint,
        region: process.env.S3_REGION || process.env.AWS_REGION || s3Config.region || 'us-east-1',
        accessKey: process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || s3Config.accessKey || '',
        secretKey: process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || s3Config.secretKey || '',
        bucket: process.env.S3_BUCKET || s3Config.bucket || 'kai-storage',
        publicUrl: process.env.S3_PUBLIC_URL || s3Config.publicUrl
      });

      // Set provider and default bucket
      storage.setProvider(provider);
      storage.setDefaultBucket(process.env.S3_BUCKET || s3Config.bucket || 'kai-storage');

      logger.info(`S3 storage initialized with bucket: ${process.env.S3_BUCKET || s3Config.bucket || 'kai-storage'}`);
    } else {
      // Create Supabase provider
      const provider = new SupabaseStorageProvider(
        process.env.SUPABASE_STORAGE_BUCKET || storageConfig.defaultBucket || 'materials'
      );

      // Set provider and default bucket
      storage.setProvider(provider);
      storage.setDefaultBucket(process.env.SUPABASE_STORAGE_BUCKET || storageConfig.defaultBucket || 'materials');

      logger.info(`Supabase storage initialized with bucket: ${process.env.SUPABASE_STORAGE_BUCKET || storageConfig.defaultBucket || 'materials'}`);
    }

    logger.info('Unified storage service initialized successfully for server package');
  } catch (error) {
    logger.error('Failed to initialize unified storage service', error);
    throw new Error('Storage initialization failed');
  }
}

// Export default for convenience
export default initializeStorage;
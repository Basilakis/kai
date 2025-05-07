// Export all types and utilities from the shared package

// Types
export * from './types/tile';
export * from './types/catalog';
export * from './types/recognition';
export * from './types/user';
export * from './types/crawler';
export * from './types/material'; // Export new material types for Supabase
export * from './types/subscription'; // Export subscription types

// Utilities
export * from './utils/validation';
export * from './utils/formatting';
export * from './utils/constants';
export * from './utils/unified-logger';
export * from './utils/unified-config';

// Services
// Service Initializer
export * from './services/serviceInitializer';

// Storage
export * from './services/storage/unifiedStorageService';
export * from './services/storage/supabaseStorageProvider';
export * from './services/storage/s3StorageProvider';
export * from './services/storage/storageInitializer';

// Authentication
export * from './services/auth/authService';
export * from './services/auth/supabaseAuthProvider';
export * from './services/auth/authInitializer';

// API
export * from './services/api/apiClient';
export * from './services/api/mcpClient';

// Cache
export * from './services/cache';

// Telemetry
export * from './services/telemetry';

// Tracing
export * from './services/tracing';

// Events
export * from './services/events';

// Alerting
export * from './services/alerting';

// Base services
export * from './services/base';
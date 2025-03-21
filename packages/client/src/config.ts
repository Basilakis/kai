/**
 * Application Configuration
 */

// API endpoint configuration
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Version information
export const APP_VERSION = process.env.REACT_APP_VERSION || '1.0.0';

// Environment settings
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const IS_TEST = process.env.NODE_ENV === 'test';

// Feature flags
export const FEATURES = {
  ENABLE_CRAWLER_CREDENTIALS: true,
  ENABLE_PDF_PROCESSING: true
};

// Default pagination
export const DEFAULT_PAGE_SIZE = 10;

// Upload limits
export const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB
/**
 * Shared constants for the application
 */

// Add type declaration for process.env
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      API_URL?: string;
      S3_BUCKET?: string;
      NODE_ENV?: 'development' | 'production' | 'test';
      JWT_SECRET?: string;
    }
  }
}

/**
 * API endpoints
 */
export const API = {
  BASE_URL: process.env.API_URL || 'http://localhost:3000/api',
  
  // Authentication endpoints
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH_TOKEN: '/auth/refresh-token',
    RESET_PASSWORD: '/auth/reset-password',
    VERIFY_EMAIL: '/auth/verify-email',
    MFA: '/auth/mfa'
  },
  
  // User endpoints
  USERS: {
    BASE: '/users',
    PROFILE: '/users/profile',
    PREFERENCES: '/users/preferences'
  },
  
  // Material endpoints
  MATERIALS: {
    BASE: '/materials',
    SEARCH: '/materials/search',
    RECOGNITION: '/materials/recognition',
    SIMILAR: '/materials/similar'
  },
  
  // Catalog endpoints
  CATALOGS: {
    BASE: '/catalogs',
    UPLOAD: '/catalogs/upload',
    PROCESS: '/catalogs/process',
    BATCH: '/catalogs/batch'
  },
  
  // Crawler endpoints
  CRAWLERS: {
    BASE: '/crawlers',
    JOBS: '/crawlers/jobs',
    RESULTS: '/crawlers/results'
  },
  
  // Admin endpoints
  ADMIN: {
    BASE: '/admin',
    DASHBOARD: '/admin/dashboard',
    USERS: '/admin/users',
    ORGANIZATIONS: '/admin/organizations',
    SETTINGS: '/admin/settings',
    LOGS: '/admin/logs',
    STATS: '/admin/stats'
  }
};

/**
 * Storage constants
 */
export const STORAGE = {
  S3_BUCKET: process.env.S3_BUCKET || 'kai-storage',
  
  // Folder paths within the bucket
  FOLDERS: {
    CATALOGS: 'catalogs',
    MATERIALS: 'materials',
    RECOGNITION: 'recognition',
    USERS: 'users',
    TEMP: 'temp'
  },
  
  // File size limits
  MAX_FILE_SIZE: {
    CATALOG_PDF: 50 * 1024 * 1024, // 50MB
    MATERIAL_IMAGE: 10 * 1024 * 1024, // 10MB
    RECOGNITION_IMAGE: 20 * 1024 * 1024, // 20MB
    PROFILE_PICTURE: 2 * 1024 * 1024 // 2MB
  }
};

/**
 * Authentication constants
 */
export const AUTH = {
  TOKEN_EXPIRY: 60 * 60 * 1000, // 1 hour in milliseconds
  REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  PASSWORD_RESET_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  MFA_CODE_EXPIRY: 10 * 60 * 1000, // 10 minutes in milliseconds
  
  // OAuth providers
  OAUTH_PROVIDERS: {
    GOOGLE: 'google',
    MICROSOFT: 'microsoft',
    APPLE: 'apple'
  }
};

/**
 * Pagination constants
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100
};

/**
 * Material constants
 */
export const MATERIALS = {
  // Material types
  TYPES: {
    TILE: 'tile',
    STONE: 'stone',
    WOOD: 'wood',
    LAMINATE: 'laminate',
    VINYL: 'vinyl',
    CARPET: 'carpet',
    METAL: 'metal',
    GLASS: 'glass',
    CONCRETE: 'concrete',
    CERAMIC: 'ceramic',
    PORCELAIN: 'porcelain',
    OTHER: 'other'
  },
  
  // Common finishes
  FINISHES: {
    MATTE: 'matte',
    GLOSSY: 'glossy',
    POLISHED: 'polished',
    HONED: 'honed',
    TEXTURED: 'textured',
    BRUSHED: 'brushed',
    LAPPATO: 'lappato',
    SATIN: 'satin',
    NATURAL: 'natural',
    OTHER: 'other'
  },
  
  // Measurement units
  UNITS: {
    MM: 'mm',
    CM: 'cm',
    INCH: 'inch',
    M: 'm',
    FT: 'ft'
  }
};

/**
 * Recognition constants
 */
export const RECOGNITION = {
  DEFAULT_CONFIDENCE_THRESHOLD: 0.7,
  DEFAULT_MAX_RESULTS: 10,
  
  // Recognition methods
  METHODS: {
    FEATURE_MATCHING: 'feature-matching',
    VECTOR_SEARCH: 'vector-search',
    HYBRID: 'hybrid'
  }
};

/**
 * Crawler constants
 */
export const CRAWLER = {
  DEFAULT_MAX_DEPTH: 3,
  DEFAULT_MAX_PAGES: 100,
  DEFAULT_DELAY: 1000, // 1 second in milliseconds
  DEFAULT_CONCURRENCY: 5,
  DEFAULT_TIMEOUT: 30000, // 30 seconds in milliseconds
  DEFAULT_RETRIES: 3,
  
  // Crawler providers
  PROVIDERS: {
    FIRECRAWL: 'firecrawl',
    JINA: 'jina',
    INTERNAL: 'internal',
    CUSTOM: 'custom'
  }
};

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  // Authentication errors
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid email or password',
    ACCOUNT_LOCKED: 'Your account has been locked due to too many failed login attempts',
    ACCOUNT_DISABLED: 'Your account has been disabled',
    TOKEN_EXPIRED: 'Your session has expired, please log in again',
    INSUFFICIENT_PERMISSIONS: 'You do not have permission to perform this action',
    MFA_REQUIRED: 'Multi-factor authentication is required'
  },
  
  // Validation errors
  VALIDATION: {
    REQUIRED_FIELD: 'This field is required',
    INVALID_EMAIL: 'Please enter a valid email address',
    INVALID_PASSWORD: 'Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, and one number',
    PASSWORDS_DO_NOT_MATCH: 'Passwords do not match',
    INVALID_URL: 'Please enter a valid URL',
    INVALID_FILE_TYPE: 'Invalid file type',
    FILE_TOO_LARGE: 'File size exceeds the maximum limit'
  },
  
  // Resource errors
  RESOURCE: {
    NOT_FOUND: 'The requested resource was not found',
    ALREADY_EXISTS: 'A resource with this identifier already exists',
    CONFLICT: 'The request conflicts with the current state of the resource'
  },
  
  // Server errors
  SERVER: {
    INTERNAL_ERROR: 'An internal server error occurred',
    SERVICE_UNAVAILABLE: 'The service is currently unavailable',
    TIMEOUT: 'The request timed out'
  }
};

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  // Authentication success
  AUTH: {
    LOGIN_SUCCESS: 'You have successfully logged in',
    LOGOUT_SUCCESS: 'You have successfully logged out',
    REGISTER_SUCCESS: 'Your account has been created successfully',
    PASSWORD_RESET_SUCCESS: 'Your password has been reset successfully',
    EMAIL_VERIFICATION_SUCCESS: 'Your email has been verified successfully'
  },
  
  // Resource success
  RESOURCE: {
    CREATE_SUCCESS: 'The resource was created successfully',
    UPDATE_SUCCESS: 'The resource was updated successfully',
    DELETE_SUCCESS: 'The resource was deleted successfully'
  },
  
  // Catalog success
  CATALOG: {
    UPLOAD_SUCCESS: 'The catalog was uploaded successfully',
    PROCESSING_STARTED: 'Catalog processing has started',
    PROCESSING_COMPLETE: 'Catalog processing has completed successfully'
  },
  
  // Recognition success
  RECOGNITION: {
    UPLOAD_SUCCESS: 'The image was uploaded successfully',
    PROCESSING_STARTED: 'Image recognition has started',
    PROCESSING_COMPLETE: 'Image recognition has completed successfully'
  }
};

/**
 * Default values
 */
export const DEFAULTS = {
  USER_PREFERENCES: {
    THEME: 'light',
    LANGUAGE: 'en',
    NOTIFICATIONS: {
      EMAIL: true,
      PUSH: true,
      IN_APP: true
    },
    DISPLAY_DENSITY: 'comfortable'
  },
  
  RECOGNITION_OPTIONS: {
    CONFIDENCE_THRESHOLD: 0.7,
    MAX_RESULTS: 10,
    INCLUDE_FEATURE_MATCHING: true,
    INCLUDE_VECTOR_SEARCH: true,
    INCLUDE_SIMILAR_TILES: true
  }
};
/**
 * Global type declarations for the shared package
 */

// Add type declaration for Node.js process
declare namespace NodeJS {
  interface ProcessEnv {
    API_URL?: string;
    S3_BUCKET?: string;
    NODE_ENV?: 'development' | 'production' | 'test';
    JWT_SECRET?: string;
    MONGODB_URI?: string;
    PORT?: string;
  }
}
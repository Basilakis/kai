/// <reference types="node" />

declare global {
  // Re-export Node.js types
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
    }
  }
}

// This file is a module
export {};
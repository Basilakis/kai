/**
 * Global declarations for Node.js Buffer and other globals
 */

// Declare Buffer as a global to fix TypeScript errors
declare global {
  // Make Buffer available as a value in the global scope
  const Buffer: typeof import('buffer').Buffer;
  
  // Add additional Node.js globals if needed
  namespace NodeJS {
    interface Global {
      Buffer: typeof import('buffer').Buffer;
    }
  }
}

export {};
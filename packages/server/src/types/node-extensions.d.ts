/**
 * Node.js Type Extensions
 * 
 * Extends Node.js type definitions with missing or underspecified functionality.
 */

// Declare fs extension for older Node.js types
declare module 'fs' {
  interface MakeDirectoryOptions {
    recursive?: boolean;
    mode?: number;
  }

  // Add missing fs methods
  namespace fs {
    function mkdir(path: string, options?: MakeDirectoryOptions): void;
    function mkdir(path: string, options: MakeDirectoryOptions, callback: (err: NodeJS.ErrnoException | null) => void): void;
    function mkdir(path: string, callback: (err: NodeJS.ErrnoException | null) => void): void;

    function rmdir(path: string, options?: { recursive?: boolean }): void;
    function rmdir(path: string, callback: (err: NodeJS.ErrnoException | null) => void): void;
    function rmdir(path: string, options: { recursive?: boolean }, callback: (err: NodeJS.ErrnoException | null) => void): void;
  }
}

// Declare util module with promisify
declare module 'util' {
  /**
   * Promisify a callback-based function
   */
  export function promisify<T extends (...args: any[]) => any>(
    fn: T
  ): T extends (...args: infer A) => infer R
    ? (...args: A) => Promise<R>
    : never;
}

// Declare os module with tmpdir
declare module 'os' {
  /**
   * Returns the operating system's default directory for temporary files.
   */
  export function tmpdir(): string;
}

// Declare global require function
declare global {
  function require(id: string): any;
  
  namespace NodeJS {
    interface ErrnoException extends Error {
      errno?: number;
      code?: string;
      path?: string;
      syscall?: string;
    }
  }
}

export {};
/**
 * Minimal Node.js type declarations to fix TypeScript errors
 */

declare namespace NodeJS {
  export interface ProcessEnv {
    [key: string]: string | undefined;
  }
  
  export interface Process {
    env: ProcessEnv;
    cwd(): string;
    exit(code?: number): never;
  }
  
  export interface ErrnoException extends Error {
    errno?: number;
    code?: string;
    path?: string;
    syscall?: string;
  }
  
  // Add Timeout type for setInterval and setTimeout
  export type Timeout = number;
}

declare var process: NodeJS.Process;
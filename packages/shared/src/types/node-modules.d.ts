/**
 * Type declarations for Node.js modules
 * 
 * This file provides TypeScript type declarations for Node.js core modules
 * that are used in the project. These declarations would normally come from
 * @types/node, but we're providing them directly for simplicity.
 */

// File System module
declare module 'fs' {
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function appendFileSync(path: string, data: string): void;
  export function readFileSync(path: string, options?: { encoding?: string }): Buffer | string;
  export function writeFileSync(path: string, data: string): void;
}

// Path module
declare module 'path' {
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  export function dirname(path: string): string;
  export function basename(path: string, ext?: string): string;
  export function extname(path: string): string;
}

// OS module
declare module 'os' {
  export function hostname(): string;
  export function platform(): string;
  export function type(): string;
  export function release(): string;
  export function freemem(): number;
  export function totalmem(): number;
}

// Node.js Process
declare namespace NodeJS {
  interface Process {
    env: {
      [key: string]: string | undefined;
      NODE_ENV?: string;
      LOG_DIRECTORY?: string;
    };
    cwd(): string;
    pid: number;
    uptime(): number;
    memoryUsage(): {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
  }
}

declare var process: NodeJS.Process;
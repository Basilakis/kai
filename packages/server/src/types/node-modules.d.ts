/**
 * Custom type declarations for Node.js modules and packages
 * This resolves TypeScript errors when importing certain modules
 */

// Declare Node.js modules to fix path, fs, and process errors
declare module 'path' {
  export function join(...paths: string[]): string;
  export function basename(path: string, ext?: string): string;
  export function dirname(path: string): string;
  export function extname(path: string): string;
  export function resolve(...paths: string[]): string;
  export function isAbsolute(path: string): boolean;
  export function relative(from: string, to: string): string;
  export function normalize(path: string): string;
}

declare module 'fs' {
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function unlinkSync(path: string): void;
  export function readFileSync(path: string, options: { encoding: string; flag?: string } | string): string;
  export function readFileSync(path: string, options?: { encoding?: null; flag?: string } | null): Buffer;
  export function writeFileSync(path: string, data: string | Buffer, options?: { encoding?: string; mode?: number; flag?: string } | string): void;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
}

// Declare uuid package
declare module 'uuid' {
  export function v4(): string;
}

// Add global Process type for process.cwd()
declare global {
  namespace NodeJS {
    interface Process {
      cwd(): string;
    }
  }
  
  const process: NodeJS.Process;
}
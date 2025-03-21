/**
 * Global type declarations for Node.js
 * These declarations will be automatically loaded by TypeScript
 */

// Declare Node.js global objects
declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
  [key: string]: any;
};

// Declare Node.js modules to fix module import errors
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
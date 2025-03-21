/**
 * Custom type declarations for Node.js modules and globals
 * This file provides type declarations for Node.js modules and globals
 * that TypeScript might not be able to find automatically
 */

// Declare Node.js modules
declare module 'child_process' {
  export function spawn(command: string, args?: readonly string[], options?: any): any;
}

declare module 'path' {
  export function join(...paths: string[]): string;
  export function dirname(path: string): string;
}

declare module 'fs' {
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function writeFileSync(path: string, data: string): void;
  export function readFileSync(path: string, encoding: string): string;
  export function unlinkSync(path: string): void;
}

declare module 'os' {
  export function tmpdir(): string;
}

// Declare global variables
declare const __dirname: string;

// Declare Buffer type
declare class Buffer extends Uint8Array {
  toString(encoding?: string): string;
  static from(data: string | ArrayBuffer | SharedArrayBuffer | Uint8Array, encoding?: string): Buffer;
}
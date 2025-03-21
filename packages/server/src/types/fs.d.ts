/**
 * Type declarations for Node.js fs module
 */

declare module 'fs' {
  import * as events from 'events';
  
  // Error class used in callbacks
  export class Stats {
    isFile(): boolean;
    isDirectory(): boolean;
    isBlockDevice(): boolean;
    isCharacterDevice(): boolean;
    isSymbolicLink(): boolean;
    isFIFO(): boolean;
    isSocket(): boolean;
    
    dev: number;
    ino: number;
    mode: number;
    nlink: number;
    uid: number;
    gid: number;
    rdev: number;
    size: number;
    blksize: number;
    blocks: number;
    atimeMs: number;
    mtimeMs: number;
    ctimeMs: number;
    birthtimeMs: number;
    atime: Date;
    mtime: Date;
    ctime: Date;
    birthtime: Date;
  }
  
  export interface Dirent {
    name: string;
    isFile(): boolean;
    isDirectory(): boolean;
    isBlockDevice(): boolean;
    isCharacterDevice(): boolean;
    isSymbolicLink(): boolean;
    isFIFO(): boolean;
    isSocket(): boolean;
  }
  
  export interface ReaddirOptions {
    encoding?: string | null;
    withFileTypes?: boolean;
  }
  
  export interface RmDirOptions {
    recursive?: boolean;
    force?: boolean;
  }
  
  // Constants
  export const constants: {
    F_OK: number;
    R_OK: number;
    W_OK: number;
    X_OK: number;
  };
  
  // Asynchronous methods
  export function writeFile(
    path: string,
    data: string | Uint8Array, 
    options: { encoding?: string; mode?: number; flag?: string } | string | undefined | null,
    callback: (err: NodeJS.ErrnoException | null) => void
  ): void;
  
  export function writeFile(
    path: string,
    data: string | Uint8Array,
    callback: (err: NodeJS.ErrnoException | null) => void
  ): void;
  
  export function access(
    path: string,
    mode: number,
    callback: (err: NodeJS.ErrnoException | null) => void
  ): void;
  
  export function readFile(
    path: string,
    options: { encoding?: string | null; flag?: string } | string | undefined | null,
    callback: (err: NodeJS.ErrnoException | null, data: string | Buffer) => void
  ): void;
  
  export function readFile(
    path: string,
    callback: (err: NodeJS.ErrnoException | null, data: Buffer) => void
  ): void;
  
  export function readdir(
    path: string,
    options: ReaddirOptions | undefined | null,
    callback: (err: NodeJS.ErrnoException | null, files: string[] | Dirent[]) => void
  ): void;
  
  export function readdir(
    path: string,
    callback: (err: NodeJS.ErrnoException | null, files: string[]) => void
  ): void;
  
  export function unlink(
    path: string,
    callback: (err: NodeJS.ErrnoException | null) => void
  ): void;
  
  // Synchronous methods
  export function readdirSync(path: string): string[];
  export function readdirSync(path: string, options: { withFileTypes: true }): Dirent[];
  export function readdirSync(path: string, options?: ReaddirOptions): string[] | Dirent[];
  
  export function statSync(path: string): Stats;
  export function lstatSync(path: string): Stats;
  export function unlinkSync(path: string): void;
  export function existsSync(path: string): boolean;
  export function rmdirSync(path: string, options?: RmDirOptions): void;
}
/**
 * Type declarations for Node.js built-in modules
 * This file consolidates declarations for fs, path, buffer, and child_process
 */

// Buffer type declaration
declare global {
  class Buffer extends Uint8Array {
    constructor(arg: string | ArrayBuffer | SharedArrayBuffer | Array<number> | Buffer | ReadonlyArray<number>, encodingOrOffset?: string | number, length?: number);
    toString(encoding?: string, start?: number, end?: number): string;

    static from(arrayBuffer: ArrayBuffer | SharedArrayBuffer): Buffer;
    static from(data: ReadonlyArray<number>): Buffer;
    static from(data: Uint8Array): Buffer;
    static from(str: string, encoding?: string): Buffer;
    static isBuffer(obj: any): boolean;
    static concat(list: ReadonlyArray<Uint8Array>, totalLength?: number): Buffer;
  }

  namespace NodeJS {
    interface ProcessEnv {
      [key: string]: string | undefined;
    }

    interface ErrnoException extends Error {
      errno?: number;
      code?: string;
      path?: string;
      syscall?: string;
    }
  }
}

// fs module declaration
declare module 'fs' {
  export interface Stats {
    isDirectory(): boolean;
    isFile(): boolean;
    size: number;
    mtime: Date;
    ctime: Date;
    atime: Date;
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

  export interface Promises {
    readFile(path: string, options?: { encoding?: string; flag?: string } | string): Promise<string | Buffer>;
    writeFile(path: string, data: string | Buffer, options?: { encoding?: string; mode?: number; flag?: string } | string): Promise<void>;
    mkdir(path: string, options?: { recursive?: boolean; mode?: number }): Promise<string | undefined>;
    stat(path: string): Promise<Stats>;
    access(path: string, mode?: number): Promise<void>;
    rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
    readdir(path: string, options?: { encoding?: string; withFileTypes?: boolean }): Promise<string[] | Dirent[]>;
  }

  export function readdir(path: string, callback: (err: NodeJS.ErrnoException | null, files: string[]) => void): void;
  export function readdir(path: string, options: { encoding?: string; withFileTypes?: false }, callback: (err: NodeJS.ErrnoException | null, files: string[]) => void): void;
  export function readdir(path: string, options: { encoding?: string; withFileTypes: true }, callback: (err: NodeJS.ErrnoException | null, files: Dirent[]) => void): void;

  export const promises: Promises;
}

// path module declaration
declare module 'path' {
  export interface ParsedPath {
    root: string;
    dir: string;
    base: string;
    ext: string;
    name: string;
  }

  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  export function dirname(path: string): string;
  export function basename(path: string, ext?: string): string;
  export function extname(path: string): string;
  export function parse(path: string): ParsedPath;
  export function relative(from: string, to: string): string;
}

// fs/promises module declaration
declare module 'fs/promises' {
  export * from 'fs';
  export function readFile(path: string, options?: { encoding?: string; flag?: string } | string): Promise<string | Buffer>;
  export function writeFile(path: string, data: string | Buffer, options?: { encoding?: string; mode?: number; flag?: string } | string): Promise<void>;
  export function mkdir(path: string, options?: { recursive?: boolean; mode?: number }): Promise<string | undefined>;
  export function stat(path: string): Promise<import('fs').Stats>;
  export function access(path: string, mode?: number): Promise<void>;
  export function rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  export function readdir(path: string, options?: { encoding?: string; withFileTypes?: boolean }): Promise<string[] | import('fs').Dirent[]>;
}

// util module declaration
declare module 'util' {
  // Special case for readdir with options
  export function promisify(fn: typeof import('fs').readdir): {
    (path: string): Promise<string[]>;
    (path: string, options: { encoding?: string; withFileTypes?: false }): Promise<string[]>;
    (path: string, options: { encoding?: string; withFileTypes: true }): Promise<import('fs').Dirent[]>;
  };

  // Generic case for other functions
  export function promisify<T extends (...args: any[]) => any>(fn: T): (...args: Parameters<T> extends [...infer U, (err: any, result: infer R) => any] ? [...U] : Parameters<T>) => Promise<T extends (...args: any[]) => any ? Parameters<Parameters<T>[Parameters<T>['length'] - 1]>[1] : any>;

  export function inspect(object: any, options?: { showHidden?: boolean; depth?: number | null; colors?: boolean }): string;
  export function format(format: string, ...param: any[]): string;
  export function inherits(constructor: any, superConstructor: any): void;
}

// winston module declaration
declare module 'winston' {
  export interface Logger {
    debug(message: string, meta?: any): void;
    info(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
  }
}

// buffer module declaration
declare module 'buffer' {
  export class Buffer extends Uint8Array {
    constructor(arg: string | ArrayBuffer | SharedArrayBuffer | Array<number> | Buffer | ReadonlyArray<number>, encodingOrOffset?: string | number, length?: number);
    toString(encoding?: string, start?: number, end?: number): string;

    static from(arrayBuffer: ArrayBuffer | SharedArrayBuffer): Buffer;
    static from(data: ReadonlyArray<number>): Buffer;
    static from(data: Uint8Array): Buffer;
    static from(str: string, encoding?: string): Buffer;
    static isBuffer(obj: any): boolean;
    static concat(list: ReadonlyArray<Uint8Array>, totalLength?: number): Buffer;
  }
}

// child_process module declaration
declare module 'child_process' {
  export interface SpawnOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    stdio?: 'pipe' | 'ignore' | 'inherit' | Array<'pipe' | 'ignore' | 'inherit'>;
    detached?: boolean;
    shell?: boolean | string;
  }

  export interface ChildProcess {
    stdout: {
      on(event: 'data', listener: (data: Buffer) => void): this;
    };
    stderr: {
      on(event: 'data', listener: (data: Buffer) => void): this;
    };
    on(event: 'close', listener: (code: number | null, signal: string | null) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
  }

  export function spawn(command: string, args?: string[], options?: SpawnOptions): ChildProcess;
}

/**
 * Type declarations for external modules used in the MCP client
 */

// Type declarations for Node.js modules
/// <reference types="node" />

// Type declarations for axios
declare module 'axios' {
  export interface AxiosRequestConfig {
    url?: string;
    method?: string;
    baseURL?: string;
    headers?: any;
    params?: any;
    data?: any;
    timeout?: number;
    withCredentials?: boolean;
    responseType?: string;
    [key: string]: any;
  }

  export interface AxiosResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: any;
    config: AxiosRequestConfig;
    request?: any;
  }

  export interface AxiosError<T = any> extends Error {
    config: AxiosRequestConfig;
    code?: string;
    request?: any;
    response?: AxiosResponse<T>;
    isAxiosError: boolean;
    toJSON: () => object;
  }

  export interface AxiosInstance {
    (config: AxiosRequestConfig): Promise<AxiosResponse>;
    (url: string, config?: AxiosRequestConfig): Promise<AxiosResponse>;
    defaults: AxiosRequestConfig;
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    head<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    options<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  }

  export function create(config?: AxiosRequestConfig): AxiosInstance;
  export function isCancel(value: any): boolean;
  export function all<T>(values: (T | Promise<T>)[]): Promise<T[]>;
  export function spread<T, R>(callback: (...args: T[]) => R): (array: T[]) => R;

  const axios: AxiosInstance & {
    create: typeof create;
    isCancel: typeof isCancel;
    all: typeof all;
    spread: typeof spread;
  };

  export default axios;
}

// Type declarations for form-data
declare module 'form-data' {
  import { Readable } from 'stream';

  class FormData {
    constructor();
    append(key: string, value: any, options?: any): void;
    getHeaders(): { [key: string]: string };
    getBuffer(): Buffer;
    getBoundary(): string;
    getLength(callback: (err: Error | null, length: number) => void): void;
    getLengthSync(): number;
    hasKnownLength(): boolean;
    pipe<T extends NodeJS.WritableStream>(dest: T): T;
    submit(
      url: string | URL,
      callback: (err: Error | null, res: any) => void
    ): void;
  }

  export default FormData;
}

// Type declarations for fs module
declare module 'fs' {
  export function readFileSync(path: string, options?: { encoding?: string; flag?: string } | string): string | Buffer;
  export function existsSync(path: string): boolean;
  export function statSync(path: string): {
    isFile(): boolean;
    isDirectory(): boolean;
    size: number;
    mtime: Date;
  };
  export function createReadStream(path: string, options?: { encoding?: string; flag?: string }): NodeJS.ReadableStream;
}

// Type declarations for path module
declare module 'path' {
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  export function basename(path: string, ext?: string): string;
  export function dirname(path: string): string;
  export function extname(path: string): string;
  export function isAbsolute(path: string): boolean;
  export function relative(from: string, to: string): string;
  export function normalize(path: string): string;
}

// Node.js global types
declare global {
  namespace NodeJS {
    interface ReadableStream {
      pipe<T extends NodeJS.WritableStream>(destination: T, options?: { end?: boolean }): T;
    }

    interface WritableStream {
      write(chunk: any, encoding?: string, callback?: (error: Error | null | undefined) => void): boolean;
      end(callback?: () => void): void;
      end(chunk: any, callback?: () => void): void;
      end(chunk: any, encoding?: string, callback?: () => void): void;
    }
  }

  class Buffer extends Uint8Array {
    constructor(arg: any, encodingOrOffset?: string | number, length?: number);

    static alloc(size: number, fill?: string | Buffer | number, encoding?: string): Buffer;
    static from(arrayBuffer: ArrayBuffer, byteOffset?: number, length?: number): Buffer;
    static from(data: any[], encoding?: string): Buffer;
    static from(data: Uint8Array): Buffer;
    static from(str: string, encoding?: string): Buffer;
    static isBuffer(obj: any): boolean;
    static concat(list: Buffer[], totalLength?: number): Buffer;

    toString(encoding?: string, start?: number, end?: number): string;
    toJSON(): { type: 'Buffer'; data: number[] };
    equals(otherBuffer: Buffer): boolean;
    compare(target: Buffer, targetStart?: number, targetEnd?: number, sourceStart?: number, sourceEnd?: number): number;
    copy(target: Buffer, targetStart?: number, sourceStart?: number, sourceEnd?: number): number;
    slice(start?: number, end?: number): Buffer;
    write(string: string, offset?: number, length?: number, encoding?: string): number;
    writeUInt8(value: number, offset: number): number;
    readUInt8(offset: number): number;
  }
}

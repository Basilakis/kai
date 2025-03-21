/**
 * Supabase Storage Type Definitions
 * 
 * This file adds type definitions for Supabase Storage methods that
 * might be missing or incomplete in the @supabase/supabase-js package.
 */

// Type definition for Node.js Buffer, used when @types/node is not available
interface Buffer extends Uint8Array {
  write(string: string, offset?: number, length?: number, encoding?: string): number;
  toString(encoding?: string, start?: number, end?: number): string;
  toJSON(): { type: 'Buffer'; data: number[] };
  equals(otherBuffer: Uint8Array): boolean;
  compare(otherBuffer: Uint8Array, targetStart?: number, targetEnd?: number, sourceStart?: number, sourceEnd?: number): number;
  copy(targetBuffer: Uint8Array, targetStart?: number, sourceStart?: number, sourceEnd?: number): number;
  slice(start?: number, end?: number): Buffer;
  subarray(start?: number, end?: number): Buffer;
  readUIntLE(offset: number, byteLength: number): number;
  readUIntBE(offset: number, byteLength: number): number;
  readIntLE(offset: number, byteLength: number): number;
  readIntBE(offset: number, byteLength: number): number;
  readUInt8(offset: number): number;
  readUInt16LE(offset: number): number;
  readUInt16BE(offset: number): number;
  readUInt32LE(offset: number): number;
  readUInt32BE(offset: number): number;
  readInt8(offset: number): number;
  readInt16LE(offset: number): number;
  readInt16BE(offset: number): number;
  readInt32LE(offset: number): number;
  readInt32BE(offset: number): number;
  readFloatLE(offset: number): number;
  readFloatBE(offset: number): number;
  readDoubleLE(offset: number): number;
  readDoubleBE(offset: number): number;
  reverse(): Buffer;
  swap16(): Buffer;
  swap32(): Buffer;
  swap64(): Buffer;
  writeUInt8(value: number, offset: number): number;
  writeUInt16LE(value: number, offset: number): number;
  writeUInt16BE(value: number, offset: number): number;
  writeUInt32LE(value: number, offset: number): number;
  writeUInt32BE(value: number, offset: number): number;
  writeInt8(value: number, offset: number): number;
  writeInt16LE(value: number, offset: number): number;
  writeInt16BE(value: number, offset: number): number;
  writeInt32LE(value: number, offset: number): number;
  writeInt32BE(value: number, offset: number): number;
  writeFloatLE(value: number, offset: number): number;
  writeFloatBE(value: number, offset: number): number;
  writeDoubleLE(value: number, offset: number): number;
  writeDoubleBE(value: number, offset: number): number;
  fill(value: string | Uint8Array | number, offset?: number, end?: number, encoding?: string): this;
  indexOf(value: string | number | Uint8Array, byteOffset?: number, encoding?: string): number;
  lastIndexOf(value: string | number | Uint8Array, byteOffset?: number, encoding?: string): number;
  entries(): IterableIterator<[number, number]>;
  includes(value: string | number | Buffer, byteOffset?: number, encoding?: string): boolean;
  keys(): IterableIterator<number>;
  values(): IterableIterator<number>;
}

// Add global Buffer declaration
declare namespace NodeJS {
  interface Global {
    Buffer: {
      from: (data: Uint8Array | ArrayBuffer | readonly number[] | string, 
             encodingOrOffset?: string | number, 
             length?: number) => Buffer;
      isBuffer: (obj: any) => boolean;
      isEncoding: (encoding: string) => boolean;
      byteLength: (string: string, encoding?: string) => number;
      concat: (list: readonly Uint8Array[], totalLength?: number) => Buffer;
      compare: (buf1: Uint8Array, buf2: Uint8Array) => number;
      alloc: (size: number, fill?: string | number | Uint8Array, encoding?: string) => Buffer;
      allocUnsafe: (size: number) => Buffer;
      allocUnsafeSlow: (size: number) => Buffer;
    }
  }
}

// Declare Supabase Storage methods
declare module '@supabase/supabase-js' {
  interface SupabaseClient {
    storage: {
      from(bucket: string): StorageBucketApi;
    };
  }

  interface StorageBucketApi {
    /**
     * Upload a file to a bucket
     */
    upload(
      path: string,
      fileBody: string | File | Blob | ArrayBuffer | Buffer | ReadableStream<any>,
      options?: {
        cacheControl?: string;
        contentType?: string;
        upsert?: boolean;
        metadata?: Record<string, string>;
      }
    ): Promise<{
      data: { Key?: string } | null;
      error: Error | null;
    }>;

    /**
     * Download a file
     */
    download(path: string): Promise<{
      data: Blob | null;
      error: Error | null;
    }>;

    /**
     * List all files in a bucket
     */
    list(prefix?: string, options?: {
      limit?: number;
      offset?: number;
      sortBy?: { column: string; order: 'asc' | 'desc' };
    }): Promise<{
      data: Array<{
        name: string;
        id: string;
        metadata: any;
        created_at: string;
        updated_at: string;
      }>;
      error: Error | null;
    }>;

    /**
     * Delete files within a bucket
     */
    remove(paths: string[]): Promise<{
      data: {} | null;
      error: Error | null;
    }>;

    /**
     * Get signed URL to download a file without requiring permissions
     */
    createSignedUrl(
      path: string,
      expiresIn: number
    ): Promise<{
      data: {
        signedUrl: string;
        path: string;
        token: string;
      } | null;
      error: Error | null;
    }>;

    /**
     * Get public URL for a file
     */
    getPublicUrl(
      path: string
    ): {
      data: {
        publicUrl: string;
      };
    };
  }
}
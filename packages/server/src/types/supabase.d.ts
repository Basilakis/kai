/**
 * Type Declarations for Supabase and Node.js Modules
 *
 * This file provides TypeScript declarations for modules used in the server-side code.
 */

// Supabase declarations
declare module '@supabase/supabase-js' {
  export interface SupabaseClientOptions {
    auth?: {
      autoRefreshToken?: boolean;
      persistSession?: boolean;
      detectSessionInUrl?: boolean;
    };
    global?: {
      headers?: Record<string, string>;
    };
    realtime?: {
      endpoint?: string;
      eventsPerSecond?: number;
      headers?: Record<string, string>;
    };
    db?: {
      schema?: string;
    };
  }

  export interface PostgrestResponse<T> {
    data: T | null;
    error: PostgrestError | null;
    count: number | null;
    status: number;
    statusText: string;
  }

  export interface PostgrestFilterBuilder<T> {
    eq: (column: string, value: any) => PostgrestFilterBuilder<T>;
    neq: (column: string, value: any) => PostgrestFilterBuilder<T>;
    gt: (column: string, value: any) => PostgrestFilterBuilder<T>;
    gte: (column: string, value: any) => PostgrestFilterBuilder<T>;
    lt: (column: string, value: any) => PostgrestFilterBuilder<T>;
    lte: (column: string, value: any) => PostgrestFilterBuilder<T>;
    like: (column: string, pattern: string) => PostgrestFilterBuilder<T>;
    ilike: (column: string, pattern: string) => PostgrestFilterBuilder<T>;
    is: (column: string, value: any) => PostgrestFilterBuilder<T>;
    in: (column: string, values: any[]) => PostgrestFilterBuilder<T>;
    contains: (column: string, value: any) => PostgrestFilterBuilder<T>;
    containedBy: (column: string, value: any) => PostgrestFilterBuilder<T>;
    range: (column: string, from: any, to: any) => PostgrestFilterBuilder<T>;
    range: (from: number, to: number) => PostgrestFilterBuilder<T>;
    textSearch: (column: string, query: string, options?: any) => PostgrestFilterBuilder<T>;
    filter: (column: string, operator: string, value: any) => PostgrestFilterBuilder<T>;
    match: (query: any) => PostgrestFilterBuilder<T>;
    or: (condition: string, options?: any) => PostgrestFilterBuilder<T>;
    order: (column: string, options?: any) => PostgrestFilterBuilder<T>;
    limit: (count: number) => PostgrestFilterBuilder<T>;
    offset: (count: number) => PostgrestFilterBuilder<T>;
    select: (columns?: string) => PostgrestFilterBuilder<T>;
    single: () => PostgrestFilterBuilder<T>;
    maybeSingle: () => PostgrestFilterBuilder<T>;
    then: <R>(onfulfilled?: (value: PostgrestResponse<T>) => R | PromiseLike<R>) => Promise<R>;
  }

  export interface PostgrestError {
    message: string;
    details: string;
    hint: string;
    code: string;
  }

  export interface SupabaseClient {
    from<T = any>(table: string): PostgrestFilterBuilder<T> & {
      select(columns?: string): PostgrestFilterBuilder<T>;
      insert(values: any, options?: { returning?: string; upsert?: boolean; onConflict?: string }): PostgrestFilterBuilder<T>;
      update(values: any, options?: { returning?: string }): PostgrestFilterBuilder<T>;
      delete(options?: { returning?: string }): PostgrestFilterBuilder<T>;
      upsert(values: any, options?: { returning?: string; onConflict?: string }): PostgrestFilterBuilder<T>;
      then: <R>(onfulfilled?: (value: PostgrestResponse<T>) => R | PromiseLike<R>) => Promise<R>;
    };
    storage: {
      from(bucket: string): {
        upload(path: string, file: any, options?: any): Promise<{ data: any; error: any }>;
        download(path: string): Promise<{ data: any; error: any }>;
        remove(paths: string[]): Promise<{ data: any; error: any }>;
        list(prefix?: string): Promise<{ data: any; error: any }>;
      };
    };
    auth: {
      signUp(credentials: { email: string; password: string }): Promise<{ user: any; session: any; error: any }>;
      signIn(credentials: { email: string; password: string }): Promise<{ user: any; session: any; error: any }>;
      signOut(): Promise<{ error: any }>;
      session(): Promise<{ data: any; error: any }>;
    };
    rpc<T = any>(fn: string, params?: any): Promise<PostgrestResponse<T>>;
  }

  export function createClient(url: string, key: string, options?: SupabaseClientOptions): SupabaseClient;
}

// Node.js module declarations
declare module 'mongoose' {
  export interface Connection {
    readyState: number;
  }

  export interface Model<T> {
    find(conditions?: any): Query<T[], T>;
    findOne(conditions?: any): Query<T | null, T>;
    findById(id: any): Query<T | null, T>;
    countDocuments(conditions?: any): Promise<number>;
    create(doc: any): Promise<T>;
    updateOne(conditions: any, doc: any): Promise<any>;
    deleteOne(conditions: any): Promise<any>;
  }

  export interface Query<ResultType, DocType> {
    where(path: string): any;
    gt(val: any): this;
    skip(val: number): this;
    limit(val: number): this;
    lean(): this;
    exec(): Promise<ResultType>;
  }

  export function connect(uri: string, options?: any): Promise<any>;
  export function model<T>(name: string, schema: any): Model<T>;
  export default mongoose;
}

// Stream module
declare module 'stream' {
  export class PassThrough extends NodeJS.ReadWriteStream {}
}

// fs module declarations
declare module 'fs' {
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean; mode?: number }): string | undefined;
  export function writeFileSync(path: string, data: string | Buffer, options?: { encoding?: string; mode?: number; flag?: string }): void;
  export function writeFile(path: string, data: string | Buffer, callback: (err: NodeJS.ErrnoException | null) => void): void;
  export function writeFile(path: string, data: string | Buffer, options: { encoding?: string; mode?: number; flag?: string }, callback: (err: NodeJS.ErrnoException | null) => void): void;
  export function readFile(path: string, encoding: string, callback: (err: NodeJS.ErrnoException | null, data: string) => void): void;
  export function readFile(path: string, callback: (err: NodeJS.ErrnoException | null, data: Buffer) => void): void;
  export function readdir(path: string, callback: (err: NodeJS.ErrnoException | null, files: string[]) => void): void;
  export function readdir(path: string, options: { withFileTypes?: boolean }, callback: (err: NodeJS.ErrnoException | null, files: any[]) => void): void;
  export function readdirSync(path: string, options?: { withFileTypes?: boolean }): any[];
  export function statSync(path: string): { size: number; isDirectory(): boolean; isFile(): boolean };
  export function access(path: string, mode: number, callback: (err: NodeJS.ErrnoException | null) => void): void;
  export function unlink(path: string, callback: (err: NodeJS.ErrnoException | null) => void): void;
  export function unlinkSync(path: string): void;
  export function createReadStream(path: string, options?: any): NodeJS.ReadableStream;
  export const constants: { F_OK: number; R_OK: number; W_OK: number; X_OK: number };
}

// Model imports
declare module '../../models/material.model' {
  import { Model } from 'mongoose';
  export const MaterialModel: Model<any>;
}

declare module '../../models/collection.model' {
  import { Model } from 'mongoose';
  export const CollectionModel: Model<any>;
}

declare module '../../models/metadataField.model' {
  import { Model } from 'mongoose';
  export const MetadataFieldModel: Model<any>;
}

declare module '../../models/version.model' {
  import { Model } from 'mongoose';
  export const VersionModel: Model<any>;
}
/**
 * Global Type Declarations
 * 
 * This file provides TypeScript declarations for all external modules
 * and interfaces needed throughout the project.
 */

// React module declarations
declare module 'react' {
  export interface FC<P = {}> {
    (props: P & { children?: React.ReactNode }): React.ReactElement<any, any> | null;
  }

  export const useState: any;
  export const useEffect: any;
  export const useCallback: any;
  export const useMemo: any;
  export const useRef: any;
  export const useContext: any;
  export const useReducer: any;
  export const useLayoutEffect: any;

  export interface ChangeEvent<T> {
    target: T;
    currentTarget: T;
  }

  export namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

// React JSX Runtime
declare module 'react/jsx-runtime' {
  export namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
  }
  export function jsx(
    type: React.ElementType,
    props: Record<string, any>,
    key?: string
  ): React.ReactElement;
  export function jsxs(
    type: React.ElementType,
    props: Record<string, any>,
    key?: string
  ): React.ReactElement;
}

// Heroicons module
declare module '@heroicons/react/outline' {
  import { FC, SVGProps } from 'react';
  
  export const CogIcon: FC<SVGProps<SVGSVGElement>>;
  export const SaveIcon: FC<SVGProps<SVGSVGElement>>;
  export const CloudIcon: FC<SVGProps<SVGSVGElement>>;
  export const DatabaseIcon: FC<SVGProps<SVGSVGElement>>;
  export const MailIcon: FC<SVGProps<SVGSVGElement>>;
  export const LockClosedIcon: FC<SVGProps<SVGSVGElement>>;
  export const ServerIcon: FC<SVGProps<SVGSVGElement>>;
  export const ChipIcon: FC<SVGProps<SVGSVGElement>>;
  export const RefreshIcon: FC<SVGProps<SVGSVGElement>>;
  export const CheckCircleIcon: FC<SVGProps<SVGSVGElement>>;
  export const ExclamationCircleIcon: FC<SVGProps<SVGSVGElement>>;
  export const ArrowCircleRightIcon: FC<SVGProps<SVGSVGElement>>;
  export const CheckIcon: FC<SVGProps<SVGSVGElement>>;
  export const ExclamationIcon: FC<SVGProps<SVGSVGElement>>;
}

// Supabase module
declare module '@supabase/supabase-js' {
  export interface PostgrestResponse<T> {
    data: T | null;
    error: PostgrestError | null;
    status: number;
    statusText: string;
    count: number | null;
  }

  export interface PostgrestError {
    message: string;
    details: string;
    hint: string;
    code: string;
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
    textSearch: (column: string, query: string, options?: { config?: string }) => PostgrestFilterBuilder<T>;
    filter: (column: string, operator: string, value: any) => PostgrestFilterBuilder<T>;
    match: (query: Record<string, any>) => PostgrestFilterBuilder<T>;
    not: (column: string, operator: string, value: any) => PostgrestFilterBuilder<T>;
    or: (filters: string, options?: { referencedTable?: string }) => PostgrestFilterBuilder<T>;
    limit: (count: number) => PostgrestFilterBuilder<T>;
    offset: (count: number) => PostgrestFilterBuilder<T>;
    select: (columns?: string) => PostgrestFilterBuilder<T>;
    order: (column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => PostgrestFilterBuilder<T>;
    single: () => Promise<PostgrestResponse<T>>;
    then: <U>(onFulfilled?: (value: PostgrestResponse<T>) => U | PromiseLike<U>) => Promise<U>;
  }

  export interface SupabaseClient {
    from: <T = any>(table: string) => {
      select: (columns?: string) => PostgrestFilterBuilder<T>;
      insert: (values: Partial<T> | Partial<T>[], options?: { returning?: boolean }) => Promise<PostgrestResponse<T>>;
      update: (values: Partial<T>, options?: { returning?: boolean }) => PostgrestFilterBuilder<T>;
      upsert: (values: Partial<T> | Partial<T>[], options?: { onConflict?: string; returning?: boolean }) => Promise<PostgrestResponse<T>>;
      delete: (options?: { returning?: boolean }) => PostgrestFilterBuilder<T>;
    };
    storage: {
      from: (bucket: string) => {
        upload: (path: string, file: File | Blob | ArrayBuffer | FormData | string, options?: any) => Promise<{ data: any; error: any }>;
        download: (path: string) => Promise<{ data: any; error: any }>;
        list: (prefix?: string) => Promise<{ data: any; error: any }>;
        remove: (path: string) => Promise<{ data: any; error: any }>;
      };
    };
    rpc: (fn: string, params?: object) => Promise<PostgrestResponse<any>>;
  }

  export function createClient(supabaseUrl: string, supabaseKey: string, options?: any): SupabaseClient;
}

// Mongoose type declarations
declare module 'mongoose' {
  export default mongoose;
  
  const mongoose: {
    connect: (uri: string, options?: any) => Promise<any>;
    connection: any;
    Schema: any;
    model: any;
    Types: {
      ObjectId: any;
    };
  };

  export interface Document {
    _id: any;
    save(): Promise<this>;
    toObject(): Record<string, any>;
    toJSON(): Record<string, any>;
  }

  export interface Model<T> {
    find(filter?: any): Query<T[], T>;
    findOne(filter?: any): Query<T | null, T>;
    findById(id: any): Query<T | null, T>;
    updateOne(filter: any, update: any, options?: any): Query<any, T>;
    updateMany(filter: any, update: any, options?: any): Query<any, T>;
    deleteOne(filter: any): Query<any, T>;
    deleteMany(filter: any): Query<any, T>;
    create(docs: any): Promise<T>;
    countDocuments(filter?: any): Promise<number>;
  }
  
  export interface Query<T, U> {
    where(path: string): Query<T, U>;
    equals(val: any): Query<T, U>;
    eq(val: any): Query<T, U>;
    gt(val: any): Query<T, U>;
    gte(val: any): Query<T, U>;
    lt(val: any): Query<T, U>;
    lte(val: any): Query<T, U>;
    in(val: any[]): Query<T, U>;
    nin(val: any[]): Query<T, U>;
    exists(val?: boolean): Query<T, U>;
    sort(val: any): Query<T, U>;
    limit(val: number): Query<T, U>;
    skip(val: number): Query<T, U>;
    select(val: any): Query<T, U>;
    populate(path: string | Record<string, any>, options?: any): Query<T, U>;
    lean(): Query<T, U>;
    exec(): Promise<T>;
    countDocuments(): Promise<number>;
  }
}

// Stream module declaration
declare module 'stream' {
  export class PassThrough extends NodeJS.ReadWriteStream {
    constructor(options?: any);
  }
}

// Node.js fs module extensions
declare namespace NodeJS {
  interface ReadableStream {}
  interface WritableStream {}
  interface ReadWriteStream extends ReadableStream, WritableStream {}
}

interface FileSystem {
  createReadStream(path: string, options?: any): NodeJS.ReadableStream;
}

declare module 'fs' {
  export const createReadStream: (path: string, options?: any) => NodeJS.ReadableStream;
  export function existsSync(path: string): boolean;
}

// MongoDB model declarations for direct imports
declare module '../../models/material.model' {
  import { Model, Document } from 'mongoose';
  
  export interface MaterialDocument extends Document {
    name: string;
    description: string;
    type: string;
    vectorRepresentation?: number[];
    [key: string]: any;
  }
  
  const MaterialModel: Model<MaterialDocument>;
  export { MaterialModel };
  export default MaterialModel;
}

declare module '../../models/collection.model' {
  import { Model, Document } from 'mongoose';
  
  export interface CollectionDocument extends Document {
    name: string;
    description: string;
    [key: string]: any;
  }
  
  const CollectionModel: Model<CollectionDocument>;
  export { CollectionModel };
  export default CollectionModel;
}

declare module '../../models/metadataField.model' {
  import { Model, Document } from 'mongoose';
  
  export interface MetadataFieldDocument extends Document {
    name: string;
    type: string;
    [key: string]: any;
  }
  
  const MetadataFieldModel: Model<MetadataFieldDocument>;
  export { MetadataFieldModel };
  export default MetadataFieldModel;
}

declare module '../../models/version.model' {
  import { Model, Document } from 'mongoose';
  
  export interface VersionDocument extends Document {
    materialId: string;
    version: number;
    changes: any;
    [key: string]: any;
  }
  
  const VersionModel: Model<VersionDocument>;
  export { VersionModel };
  export default VersionModel;
}
/**
 * Enhanced type definitions for Supabase
 *
 * This file provides comprehensive TypeScript declarations for Supabase
 * that should be used across all packages to ensure type consistency.
 */

declare module '@supabase/supabase-js' {
  /**
   * Supabase client configuration options
   */
  export interface SupabaseClientOptions {
    auth?: {
      autoRefreshToken?: boolean;
      persistSession?: boolean;
      detectSessionInUrl?: boolean;
    };
    global?: {
      headers?: Record<string, string>;
    };
    db?: {
      schema?: string;
    };
    realtime?: {
      endpoint?: string;
      eventsPerSecond?: number;
      headers?: Record<string, string>;
    };
  }

  /**
   * Options for PostgrestBuilder.select() method
   */
  export interface PostgrestSelectOptions {
    count?: 'exact' | 'planned' | 'estimated';
    head?: boolean;
  }

  /**
   * PostgreSQL query builder with filtering capabilities
   */
  export interface PostgrestFilterBuilder<T> {
    // Query filters
    eq: (column: string, value: any) => PostgrestFilterBuilder<T>;
    neq: (column: string, value: any) => PostgrestFilterBuilder<T>;
    gt: (column: string, value: any) => PostgrestFilterBuilder<T>;
    lt: (column: string, value: any) => PostgrestFilterBuilder<T>;
    gte: (column: string, value: any) => PostgrestFilterBuilder<T>;
    lte: (column: string, value: any) => PostgrestFilterBuilder<T>;
    like: (column: string, pattern: string) => PostgrestFilterBuilder<T>;
    ilike: (column: string, pattern: string) => PostgrestFilterBuilder<T>;
    is: (column: string, value: any) => PostgrestFilterBuilder<T>;
    in: (column: string, values: any[]) => PostgrestFilterBuilder<T>;
    contains: (column: string, value: any) => PostgrestFilterBuilder<T>;
    containedBy: (column: string, value: any) => PostgrestFilterBuilder<T>;
    range: (column: string, from: any, to: any) => PostgrestFilterBuilder<T>;
    overlaps: (column: string, value: any) => PostgrestFilterBuilder<T>;
    or: (conditions: string) => PostgrestFilterBuilder<T>;
    filter: (column: string, operator: string, value: any) => PostgrestFilterBuilder<T>;
    textSearch: (column: string, query: string, options?: { type?: string; config?: string }) => PostgrestFilterBuilder<T>;

    // Modifiers
    select: (columns?: string, options?: PostgrestSelectOptions) => PostgrestFilterBuilder<T>;
    order: (column: string | undefined, options?: { ascending?: boolean }) => PostgrestFilterBuilder<T>;
    limit: (count: number) => PostgrestFilterBuilder<T>;
    range: (from: number, to: number) => PostgrestFilterBuilder<T>;
    range: (column: string, from: any, to: any) => PostgrestFilterBuilder<T>;
    single: () => Promise<PostgrestResponse<T>>;
    maybeSingle: () => Promise<PostgrestResponse<T>>;
    group: (columns: string) => PostgrestFilterBuilder<T>;
    offset: (count: number) => PostgrestFilterBuilder<T>;

    // CRUD operations
    insert: (values: Partial<T> | Partial<T>[], options?: { returning?: string; upsert?: boolean; onConflict?: string }) => PostgrestFilterBuilder<T>;
    upsert: (values: Partial<T> | Partial<T>[], options?: { returning?: string; onConflict?: string }) => PostgrestFilterBuilder<T>;
    update: (values: Partial<T>, options?: { returning?: string }) => PostgrestFilterBuilder<T>;
    delete: (options?: { returning?: string }) => PostgrestFilterBuilder<T>;

    // Execute query
    then: <TResult = PostgrestResponse<T>>(
      onfulfilled?: ((value: PostgrestResponse<T>) => TResult | PromiseLike<TResult>) | undefined | null,
      onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
    ) => Promise<TResult>;
  }

  /**
   * PostgreSQL error response
   */
  export interface PostgrestError {
    message: string;
    code: string;
    details?: string;
    hint?: string;
  }

  /**
   * PostgreSQL query response
   */
  export interface PostgrestResponse<T> {
    data: T extends any[] ? T[] : T | null;
    error: PostgrestError | null;
    count?: number;
    status?: number;
    statusText?: string;
  }

  /**
   * Supabase client interface
   */
  export interface SupabaseClient {
    // Database access
    from: <T = any>(table: string) => PostgrestFilterBuilder<T>;

    // Remote procedure calls
    rpc: <T = any>(
      fn: string,
      params?: Record<string, any>
    ) => PostgrestFilterBuilder<T>;

    // Authentication
    auth: {
      // Core auth methods
      signUp: (credentials: { email: string; password: string }) => Promise<{ user: any; session: any; error: any }>;
      signIn: (credentials: { email: string; password: string }) => Promise<{ user: any; session: any; error: any }>;
      signInWithPassword: (credentials: { email: string; password: string }) => Promise<{ data: { user: any; session: any }; error: any }>;
      signOut: () => Promise<{ error: any }>;
      session: () => Promise<{ data: { session: any }; error: any }>;

      // Auth state
      onAuthStateChange: (callback: (event: string, session: any) => void) => { data: any; error: any };
      getSession: () => Promise<{ data: { session: any }; error: any }>;
      getUser: () => Promise<{ data: { user: any }; error: any }>;

      // Social auth
      signInWithOAuth: (options: { provider: string }) => Promise<{ data: any; error: any }>;
    };

    // Storage
    storage: {
      from: (bucket: string) => {
        // File operations
        upload: (path: string, file: any, options?: any) => Promise<{ data: any; error: any }>;
        download: (path: string) => Promise<{ data: any; error: any }>;
        remove: (paths: string[]) => Promise<{ data: any; error: any }>;
        list: (prefix?: string) => Promise<{ data: any; error: any }>;

        // URL generation
        getPublicUrl: (path: string) => { data: { publicUrl: string } };
        createSignedUrl: (path: string, expiresIn: number) => Promise<{ data: { signedUrl: string }; error: any }>;
      };
    };

    // Realtime subscriptions
    channel: (name: string) => {
      on: (event: string, schema: string, table: string, callback: (payload: any) => void) => any;
      subscribe: (callback?: (status: string, err?: any) => void) => any;
    };
  }

  /**
   * Create a new Supabase client
   */
  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: SupabaseClientOptions
  ): SupabaseClient;

  /**
   * User session information
   */
  export interface Session {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
    user: User;
  }

  /**
   * User information
   */
  export interface User {
    id: string;
    email?: string;
    app_metadata: {
      provider?: string;
      [key: string]: any;
    };
    user_metadata: {
      [key: string]: any;
    };
    aud: string;
    created_at: string;
  }

  /**
   * Auth change event type
   */
  export type AuthChangeEvent =
    | 'SIGNED_IN'
    | 'SIGNED_OUT'
    | 'USER_UPDATED'
    | 'PASSWORD_RECOVERY'
    | 'TOKEN_REFRESHED';
}
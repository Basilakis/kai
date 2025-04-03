declare module '@supabase/supabase-js' {
  export interface SupabaseClientOptions {
    auth?: {
      autoRefreshToken?: boolean;
      persistSession?: boolean;
    };
    global?: {
      headers?: Record<string, string>;
    };
    db?: {
      schema?: string;
    };
  }

  export interface PostgrestSelectOptions {
    count?: 'exact' | 'planned' | 'estimated';
    head?: boolean;
  }

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

    // Modifiers
    select: (columns?: string, options?: PostgrestSelectOptions) => PostgrestFilterBuilder<T>;
    order: (column: string | undefined, options?: { ascending?: boolean }) => PostgrestFilterBuilder<T>;
    limit: (count: number) => PostgrestFilterBuilder<T>;
    range: (from: number, to: number) => PostgrestFilterBuilder<T>;
    range: (column: string, from: any, to: any) => PostgrestFilterBuilder<T>;
    single: () => Promise<PostgrestResponse<T>>;
    group: (columns: string) => PostgrestFilterBuilder<T>;

    // CRUD operations
    insert: (values: Partial<T> | Partial<T>[]) => PostgrestFilterBuilder<T>;
    update: (values: Partial<T>) => PostgrestFilterBuilder<T>;
    delete: () => PostgrestFilterBuilder<T>;

    // Execute query
    then: <TResult = PostgrestResponse<T>>(
      onfulfilled?: ((value: PostgrestResponse<T>) => TResult | PromiseLike<TResult>) | undefined | null,
      onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
    ) => Promise<TResult>;
  }

  export interface PostgrestError {
    message: string;
    code: string;
    details?: string;
    hint?: string;
  }

  export interface PostgrestResponse<T> {
    data: T extends any[] ? T[] : T | null;
    error: PostgrestError | null;
    count?: number;
  }

  export interface SupabaseClient {
    from: <T = any>(table: string) => PostgrestFilterBuilder<T>;
    rpc: <T = any>(
      fn: string,
      params?: Record<string, any>
    ) => PostgrestFilterBuilder<T>;
    auth: {
      signUp: (credentials: { email: string; password: string }) => Promise<any>;
      signIn: (credentials: { email: string; password: string }) => Promise<any>;
      signOut: () => Promise<any>;
      onAuthStateChange: (callback: (event: string, session: any) => void) => { data: any; error: any };
    };
    storage: {
      from: (bucket: string) => {
        upload: (path: string, file: any) => Promise<any>;
        download: (path: string) => Promise<any>;
        remove: (paths: string[]) => Promise<any>;
        list: (prefix?: string) => Promise<any>;
      };
    };
  }

  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: SupabaseClientOptions
  ): SupabaseClient;
}
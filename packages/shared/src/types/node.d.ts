declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV?: 'development' | 'production' | 'test';
      SUPABASE_URL?: string;
      SUPABASE_KEY?: string;
      [key: string]: string | undefined;
    }
  }

  interface Process {
    env: NodeJS.ProcessEnv;
  }

  const process: Process;
}

export {};

declare module 'path' {
  export function basename(path: string, ext?: string): string;
  export function dirname(path: string): string;
  export function extname(path: string): string;
  export function join(...paths: string[]): string;
  export function normalize(path: string): string;
  export function parse(path: string): {
    root: string;
    dir: string;
    base: string;
    ext: string;
    name: string;
  };
  export function relative(from: string, to: string): string;
  export function resolve(...paths: string[]): string;
  export function sep(): string;
  export function delimiter(): string;
}

declare module 'fs' {
  export function readFileSync(path: string, options?: { encoding?: string | null; flag?: string } | string | null): string | Buffer;
  export function writeFileSync(path: string, data: string | Buffer, options?: { encoding?: string | null; mode?: number | string; flag?: string } | string | null): void;
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean; mode?: number | string } | number | string): void;
  export function readdirSync(path: string, options?: { encoding?: string | null; withFileTypes?: boolean } | string | null): string[];
  export function statSync(path: string): {
    isFile(): boolean;
    isDirectory(): boolean;
    size: number;
    mtime: Date;
    ctime: Date;
  };
}

declare module 'crypto' {
  export function randomBytes(size: number): Buffer;
  export function createHash(algorithm: string): {
    update(data: string | Buffer): { digest(encoding: string): string };
  };
}
declare module 'fs' {
  export type PathLike = string | Buffer | URL;
  export function existsSync(path: PathLike): boolean;
  export function mkdirSync(path: PathLike, options?: { recursive?: boolean }): void;
  export function readFileSync(path: string, options?: { encoding?: string | null; flag?: string } | string | null): string | Buffer;
  export function writeFileSync(path: string, data: string | Buffer, options?: { encoding?: string | null; flag?: string } | string | null): void;
  export function unlinkSync(path: string): void;
  export function rmdirSync(path: string, options?: { recursive?: boolean }): void;
  export function readdirSync(path: string): string[];
  export function statSync(path: string): {
    isFile(): boolean;
    isDirectory(): boolean;
    size: number;
    mtime: Date;
  };
}

// Process is declared as a global variable in global.d.ts

declare module 'path' {
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  export function dirname(path: string): string;
  export function basename(path: string, ext?: string): string;
  export function extname(path: string): string;
  export function normalize(path: string): string;
  export function relative(from: string, to: string): string;
}
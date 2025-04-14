/**
 * Global type declarations
 */

// Declare global process variable
declare const process: {
  env: {
    [key: string]: string | undefined;
    NODE_ENV?: 'development' | 'production' | 'test';
    COORDINATOR_URL?: string;
    GPU_TIER?: string;
    RENDER_CAPABILITY?: string;
    HAS_GPU?: string;
    CUDA_VISIBLE_DEVICES?: string;
    GPU_COUNT?: string;
  };
  memoryUsage(): {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers?: number;
  };
  cwd(): string;
};

// Declare global Buffer class if needed
declare class Buffer extends Uint8Array {
  constructor(arg: string | ArrayBuffer | SharedArrayBuffer | Array<number> | Buffer | ReadonlyArray<number>, encodingOrOffset?: string | number, length?: number);
  toString(encoding?: string, start?: number, end?: number): string;
  
  static from(arrayBuffer: ArrayBuffer | SharedArrayBuffer): Buffer;
  static from(data: ReadonlyArray<number>): Buffer;
  static from(data: Uint8Array): Buffer;
  static from(str: string, encoding?: string): Buffer;
  static isBuffer(obj: any): boolean;
  static concat(list: ReadonlyArray<Uint8Array>, totalLength?: number): Buffer;
}

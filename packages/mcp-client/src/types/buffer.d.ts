/**
 * Simple type declaration for Buffer
 */

declare class Buffer extends Uint8Array {
  constructor(arg: string | ArrayBuffer | SharedArrayBuffer | Array<number> | Buffer | ReadonlyArray<number>, encodingOrOffset?: string | number, length?: number);
  toString(encoding?: string, start?: number, end?: number): string;
  toJSON(): { type: 'Buffer'; data: number[] };
}

declare namespace NodeJS {
  interface Global {
    Buffer: typeof Buffer;
  }
}

/**
 * Type declarations for Node.js Buffer
 */

declare global {
  // Define the Buffer class
  class Buffer extends Uint8Array {
    constructor(arg: string | ArrayBuffer | SharedArrayBuffer | Array<number> | Buffer | ReadonlyArray<number>, encodingOrOffset?: string | number, length?: number);
    
    // Common Buffer methods
    toString(encoding?: string, start?: number, end?: number): string;
    toJSON(): { type: 'Buffer'; data: number[] };
    equals(otherBuffer: Uint8Array): boolean;
    compare(target: Uint8Array, targetStart?: number, targetEnd?: number, sourceStart?: number, sourceEnd?: number): number;
    copy(target: Uint8Array, targetStart?: number, sourceStart?: number, sourceEnd?: number): number;
    slice(start?: number, end?: number): Buffer;
    write(string: string, offset?: number, length?: number, encoding?: string): number;
    
    // Static methods
    static isBuffer(obj: any): boolean;
    static byteLength(string: string | NodeJS.ArrayBufferView | ArrayBuffer | SharedArrayBuffer, encoding?: string): number;
    static concat(list: ReadonlyArray<Uint8Array>, totalLength?: number): Buffer;
    static compare(buf1: Uint8Array, buf2: Uint8Array): number;
    static from(arrayBuffer: ArrayBuffer | SharedArrayBuffer, byteOffset?: number, length?: number): Buffer;
    static from(data: ReadonlyArray<number>): Buffer;
    static from(data: Uint8Array): Buffer;
    static from(str: string, encoding?: string): Buffer;
    static of(...items: number[]): Buffer;
    static alloc(size: number, fill?: string | Buffer | number, encoding?: string): Buffer;
    static allocUnsafe(size: number): Buffer;
    static allocUnsafeSlow(size: number): Buffer;
  }
  
  // Add Buffer to global namespace
  var Buffer: {
    new(arg: string | ArrayBuffer | SharedArrayBuffer | Array<number> | Buffer | ReadonlyArray<number>, encodingOrOffset?: string | number, length?: number): Buffer;
    prototype: Buffer;
    isBuffer(obj: any): boolean;
    byteLength(string: string | NodeJS.ArrayBufferView | ArrayBuffer | SharedArrayBuffer, encoding?: string): number;
    concat(list: ReadonlyArray<Uint8Array>, totalLength?: number): Buffer;
    compare(buf1: Uint8Array, buf2: Uint8Array): number;
    from(arrayBuffer: ArrayBuffer | SharedArrayBuffer, byteOffset?: number, length?: number): Buffer;
    from(data: ReadonlyArray<number>): Buffer;
    from(data: Uint8Array): Buffer;
    from(str: string, encoding?: string): Buffer;
    of(...items: number[]): Buffer;
    alloc(size: number, fill?: string | Buffer | number, encoding?: string): Buffer;
    allocUnsafe(size: number): Buffer;
    allocUnsafeSlow(size: number): Buffer;
  };
  
  namespace NodeJS {
    interface ArrayBufferView {
      buffer: ArrayBuffer;
      byteLength: number;
      byteOffset: number;
    }
  }
}

export {};

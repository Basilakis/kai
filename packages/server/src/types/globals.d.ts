/**
 * Global type declarations for Node.js
 * This file provides type declarations for Node.js globals and modules that are used throughout the application.
 */

// Node.js Buffer
declare global {
  interface Buffer extends Uint8Array {
    write(string: string, offset?: number, length?: number, encoding?: string): number;
    toString(encoding?: string, start?: number, end?: number): string;
    toJSON(): { type: 'Buffer'; data: number[] };
    equals(otherBuffer: Uint8Array): boolean;
    compare(target: Uint8Array, targetStart?: number, targetEnd?: number, sourceStart?: number, sourceEnd?: number): number;
    copy(target: Uint8Array, targetStart?: number, sourceStart?: number, sourceEnd?: number): number;
    slice(start?: number, end?: number): Buffer;
    subarray(start?: number, end?: number): Buffer;
    writeUIntLE(value: number, offset: number, byteLength: number): number;
    writeUIntBE(value: number, offset: number, byteLength: number): number;
    writeIntLE(value: number, offset: number, byteLength: number): number;
    writeIntBE(value: number, offset: number, byteLength: number): number;
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
    reverse(): this;
    swap16(): Buffer;
    swap32(): Buffer;
    swap64(): Buffer;
  }

  var Buffer: {
    new(str: string, encoding?: string): Buffer;
    new(size: number): Buffer;
    new(array: Uint8Array): Buffer;
    new(arrayBuffer: ArrayBuffer): Buffer;
    new(array: any[]): Buffer;
    from(arrayBuffer: ArrayBuffer, byteOffset?: number, length?: number): Buffer;
    from(data: any[]): Buffer;
    from(data: Uint8Array): Buffer;
    from(str: string, encoding?: string): Buffer;
    alloc(size: number, fill?: string | Buffer | number, encoding?: string): Buffer;
    allocUnsafe(size: number): Buffer;
    allocUnsafeSlow(size: number): Buffer;
    isBuffer(obj: any): boolean;
    byteLength(string: string | Buffer | ArrayBuffer | SharedArrayBuffer | Uint8Array, encoding?: string): number;
    concat(list: Uint8Array[], totalLength?: number): Buffer;
    compare(buf1: Uint8Array, buf2: Uint8Array): number;
  };
}

// Node.js child_process module
declare module 'child_process' {
  import * as events from 'events';
  import * as stream from 'stream';
  import * as net from 'net';

  interface ChildProcess extends events.EventEmitter {
    stdin: stream.Writable | null;
    stdout: stream.Readable | null;
    stderr: stream.Readable | null;
    killed: boolean;
    pid: number;
    kill(signal?: string): void;
  }

  interface SpawnOptions {
    cwd?: string;
    env?: any;
    argv0?: string;
    stdio?: any;
    detached?: boolean;
    uid?: number;
    gid?: number;
    shell?: boolean | string;
    windowsVerbatimArguments?: boolean;
    windowsHide?: boolean;
  }

  function spawn(command: string, args?: readonly string[], options?: SpawnOptions): ChildProcess;
  function exec(command: string, callback?: (error: Error | null, stdout: string, stderr: string) => void): ChildProcess;
  function exec(command: string, options?: any, callback?: (error: Error | null, stdout: string, stderr: string) => void): ChildProcess;
  function execFile(file: string, args?: readonly string[], options?: any, callback?: (error: Error | null, stdout: string, stderr: string) => void): ChildProcess;
  function fork(modulePath: string, args?: readonly string[], options?: any): ChildProcess;
}

// Other common Node.js modules
declare module 'fs' {
  function readFileSync(path: string, options?: { encoding?: string; flag?: string } | string): string | Buffer;
  function writeFileSync(path: string, data: string | Buffer, options?: { encoding?: string; mode?: number; flag?: string } | string): void;
  function existsSync(path: string): boolean;
  function mkdirSync(path: string, options?: { recursive?: boolean; mode?: number } | number): void;
  function unlinkSync(path: string): void;
  function rmdirSync(path: string): void;
  function statSync(path: string): any;
  function readdirSync(path: string): string[];
  function lstatSync(path: string): any;
}

declare module 'path' {
  function join(...paths: string[]): string;
  function resolve(...paths: string[]): string;
  function dirname(path: string): string;
  function basename(path: string, ext?: string): string;
  function extname(path: string): string;
  function parse(path: string): { root: string; dir: string; base: string; ext: string; name: string };
  function format(pathObject: { root?: string; dir?: string; base?: string; ext?: string; name?: string }): string;
  const sep: string;
}
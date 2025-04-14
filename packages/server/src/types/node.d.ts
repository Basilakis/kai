/**
 * Minimal Node.js type declarations to fix TypeScript errors
 */

declare namespace NodeJS {
  export interface ProcessEnv {
    [key: string]: string | undefined;
  }
  
  export interface Process {
    env: ProcessEnv;
    cwd(): string;
    exit(code?: number): never;
  }
  
  export interface ErrnoException extends Error {
    errno?: number;
    code?: string;
    path?: string;
    syscall?: string;
  }
  
  // Add Timeout type for setInterval and setTimeout
  export type Timeout = number;
}

declare var process: NodeJS.Process;

/**
 * OS module declarations
 */
declare module 'os' {
  export function tmpdir(): string;
  export function hostname(): string;
  export function type(): string;
  export function platform(): string;
  export function arch(): string;
  export function release(): string;
  export function uptime(): number;
  export function loadavg(): number[];
  export function totalmem(): number;
  export function freemem(): number;
  export function cpus(): Array<{
    model: string;
    speed: number;
    times: {
      user: number;
      nice: number;
      sys: number;
      idle: number;
      irq: number;
    };
  }>;
  export interface NetworkInterfaceInfo {
    address: string;
    netmask: string;
    family: string;
    mac: string;
    internal: boolean;
    cidr: string | null;
  }
  export function networkInterfaces(): { [index: string]: NetworkInterfaceInfo[] };
  export function homedir(): string;
  export function userInfo(options?: { encoding: string }): {
    username: string;
    uid: number;
    gid: number;
    shell: string;
    homedir: string;
  };
  export function endianness(): string;
}

/**
 * child_process module declarations
 */
declare module 'child_process' {
  import { EventEmitter } from 'events';
  import { Readable, Writable } from 'stream';

  export interface SpawnOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    argv0?: string;
    stdio?: 'pipe' | 'ignore' | 'inherit' | Array<any>;
    detached?: boolean;
    uid?: number;
    gid?: number;
    shell?: boolean | string;
    windowsVerbatimArguments?: boolean;
    windowsHide?: boolean;
  }

  export interface ChildProcess extends EventEmitter {
    stdin: Writable | null;
    stdout: Readable | null;
    stderr: Readable | null;
    readonly pid: number;
    readonly killed: boolean;
    readonly exitCode: number | null;
    readonly signalCode: string | null;
    readonly spawnfile: string;
    kill(signal?: string): boolean;
    on(event: 'close', listener: (code: number, signal: string) => void): this;
    on(event: 'disconnect', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'exit', listener: (code: number | null, signal: string | null) => void): this;
    on(event: 'message', listener: (message: any, sendHandle: any) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export function spawn(command: string, args?: readonly string[], options?: SpawnOptions): ChildProcess;
  export function exec(command: string, callback?: (error: Error | null, stdout: string, stderr: string) => void): ChildProcess;
  export function execFile(file: string, args?: readonly string[], options?: SpawnOptions, callback?: (error: Error | null, stdout: string, stderr: string) => void): ChildProcess;
  export function fork(modulePath: string, args?: readonly string[], options?: SpawnOptions): ChildProcess;
}
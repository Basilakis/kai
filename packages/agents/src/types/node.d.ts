/**
 * Type declarations for Node.js
 * 
 * This file provides TypeScript declarations for Node.js APIs used in
 * the agent system, including process, environment variables, etc.
 */

declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
    NODE_ENV?: 'development' | 'production' | 'test';
    OPENAI_API_KEY?: string;
    PORT?: string;
    HOST?: string;
    DEBUG?: string;
    LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
  }

  interface Process {
    env: ProcessEnv;
    cwd(): string;
    exit(code?: number): never;
    on(event: string, listener: (...args: any[]) => void): this;
    stdout: {
      write(data: string | Uint8Array): boolean;
    };
    stderr: {
      write(data: string | Uint8Array): boolean;
    };
    stdin: {
      on(event: string, listener: (...args: any[]) => void): this;
    };
    platform: string;
    version: string;
    versions: {
      node: string;
      [key: string]: string;
    };
    pid: number;
    uptime(): number;
    memoryUsage(): {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    };
    nextTick(callback: (...args: any[]) => void, ...args: any[]): void;
    hrtime(time?: [number, number]): [number, number];
  }
}

declare const process: NodeJS.Process;

declare module 'process' {
  export = process;
}
/**
 * Custom type definitions for Node.js process global
 */

declare namespace NodeJS {
  interface Process {
    cwd(): string;
    env: {
      [key: string]: string | undefined;
      NODE_ENV?: 'development' | 'production' | 'test';
      PORT?: string;
      DATABASE_URL?: string;
      JWT_SECRET?: string;
    };
    exit(code?: number): never;
    on(event: string, listener: Function): this;
    stdout: {
      write(buffer: string | Uint8Array): boolean;
    };
    stderr: {
      write(buffer: string | Uint8Array): boolean;
    };
  }
}

declare var process: NodeJS.Process;
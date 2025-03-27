/**
 * Express Type Declarations
 * 
 * This file provides type definitions for Express and related middleware,
 * ensuring proper TypeScript type checking for server-side code.
 */

declare module 'express' {
  import { Server } from 'http';
  import { NextFunction, Request, Response } from 'express';

  interface Express {
    (): Application;
    json: (options?: any) => any;
    urlencoded: (options?: any) => any;
    static: (path: string, options?: any) => any;
  }

  interface Application {
    use: (middleware: any) => Application;
    listen: (port: number, callback?: () => void) => Server;
    set: (setting: string, value: any) => Application;
    get: (path: string, ...handlers: any[]) => Application;
    post: (path: string, ...handlers: any[]) => Application;
    put: (path: string, ...handlers: any[]) => Application;
    delete: (path: string, ...handlers: any[]) => Application;
    patch: (path: string, ...handlers: any[]) => Application;
    options: (path: string, ...handlers: any[]) => Application;
    head: (path: string, ...handlers: any[]) => Application;
  }

  const express: Express;
  export default express;
}

declare module 'cors' {
  import { RequestHandler } from 'express';
  
  interface CorsOptions {
    origin?: string | string[] | boolean | ((origin: string, callback: (err: Error | null, allow?: boolean) => void) => void);
    methods?: string | string[];
    allowedHeaders?: string | string[];
    exposedHeaders?: string | string[];
    credentials?: boolean;
    maxAge?: number;
    preflightContinue?: boolean;
    optionsSuccessStatus?: number;
  }
  
  function cors(options?: CorsOptions): RequestHandler;
  export default cors;
}

declare module 'helmet' {
  import { RequestHandler } from 'express';
  
  function helmet(options?: any): RequestHandler;
  export default helmet;
}

declare module 'compression' {
  import { RequestHandler } from 'express';
  
  interface CompressionOptions {
    threshold?: number;
    level?: number;
    filter?: (req: any, res: any) => boolean;
  }
  
  function compression(options?: CompressionOptions): RequestHandler;
  export default compression;
}

declare module 'morgan' {
  import { RequestHandler } from 'express';
  
  function morgan(format: string, options?: any): RequestHandler;
  export default morgan;
}

declare module 'dotenv' {
  interface DotenvConfigOptions {
    path?: string;
    encoding?: string;
    debug?: boolean;
    override?: boolean;
  }
  
  interface DotenvConfigOutput {
    parsed?: { [key: string]: string };
    error?: Error;
  }
  
  interface Dotenv {
    config(options?: DotenvConfigOptions): DotenvConfigOutput;
    parse(src: string | Buffer): { [key: string]: string };
  }
  
  const dotenv: Dotenv;
  export default dotenv;
}
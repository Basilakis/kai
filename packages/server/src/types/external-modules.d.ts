/**
 * Type declarations for external modules
 * 
 * This file provides TypeScript type declarations for external modules used in the project
 * that don't have built-in type definitions or where the available type definitions
 * are causing issues with the current codebase structure.
 */

// Express type declarations that match our usage pattern
declare module 'express' {
  import { Server } from 'http';
  
  export interface Request {
    ip: string;
    path: string;
    method: string;
    headers: Record<string, string | string[] | undefined>;
    body: any;
    params: Record<string, string>;
    query: Record<string, string | string[] | undefined>;
    user?: any;
    [key: string]: any;
  }
  
  export interface Response {
    status(code: number): Response;
    json(body: any): Response;
    send(body: any): Response;
    end(): Response;
    setHeader(name: string, value: string): Response;
    redirect(url: string): Response;
    cookie(name: string, value: string, options?: any): Response;
    [key: string]: any;
  }
  
  export interface NextFunction {
    (err?: any): void;
  }
  
  export interface Router {
    use(path: string, ...handlers: any[]): Router;
    use(...handlers: any[]): Router;
    get(path: string, ...handlers: any[]): Router;
    post(path: string, ...handlers: any[]): Router;
    put(path: string, ...handlers: any[]): Router;
    delete(path: string, ...handlers: any[]): Router;
    patch(path: string, ...handlers: any[]): Router;
    [key: string]: any;
  }
  
  export interface Express {
    use(path: string, ...handlers: any[]): Express;
    use(...handlers: any[]): Express;
    get(path: string, ...handlers: any[]): Express;
    post(path: string, ...handlers: any[]): Express;
    put(path: string, ...handlers: any[]): Express;
    delete(path: string, ...handlers: any[]): Express;
    patch(path: string, ...handlers: any[]): Express;
    listen(port: number | string, callback?: () => void): Server;
    [key: string]: any;
  }
  
  // When importing express, we need to define middleware factories as properties
  interface ExpressMiddlewareFactory {
    json(options?: any): (req: Request, res: Response, next: NextFunction) => void;
    urlencoded(options?: any): (req: Request, res: Response, next: NextFunction) => void;
    static(root: string, options?: any): (req: Request, res: Response, next: NextFunction) => void;
  }
  
  // Combine the function and namespace properties
  interface ExpressFunction extends ExpressMiddlewareFactory {
    (): Express;
    Router: () => Router;  // Add Router factory method
  }
  
  // Define the default export
  const express: ExpressFunction;
  export default express;
}

// CORS middleware
declare module 'cors' {
  import { Request, Response, NextFunction } from 'express';
  
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
  
  function cors(options?: CorsOptions): (req: Request, res: Response, next: NextFunction) => void;
  export default cors;
}

// Helmet middleware
declare module 'helmet' {
  import { Request, Response, NextFunction } from 'express';
  
  interface HelmetOptions {
    contentSecurityPolicy?: boolean | object;
    crossOriginEmbedderPolicy?: boolean | object;
    crossOriginOpenerPolicy?: boolean | object;
    crossOriginResourcePolicy?: boolean | object;
    dnsPrefetchControl?: boolean | object;
    expectCt?: boolean | object;
    frameguard?: boolean | object;
    hidePoweredBy?: boolean | object;
    hsts?: boolean | object;
    ieNoOpen?: boolean | object;
    noSniff?: boolean | object;
    originAgentCluster?: boolean | object;
    permittedCrossDomainPolicies?: boolean | object;
    referrerPolicy?: boolean | object;
    xssFilter?: boolean | object;
  }
  
  function helmet(options?: HelmetOptions): (req: Request, res: Response, next: NextFunction) => void;
  export default helmet;
}

// Compression middleware
declare module 'compression' {
  import { Request, Response, NextFunction } from 'express';
  
  interface CompressionOptions {
    threshold?: number;
    level?: number;
    memLevel?: number;
    strategy?: number;
    filter?: (req: Request, res: Response) => boolean;
    chunkSize?: number;
    windowBits?: number;
    zlibOptions?: any;
  }
  
  function compression(options?: CompressionOptions): (req: Request, res: Response, next: NextFunction) => void;
  export default compression;
}

// Morgan logging middleware
declare module 'morgan' {
  import { Request, Response, NextFunction } from 'express';
  
  interface TokenIndexer {
    [tokenName: string]: string;
  }
  
  type FormatFn = (tokens: TokenIndexer, req: Request, res: Response) => string;
  
  function morgan(format: string | FormatFn, options?: any): (req: Request, res: Response, next: NextFunction) => void;
  export default morgan;
}

// Dotenv module
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
  
  export function config(options?: DotenvConfigOptions): DotenvConfigOutput;
  export const parse: (src: string | Buffer) => { [key: string]: string };
}

// Enhance Node.js Process interface to include the methods we use
declare namespace NodeJS {
  interface Process {
    uptime(): number;
    memoryUsage(): {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers?: number;
    };
    cpuUsage(previousValue?: { user: number; system: number }): { user: number; system: number };
    version: string;
  }
}
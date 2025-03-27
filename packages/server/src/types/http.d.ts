/**
 * HTTP Module Type Declarations
 * 
 * This file provides type definitions for Node.js HTTP module,
 * ensuring proper TypeScript type checking for server-side code.
 */

declare module 'http' {
  import { Server as HttpServer } from 'node:http';
  import { Application } from 'express';
  
  export function createServer(app: Application): HttpServer;
  
  export interface Server extends HttpServer {
    listen(port: number, callback?: () => void): Server;
    listen(port: number, hostname: string, callback?: () => void): Server;
  }
}
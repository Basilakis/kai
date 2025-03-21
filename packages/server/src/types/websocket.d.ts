/**
 * Type declarations for WebSocket and HTTP modules
 */

declare module 'http' {
  import * as net from 'net';
  
  export class Server extends net.Server {
    listen(port: number, callback?: () => void): this;
    close(callback?: (err?: Error) => void): this;
  }
}

declare module 'ws' {
  import { Server as HTTPServer } from 'http';
  import { EventEmitter } from 'events';
  
  namespace WebSocket {
    export interface ServerOptions {
      server?: HTTPServer;
      port?: number;
      host?: string;
      path?: string;
      noServer?: boolean;
    }
    
    export class Server extends EventEmitter {
      constructor(options: ServerOptions);
      
      on(event: 'connection', cb: (socket: WebSocket, request: any) => void): this;
      on(event: 'error', cb: (error: Error) => void): this;
      on(event: 'close', cb: () => void): this;
      on(event: string, cb: (...args: any[]) => void): this;
      
      close(cb?: (err?: Error) => void): void;
    }
  }
  
  class WebSocket extends EventEmitter {
    static Server: typeof WebSocket.Server;
    
    constructor(address: string, protocols?: string | string[]);
    
    on(event: 'message', cb: (data: string) => void): this;
    on(event: 'close', cb: () => void): this;
    on(event: 'error', cb: (err: Error) => void): this;
    on(event: 'open', cb: () => void): this;
    on(event: string, cb: (...args: any[]) => void): this;
    
    send(data: string | Buffer, cb?: (err?: Error) => void): void;
    close(code?: number, reason?: string): void;
    
    readyState: number;
    readonly CONNECTING: number;
    readonly OPEN: number;
    readonly CLOSING: number;
    readonly CLOSED: number;
  }
  
  export = WebSocket;
}
/**
 * Custom type definitions for Express and Multer
 */

declare module 'express' {
  import { Server } from 'http';
  
  export interface Request {
    user?: any;
    file?: any;
    files?: any[];
    body: any;
    params: {
      [key: string]: string;
    };
    query: {
      [key: string]: string | string[] | undefined;
    };
  }
  
  export interface Response {
    status(code: number): Response;
    json(data: any): void;
    sendFile(path: string, options?: any, callback?: (err?: any) => void): void;
  }
  
  export interface NextFunction {
    (err?: any): void;
  }
  
  export interface Router {
    get(path: string, ...handlers: any[]): Router;
    post(path: string, ...handlers: any[]): Router;
    put(path: string, ...handlers: any[]): Router;
    delete(path: string, ...handlers: any[]): Router;
    use(path: string, router: Router): Router;
    use(...handlers: any[]): Router;
  }
  
  export interface Express {
    use(path: string, router: Router): Express;
    use(...handlers: any[]): Express;
    listen(port: number, callback?: () => void): Server;
  }
  
  export function Router(): Router;
}

declare module 'multer' {
  import { Request } from 'express';
  
  interface StorageEngine {
    _handleFile(req: Request, file: Multer.File, callback: (error?: any, info?: Partial<Multer.File>) => void): void;
    _removeFile(req: Request, file: Multer.File, callback: (error?: any) => void): void;
  }
  
  interface DiskStorageOptions {
    destination?: string | ((req: any, file: any, callback: (error: Error | null, destination: string) => void) => void);
    filename?: (req: any, file: any, callback: (error: Error | null, filename: string) => void) => void;
  }
  
  interface MulterOptions {
    dest?: string;
    storage?: StorageEngine;
    limits?: {
      fieldNameSize?: number;
      fieldSize?: number;
      fields?: number;
      fileSize?: number;
      files?: number;
      parts?: number;
      headerPairs?: number;
    };
    fileFilter?: (req: any, file: any, callback: (error: Error | null | any, acceptFile?: boolean) => void) => void;
    preservePath?: boolean;
  }
  
  namespace Multer {
    interface File {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      destination: string;
      filename: string;
      path: string;
      buffer: Buffer;
    }
  }
  
  interface Multer {
    single(fieldname: string): any;
    array(fieldname: string, maxCount?: number): any;
    fields(fields: Array<{ name: string, maxCount?: number }>): any;
    none(): any;
  }
  
  function diskStorage(options: DiskStorageOptions): StorageEngine;
  function memoryStorage(): StorageEngine;
  
  export default function(options?: MulterOptions): Multer;
  export { diskStorage, memoryStorage };
}

// Add Express.Multer namespace to fix 'Express.Multer.File' issue
declare namespace Express {
  namespace Multer {
    interface File {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      destination: string;
      filename: string;
      path: string;
      buffer: Buffer;
    }
  }
}
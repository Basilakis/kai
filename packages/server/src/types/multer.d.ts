/**
 * Custom type definitions for Multer
 */

declare module 'multer' {
  import { Request } from 'express';
  
  interface StorageEngine {
    _handleFile(req: Request, file: Express.Multer.File, callback: (error?: any, info?: Partial<Express.Multer.File>) => void): void;
    _removeFile(req: Request, file: Express.Multer.File, callback: (error?: Error) => void): void;
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
    preservePath?: boolean;
    fileFilter?(req: Request, file: Express.Multer.File, callback: FileFilterCallback): void;
  }

  interface DiskStorageOptions {
    destination?: string | ((req: Request, file: Express.Multer.File, callback: (error: Error | null, destination: string) => void) => void);
    filename?(req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void): void;
  }

  type FileFilterCallback = (error: Error | null, acceptFile: boolean) => void;

  function diskStorage(options: DiskStorageOptions): StorageEngine;

  export = multer;
  export {
    diskStorage,
    StorageEngine,
    MulterOptions,
    DiskStorageOptions,
    FileFilterCallback
  };
  
  function multer(options?: MulterOptions): any;
  namespace multer {
    export { diskStorage, StorageEngine, MulterOptions, DiskStorageOptions, FileFilterCallback };
  }
}

// Add global namespace declaration to make multer.FileFilterCallback accessible
declare namespace multer {
  type FileFilterCallback = (error: Error | null, acceptFile: boolean) => void;
}
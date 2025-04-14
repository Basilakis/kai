declare module 'multer' {
  import { Request } from 'express';
  
  namespace multer {
    interface File {
      /** Field name specified in the form */
      fieldname: string;
      /** Name of the file on the user's computer */
      originalname: string;
      /** Encoding type of the file */
      encoding: string;
      /** Mime type of the file */
      mimetype: string;
      /** Size of the file in bytes */
      size: number;
      /** The folder to which the file has been saved */
      destination: string;
      /** The name of the file within the destination */
      filename: string;
      /** Location of the uploaded file */
      path: string;
      /** A Buffer of the entire file */
      buffer: Buffer;
    }

    interface StorageEngine {
      _handleFile(req: Request, file: Express.Multer.File, callback: (error?: any, info?: Partial<File>) => void): void;
      _removeFile(req: Request, file: Express.Multer.File, callback: (error?: any) => void): void;
    }

    interface DiskStorageOptions {
      /** A function that determines within which folder the uploaded files should be stored. Defaults to the system's default temporary directory. */
      destination?: string | ((req: Request, file: Express.Multer.File, callback: (error: Error | null, destination: string) => void) => void);
      /** A function that determines what the file should be named inside the folder. Defaults to a random name with no file extension. */
      filename?: (req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => void;
    }

    interface Options {
      /** The destination directory for the uploaded files. */
      dest?: string;
      /** The storage engine to use for uploaded files. */
      storage?: StorageEngine;
      /** An object specifying the size limits of the following optional properties. This object is passed to busboy directly, and the details of properties can be found on https://github.com/mscdex/busboy#busboy-methods */
      limits?: {
        /** Max field name size (Default: 100 bytes) */
        fieldNameSize?: number;
        /** Max field value size (Default: 1MB) */
        fieldSize?: number;
        /** Max number of non-file fields (Default: Infinity) */
        fields?: number;
        /** For multipart forms, the max file size (in bytes)(Default: Infinity) */
        fileSize?: number;
        /** For multipart forms, the max number of file fields (Default: Infinity) */
        files?: number;
        /** For multipart forms, the max number of parts (fields + files)(Default: Infinity) */
        parts?: number;
        /** For multipart forms, the max number of header key=>value pairs to parse Default: 2000(same as node's http). */
        headerPairs?: number;
      };
      /** A function to control which files to upload and which to skip. */
      fileFilter?: (req: Request, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => void;
    }
  }

  interface Multer {
    diskStorage(options: multer.DiskStorageOptions): multer.StorageEngine;
    memoryStorage(): multer.StorageEngine;
    single(fieldName: string): any;
    array(fieldName: string, maxCount?: number): any;
    fields(fields: Array<{ name: string; maxCount?: number }>): any;
    none(): any;
  }

  // Properly type multer as both a function that returns Multer and an object with Multer properties
  const multer: ((options?: multer.Options) => Multer) & Multer;
  export = multer;
}

declare namespace Express {
  namespace Multer {
    interface File {
      /** Field name specified in the form */
      fieldname: string;
      /** Name of the file on the user's computer */
      originalname: string;
      /** Encoding type of the file */
      encoding: string;
      /** Mime type of the file */
      mimetype: string;
      /** Size of the file in bytes */
      size: number;
      /** The folder to which the file has been saved */
      destination: string;
      /** The name of the file within the destination */
      filename: string;
      /** Location of the uploaded file */
      path: string;
      /** A Buffer of the entire file */
      buffer: Buffer;
    }
  }
}
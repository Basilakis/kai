/**
 * Custom Express type declarations
 * 
 * Extends the Express namespace with additional types for our application.
 */

import * as express from 'express';

declare global {
  namespace Express {
    // Extend Express Request with file upload capabilities
    interface Request {
      file?: {
        buffer: Buffer;
        mimetype: string;
        originalname: string;
        size: number;
        fieldname: string;
      };
      files?: {
        [fieldname: string]: Express.Multer.File[];
      } | Express.Multer.File[];
    }
  }
}

// This is required to make this file a module
export {};
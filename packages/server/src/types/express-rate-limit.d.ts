/**
 * Type declarations for express-rate-limit
 */

declare module 'express-rate-limit' {
  import { Request, Response, NextFunction } from 'express';

  export interface Options {
    windowMs?: number;
    max?: number;
    message?: string | object;
    statusCode?: number;
    headers?: boolean;
    draft_polli_ratelimit_headers?: boolean;
    skipFailedRequests?: boolean;
    skipSuccessfulRequests?: boolean;
    requestPropertyName?: string;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
    store?: any;
    keyGenerator?: (req: Request) => string;
    handler?: (req: Request, res: Response, next: NextFunction) => void;
  }

  export default function rateLimit(options?: Options): (req: Request, res: Response, next: NextFunction) => void;
}
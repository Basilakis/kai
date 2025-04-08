import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { ApiError } from './error.middleware';
import { asyncHandler } from './error.middleware';
import { isInternalRequest, NetworkAccessType } from '../utils/network';
import { logger } from '../utils/logger';

// Add type declaration for Node.js process
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      JWT_SECRET?: string;
      NODE_ENV?: 'development' | 'production' | 'test';
    }
  }
}

/**
 * Interface for JWT payload
 */
interface JwtPayload {
  id: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Extend Express Request interface to add source property
 * (user property is already defined elsewhere)
 */
declare global {
  namespace Express {
    interface Request {
      source?: 'internal' | 'external';
    }
  }
}

/**
 * Authorization options
 */
export interface AuthorizeOptions {
  roles?: string[];
  accessType?: NetworkAccessType;
}

/**
 * Authentication middleware
 * Verifies JWT token and adds user to request object
 */
export const authMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;

    // Get token from Authorization header
    if (
      req.headers.authorization &&
      typeof req.headers.authorization === 'string' &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Get token from cookie
    else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    // Check if token exists
    if (!token) {
      return next(new ApiError(401, 'Not authorized, no token provided'));
    }

    try {
      // Verify token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'default_secret'
      ) as JwtPayload;

      // Add user to request object
      req.user = {
        id: decoded.id,
        role: decoded.role,
      };

      next();
    } catch (error) {
      return next(new ApiError(401, 'Not authorized, invalid token'));
    }
  }
);

/**
 * Enhanced authorization middleware
 * Checks both role and network access restrictions
 * 
 * @param options Authorization options including roles and network access type
 * @returns Middleware function
 */
export const authorize = (options: AuthorizeOptions = {}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Verify user is authenticated
    if (!req.user) {
      return next(new ApiError(401, 'Not authorized, no user found'));
    }
    
    // Check role-based access if roles are specified
    if (options.roles && options.roles.length > 0) {
      if (!options.roles.includes(req.user.role)) {
        return next(
          new ApiError(403, `Role (${req.user.role}) is not authorized to access this resource`)
        );
      }
    }
    
    // Check network-based access if access type is specified
    if (options.accessType === NetworkAccessType.INTERNAL_ONLY) {
      // Determine if request is from internal network
      const isInternal = isInternalRequest(req);
      
      // Add source to request for potential later use
      req.source = isInternal ? 'internal' : 'external';
      
      if (!isInternal) {
        logger.warn(`External access attempt to internal-only resource: ${req.method} ${req.originalUrl} from IP ${req.ip || req.socket.remoteAddress || 'unknown'}`);
        return next(
          new ApiError(403, 'This resource is only accessible from internal networks')
        );
      }
    }
    
    next();
  };
};

/**
 * Role-based authorization middleware (backward compatibility)
 * Checks if the user has the required role(s)
 * @param roles Array of roles that are allowed to access the route
 */
export const authorizeRoles = (roles: string[]) => {
  return authorize({ roles });
};
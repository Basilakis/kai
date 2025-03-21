import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from './error.middleware';
import { asyncHandler } from './error.middleware';

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
 * Extend Express Request interface to include user
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
      };
    }
  }
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
 * Role-based authorization middleware
 * Checks if the user has the required role(s)
 * @param roles Array of roles that are allowed to access the route
 */
export const authorizeRoles = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, 'Not authorized, no user found'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(403, `Role (${req.user.role}) is not authorized to access this resource`)
      );
    }

    next();
  };
};
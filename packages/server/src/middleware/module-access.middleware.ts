/**
 * Module Access Middleware
 * 
 * This middleware provides subscription-based access control to modules.
 * It checks if a user has permission to access a specific module based on their subscription tier.
 * It also tracks module usage and enforces API rate limits.
 */

import { Request, Response, NextFunction } from 'express';
import { ApiError } from './error.middleware';
import { logger } from '../utils/logger';
import { 
  checkModuleAccess, 
  checkApiLimit, 
  trackUserApiUsage, 
  trackUserModuleUsage 
} from '../controllers/subscription.controller';

/**
 * Require module access middleware
 * @param moduleName The name of the module to check access for
 * @returns Middleware function
 */
export const requireModuleAccess = (moduleName: string) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Check if user is authenticated
      if (!req.user || !req.user.id) {
        throw new ApiError(401, 'Not authenticated');
      }

      // Check if user is an admin (admins have access to all modules)
      if (req.user.role === 'admin') {
        // Track usage for analytics but allow access
        await trackUserModuleUsage(req.user.id, moduleName);
        return next();
      }

      // Check if user has access to this module
      const hasAccess = await checkModuleAccess(req.user.id, moduleName);

      if (!hasAccess) {
        throw new ApiError(403, `Your subscription does not include access to the ${moduleName} module`);
      }

      // Track module usage
      await trackUserModuleUsage(req.user.id, moduleName);
      
      // Continue with the request
      next();
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else {
        logger.error(`Module access error: ${error}`);
        next(new ApiError(500, 'Error checking module access'));
      }
    }
  };
};

/**
 * Rate limit API requests based on subscription tier
 * @returns Middleware function
 */
export const subscriptionRateLimit = () => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Check if user is authenticated
      if (!req.user || !req.user.id) {
        throw new ApiError(401, 'Not authenticated');
      }

      // Check if user is an admin (admins bypass rate limits)
      if (req.user.role === 'admin') {
        // Still track usage for analytics
        await trackUserApiUsage(req.user.id);
        return next();
      }

      // Check if user has reached API rate limit
      const hasReachedLimit = await checkApiLimit(req.user.id);

      if (hasReachedLimit) {
        throw new ApiError(429, 'You have reached your API rate limit. Please upgrade your subscription or try again later.');
      }

      // Track API usage
      await trackUserApiUsage(req.user.id);
      
      // Continue with the request
      next();
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else {
        logger.error(`Rate limit error: ${error}`);
        next(new ApiError(500, 'Error checking rate limit'));
      }
    }
  };
};

export default {
  requireModuleAccess,
  subscriptionRateLimit
};
/**
 * Credit Middleware
 * 
 * This middleware handles credit checking and deduction for API usage.
 * It ensures users have sufficient credits before allowing access to credit-consuming endpoints.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import creditService from '../services/credit/creditService';
import { ApiError } from '../utils/apiError';

/**
 * Check if user has enough credits for a service
 * @param serviceKey Service key
 * @param units Number of units to be used
 */
export const checkCredits = (serviceKey: string, units: number = 1) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get user ID from request
      const userId = req.user?.id;
      
      if (!userId) {
        return next(new ApiError(401, 'Unauthorized'));
      }
      
      // Check if user has enough credits
      const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
        userId,
        serviceKey,
        units
      );
      
      if (!hasEnoughCredits) {
        return next(
          new ApiError(
            402, 
            'Insufficient credits', 
            'You do not have enough credits to perform this action. Please purchase more credits.'
          )
        );
      }
      
      // Store service info in request for later use
      req.creditInfo = {
        serviceKey,
        units,
        userId
      };
      
      next();
    } catch (error) {
      logger.error(`Error in credit middleware: ${error}`);
      next(new ApiError(500, 'Failed to check credits'));
    }
  };
};

/**
 * Deduct credits after successful API call
 * This middleware should be used after the main handler
 * @param description Description for the credit transaction
 */
export const deductCredits = (description: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get credit info from request
      const creditInfo = req.creditInfo;
      
      if (!creditInfo) {
        logger.warn('Credit info not found in request');
        return next();
      }
      
      // Deduct credits
      await creditService.useServiceCredits(
        creditInfo.userId,
        creditInfo.serviceKey,
        creditInfo.units,
        description,
        { 
          endpoint: req.originalUrl,
          method: req.method,
          responseStatus: res.statusCode
        }
      );
      
      next();
    } catch (error) {
      logger.error(`Error deducting credits: ${error}`);
      // Continue even if credit deduction fails to avoid blocking the response
      next();
    }
  };
};

// Extend Express Request interface to include credit info
declare global {
  namespace Express {
    interface Request {
      creditInfo?: {
        serviceKey: string;
        units: number;
        userId: string;
      };
    }
  }
}

export default {
  checkCredits,
  deductCredits
};

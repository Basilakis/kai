/**
 * API Credit Middleware
 * 
 * This middleware handles credit checking and deduction for third-party API requests.
 * It ensures users have sufficient credits before allowing access to third-party APIs
 * and deducts credits based on actual usage after the request is complete.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import creditService from '../services/credit/creditService';
import { ApiError } from '../utils/apiError';

/**
 * Check if user has enough credits for a third-party API request
 * @param serviceKey Service key (e.g., 'openai.gpt-4')
 * @param estimatedUnits Estimated number of units to be used
 */
export const checkApiCredits = (serviceKey: string, estimatedUnits: number = 1) => {
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
        estimatedUnits
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
      
      // Store API info in request for later use
      req.apiCreditInfo = {
        serviceKey,
        estimatedUnits,
        userId,
        startTime: Date.now()
      };
      
      // Create a custom end function to track API usage
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any, callback?: any) {
        try {
          // Track API usage after response is sent
          const apiCreditInfo = req.apiCreditInfo;
          
          if (apiCreditInfo) {
            // Calculate actual units used (this would be replaced with actual calculation)
            const actualUnits = apiCreditInfo.estimatedUnits;
            
            // Deduct credits asynchronously (don't wait for it to complete)
            creditService.useServiceCredits(
              apiCreditInfo.userId,
              apiCreditInfo.serviceKey,
              actualUnits,
              `${apiCreditInfo.serviceKey} API usage`,
              { 
                endpoint: req.originalUrl,
                method: req.method,
                responseStatus: res.statusCode,
                duration: Date.now() - apiCreditInfo.startTime
              }
            ).catch(error => {
              logger.error(`Error deducting credits for API usage: ${error}`);
            });
          }
        } catch (error) {
          logger.error(`Error in API credit tracking: ${error}`);
        }
        
        // Call the original end function
        return originalEnd.call(this, chunk, encoding, callback);
      };
      
      next();
    } catch (error) {
      logger.error(`Error in API credit middleware: ${error}`);
      next(new ApiError(500, 'Failed to check API credits'));
    }
  };
};

/**
 * Track actual API usage and deduct credits
 * This function should be called after the API request is complete
 * with the actual usage information
 * @param req Request
 * @param actualUnits Actual number of units used
 * @param additionalMetadata Additional metadata to store with the transaction
 */
export const trackApiUsage = async (
  req: Request,
  actualUnits: number,
  additionalMetadata: Record<string, any> = {}
): Promise<void> => {
  try {
    const apiCreditInfo = req.apiCreditInfo;
    
    if (!apiCreditInfo) {
      logger.warn('API credit info not found in request');
      return;
    }
    
    // Deduct credits based on actual usage
    await creditService.useServiceCredits(
      apiCreditInfo.userId,
      apiCreditInfo.serviceKey,
      actualUnits,
      `${apiCreditInfo.serviceKey} API usage`,
      { 
        ...additionalMetadata,
        endpoint: req.originalUrl,
        method: req.method,
        duration: Date.now() - apiCreditInfo.startTime
      }
    );
  } catch (error) {
    logger.error(`Error tracking API usage: ${error}`);
  }
};

// Extend Express Request interface to include API credit info
declare global {
  namespace Express {
    interface Request {
      apiCreditInfo?: {
        serviceKey: string;
        estimatedUnits: number;
        userId: string;
        startTime: number;
      };
    }
  }
}

export default {
  checkApiCredits,
  trackApiUsage
};

/**
 * Credit Top-up Controller
 * 
 * This controller handles API endpoints for credit top-up management,
 * including automatic top-up settings and manual top-ups.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { ApiError } from '../../middleware/error.middleware';
import autoTopupService from '../../services/credit/autoTopup.service';
import bulkPurchaseService from '../../services/credit/bulkPurchase.service';
import { getUserCreditBalance } from '../../models/userCredit.model';

/**
 * Get credit top-up setting for the current user
 * @route GET /api/credits/topup/settings
 * @access Private
 */
export const getTopupSetting = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // Get top-up setting
    const setting = await autoTopupService.getTopupSetting(userId);
    
    // Get credit balance
    const balance = await getUserCreditBalance(userId);
    
    res.status(200).json({
      success: true,
      data: {
        setting,
        creditBalance: balance
      }
    });
  } catch (error) {
    logger.error(`Error getting top-up setting: ${error}`);
    throw new ApiError(500, 'Failed to get top-up setting');
  }
};

/**
 * Create or update credit top-up setting
 * @route POST /api/credits/topup/settings
 * @access Private
 */
export const createOrUpdateTopupSetting = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { 
      isEnabled, 
      thresholdAmount, 
      topupAmount, 
      maxMonthlySpend, 
      paymentMethodId,
      metadata 
    } = req.body;
    
    if (isEnabled === undefined) {
      throw new ApiError(400, 'isEnabled is required');
    }
    
    if (thresholdAmount === undefined || thresholdAmount < 0) {
      throw new ApiError(400, 'thresholdAmount is required and must be non-negative');
    }
    
    if (!topupAmount || topupAmount <= 0) {
      throw new ApiError(400, 'topupAmount is required and must be positive');
    }
    
    if (maxMonthlySpend !== undefined && maxMonthlySpend <= 0) {
      throw new ApiError(400, 'maxMonthlySpend must be positive');
    }
    
    // If enabling top-up, payment method is required
    if (isEnabled && !paymentMethodId) {
      throw new ApiError(400, 'paymentMethodId is required when enabling auto top-up');
    }
    
    // Create or update setting
    const setting = await autoTopupService.createOrUpdateTopupSetting(
      userId,
      isEnabled,
      thresholdAmount,
      topupAmount,
      maxMonthlySpend,
      paymentMethodId,
      metadata
    );
    
    res.status(200).json({
      success: true,
      message: 'Top-up setting updated successfully',
      data: setting
    });
  } catch (error) {
    logger.error(`Error updating top-up setting: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to update top-up setting');
  }
};

/**
 * Delete credit top-up setting
 * @route DELETE /api/credits/topup/settings
 * @access Private
 */
export const deleteTopupSetting = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    await autoTopupService.deleteTopupSetting(userId);
    
    res.status(200).json({
      success: true,
      message: 'Top-up setting deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting top-up setting: ${error}`);
    throw new ApiError(500, 'Failed to delete top-up setting');
  }
};

/**
 * Get credit top-up history for the current user
 * @route GET /api/credits/topup/history
 * @access Private
 */
export const getTopupHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    
    const history = await autoTopupService.getTopupHistory(userId, limit, offset);
    
    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error(`Error getting top-up history: ${error}`);
    throw new ApiError(500, 'Failed to get top-up history');
  }
};

/**
 * Trigger a manual top-up
 * @route POST /api/credits/topup/manual
 * @access Private
 */
export const manualTopup = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { creditAmount, paymentMethodId, metadata } = req.body;
    
    if (!creditAmount || creditAmount <= 0) {
      throw new ApiError(400, 'creditAmount is required and must be positive');
    }
    
    if (!paymentMethodId) {
      throw new ApiError(400, 'paymentMethodId is required');
    }
    
    // Process the purchase
    const result = await bulkPurchaseService.purchaseCredits(
      userId,
      creditAmount,
      paymentMethodId,
      {
        isManualTopup: true,
        ...metadata
      }
    );
    
    res.status(200).json({
      success: true,
      message: `Successfully purchased ${creditAmount} credits`,
      data: result
    });
  } catch (error) {
    logger.error(`Error processing manual top-up: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to process manual top-up');
  }
};

/**
 * Check if the user needs a top-up and process it if needed
 * @route POST /api/credits/topup/check
 * @access Private
 */
export const checkAndProcessTopup = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // Check if user needs a top-up
    const { needsTopup, setting } = await autoTopupService.checkUserNeedsTopup(userId);
    
    if (!needsTopup || !setting) {
      res.status(200).json({
        success: true,
        needsTopup: false,
        message: 'No top-up needed at this time'
      });
      return;
    }
    
    // Process the top-up
    const result = await autoTopupService.processTopup(userId, setting.id, setting);
    
    res.status(200).json({
      success: true,
      needsTopup: true,
      message: result.status === 'completed' 
        ? `Successfully topped up ${result.creditAmount} credits` 
        : 'Failed to process top-up',
      data: result
    });
  } catch (error) {
    logger.error(`Error checking and processing top-up: ${error}`);
    throw new ApiError(500, 'Failed to check and process top-up');
  }
};

export default {
  getTopupSetting,
  createOrUpdateTopupSetting,
  deleteTopupSetting,
  getTopupHistory,
  manualTopup,
  checkAndProcessTopup
};

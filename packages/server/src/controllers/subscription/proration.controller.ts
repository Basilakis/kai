/**
 * Proration Controller
 * 
 * This controller handles API endpoints for subscription proration,
 * including previewing and applying prorated subscription changes.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { ApiError } from '../../middleware/error.middleware';
import proratedBillingService from '../../services/billing/proratedBilling.service';
import { getSubscriptionTierById } from '../../models/subscriptionTier.model';
import { getUserSubscription } from '../../models/userSubscription.model';

/**
 * Preview a subscription change with proration
 * @route GET /api/subscriptions/proration/preview
 * @access Private
 */
export const previewProration = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { tierId, prorationDate } = req.query;
    
    if (!tierId) {
      throw new ApiError(400, 'Subscription tier ID is required');
    }
    
    // Get current subscription
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      throw new ApiError(404, 'You do not have an active subscription');
    }
    
    // Check if the new tier exists
    const newTier = await getSubscriptionTierById(tierId as string);
    
    if (!newTier) {
      throw new ApiError(404, 'Subscription tier not found');
    }
    
    // Check if the new tier is the same as the current tier
    if (subscription.tierId === tierId) {
      throw new ApiError(400, 'You are already subscribed to this tier');
    }
    
    // Preview the subscription change
    const preview = await proratedBillingService.previewSubscriptionChange(
      userId,
      tierId as string,
      prorationDate ? parseInt(prorationDate as string, 10) : undefined
    );
    
    res.status(200).json({
      success: true,
      data: {
        currentTier: subscription.tierId,
        newTier: tierId,
        prorationDate: preview.prorationDate,
        currentPeriodEnd: preview.currentPeriodEnd,
        currentAmount: preview.currentAmount / 100, // Convert to dollars
        newAmount: preview.newAmount / 100, // Convert to dollars
        proratedAmount: preview.proratedAmount / 100, // Convert to dollars
        totalAmount: preview.totalAmount / 100, // Convert to dollars
        isUpgrade: preview.isUpgrade,
        isCredit: preview.isCredit
      }
    });
  } catch (error) {
    logger.error(`Error previewing proration: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to preview subscription change');
  }
};

/**
 * Apply a prorated subscription change
 * @route POST /api/subscriptions/proration/apply
 * @access Private
 */
export const applyProration = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { tierId, prorationDate } = req.body;
    
    if (!tierId) {
      throw new ApiError(400, 'Subscription tier ID is required');
    }
    
    // Get current subscription
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      throw new ApiError(404, 'You do not have an active subscription');
    }
    
    // Check if the new tier exists
    const newTier = await getSubscriptionTierById(tierId);
    
    if (!newTier) {
      throw new ApiError(404, 'Subscription tier not found');
    }
    
    // Check if the new tier is the same as the current tier
    if (subscription.tierId === tierId) {
      throw new ApiError(400, 'You are already subscribed to this tier');
    }
    
    // Apply the subscription change
    await proratedBillingService.applyProratedChange(
      userId,
      tierId,
      prorationDate
    );
    
    res.status(200).json({
      success: true,
      message: 'Subscription updated successfully',
      data: {
        previousTier: subscription.tierId,
        newTier: tierId
      }
    });
  } catch (error) {
    logger.error(`Error applying proration: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to update subscription');
  }
};

export default {
  previewProration,
  applyProration
};

/**
 * Prorated Billing Service
 * 
 * This service provides functionality for calculating prorated amounts
 * for subscription changes, including upgrades, downgrades, and mid-cycle changes.
 */

import { logger } from '../../utils/logger';
import { getUserSubscription } from '../../models/userSubscription.model';
import { getSubscriptionTierById } from '../../models/subscriptionTier.model';
import stripeService from '../payment/stripeService';

/**
 * Proration result
 */
export interface ProrationResult {
  prorationDate: number; // Unix timestamp
  currentPeriodEnd: number; // Unix timestamp
  currentAmount: number; // Current subscription amount in cents
  newAmount: number; // New subscription amount in cents
  proratedAmount: number; // Prorated amount in cents (can be positive or negative)
  totalAmount: number; // Total amount to charge/credit in cents
  isUpgrade: boolean; // Whether this is an upgrade or downgrade
  isCredit: boolean; // Whether this results in a credit (negative amount)
  preview: any; // Stripe proration preview
}

/**
 * Calculate prorated amount for a subscription change
 * @param userId User ID
 * @param newTierId New subscription tier ID
 * @param prorationDate Proration date (defaults to now)
 * @returns Proration result
 */
export async function calculateProration(
  userId: string,
  newTierId: string,
  prorationDate?: number
): Promise<ProrationResult> {
  try {
    // Get current subscription
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      throw new Error('User does not have an active subscription');
    }
    
    if (!subscription.stripeSubscriptionId) {
      throw new Error('Subscription is not linked to Stripe');
    }
    
    // Get current and new tiers
    const currentTier = await getSubscriptionTierById(subscription.tierId);
    const newTier = await getSubscriptionTierById(newTierId);
    
    if (!currentTier || !newTier) {
      throw new Error('Invalid subscription tier');
    }
    
    // Use Stripe to calculate proration
    const prorationResult = await stripeService.calculateProration(
      subscription.stripeSubscriptionId,
      newTier.stripePriceId!,
      prorationDate
    );
    
    // Determine if this is an upgrade or downgrade
    const isUpgrade = newTier.price > currentTier.price;
    
    // Calculate amounts
    const currentAmount = currentTier.price * 100; // Convert to cents
    const newAmount = newTier.price * 100; // Convert to cents
    const proratedAmount = prorationResult.proratedAmount;
    const totalAmount = prorationResult.totalAmount;
    const isCredit = totalAmount < 0;
    
    return {
      prorationDate: prorationResult.prorationDate,
      currentPeriodEnd: prorationResult.currentPeriodEnd,
      currentAmount,
      newAmount,
      proratedAmount,
      totalAmount,
      isUpgrade,
      isCredit,
      preview: prorationResult.preview
    };
  } catch (error) {
    logger.error(`Failed to calculate proration: ${error}`);
    throw error;
  }
}

/**
 * Apply prorated subscription change
 * @param userId User ID
 * @param newTierId New subscription tier ID
 * @param prorationDate Proration date (defaults to now)
 * @returns Updated subscription
 */
export async function applyProratedChange(
  userId: string,
  newTierId: string,
  prorationDate?: number
): Promise<any> {
  try {
    // Get current subscription
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      throw new Error('User does not have an active subscription');
    }
    
    if (!subscription.stripeSubscriptionId) {
      throw new Error('Subscription is not linked to Stripe');
    }
    
    // Get new tier
    const newTier = await getSubscriptionTierById(newTierId);
    
    if (!newTier || !newTier.stripePriceId) {
      throw new Error('Invalid subscription tier or missing Stripe price ID');
    }
    
    // Apply the change in Stripe
    const updatedSubscription = await stripeService.updateSubscription(
      subscription.stripeSubscriptionId,
      newTier.stripePriceId,
      prorationDate
    );
    
    // Update the subscription in our database
    // This will be handled by the webhook handler when Stripe sends the update event
    
    return updatedSubscription;
  } catch (error) {
    logger.error(`Failed to apply prorated change: ${error}`);
    throw error;
  }
}

/**
 * Preview subscription change without applying it
 * @param userId User ID
 * @param newTierId New subscription tier ID
 * @param prorationDate Proration date (defaults to now)
 * @returns Proration preview
 */
export async function previewSubscriptionChange(
  userId: string,
  newTierId: string,
  prorationDate?: number
): Promise<ProrationResult> {
  try {
    return await calculateProration(userId, newTierId, prorationDate);
  } catch (error) {
    logger.error(`Failed to preview subscription change: ${error}`);
    throw error;
  }
}

export default {
  calculateProration,
  applyProratedChange,
  previewSubscriptionChange
};

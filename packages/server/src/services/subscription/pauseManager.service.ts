/**
 * Subscription Pause Manager Service
 * 
 * This service provides functionality for pausing and resuming subscriptions,
 * including handling billing adjustments for paused subscriptions.
 */

import { logger } from '../../utils/logger';
import { getUserSubscription, updateUserSubscription } from '../../models/userSubscription.model';
import stripeService from '../payment/stripeService';

/**
 * Pause options
 */
export interface PauseOptions {
  resumeAt?: Date; // Date to automatically resume the subscription
  reason?: string; // Reason for pausing
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Pause a subscription
 * @param userId User ID
 * @param options Pause options
 * @returns Updated subscription
 */
export async function pauseSubscription(
  userId: string,
  options: PauseOptions = {}
): Promise<any> {
  try {
    // Get current subscription
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      throw new Error('User does not have an active subscription');
    }
    
    if (subscription.status === 'paused') {
      throw new Error('Subscription is already paused');
    }
    
    if (!subscription.stripeSubscriptionId) {
      throw new Error('Subscription is not linked to Stripe');
    }
    
    // Pause the subscription in Stripe
    const pausedSubscription = await stripeService.pauseSubscription(
      subscription.stripeSubscriptionId,
      options.resumeAt
    );
    
    // Update the subscription in our database
    const updates = {
      status: 'paused' as const,
      metadata: {
        ...subscription.metadata,
        pausedAt: new Date(),
        pauseReason: options.reason,
        scheduledResumeAt: options.resumeAt,
        ...options.metadata
      }
    };
    
    const updatedSubscription = await updateUserSubscription(
      subscription.id,
      updates
    );
    
    return {
      subscription: updatedSubscription,
      stripeSubscription: pausedSubscription
    };
  } catch (error) {
    logger.error(`Failed to pause subscription: ${error}`);
    throw error;
  }
}

/**
 * Resume a paused subscription
 * @param userId User ID
 * @param metadata Additional metadata
 * @returns Updated subscription
 */
export async function resumeSubscription(
  userId: string,
  metadata?: Record<string, any>
): Promise<any> {
  try {
    // Get current subscription
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      throw new Error('User does not have an active subscription');
    }
    
    if (subscription.status !== 'paused') {
      throw new Error('Subscription is not paused');
    }
    
    if (!subscription.stripeSubscriptionId) {
      throw new Error('Subscription is not linked to Stripe');
    }
    
    // Resume the subscription in Stripe
    const resumedSubscription = await stripeService.resumeSubscription(
      subscription.stripeSubscriptionId
    );
    
    // Update the subscription in our database
    const subscriptionMetadata = subscription.metadata || {};
    const updates = {
      status: 'active' as const,
      metadata: {
        ...subscriptionMetadata,
        resumedAt: new Date(),
        pauseDuration: subscriptionMetadata.pausedAt 
          ? Math.floor((Date.now() - new Date(subscriptionMetadata.pausedAt).getTime()) / (1000 * 60 * 60 * 24)) 
          : null,
        ...metadata
      }
    };
    
    // Remove scheduled resume date if it exists
    if (updates.metadata.scheduledResumeAt) {
      delete updates.metadata.scheduledResumeAt;
    }
    
    const updatedSubscription = await updateUserSubscription(
      subscription.id,
      updates
    );
    
    return {
      subscription: updatedSubscription,
      stripeSubscription: resumedSubscription
    };
  } catch (error) {
    logger.error(`Failed to resume subscription: ${error}`);
    throw error;
  }
}

/**
 * Get pause history for a subscription
 * @param userId User ID
 * @returns Pause history
 */
export async function getPauseHistory(userId: string): Promise<any[]> {
  try {
    // Get current subscription
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      throw new Error('User does not have an active subscription');
    }
    
    // Get pause history from Stripe
    if (subscription.stripeSubscriptionId) {
      return await stripeService.getSubscriptionPauseHistory(
        subscription.stripeSubscriptionId
      );
    }
    
    return [];
  } catch (error) {
    logger.error(`Failed to get pause history: ${error}`);
    throw error;
  }
}

/**
 * Check for subscriptions that need to be resumed
 * @returns Number of subscriptions resumed
 */
export async function processScheduledResumes(): Promise<number> {
  try {
    const now = new Date();
    
    // Find subscriptions that need to be resumed
    const { data, error } = await supabaseClient.getClient()
      .from('user_subscriptions')
      .select('*')
      .eq('status', 'paused')
      .lt('metadata->scheduledResumeAt', now.toISOString());
    
    if (error) {
      throw error;
    }
    
    if (!data || data.length === 0) {
      return 0;
    }
    
    // Resume each subscription
    let resumedCount = 0;
    
    for (const subscription of data) {
      try {
        await resumeSubscription(subscription.userId, {
          autoResumed: true,
          scheduledResumeAt: subscription.metadata?.scheduledResumeAt
        });
        
        resumedCount++;
      } catch (error) {
        logger.error(`Failed to auto-resume subscription ${subscription.id}: ${error}`);
      }
    }
    
    return resumedCount;
  } catch (error) {
    logger.error(`Failed to process scheduled resumes: ${error}`);
    throw error;
  }
}

/**
 * Schedule periodic checking for subscriptions that need to be resumed
 * @param intervalMinutes Interval in minutes
 */
export function scheduleResumeChecks(intervalMinutes: number = 60): void {
  setInterval(async () => {
    try {
      const count = await processScheduledResumes();
      if (count > 0) {
        logger.info(`Auto-resumed ${count} subscriptions`);
      }
    } catch (error) {
      logger.error(`Failed to process scheduled resumes: ${error}`);
    }
  }, intervalMinutes * 60 * 1000);
}

export default {
  pauseSubscription,
  resumeSubscription,
  getPauseHistory,
  processScheduledResumes,
  scheduleResumeChecks
};

/**
 * User Subscription Model
 *
 * This model handles user subscriptions to different pricing tiers,
 * managing access levels, module permissions, and API usage limits.
 * It also integrates with Stripe for payment processing.
 */

import { supabaseClient } from '../services/supabase/supabaseClient';
import { logger } from '../utils/logger';
import stripeService from '../services/payment/stripeService';
// Removed unused import: import { Subscription } from '@kai/shared';

/**
 * Represents user subscription usage metrics
 */
export interface SubscriptionUsage {
  apiRequests: {
    count: number;              // Current count of API requests
    lastResetDate: Date;        // Date of last reset
    resetPeriod: 'day' | 'month'; // Reset period
  };
  moduleUsage: {
    [moduleName: string]: {     // Module-specific usage
      count: number;            // Usage count
      lastUsedDate: Date;       // Last used date
    };
  };
}

/**
 * Represents a user subscription
 */
export interface UserSubscription {
  id: string;                   // Unique ID
  userId: string;               // User ID
  tierId: string;               // Subscription tier ID
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'paused'; // Subscription status
  startDate: Date;              // Start date
  endDate?: Date;               // End date (null for ongoing subscriptions)
  renewalDate?: Date;           // Next renewal date
  canceledAt?: Date;            // Cancellation date
  trialEndDate?: Date;          // Trial end date
  paymentMethod?: string;       // Payment method
  paymentId?: string;           // Payment ID (e.g., Stripe subscription ID)
  stripeCustomerId?: string;    // Stripe customer ID
  stripeSubscriptionId?: string; // Stripe subscription ID
  stripePriceId?: string;       // Stripe price ID
  stripePaymentMethodId?: string; // Stripe payment method ID
  currentPeriodStart?: Date;    // Current billing period start
  currentPeriodEnd?: Date;      // Current billing period end
  cancelAtPeriodEnd?: boolean;  // Whether subscription will cancel at period end
  autoRenew: boolean;           // Auto-renew flag
  usage: SubscriptionUsage;     // Usage metrics
  createdAt: Date;              // Creation date
  updatedAt: Date;              // Last update date
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Get user subscription by user ID
 * @param userId User ID
 * @returns User subscription or null if not found
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  try {
    // Type assertion applied earlier in the chain
    const { data, error } = await (supabaseClient.getClient()
      .from('user_subscriptions') as any)
      .select('*')
      .eq('userId', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Record not found
        return null;
      }
      logger.error(`Error fetching user subscription: ${error.message}`);
      throw error;
    }

    return data;
  } catch (error) {
    logger.error(`Failed to get user subscription: ${error}`);
    return null;
  }
}

/**
 * Create a user subscription
 * @param subscriptionData User subscription data
 * @returns Created user subscription
 */
export async function createUserSubscription(
  subscriptionData: Omit<UserSubscription, 'id' | 'createdAt' | 'updatedAt'>
): Promise<UserSubscription> {
  try {
    const newSubscription = {
      ...subscriptionData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Type assertion applied earlier in the chain
    const { data, error } = await (supabaseClient.getClient()
      .from('user_subscriptions') as any)
      .insert([newSubscription])
      .select();

    if (error) {
      logger.error(`Error creating user subscription: ${error.message}`);
      throw error;
    }

    return data[0];
  } catch (error) {
    logger.error(`Failed to create user subscription: ${error}`);
    throw error;
  }
}

/**
 * Update a user subscription
 * @param id Subscription ID
 * @param subscriptionData Updated subscription data
 * @returns Updated user subscription
 */
export async function updateUserSubscription(
  id: string,
  subscriptionData: Partial<Omit<UserSubscription, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<UserSubscription> {
  try {
    const updates = {
      ...subscriptionData,
      updatedAt: new Date()
    };

    // Type assertion applied earlier in the chain
    const { data, error } = await (supabaseClient.getClient()
      .from('user_subscriptions') as any)
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      logger.error(`Error updating user subscription: ${error.message}`);
      throw error;
    }

    return data[0];
  } catch (error) {
    logger.error(`Failed to update user subscription: ${error}`);
    throw error;
  }
}

/**
 * Track API request usage for a user
 * @param userId User ID
 * @returns Updated usage count
 */
export async function trackApiUsage(userId: string): Promise<number> {
  try {
    // Get user subscription
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      logger.error(`User subscription not found for user: ${userId}`);
      throw new Error(`User subscription not found for user: ${userId}`);
    }

    // Check if usage needs to be reset
    let { apiRequests } = subscription.usage;
    const now = new Date();
    let resetNeeded = false;

    if (apiRequests.resetPeriod === 'day') {
      // Check if last reset was on a different day
      resetNeeded = new Date(apiRequests.lastResetDate).getDate() !== now.getDate() ||
                    new Date(apiRequests.lastResetDate).getMonth() !== now.getMonth() ||
                    new Date(apiRequests.lastResetDate).getFullYear() !== now.getFullYear();
    } else if (apiRequests.resetPeriod === 'month') {
      // Check if last reset was in a different month
      resetNeeded = new Date(apiRequests.lastResetDate).getMonth() !== now.getMonth() ||
                    new Date(apiRequests.lastResetDate).getFullYear() !== now.getFullYear();
    }

    // Reset if needed
    if (resetNeeded) {
      apiRequests = {
        count: 1, // This is the current request
        lastResetDate: now,
        resetPeriod: apiRequests.resetPeriod
      };
    } else {
      // Increment count
      apiRequests.count += 1;
    }

    // Update usage
    const usage = {
      ...subscription.usage,
      apiRequests
    };

    // Update subscription
    await updateUserSubscription(subscription.id, { usage });

    return apiRequests.count;
  } catch (error) {
    logger.error(`Failed to track API usage: ${error}`);
    // Return a default value to prevent blocking API access due to tracking failure
    return 0;
  }
}

/**
 * Track module usage for a user
 * @param userId User ID
 * @param moduleName Module name
 * @returns Updated usage count
 */
export async function trackModuleUsage(userId: string, moduleName: string): Promise<number> {
  try {
    // Get user subscription
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      logger.error(`User subscription not found for user: ${userId}`);
      throw new Error(`User subscription not found for user: ${userId}`);
    }

    // Update module usage
    const now = new Date();
    const moduleUsage = { ...subscription.usage.moduleUsage };

    if (!moduleUsage[moduleName]) {
      moduleUsage[moduleName] = {
        count: 0,
        lastUsedDate: now
      };
    }

    moduleUsage[moduleName].count += 1;
    moduleUsage[moduleName].lastUsedDate = now;

    // Update usage
    const usage = {
      ...subscription.usage,
      moduleUsage
    };

    // Update subscription
    await updateUserSubscription(subscription.id, { usage });

    return moduleUsage[moduleName].count;
  } catch (error) {
    logger.error(`Failed to track module usage: ${error}`);
    // Return a default value to prevent blocking module access due to tracking failure
    return 0;
  }
}

/**
 * Check if user has access to a module
 * @param userId User ID
 * @param moduleName Module name
 * @returns True if user has access to the module
 */
export async function hasModuleAccess(userId: string, moduleName: string): Promise<boolean> {
  try {
    // Get user subscription
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      logger.warn(`User subscription not found for user: ${userId}`);
      return false;
    }

    // Get subscription tier
    // Type assertion applied earlier in the chain
    const { data: tier, error } = await (supabaseClient.getClient()
      .from('subscription_tiers') as any)
      .select('*')
      .eq('id', subscription.tierId)
      .single();

    if (error || !tier) {
      logger.error(`Error fetching subscription tier: ${error?.message || 'Tier not found'}`);
      return false;
    }

    // Check if module is enabled
    const moduleAccess = tier.moduleAccess.find((module: any) => module.name === moduleName);

    if (!moduleAccess) {
      return false;
    }

    return moduleAccess.enabled;
  } catch (error) {
    logger.error(`Failed to check module access: ${error}`);
    return false;
  }
}

/**
 * Check if user has reached API rate limit
 * @param userId User ID
 * @returns True if user has reached rate limit
 */
export async function hasReachedApiLimit(userId: string): Promise<boolean> {
  try {
    // Get user subscription
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      logger.warn(`User subscription not found for user: ${userId}`);
      // Default to true (rate limit reached) for safety
      return true;
    }

    // Get subscription tier
    // Type assertion applied earlier in the chain
    const { data: tier, error } = await (supabaseClient.getClient()
      .from('subscription_tiers') as any)
      .select('*')
      .eq('id', subscription.tierId)
      .single();

    if (error || !tier) {
      logger.error(`Error fetching subscription tier: ${error?.message || 'Tier not found'}`);
      // Default to true (rate limit reached) for safety
      return true;
    }

    // Check rate limits
    const { apiLimits } = tier;
    const { apiRequests } = subscription.usage;

    // Check if subscription is active
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      logger.warn(`User subscription is not active: ${subscription.status}`);
      return true;
    }

    // Check daily limit
    if (apiRequests.resetPeriod === 'day' && apiRequests.count >= apiLimits.requestsPerDay) {
      return true;
    }

    // Check monthly limit
    if (apiRequests.resetPeriod === 'month' && apiRequests.count >= apiLimits.requestsPerMonth) {
      return true;
    }

    return false;
  } catch (error) {
    logger.error(`Failed to check API limit: ${error}`);
    // Default to false (no rate limit) to prevent blocking access due to checking failure
    return false;
  }
}

/**
 * Get default free tier subscription
 * @param userId User ID
 * @returns Default free tier subscription
 */
export async function createDefaultSubscription(userId: string): Promise<UserSubscription> {
  try {
    // Get the free tier
    // Type assertion applied earlier in the chain
    const { data: freeTier, error } = await (supabaseClient.getClient()
      .from('subscription_tiers') as any)
      .select('*')
      .eq('price', 0)
      .single();

    if (error || !freeTier) {
      logger.error(`Error fetching free tier: ${error?.message || 'Free tier not found'}`);
      throw new Error(`Error fetching free tier: ${error?.message || 'Free tier not found'}`);
    }

    // Create default subscription
    const now = new Date();
    const subscription: Omit<UserSubscription, 'id' | 'createdAt' | 'updatedAt'> = {
      userId,
      tierId: freeTier.id,
      status: 'active',
      startDate: now,
      autoRenew: true,
      usage: {
        apiRequests: {
          count: 0,
          lastResetDate: now,
          resetPeriod: 'month'
        },
        moduleUsage: {}
      }
    };

    return await createUserSubscription(subscription);
  } catch (error) {
    logger.error(`Failed to create default subscription: ${error}`);
    throw error;
  }
}

/**
 * Create a Stripe customer for a user
 * @param userId User ID
 * @param email User email
 * @param name User name
 * @returns Stripe customer ID
 */
export async function createStripeCustomer(
  userId: string,
  email: string,
  name?: string
): Promise<string> {
  try {
    // Check if Stripe is configured
    if (!stripeService.isStripeConfigured()) {
      logger.warn('Stripe is not configured. Skipping customer creation.');
      return '';
    }

    // Create Stripe customer
    const customer = await stripeService.createCustomer(email, name, { userId });

    // Get user subscription
    const subscription = await getUserSubscription(userId);

    // Update subscription with Stripe customer ID if it exists
    if (subscription) {
      await updateUserSubscription(subscription.id, {
        stripeCustomerId: customer.id
      });
    }

    return customer.id;
  } catch (error) {
    logger.error(`Failed to create Stripe customer: ${error}`);
    throw error;
  }
}

/**
 * Subscribe user to a paid plan
 * @param userId User ID
 * @param tierId Subscription tier ID
 * @param paymentMethodId Stripe payment method ID
 * @param options Subscription options
 * @returns Updated user subscription
 */
export async function subscribeToPaidPlan(
  userId: string,
  tierId: string,
  paymentMethodId: string,
  options: {
    trialDays?: number;
    metadata?: Record<string, any>;
  } = {}
): Promise<UserSubscription> {
  try {
    // Check if Stripe is configured
    if (!stripeService.isStripeConfigured()) {
      throw new Error('Stripe is not configured. Cannot subscribe to paid plan.');
    }

    // Get user subscription
    let subscription = await getUserSubscription(userId);

    // Get subscription tier
    // Type assertion applied earlier in the chain
    const { data: tier, error } = await (supabaseClient.getClient()
      .from('subscription_tiers') as any)
      .select('*')
      .eq('id', tierId)
      .single();

    if (error || !tier) {
      throw new Error(`Subscription tier not found: ${tierId}`);
    }

    // Check if tier has a Stripe price ID
    if (!tier.stripePriceId) {
      throw new Error(`Subscription tier does not have a Stripe price ID: ${tierId}`);
    }

    // Get or create Stripe customer
    let stripeCustomerId = subscription?.stripeCustomerId;

    if (!stripeCustomerId) {
      // Get user email from Supabase
      const { data: user, error: userError } = await (supabaseClient.getClient()
        .from('users') as any)
        .select('email, first_name, last_name')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Create Stripe customer
      const customer = await stripeService.createCustomer(
        user.email,
        user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : undefined,
        { userId }
      );

      stripeCustomerId = customer.id;
    }

    // Attach payment method to customer
    await stripeService.attachPaymentMethod(stripeCustomerId, paymentMethodId, true);

    // Create Stripe subscription
    const stripeSubscription = await stripeService.createSubscription(
      stripeCustomerId,
      tier.stripePriceId,
      {
        trialPeriodDays: options.trialDays,
        metadata: { ...options.metadata, userId, tierId },
        paymentBehavior: 'error_if_incomplete'
      }
    );

    // Update or create user subscription
    const now = new Date();
    const subscriptionData: Partial<Omit<UserSubscription, 'id' | 'createdAt' | 'updatedAt'>> = {
      tierId,
      status: stripeSubscription.status as UserSubscription['status'],
      startDate: new Date(stripeSubscription.start_date * 1000),
      renewalDate: new Date(stripeSubscription.current_period_end * 1000),
      trialEndDate: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : undefined,
      stripeCustomerId,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: tier.stripePriceId,
      stripePaymentMethodId: paymentMethodId,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      autoRenew: !stripeSubscription.cancel_at_period_end,
      metadata: options.metadata
    };

    if (subscription) {
      // Update existing subscription
      subscription = await updateUserSubscription(subscription.id, subscriptionData);
    } else {
      // Create new subscription
      subscription = await createUserSubscription({
        userId,
        tierId,
        status: stripeSubscription.status as UserSubscription['status'],
        startDate: new Date(stripeSubscription.start_date * 1000),
        autoRenew: !stripeSubscription.cancel_at_period_end,
        stripeCustomerId,
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: tier.stripePriceId,
        stripePaymentMethodId: paymentMethodId,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        usage: {
          apiRequests: {
            count: 0,
            lastResetDate: now,
            resetPeriod: 'month'
          },
          moduleUsage: {}
        },
        metadata: options.metadata
      });
    }

    return subscription;
  } catch (error) {
    logger.error(`Failed to subscribe to paid plan: ${error}`);
    throw error;
  }
}

/**
 * Cancel a subscription
 * @param userId User ID
 * @param cancelAtPeriodEnd Whether to cancel at period end
 * @returns Updated user subscription
 */
export async function cancelSubscription(
  userId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<UserSubscription> {
  try {
    // Get user subscription
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      throw new Error(`User subscription not found: ${userId}`);
    }

    // Check if subscription has a Stripe subscription ID
    if (!subscription.stripeSubscriptionId) {
      // Just update the status for non-Stripe subscriptions
      return await updateUserSubscription(subscription.id, {
        status: 'canceled',
        canceledAt: new Date(),
        autoRenew: false
      });
    }

    // Cancel Stripe subscription
    const stripeSubscription = await stripeService.cancelSubscription(
      subscription.stripeSubscriptionId,
      cancelAtPeriodEnd
    );

    // Update user subscription
    const updates: Partial<Omit<UserSubscription, 'id' | 'createdAt' | 'updatedAt'>> = {
      status: stripeSubscription.status as UserSubscription['status'],
      canceledAt: new Date(),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      autoRenew: !stripeSubscription.cancel_at_period_end
    };

    // If canceling immediately, set end date
    if (!cancelAtPeriodEnd) {
      updates.endDate = new Date();
    }

    return await updateUserSubscription(subscription.id, updates);
  } catch (error) {
    logger.error(`Failed to cancel subscription: ${error}`);
    throw error;
  }
}

/**
 * Change subscription plan
 * @param userId User ID
 * @param newTierId New subscription tier ID
 * @param options Change options
 * @returns Updated user subscription
 */
export async function changeSubscriptionPlan(
  userId: string,
  newTierId: string,
  options: {
    prorate?: boolean;
    metadata?: Record<string, any>;
  } = {}
): Promise<UserSubscription> {
  try {
    // Get user subscription
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      throw new Error(`User subscription not found: ${userId}`);
    }

    // Get new subscription tier
    // Type assertion applied earlier in the chain
    const { data: newTier, error } = await (supabaseClient.getClient()
      .from('subscription_tiers') as any)
      .select('*')
      .eq('id', newTierId)
      .single();

    if (error || !newTier) {
      throw new Error(`Subscription tier not found: ${newTierId}`);
    }

    // Check if new tier is free
    if (newTier.price === 0) {
      // If current subscription has a Stripe subscription ID, cancel it
      if (subscription.stripeSubscriptionId) {
        await stripeService.cancelSubscription(subscription.stripeSubscriptionId, false);
      }

      // Update to free tier
      return await updateUserSubscription(subscription.id, {
        tierId: newTierId,
        status: 'active',
        stripeSubscriptionId: null,
        stripePriceId: null,
        autoRenew: true,
        metadata: options.metadata
      });
    }

    // Check if new tier has a Stripe price ID
    if (!newTier.stripePriceId) {
      throw new Error(`New subscription tier does not have a Stripe price ID: ${newTierId}`);
    }

    // Check if current subscription has a Stripe subscription ID
    if (!subscription.stripeSubscriptionId) {
      throw new Error('Cannot change plan for non-Stripe subscription. Please subscribe to a paid plan first.');
    }

    // Change Stripe subscription plan
    const stripeSubscription = await stripeService.changeSubscriptionPlan(
      subscription.stripeSubscriptionId,
      newTier.stripePriceId,
      {
        prorate: options.prorate
      }
    );

    // Update user subscription
    return await updateUserSubscription(subscription.id, {
      tierId: newTierId,
      status: stripeSubscription.status as UserSubscription['status'],
      stripePriceId: newTier.stripePriceId,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      autoRenew: !stripeSubscription.cancel_at_period_end,
      metadata: options.metadata
    });
  } catch (error) {
    logger.error(`Failed to change subscription plan: ${error}`);
    throw error;
  }
}

/**
 * Sync subscription with Stripe
 * @param userId User ID
 * @returns Updated user subscription
 */
export async function syncSubscriptionWithStripe(userId: string): Promise<UserSubscription> {
  try {
    // Get user subscription
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      throw new Error(`User subscription not found: ${userId}`);
    }

    // Check if subscription has a Stripe subscription ID
    if (!subscription.stripeSubscriptionId) {
      return subscription; // Nothing to sync
    }

    // Get Stripe subscription
    const stripeSubscription = await stripeService.getSubscription(subscription.stripeSubscriptionId);

    // Update user subscription
    return await updateUserSubscription(subscription.id, {
      status: stripeSubscription.status as UserSubscription['status'],
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      autoRenew: !stripeSubscription.cancel_at_period_end
    });
  } catch (error) {
    logger.error(`Failed to sync subscription with Stripe: ${error}`);
    throw error;
  }
}
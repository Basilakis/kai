/**
 * Admin Subscription Controller
 * 
 * This controller handles admin operations for subscription management,
 * including tier management, user subscription management, and analytics.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { ApiError } from '../../utils/apiError';
import { supabaseClient } from '../../services/supabase/supabaseClient';
import {
  getAllTiers,
  getTierById,
  createTier,
  updateTier,
  deleteTier
} from '../../models/subscriptionTier.model';
import {
  getUserSubscription,
  updateUserSubscription,
  cancelSubscription,
  changeSubscriptionPlan
} from '../../models/userSubscription.model';
import {
  addCredits,
  getCreditTransactions
} from '../../models/userCredit.model';
import stripeService from '../../services/payment/stripeService';

/**
 * Get all subscription tiers
 * @route GET /api/admin/subscriptions/tiers
 * @access Admin
 */
export const getAllSubscriptionTiers = async (req: Request, res: Response) => {
  try {
    const tiers = await getAllTiers();
    
    res.status(200).json({
      success: true,
      count: tiers.length,
      data: tiers
    });
  } catch (error) {
    logger.error(`Error in getAllSubscriptionTiers: ${error}`);
    throw new ApiError(500, 'Error fetching subscription tiers');
  }
};

/**
 * Get subscription tier by ID
 * @route GET /api/admin/subscriptions/tiers/:id
 * @access Admin
 */
export const getSubscriptionTierById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const tier = await getTierById(id);
    
    if (!tier) {
      throw new ApiError(404, 'Subscription tier not found');
    }
    
    res.status(200).json({
      success: true,
      data: tier
    });
  } catch (error) {
    logger.error(`Error in getSubscriptionTierById: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error fetching subscription tier');
  }
};

/**
 * Create subscription tier
 * @route POST /api/admin/subscriptions/tiers
 * @access Admin
 */
export const createSubscriptionTier = async (req: Request, res: Response) => {
  try {
    const tierData = req.body;
    
    // Create tier
    const tier = await createTier(tierData);
    
    // If tier has a price and no Stripe product/price, create them
    if (tier.price > 0 && !tier.stripePriceId && stripeService.isStripeConfigured()) {
      try {
        // Create Stripe product
        const product = await stripeService.createProduct(
          tier.name,
          tier.description,
          { tierId: tier.id }
        );
        
        // Create Stripe price
        const price = await stripeService.createPrice(
          product.id,
          tier.price * 100, // Convert to cents
          tier.currency,
          {
            interval: tier.billingInterval === 'yearly' ? 'year' : 'month',
            interval_count: 1
          },
          { tierId: tier.id }
        );
        
        // Update tier with Stripe IDs
        await updateTier(tier.id, {
          stripeProductId: product.id,
          stripePriceId: price.id
        });
        
        // Update the returned tier object
        tier.stripeProductId = product.id;
        tier.stripePriceId = price.id;
      } catch (stripeError) {
        logger.error(`Error creating Stripe product/price: ${stripeError}`);
        // Continue without Stripe integration
      }
    }
    
    res.status(201).json({
      success: true,
      data: tier
    });
  } catch (error) {
    logger.error(`Error in createSubscriptionTier: ${error}`);
    throw new ApiError(500, 'Error creating subscription tier');
  }
};

/**
 * Update subscription tier
 * @route PUT /api/admin/subscriptions/tiers/:id
 * @access Admin
 */
export const updateSubscriptionTier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tierData = req.body;
    
    // Get existing tier
    const existingTier = await getTierById(id);
    
    if (!existingTier) {
      throw new ApiError(404, 'Subscription tier not found');
    }
    
    // Update tier
    const updatedTier = await updateTier(id, tierData);
    
    // If price changed and Stripe is configured, update Stripe price
    if (
      tierData.price !== undefined &&
      tierData.price !== existingTier.price &&
      existingTier.stripeProductId &&
      stripeService.isStripeConfigured()
    ) {
      try {
        // Create new price (Stripe prices cannot be updated)
        const price = await stripeService.createPrice(
          existingTier.stripeProductId,
          tierData.price * 100, // Convert to cents
          tierData.currency || existingTier.currency,
          {
            interval: (tierData.billingInterval || existingTier.billingInterval) === 'yearly' ? 'year' : 'month',
            interval_count: 1
          },
          { tierId: id }
        );
        
        // Update tier with new Stripe price ID
        await updateTier(id, {
          stripePriceId: price.id
        });
        
        // Update the returned tier object
        updatedTier.stripePriceId = price.id;
      } catch (stripeError) {
        logger.error(`Error updating Stripe price: ${stripeError}`);
        // Continue without Stripe integration
      }
    }
    
    res.status(200).json({
      success: true,
      data: updatedTier
    });
  } catch (error) {
    logger.error(`Error in updateSubscriptionTier: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error updating subscription tier');
  }
};

/**
 * Delete subscription tier
 * @route DELETE /api/admin/subscriptions/tiers/:id
 * @access Admin
 */
export const deleteSubscriptionTier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if tier exists
    const tier = await getTierById(id);
    
    if (!tier) {
      throw new ApiError(404, 'Subscription tier not found');
    }
    
    // Check if tier has active subscriptions
    const { data, error } = await (supabaseClient.getClient()
      .from('user_subscriptions') as any)
      .select('id')
      .eq('tierId', id)
      .eq('status', 'active')
      .limit(1);
    
    if (error) {
      throw new Error(`Error checking active subscriptions: ${error.message}`);
    }
    
    if (data && data.length > 0) {
      throw new ApiError(400, 'Cannot delete tier with active subscriptions');
    }
    
    // Delete tier
    await deleteTier(id);
    
    res.status(200).json({
      success: true,
      message: 'Subscription tier deleted successfully'
    });
  } catch (error) {
    logger.error(`Error in deleteSubscriptionTier: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error deleting subscription tier');
  }
};

/**
 * Get all user subscriptions
 * @route GET /api/admin/subscriptions/users
 * @access Admin
 */
export const getAllUserSubscriptions = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const search = req.query.search as string || '';
    const status = req.query.status as string || 'all';
    
    // Build query
    let query = (supabaseClient.getClient()
      .from('user_subscriptions') as any)
      .select(`
        *,
        tier:subscription_tiers(*),
        user:users(id, email, first_name, last_name, credits)
      `)
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Add status filter if not 'all'
    if (status !== 'all') {
      query = query.eq('status', status);
    }
    
    // Add search filter if provided
    if (search) {
      // Search by user ID or email
      query = query.or(`user.id.eq.${search},user.email.ilike.%${search}%`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Error fetching user subscriptions: ${error.message}`);
    }
    
    res.status(200).json({
      success: true,
      count: data.length,
      data: data
    });
  } catch (error) {
    logger.error(`Error in getAllUserSubscriptions: ${error}`);
    throw new ApiError(500, 'Error fetching user subscriptions');
  }
};

/**
 * Get user subscription by ID
 * @route GET /api/admin/subscriptions/users/:id
 * @access Admin
 */
export const getUserSubscriptionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await (supabaseClient.getClient()
      .from('user_subscriptions') as any)
      .select(`
        *,
        tier:subscription_tiers(*),
        user:users(id, email, first_name, last_name, credits)
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'User subscription not found');
      }
      throw new Error(`Error fetching user subscription: ${error.message}`);
    }
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    logger.error(`Error in getUserSubscriptionById: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error fetching user subscription');
  }
};

/**
 * Get user subscription by user ID
 * @route GET /api/admin/subscriptions/users/by-user/:userId
 * @access Admin
 */
export const getUserSubscriptionByUserId = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      throw new ApiError(404, 'User subscription not found');
    }
    
    // Get tier details
    const tier = await getTierById(subscription.tierId);
    
    // Get user details
    const { data: user, error: userError } = await (supabaseClient.getClient()
      .from('users') as any)
      .select('id, email, first_name, last_name, credits')
      .eq('id', userId)
      .single();
    
    if (userError) {
      throw new Error(`Error fetching user: ${userError.message}`);
    }
    
    res.status(200).json({
      success: true,
      data: {
        ...subscription,
        tier,
        user
      }
    });
  } catch (error) {
    logger.error(`Error in getUserSubscriptionByUserId: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error fetching user subscription');
  }
};

/**
 * Update user subscription
 * @route PUT /api/admin/subscriptions/users/:id
 * @access Admin
 */
export const updateUserSubscription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Get subscription
    const { data: subscription, error } = await (supabaseClient.getClient()
      .from('user_subscriptions') as any)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'User subscription not found');
      }
      throw new Error(`Error fetching user subscription: ${error.message}`);
    }
    
    // Update subscription
    const { data: updatedSubscription, error: updateError } = await (supabaseClient.getClient()
      .from('user_subscriptions') as any)
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) {
      throw new Error(`Error updating user subscription: ${updateError.message}`);
    }
    
    // If status changed and subscription has Stripe subscription ID, update Stripe
    if (
      updates.status &&
      updates.status !== subscription.status &&
      subscription.stripeSubscriptionId &&
      stripeService.isStripeConfigured()
    ) {
      try {
        if (updates.status === 'active' && subscription.status === 'past_due') {
          // Mark subscription as active in Stripe
          await stripeService.updateSubscription(subscription.stripeSubscriptionId, {
            // No specific update needed, just marking as handled
          });
        } else if (updates.status === 'paused') {
          // Pause subscription in Stripe
          await stripeService.updateSubscription(subscription.stripeSubscriptionId, {
            pause_collection: {
              behavior: 'keep_as_draft'
            }
          });
        }
      } catch (stripeError) {
        logger.error(`Error updating Stripe subscription: ${stripeError}`);
        // Continue without Stripe integration
      }
    }
    
    res.status(200).json({
      success: true,
      data: updatedSubscription
    });
  } catch (error) {
    logger.error(`Error in updateUserSubscription: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error updating user subscription');
  }
};

/**
 * Cancel user subscription
 * @route POST /api/admin/subscriptions/users/:id/cancel
 * @access Admin
 */
export const cancelUserSubscription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { cancelAtPeriodEnd = true } = req.body;
    
    // Get subscription
    const { data: subscription, error } = await (supabaseClient.getClient()
      .from('user_subscriptions') as any)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'User subscription not found');
      }
      throw new Error(`Error fetching user subscription: ${error.message}`);
    }
    
    // Cancel subscription
    const updatedSubscription = await cancelSubscription(subscription.userId, cancelAtPeriodEnd);
    
    res.status(200).json({
      success: true,
      data: updatedSubscription
    });
  } catch (error) {
    logger.error(`Error in cancelUserSubscription: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error canceling user subscription');
  }
};

/**
 * Change user subscription tier
 * @route POST /api/admin/subscriptions/users/:id/change-tier
 * @access Admin
 */
export const changeUserSubscriptionTier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newTierId, prorate = true } = req.body;
    
    // Get subscription
    const { data: subscription, error } = await (supabaseClient.getClient()
      .from('user_subscriptions') as any)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'User subscription not found');
      }
      throw new Error(`Error fetching user subscription: ${error.message}`);
    }
    
    // Change subscription tier
    const updatedSubscription = await changeSubscriptionPlan(subscription.userId, newTierId, {
      prorate
    });
    
    res.status(200).json({
      success: true,
      data: updatedSubscription
    });
  } catch (error) {
    logger.error(`Error in changeUserSubscriptionTier: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error changing user subscription tier');
  }
};

/**
 * Add credits to user
 * @route POST /api/admin/subscriptions/credits/:userId/add
 * @access Admin
 */
export const addCreditsToUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { amount, description, type = 'adjustment' } = req.body;
    
    // Validate input
    if (!amount || amount <= 0) {
      throw new ApiError(400, 'Invalid credit amount');
    }
    
    if (!description) {
      throw new ApiError(400, 'Description is required');
    }
    
    // Add credits
    const result = await addCredits(userId, amount, description, type);
    
    res.status(200).json({
      success: true,
      message: `Added ${amount} credits to user ${userId}`,
      data: result
    });
  } catch (error) {
    logger.error(`Error in addCreditsToUser: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error adding credits to user');
  }
};

/**
 * Get user credit history
 * @route GET /api/admin/subscriptions/credits/:userId/history
 * @access Admin
 */
export const getUserCreditHistory = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    
    // Get credit transactions
    const transactions = await getCreditTransactions(userId, limit, offset);
    
    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (error) {
    logger.error(`Error in getUserCreditHistory: ${error}`);
    throw new ApiError(500, 'Error fetching user credit history');
  }
};

// Placeholder for analytics methods - these will be implemented in the next step
export const getSubscriptionAnalytics = async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      // Placeholder data
      revenue: {
        monthly: 0,
        annual: 0,
        averagePerUser: 0,
        byTier: {}
      },
      subscribers: {
        total: 0,
        active: 0,
        trialing: 0,
        pastDue: 0,
        canceled: 0
      },
      churnRate: 0,
      conversionRate: 0,
      tierDistribution: [],
      recentActivity: [],
      creditUsage: []
    }
  });
};

export const getSubscriptionAnalyticsByDateRange = async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      // Placeholder data
      revenue: {
        monthly: 0,
        annual: 0,
        averagePerUser: 0,
        byTier: {}
      },
      subscribers: {
        total: 0,
        active: 0,
        trialing: 0,
        pastDue: 0,
        canceled: 0
      },
      churnRate: 0,
      conversionRate: 0,
      tierDistribution: [],
      recentActivity: [],
      creditUsage: []
    }
  });
};

export const getSubscriptionChurnAnalytics = async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      // Placeholder data
      churnRate: 0,
      churnByTier: {},
      churnByPeriod: []
    }
  });
};

export const getSubscriptionRevenueAnalytics = async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      // Placeholder data
      mrr: 0,
      arr: 0,
      revenueByTier: {},
      revenueByPeriod: []
    }
  });
};

// Placeholder for plan versioning methods - these will be implemented in the next step
export const getSubscriptionTierVersions = async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: []
  });
};

export const createSubscriptionTierVersion = async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {}
  });
};

// Placeholder for subscription state transition methods - these will be implemented in the next step
export const getSubscriptionStateTransitions = async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: []
  });
};

export default {
  getAllSubscriptionTiers,
  getSubscriptionTierById,
  createSubscriptionTier,
  updateSubscriptionTier,
  deleteSubscriptionTier,
  getAllUserSubscriptions,
  getUserSubscriptionById,
  getUserSubscriptionByUserId,
  updateUserSubscription,
  cancelUserSubscription,
  changeUserSubscriptionTier,
  addCreditsToUser,
  getUserCreditHistory,
  getSubscriptionAnalytics,
  getSubscriptionAnalyticsByDateRange,
  getSubscriptionChurnAnalytics,
  getSubscriptionRevenueAnalytics,
  getSubscriptionTierVersions,
  createSubscriptionTierVersion,
  getSubscriptionStateTransitions
};

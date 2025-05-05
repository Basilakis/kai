/**
 * Subscription Controller
 *
 * This controller handles APIs for managing subscription tiers and user subscriptions.
 * It provides functionality for:
 * - Users to view and update their subscription
 * - Admins to manage subscription tiers
 * - Checking module access and API limits
 */

import { Request, Response } from 'express';
import { ApiError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';
import { supabaseClient } from '../services/supabase/supabaseClient';

import {
  getAllSubscriptionTiers,
  getSubscriptionTierById as getTierById,
  createSubscriptionTier,
  updateSubscriptionTier,
  deleteSubscriptionTier,
  getSubscriptionTiersByUserType,
  associateTierWithUserType,
  disassociateTierFromUserType,
  getUserTypesForTier
  // Removed unused SubscriptionTier import
} from '../models/subscriptionTier.model';

import {
  getUserSubscription,
  createUserSubscription,
  updateUserSubscription,
  hasModuleAccess,
  hasReachedApiLimit,
  createDefaultSubscription,
  trackApiUsage,
  trackModuleUsage,
  createStripeCustomer,
  subscribeToPaidPlan,
  cancelSubscription,
  changeSubscriptionPlan,
  syncSubscriptionWithStripe
  // Removed unused UserSubscription import
} from '../models/userSubscription.model';

import {
  getUserCredit,
  addCredits,
  useCredits,
  getCreditTransactions,
  hasEnoughCredits,
  initializeUserCredit,
  useServiceCredits,
  getCreditUsageByService
} from '../models/userCredit.model';

import creditService from '../services/credit/creditService';

import stripeService from '../services/payment/stripeService';

/**
 * Get all subscription tiers
 * @route GET /api/subscriptions/tiers
 * @access Public (limited info) / Admin (full info)
 */
export const getSubscriptionTiers = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const isAdmin = req.user?.role === 'admin';

    // Get user type from query params or from user object
    const userTypeParam = req.query.userType as string;
    const userType = userTypeParam || req.user?.userType || 'user';

    // Get tiers based on user type or admin status
    let tiers;
    if (isAdmin && !userTypeParam) {
      // Admins see all tiers by default
      tiers = await getAllSubscriptionTiers(true);
    } else {
      // Filter tiers by user type
      tiers = await getSubscriptionTiersByUserType(userType, isAdmin);
    }

    // Filter out sensitive information for non-admins
    const filteredTiers = isAdmin
      ? tiers
      : tiers.map(tier => ({
          id: tier.id,
          name: tier.name,
          description: tier.description,
          price: tier.price,
          currency: tier.currency,
          supportLevel: tier.supportLevel,
          isPublic: tier.isPublic,
          // Include high-level module access info without detailed limits
          moduleAccess: tier.moduleAccess.map(module => ({
            name: module.name,
            enabled: module.enabled
          })),
          // Include basic API limit info
          apiLimits: {
            requestsPerMinute: tier.apiLimits.requestsPerMinute,
            requestsPerDay: tier.apiLimits.requestsPerDay,
            requestsPerMonth: tier.apiLimits.requestsPerMonth,
            includedModules: tier.apiLimits.includedModules
          },
          maxProjects: tier.maxProjects,
          maxTeamMembers: tier.maxTeamMembers,
          customFeatures: tier.customFeatures
        }));

    res.status(200).json({
      success: true,
      count: filteredTiers.length,
      userType: userType,
      data: filteredTiers
    });
  } catch (error) {
    logger.error(`Error in getSubscriptionTiers: ${error}`);
    throw new ApiError(500, 'Error fetching subscription tiers');
  }
};

/**
 * Get subscription tier by ID
 * @route GET /api/subscriptions/tiers/:id
 * @access Public (limited info) / Admin (full info)
 */
export const getSubscriptionTierByIdHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if tier exists
    if (!id) {
      throw new ApiError(400, 'Subscription tier ID is required');
    }
    const tier = await getTierById(id);

    if (!tier) {
      throw new ApiError(404, 'Subscription tier not found');
    }

    // Check if user is admin or tier is public
    const isAdmin = req.user?.role === 'admin';

    if (!isAdmin && !tier.isPublic) {
      throw new ApiError(403, 'Access to this subscription tier is restricted');
    }

    // Filter out sensitive information for non-admins
    const filteredTier = isAdmin
      ? tier
      : {
          id: tier.id,
          name: tier.name,
          description: tier.description,
          price: tier.price,
          currency: tier.currency,
          supportLevel: tier.supportLevel,
          isPublic: tier.isPublic,
          // Include high-level module access info without detailed limits
          moduleAccess: tier.moduleAccess.map(module => ({
            name: module.name,
            enabled: module.enabled
          })),
          // Include basic API limit info
          apiLimits: {
            requestsPerMinute: tier.apiLimits.requestsPerMinute,
            requestsPerDay: tier.apiLimits.requestsPerDay,
            requestsPerMonth: tier.apiLimits.requestsPerMonth,
            includedModules: tier.apiLimits.includedModules
          },
          maxProjects: tier.maxProjects,
          maxTeamMembers: tier.maxTeamMembers,
          customFeatures: tier.customFeatures
        };

    res.status(200).json({
      success: true,
      data: filteredTier
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
 * Create subscription tier (admin only)
 * @route POST /api/subscriptions/tiers
 * @access Admin
 */
export const createTier = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      price,
      currency,
      stripePriceId,
      moduleAccess,
      apiLimits,
      maxProjects,
      maxTeamMembers,
      supportLevel,
      customFeatures,
      isPublic,
      userTypes
    } = req.body;

    // Validate required fields
    if (!name || !description || price === undefined || !currency || !moduleAccess || !apiLimits || !supportLevel) {
      throw new ApiError(400, 'Missing required fields');
    }

    // Validate user types if provided
    if (userTypes && (!Array.isArray(userTypes) || userTypes.some(type => !['user', 'factory', 'b2b', 'admin'].includes(type)))) {
      throw new ApiError(400, 'User types must be an array containing only valid types: user, factory, b2b, admin');
    }

    // Validate module access
    if (!Array.isArray(moduleAccess) || moduleAccess.length === 0) {
      throw new ApiError(400, 'Module access must be a non-empty array');
    }

    for (const module of moduleAccess) {
      if (!module.name || module.enabled === undefined) {
        throw new ApiError(400, 'Each module must have a name and enabled property');
      }
    }

    // Validate API limits
    if (!apiLimits.requestsPerMinute || !apiLimits.requestsPerDay || !apiLimits.requestsPerMonth) {
      throw new ApiError(400, 'API limits must include requestsPerMinute, requestsPerDay, and requestsPerMonth');
    }

    // Create tier
    const tier = await createSubscriptionTier({
      name,
      description,
      price,
      currency,
      stripePriceId,
      moduleAccess,
      apiLimits,
      maxProjects,
      maxTeamMembers,
      supportLevel,
      customFeatures,
      userTypes,
      isPublic: isPublic !== undefined ? isPublic : true // Default to true
    });

    // Associate tier with user types if provided
    if (userTypes && userTypes.length > 0) {
      for (const userType of userTypes) {
        await associateTierWithUserType(tier.id, userType);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Subscription tier created successfully',
      data: tier
    });
  } catch (error) {
    logger.error(`Error in createTier: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error creating subscription tier');
  }
};

/**
 * Update subscription tier (admin only)
 * @route PUT /api/subscriptions/tiers/:id
 * @access Admin
 */
export const updateTier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      currency,
      stripePriceId,
      moduleAccess,
      apiLimits,
      maxProjects,
      maxTeamMembers,
      supportLevel,
      customFeatures,
      isPublic,
      userTypes
    } = req.body;

    // Check if tier exists
    if (!id) {
      throw new ApiError(400, 'Subscription tier ID is required');
    }
    const existingTier = await getTierById(id);

    if (!existingTier) {
      throw new ApiError(404, 'Subscription tier not found');
    }

    // Validate module access if provided
    if (moduleAccess && (!Array.isArray(moduleAccess) || moduleAccess.length === 0)) {
      throw new ApiError(400, 'Module access must be a non-empty array');
    }

    if (moduleAccess) {
      for (const module of moduleAccess) {
        if (!module.name || module.enabled === undefined) {
          throw new ApiError(400, 'Each module must have a name and enabled property');
        }
      }
    }

    // Validate API limits if provided
    if (apiLimits) {
      const { requestsPerMinute, requestsPerDay, requestsPerMonth } = apiLimits;

      if (
        (requestsPerMinute !== undefined && requestsPerMinute <= 0) ||
        (requestsPerDay !== undefined && requestsPerDay <= 0) ||
        (requestsPerMonth !== undefined && requestsPerMonth <= 0)
      ) {
        throw new ApiError(400, 'API limits must be positive numbers');
      }
    }

    // Validate user types if provided
    if (userTypes && (!Array.isArray(userTypes) || userTypes.some(type => !['user', 'factory', 'b2b', 'admin'].includes(type)))) {
      throw new ApiError(400, 'User types must be an array containing only valid types: user, factory, b2b, admin');
    }

    // Update tier
    if (!id) {
      throw new ApiError(400, 'Subscription tier ID is required');
    }
    const updatedTier = await updateSubscriptionTier(id, {
      name,
      description,
      price,
      currency,
      stripePriceId,
      moduleAccess,
      apiLimits,
      maxProjects,
      maxTeamMembers,
      supportLevel,
      customFeatures,
      userTypes,
      isPublic
    });

    // Update user type associations if provided
    if (userTypes) {
      // Get current user types
      const currentUserTypes = await getUserTypesForTier(id);

      // Remove associations that are no longer needed
      for (const currentType of currentUserTypes) {
        if (!userTypes.includes(currentType)) {
          await disassociateTierFromUserType(id, currentType);
        }
      }

      // Add new associations
      for (const newType of userTypes) {
        if (!currentUserTypes.includes(newType)) {
          await associateTierWithUserType(id, newType);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Subscription tier updated successfully',
      data: updatedTier
    });
  } catch (error) {
    logger.error(`Error in updateTier: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error updating subscription tier');
  }
};

/**
 * Delete subscription tier (admin only)
 * @route DELETE /api/subscriptions/tiers/:id
 * @access Admin
 */
export const deleteTier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if tier exists
    if (!id) {
      throw new ApiError(400, 'Subscription tier ID is required');
    }
    const existingTier = await getTierById(id);

    if (!existingTier) {
      throw new ApiError(404, 'Subscription tier not found');
    }

    // Delete tier
    if (!id) {
      throw new ApiError(400, 'Subscription tier ID is required');
    }
    await deleteSubscriptionTier(id);

    res.status(200).json({
      success: true,
      message: 'Subscription tier deleted successfully'
    });
  } catch (error) {
    logger.error(`Error in deleteTier: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error deleting subscription tier');
  }
};

/**
 * Get current user's subscription
 * @route GET /api/subscriptions/my-subscription
 * @access Private
 */
export const getCurrentUserSubscription = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      throw new ApiError(401, 'Not authenticated');
    }

    // Get user's subscription
    let subscription = await getUserSubscription(req.user.id);

    // Create default subscription if user doesn't have one
    if (!subscription) {
      subscription = await createDefaultSubscription(req.user.id);
    }

    // Get subscription tier
    const tier = await getTierById(subscription.tierId);

    if (!tier) {
      throw new ApiError(404, 'Subscription tier not found');
    }

    res.status(200).json({
      success: true,
      data: {
        subscription,
        tier: {
          id: tier.id,
          name: tier.name,
          description: tier.description,
          price: tier.price,
          currency: tier.currency,
          moduleAccess: tier.moduleAccess,
          apiLimits: tier.apiLimits,
          maxProjects: tier.maxProjects,
          maxTeamMembers: tier.maxTeamMembers,
          supportLevel: tier.supportLevel,
          customFeatures: tier.customFeatures
        }
      }
    });
  } catch (error) {
    logger.error(`Error in getCurrentUserSubscription: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error fetching user subscription');
  }
};

/**
 * Update current user's subscription
 * @route PUT /api/subscriptions/my-subscription
 * @access Private
 */
export const updateUserSubscriptionTier = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      throw new ApiError(401, 'Not authenticated');
    }

    const { tierId } = req.body;

    if (!tierId) {
      throw new ApiError(400, 'Subscription tier ID is required');
    }

    // Check if tier exists and is public
    const tier = await getTierById(tierId);

    if (!tier) {
      throw new ApiError(404, 'Subscription tier not found');
    }

    if (!tier.isPublic && req.user.role !== 'admin') {
      throw new ApiError(403, 'This subscription tier is not available');
    }

    // Check if tier is available for the user's type
    const userType = req.user.userType || 'user';
    const tierUserTypes = await getUserTypesForTier(tierId);

    // If the tier has user type restrictions and the user's type is not included
    if (tierUserTypes.length > 0 && !tierUserTypes.includes(userType) && req.user.role !== 'admin') {
      throw new ApiError(403, `This subscription tier is not available for ${userType} accounts`);
    }

    // Get user's current subscription
    let subscription = await getUserSubscription(req.user.id);

    // If user doesn't have a subscription, create a new one
    if (!subscription) {
      subscription = await createUserSubscription({
        userId: req.user.id,
        tierId,
        status: 'active',
        startDate: new Date(),
        autoRenew: true,
        usage: {
          apiRequests: {
            count: 0,
            lastResetDate: new Date(),
            resetPeriod: 'month'
          },
          moduleUsage: {}
        }
      });
    } else {
      // Update existing subscription
      subscription = await updateUserSubscription(subscription.id, {
        tierId,
        status: 'active'
        // updatedAt is handled internally by the model
      });
    }

    res.status(200).json({
      success: true,
      message: 'Subscription updated successfully',
      data: {
        subscription,
        tier: {
          id: tier.id,
          name: tier.name,
          description: tier.description,
          price: tier.price,
          currency: tier.currency
        }
      }
    });
  } catch (error) {
    logger.error(`Error in updateUserSubscriptionTier: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error updating user subscription');
  }
};

/**
 * Check if user has access to a module
 * This is an internal API used by the middleware
 * @param userId User ID
 * @param moduleName Module name
 * @returns Boolean indicating if user has access
 */
export const checkModuleAccess = async (userId: string, moduleName: string): Promise<boolean> => {
  try {
    return await hasModuleAccess(userId, moduleName);
  } catch (error) {
    logger.error(`Error in checkModuleAccess: ${error}`);
    return false;
  }
};

/**
 * Check if user has reached API limit
 * This is an internal API used by the middleware
 * @param userId User ID
 * @returns Boolean indicating if user has reached limit
 */
export const checkApiLimit = async (userId: string): Promise<boolean> => {
  try {
    return await hasReachedApiLimit(userId);
  } catch (error) {
    logger.error(`Error in checkApiLimit: ${error}`);
    return false;
  }
};

/**
 * Track API usage
 * This is an internal API used by the middleware
 * @param userId User ID
 * @returns Updated API usage count
 */
export const trackUserApiUsage = async (userId: string): Promise<number> => {
  try {
    return await trackApiUsage(userId);
  } catch (error) {
    logger.error(`Error in trackUserApiUsage: ${error}`);
    return 0;
  }
};

/**
 * Track module usage
 * This is an internal API used by the middleware
 * @param userId User ID
 * @param moduleName Module name
 * @returns Updated module usage count
 */
export const trackUserModuleUsage = async (userId: string, moduleName: string): Promise<number> => {
  try {
    return await trackModuleUsage(userId, moduleName);
  } catch (error) {
    logger.error(`Error in trackUserModuleUsage: ${error}`);
    return 0;
  }
};

/**
 * Get user credit balance
 * @route GET /api/subscriptions/credits
 * @access Private
 */
export const getUserCreditBalance = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    // Get user credit
    const userCredit = await getUserCredit(userId);

    // If user credit doesn't exist, initialize it
    if (!userCredit) {
      const initializedCredit = await initializeUserCredit(userId);

      res.status(200).json({
        success: true,
        data: {
          balance: initializedCredit.balance,
          lastUpdatedAt: initializedCredit.lastUpdatedAt
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        balance: userCredit.balance,
        lastUpdatedAt: userCredit.lastUpdatedAt
      }
    });
  } catch (error) {
    logger.error(`Error in getUserCreditBalance: ${error}`);
    throw new ApiError(500, 'Error fetching user credit balance');
  }
};

/**
 * Get user credit transactions
 * @route GET /api/subscriptions/credits/transactions
 * @access Private
 */
export const getUserCreditTransactions = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
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
    logger.error(`Error in getUserCreditTransactions: ${error}`);
    throw new ApiError(500, 'Error fetching credit transactions');
  }
};

/**
 * Purchase credits
 * @route POST /api/subscriptions/credits/purchase
 * @access Private
 */
export const purchaseCredits = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { amount, paymentMethodId } = req.body;

    // Validate input
    if (!amount || amount <= 0) {
      throw new ApiError(400, 'Invalid credit amount');
    }

    if (!paymentMethodId) {
      throw new ApiError(400, 'Payment method ID is required');
    }

    // Check if Stripe is configured
    if (!stripeService.isStripeConfigured()) {
      throw new ApiError(500, 'Payment processing is not configured');
    }

    // Get or create Stripe customer
    let subscription = await getUserSubscription(userId);
    let stripeCustomerId = subscription?.stripeCustomerId;

    if (!stripeCustomerId) {
      // Get user email from Supabase
      const { data: user, error: userError } = await (supabaseClient.getClient()
        .from('users') as any)
        .select('email, first_name, last_name')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        throw new ApiError(404, 'User not found');
      }

      // Create Stripe customer
      stripeCustomerId = await createStripeCustomer(
        userId,
        user.email,
        user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : undefined
      );
    }

    // Attach payment method to customer
    await stripeService.attachPaymentMethod(stripeCustomerId, paymentMethodId, true);

    // Calculate price (1 credit = $1)
    const unitAmount = 100; // $1 in cents
    const totalAmount = amount * unitAmount;

    // Create a payment intent
    const paymentIntent = await stripeService.stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method: paymentMethodId,
      confirm: true,
      metadata: {
        type: 'credits',
        userId,
        creditAmount: amount.toString()
      }
    });

    // If payment succeeded, add credits immediately
    if (paymentIntent.status === 'succeeded') {
      // Initialize user credit if it doesn't exist
      await initializeUserCredit(userId);

      // Add credits
      const result = await addCredits(
        userId,
        amount,
        `Credit purchase (Payment: ${paymentIntent.id})`,
        'purchase',
        { paymentIntentId: paymentIntent.id, amount: totalAmount }
      );

      res.status(200).json({
        success: true,
        message: 'Credits purchased successfully',
        data: {
          balance: result.userCredit.balance,
          transaction: result.transaction
        }
      });
    } else {
      // Payment requires additional action
      res.status(200).json({
        success: true,
        requiresAction: true,
        clientSecret: paymentIntent.client_secret
      });
    }
  } catch (error) {
    logger.error(`Error in purchaseCredits: ${error}`);
    throw new ApiError(500, 'Error purchasing credits');
  }
};

/**
 * Use credits
 * @route POST /api/subscriptions/credits/use
 * @access Private
 */
export const useUserCredits = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { amount, description, type = 'usage', metadata } = req.body;

    // Validate input
    if (!amount || amount <= 0) {
      throw new ApiError(400, 'Invalid credit amount');
    }

    if (!description) {
      throw new ApiError(400, 'Description is required');
    }

    // Check if user has enough credits
    const hasEnough = await hasEnoughCredits(userId, amount);

    if (!hasEnough) {
      throw new ApiError(400, 'Insufficient credits');
    }

    // Use credits
    const result = await useCredits(userId, amount, description, type, metadata);

    res.status(200).json({
      success: true,
      message: 'Credits used successfully',
      data: {
        balance: result.userCredit.balance,
        transaction: result.transaction
      }
    });
  } catch (error) {
    logger.error(`Error in useUserCredits: ${error}`);
    throw new ApiError(500, 'Error using credits');
  }
};

/**
 * Subscribe to a paid plan
 * @route POST /api/subscriptions/subscribe
 * @access Private
 */
export const subscribeUser = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { tierId, paymentMethodId, trialDays, metadata } = req.body;

    // Validate input
    if (!tierId) {
      throw new ApiError(400, 'Subscription tier ID is required');
    }

    if (!paymentMethodId) {
      throw new ApiError(400, 'Payment method ID is required');
    }

    // Subscribe to paid plan
    const subscription = await subscribeToPaidPlan(userId, tierId, paymentMethodId, {
      trialDays,
      metadata
    });

    res.status(200).json({
      success: true,
      message: 'Subscribed successfully',
      data: subscription
    });
  } catch (error) {
    logger.error(`Error in subscribeUser: ${error}`);
    throw new ApiError(500, 'Error subscribing to plan');
  }
};

/**
 * Cancel subscription
 * @route POST /api/subscriptions/cancel
 * @access Private
 */
export const cancelUserSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { cancelAtPeriodEnd = true } = req.body;

    // Cancel subscription
    const subscription = await cancelSubscription(userId, cancelAtPeriodEnd);

    res.status(200).json({
      success: true,
      message: cancelAtPeriodEnd ? 'Subscription will be canceled at the end of the billing period' : 'Subscription canceled immediately',
      data: subscription
    });
  } catch (error) {
    logger.error(`Error in cancelUserSubscription: ${error}`);
    throw new ApiError(500, 'Error canceling subscription');
  }
};

/**
 * Change subscription plan
 * @route POST /api/subscriptions/change-plan
 * @access Private
 */
export const changeUserSubscriptionPlan = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { newTierId, prorate = true, metadata } = req.body;

    // Validate input
    if (!newTierId) {
      throw new ApiError(400, 'New subscription tier ID is required');
    }

    // Change subscription plan
    const subscription = await changeSubscriptionPlan(userId, newTierId, {
      prorate,
      metadata
    });

    res.status(200).json({
      success: true,
      message: 'Subscription plan changed successfully',
      data: subscription
    });
  } catch (error) {
    logger.error(`Error in changeUserSubscriptionPlan: ${error}`);
    throw new ApiError(500, 'Error changing subscription plan');
  }
};

/**
 * Get payment methods
 * @route GET /api/subscriptions/payment-methods
 * @access Private
 */
export const getPaymentMethods = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    // Get user subscription
    const subscription = await getUserSubscription(userId);

    if (!subscription || !subscription.stripeCustomerId) {
      res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
      return;
    }

    // Get payment methods
    const paymentMethods = await stripeService.listPaymentMethods(subscription.stripeCustomerId);

    res.status(200).json({
      success: true,
      count: paymentMethods.length,
      data: paymentMethods.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year
        } : undefined,
        billingDetails: pm.billing_details
      }))
    });
  } catch (error) {
    logger.error(`Error in getPaymentMethods: ${error}`);
    throw new ApiError(500, 'Error fetching payment methods');
  }
};

/**
 * Get user credit usage by service
 * @param req Request
 * @param res Response
 */
export const getUserCreditUsageByService = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    // Get credit usage by service
    const creditUsage = await creditService.getUserCreditUsageByService(userId, limit, offset);

    res.status(200).json({
      success: true,
      data: creditUsage
    });
  } catch (error) {
    logger.error(`Error in getUserCreditUsageByService: ${error}`);
    throw new ApiError(500, 'Error fetching credit usage by service');
  }
};

/**
 * Use credits for a specific service
 * @param req Request
 * @param res Response
 */
export const useServiceCredits = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const { serviceKey, units, description, metadata } = req.body;

    // Validate required fields
    if (!serviceKey || !units || !description) {
      throw new ApiError(400, 'Missing required fields: serviceKey, units, and description are required');
    }

    // Use credits for service
    const result = await creditService.useServiceCredits(
      userId,
      serviceKey,
      units,
      description,
      metadata
    );

    res.status(200).json({
      success: true,
      data: {
        userCredit: result.userCredit,
        transaction: result.transaction
      }
    });
  } catch (error) {
    logger.error(`Error in useServiceCredits: ${error}`);
    if (error.message === 'Insufficient credits') {
      throw new ApiError(402, 'Insufficient credits', 'You do not have enough credits to perform this action. Please purchase more credits.');
    }
    throw new ApiError(500, 'Error using service credits');
  }
};

/**
 * Get all service costs
 * @param req Request
 * @param res Response
 */
export const getServiceCosts = async (req: Request, res: Response) => {
  try {
    // Get all service costs
    const serviceCosts = await creditService.getAllServiceCosts();

    res.status(200).json({
      success: true,
      data: serviceCosts
    });
  } catch (error) {
    logger.error(`Error in getServiceCosts: ${error}`);
    throw new ApiError(500, 'Error fetching service costs');
  }
};

export default {
  getSubscriptionTiers,
  getSubscriptionTierById: getSubscriptionTierByIdHandler,
  createTier,
  updateTier,
  deleteTier,
  getCurrentUserSubscription,
  updateUserSubscriptionTier,
  checkModuleAccess,
  checkApiLimit,
  trackUserApiUsage,
  trackUserModuleUsage,
  getUserCreditBalance,
  getUserCreditTransactions,
  getUserCreditUsageByService,
  purchaseCredits,
  useUserCredits,
  useServiceCredits,
  getServiceCosts,
  subscribeUser,
  cancelUserSubscription,
  changeUserSubscriptionPlan,
  getPaymentMethods
};
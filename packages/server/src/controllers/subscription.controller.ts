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

import {
  getAllSubscriptionTiers, 
  getSubscriptionTierById as getTierById,
  createSubscriptionTier,
  updateSubscriptionTier,
  deleteSubscriptionTier
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
  trackModuleUsage
  // Removed unused UserSubscription import
} from '../models/userSubscription.model';

/**
 * Get all subscription tiers
 * @route GET /api/subscriptions/tiers
 * @access Public (limited info) / Admin (full info)
 */
export const getSubscriptionTiers = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const isAdmin = req.user?.role === 'admin';
    
    // Get all tiers (include non-public only for admins)
    const tiers = await getAllSubscriptionTiers(isAdmin);
    
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
      isPublic
    } = req.body;
    
    // Validate required fields
    if (!name || !description || price === undefined || !currency || !moduleAccess || !apiLimits || !supportLevel) {
      throw new ApiError(400, 'Missing required fields');
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
      isPublic: isPublic !== undefined ? isPublic : true // Default to true
    });
    
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
      isPublic
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
      isPublic
    });
    
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
  trackUserModuleUsage
};
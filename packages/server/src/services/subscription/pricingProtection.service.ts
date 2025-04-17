/**
 * Pricing Protection Service
 * 
 * This service provides functionality for managing grandfathered pricing,
 * including assigning pricing versions to users and applying pricing protection.
 */

import { logger } from '../../utils/logger';
import pricingVersionModel, { 
  PricingVersion, 
  TierPricing, 
  UserPricingAssignment 
} from '../../models/pricingVersion.model';
import { getUserSubscription } from '../../models/userSubscription.model';
import { getSubscriptionTierById } from '../../models/subscriptionTier.model';

/**
 * Get the applicable price for a user and tier
 * @param userId User ID
 * @param tierId Subscription tier ID
 * @returns Applicable price and pricing version
 */
export async function getApplicablePrice(
  userId: string,
  tierId: string
): Promise<{ 
  price: number; 
  currency: string; 
  billingInterval: string; 
  stripePriceId?: string; 
  version: PricingVersion | null;
  isGrandfathered: boolean;
}> {
  try {
    // Get the user's subscription
    const subscription = await getUserSubscription(userId);
    
    // Get the tier
    const tier = await getSubscriptionTierById(tierId);
    
    if (!tier) {
      throw new Error('Invalid subscription tier');
    }
    
    // Check if the user has a grandfathered price for this tier
    const userTierPrice = await pricingVersionModel.getUserTierPrice(userId, tierId);
    
    if (userTierPrice) {
      // User has a grandfathered price
      const version = await pricingVersionModel.getPricingVersionById(userTierPrice.versionId);
      
      return {
        price: userTierPrice.price,
        currency: userTierPrice.currency,
        billingInterval: userTierPrice.billingInterval,
        stripePriceId: userTierPrice.stripePriceId,
        version,
        isGrandfathered: true
      };
    }
    
    // No grandfathered price, use current price
    return {
      price: tier.price,
      currency: tier.currency,
      billingInterval: tier.billingInterval,
      stripePriceId: tier.stripePriceId,
      version: null,
      isGrandfathered: false
    };
  } catch (error) {
    logger.error(`Failed to get applicable price: ${error}`);
    throw error;
  }
}

/**
 * Assign a pricing version to a user
 * @param userId User ID
 * @param versionId Pricing version ID
 * @param adminId Admin user ID
 * @param reason Reason for assignment
 * @param expiresAt Expiration date
 * @param metadata Additional metadata
 * @returns Created user pricing assignment
 */
export async function assignPricingVersionToUser(
  userId: string,
  versionId: string,
  adminId: string,
  reason?: string,
  expiresAt?: Date,
  metadata?: Record<string, any>
): Promise<UserPricingAssignment> {
  try {
    // Check if the pricing version exists
    const version = await pricingVersionModel.getPricingVersionById(versionId);
    
    if (!version) {
      throw new Error('Invalid pricing version');
    }
    
    if (!version.isActive) {
      throw new Error('Cannot assign inactive pricing version');
    }
    
    // Deactivate any existing assignments
    const existingAssignments = await pricingVersionModel.getUserPricingAssignments(userId);
    
    for (const assignment of existingAssignments) {
      await pricingVersionModel.deactivateUserPricingAssignment(assignment.id);
    }
    
    // Create the new assignment
    const now = new Date();
    const assignment = await pricingVersionModel.createUserPricingAssignment({
      userId,
      versionId,
      assignedAt: now,
      expiresAt,
      isActive: true,
      createdBy: adminId,
      reason,
      metadata
    });
    
    return assignment;
  } catch (error) {
    logger.error(`Failed to assign pricing version to user: ${error}`);
    throw error;
  }
}

/**
 * Remove pricing protection from a user
 * @param userId User ID
 * @param adminId Admin user ID
 * @param reason Reason for removal
 * @returns Whether the protection was removed
 */
export async function removePricingProtection(
  userId: string,
  adminId: string,
  reason?: string
): Promise<boolean> {
  try {
    // Deactivate all existing assignments
    const existingAssignments = await pricingVersionModel.getUserPricingAssignments(userId);
    
    for (const assignment of existingAssignments) {
      await pricingVersionModel.updateUserPricingAssignment(assignment.id, {
        isActive: false,
        expiresAt: new Date(),
        metadata: {
          ...assignment.metadata,
          removedBy: adminId,
          removedAt: new Date().toISOString(),
          removalReason: reason
        }
      });
    }
    
    return true;
  } catch (error) {
    logger.error(`Failed to remove pricing protection: ${error}`);
    throw error;
  }
}

/**
 * Create a new pricing version
 * @param name Version name
 * @param description Version description
 * @param effectiveDate Effective date
 * @param adminId Admin user ID
 * @param metadata Additional metadata
 * @returns Created pricing version
 */
export async function createPricingVersion(
  name: string,
  description: string,
  effectiveDate: Date,
  adminId: string,
  metadata?: Record<string, any>
): Promise<PricingVersion> {
  try {
    // Create the pricing version
    const version = await pricingVersionModel.createPricingVersion({
      name,
      description,
      effectiveDate,
      isActive: true,
      createdBy: adminId,
      metadata
    });
    
    return version;
  } catch (error) {
    logger.error(`Failed to create pricing version: ${error}`);
    throw error;
  }
}

/**
 * Add tier pricing to a version
 * @param versionId Pricing version ID
 * @param tierId Subscription tier ID
 * @param price Price
 * @param currency Currency
 * @param billingInterval Billing interval
 * @param stripePriceId Stripe price ID
 * @param metadata Additional metadata
 * @returns Created tier pricing
 */
export async function addTierPricingToVersion(
  versionId: string,
  tierId: string,
  price: number,
  currency: string,
  billingInterval: 'monthly' | 'yearly' | 'one-time',
  stripePriceId?: string,
  metadata?: Record<string, any>
): Promise<TierPricing> {
  try {
    // Check if the pricing version exists
    const version = await pricingVersionModel.getPricingVersionById(versionId);
    
    if (!version) {
      throw new Error('Invalid pricing version');
    }
    
    // Check if the tier exists
    const tier = await getSubscriptionTierById(tierId);
    
    if (!tier) {
      throw new Error('Invalid subscription tier');
    }
    
    // Check if pricing already exists for this tier
    const existingPricing = await pricingVersionModel.getTierPricingForVersion(versionId);
    const existingTierPricing = existingPricing.find(p => p.tierId === tierId);
    
    if (existingTierPricing) {
      throw new Error('Pricing already exists for this tier in this version');
    }
    
    // Create the tier pricing
    const tierPricing = await pricingVersionModel.createTierPricing({
      versionId,
      tierId,
      price,
      currency,
      billingInterval,
      stripePriceId,
      metadata
    });
    
    return tierPricing;
  } catch (error) {
    logger.error(`Failed to add tier pricing to version: ${error}`);
    throw error;
  }
}

/**
 * Get all pricing versions
 * @param includeInactive Whether to include inactive versions
 * @returns Array of pricing versions
 */
export async function getAllPricingVersions(includeInactive: boolean = false): Promise<PricingVersion[]> {
  try {
    return await pricingVersionModel.getAllPricingVersions(includeInactive);
  } catch (error) {
    logger.error(`Failed to get pricing versions: ${error}`);
    throw error;
  }
}

/**
 * Get a pricing version with tier pricing
 * @param versionId Pricing version ID
 * @returns Pricing version with tier pricing
 */
export async function getPricingVersionWithTiers(versionId: string): Promise<{
  version: PricingVersion | null;
  tiers: TierPricing[];
}> {
  try {
    const version = await pricingVersionModel.getPricingVersionById(versionId);
    
    if (!version) {
      return { version: null, tiers: [] };
    }
    
    const tiers = await pricingVersionModel.getTierPricingForVersion(versionId);
    
    return { version, tiers };
  } catch (error) {
    logger.error(`Failed to get pricing version with tiers: ${error}`);
    throw error;
  }
}

/**
 * Get user pricing assignments
 * @param userId User ID
 * @returns Array of user pricing assignments with version details
 */
export async function getUserPricingAssignmentsWithDetails(userId: string): Promise<any[]> {
  try {
    const assignments = await pricingVersionModel.getUserPricingAssignments(userId);
    
    if (!assignments || assignments.length === 0) {
      return [];
    }
    
    // Get version details for each assignment
    const result = [];
    
    for (const assignment of assignments) {
      const version = await pricingVersionModel.getPricingVersionById(assignment.versionId);
      
      if (version) {
        result.push({
          ...assignment,
          version: {
            id: version.id,
            name: version.name,
            description: version.description,
            effectiveDate: version.effectiveDate
          }
        });
      }
    }
    
    return result;
  } catch (error) {
    logger.error(`Failed to get user pricing assignments with details: ${error}`);
    throw error;
  }
}

export default {
  getApplicablePrice,
  assignPricingVersionToUser,
  removePricingProtection,
  createPricingVersion,
  addTierPricingToVersion,
  getAllPricingVersions,
  getPricingVersionWithTiers,
  getUserPricingAssignmentsWithDetails
};

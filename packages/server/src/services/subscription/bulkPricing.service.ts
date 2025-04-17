/**
 * Bulk Pricing Service
 * 
 * This service provides functionality for calculating bulk pricing discounts
 * and applying them to subscriptions and credit purchases.
 */

import { logger } from '../../utils/logger';
import bulkPricingModel, { BulkPricingType } from '../../models/bulkPricing.model';
import { getSubscriptionTierById } from '../../models/subscriptionTier.model';

/**
 * Bulk pricing result
 */
export interface BulkPricingResult {
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  savings: number;
  tierId?: string;
  tierName?: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Calculate bulk pricing for subscription seats
 * @param tierId Subscription tier ID
 * @param seats Number of seats
 * @returns Bulk pricing result
 */
export async function calculateSubscriptionBulkPricing(
  tierId: string,
  seats: number
): Promise<BulkPricingResult> {
  try {
    // Get the subscription tier
    const tier = await getSubscriptionTierById(tierId);
    
    if (!tier) {
      throw new Error('Invalid subscription tier');
    }
    
    // Calculate bulk pricing
    const result = await bulkPricingModel.calculateBulkPrice(
      BulkPricingType.SUBSCRIPTION,
      seats,
      tier.price
    );
    
    return {
      originalPrice: result.originalPrice,
      discountedPrice: result.discountedPrice,
      discountPercentage: result.discountPercentage,
      savings: result.savings,
      tierId,
      tierName: tier.name,
      quantity: seats,
      unitPrice: tier.price
    };
  } catch (error) {
    logger.error(`Failed to calculate subscription bulk pricing: ${error}`);
    throw error;
  }
}

/**
 * Calculate bulk pricing for credit purchase
 * @param creditAmount Number of credits
 * @param unitPrice Unit price per credit
 * @returns Bulk pricing result
 */
export async function calculateCreditBulkPricing(
  creditAmount: number,
  unitPrice: number
): Promise<BulkPricingResult> {
  try {
    // Calculate bulk pricing
    const result = await bulkPricingModel.calculateBulkPrice(
      BulkPricingType.CREDIT,
      creditAmount,
      unitPrice
    );
    
    return {
      originalPrice: result.originalPrice,
      discountedPrice: result.discountedPrice,
      discountPercentage: result.discountPercentage,
      savings: result.savings,
      quantity: creditAmount,
      unitPrice
    };
  } catch (error) {
    logger.error(`Failed to calculate credit bulk pricing: ${error}`);
    throw error;
  }
}

/**
 * Get all bulk pricing tiers
 * @param type Bulk pricing type
 * @returns Array of bulk pricing tiers
 */
export async function getBulkPricingTiers(type?: BulkPricingType) {
  try {
    return await bulkPricingModel.getAllBulkPricingTiers(type);
  } catch (error) {
    logger.error(`Failed to get bulk pricing tiers: ${error}`);
    throw error;
  }
}

/**
 * Create a bulk pricing tier
 * @param tierData Bulk pricing tier data
 * @returns Created bulk pricing tier
 */
export async function createBulkPricingTier(tierData: any) {
  try {
    // Validate tier data
    if (!tierData.type || !Object.values(BulkPricingType).includes(tierData.type)) {
      throw new Error('Invalid bulk pricing type');
    }
    
    if (!tierData.name) {
      throw new Error('Name is required');
    }
    
    if (tierData.minQuantity === undefined || tierData.minQuantity < 1) {
      throw new Error('Minimum quantity is required and must be at least 1');
    }
    
    if (tierData.maxQuantity !== undefined && tierData.maxQuantity <= tierData.minQuantity) {
      throw new Error('Maximum quantity must be greater than minimum quantity');
    }
    
    if (tierData.discountPercentage === undefined || 
        tierData.discountPercentage < 0 || 
        tierData.discountPercentage > 100) {
      throw new Error('Discount percentage is required and must be between 0 and 100');
    }
    
    // Create the tier
    return await bulkPricingModel.createBulkPricingTier({
      type: tierData.type,
      name: tierData.name,
      description: tierData.description,
      minQuantity: tierData.minQuantity,
      maxQuantity: tierData.maxQuantity,
      discountPercentage: tierData.discountPercentage,
      isActive: tierData.isActive !== false,
      metadata: tierData.metadata
    });
  } catch (error) {
    logger.error(`Failed to create bulk pricing tier: ${error}`);
    throw error;
  }
}

/**
 * Update a bulk pricing tier
 * @param id Bulk pricing tier ID
 * @param updates Updates to apply
 * @returns Updated bulk pricing tier
 */
export async function updateBulkPricingTier(id: string, updates: any) {
  try {
    // Validate updates
    if (updates.type && !Object.values(BulkPricingType).includes(updates.type)) {
      throw new Error('Invalid bulk pricing type');
    }
    
    if (updates.minQuantity !== undefined && updates.minQuantity < 1) {
      throw new Error('Minimum quantity must be at least 1');
    }
    
    if (updates.maxQuantity !== undefined && 
        updates.minQuantity !== undefined && 
        updates.maxQuantity <= updates.minQuantity) {
      throw new Error('Maximum quantity must be greater than minimum quantity');
    }
    
    if (updates.discountPercentage !== undefined && 
        (updates.discountPercentage < 0 || updates.discountPercentage > 100)) {
      throw new Error('Discount percentage must be between 0 and 100');
    }
    
    // Update the tier
    return await bulkPricingModel.updateBulkPricingTier(id, updates);
  } catch (error) {
    logger.error(`Failed to update bulk pricing tier: ${error}`);
    throw error;
  }
}

/**
 * Delete a bulk pricing tier
 * @param id Bulk pricing tier ID
 * @returns Whether the tier was deleted
 */
export async function deleteBulkPricingTier(id: string) {
  try {
    return await bulkPricingModel.deleteBulkPricingTier(id);
  } catch (error) {
    logger.error(`Failed to delete bulk pricing tier: ${error}`);
    throw error;
  }
}

export default {
  calculateSubscriptionBulkPricing,
  calculateCreditBulkPricing,
  getBulkPricingTiers,
  createBulkPricingTier,
  updateBulkPricingTier,
  deleteBulkPricingTier,
  BulkPricingType
};

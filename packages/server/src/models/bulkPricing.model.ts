/**
 * Bulk Pricing Model
 * 
 * This model handles the storage and retrieval of bulk pricing tiers,
 * which provide volume discounts for subscriptions and credits.
 */

import { supabaseClient } from '../services/supabase/supabaseClient';
import { logger } from '../utils/logger';

/**
 * Bulk pricing type
 */
export enum BulkPricingType {
  SUBSCRIPTION = 'subscription',
  CREDIT = 'credit'
}

/**
 * Bulk pricing tier
 */
export interface BulkPricingTier {
  id: string;
  type: BulkPricingType;
  name: string;
  description?: string;
  minQuantity: number;
  maxQuantity?: number;
  discountPercentage: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Get all bulk pricing tiers
 * @param type Bulk pricing type
 * @returns Array of bulk pricing tiers
 */
export async function getAllBulkPricingTiers(type?: BulkPricingType): Promise<BulkPricingTier[]> {
  try {
    let query = supabaseClient.getClient()
      .from('bulk_pricing_tiers')
      .select('*')
      .eq('isActive', true)
      .order('minQuantity', { ascending: true });
    
    if (type) {
      query = query.eq('type', type);
    }
    
    const { data, error } = await query;
    
    if (error) {
      logger.error(`Error getting bulk pricing tiers: ${error.message}`);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    logger.error(`Failed to get bulk pricing tiers: ${error}`);
    throw error;
  }
}

/**
 * Get a bulk pricing tier by ID
 * @param id Bulk pricing tier ID
 * @returns Bulk pricing tier or null if not found
 */
export async function getBulkPricingTierById(id: string): Promise<BulkPricingTier | null> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('bulk_pricing_tiers')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error(`Error getting bulk pricing tier: ${error.message}`);
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(`Failed to get bulk pricing tier: ${error}`);
    throw error;
  }
}

/**
 * Create a new bulk pricing tier
 * @param tier Bulk pricing tier data
 * @returns Created bulk pricing tier
 */
export async function createBulkPricingTier(
  tier: Omit<BulkPricingTier, 'id' | 'createdAt' | 'updatedAt'>
): Promise<BulkPricingTier> {
  try {
    const now = new Date();
    const newTier = {
      ...tier,
      createdAt: now,
      updatedAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('bulk_pricing_tiers')
      .insert([newTier])
      .select();
    
    if (error) {
      logger.error(`Error creating bulk pricing tier: ${error.message}`);
      throw error;
    }
    
    return data[0];
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
export async function updateBulkPricingTier(
  id: string,
  updates: Partial<Omit<BulkPricingTier, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<BulkPricingTier> {
  try {
    const now = new Date();
    const updatedTier = {
      ...updates,
      updatedAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('bulk_pricing_tiers')
      .update(updatedTier)
      .eq('id', id)
      .select();
    
    if (error) {
      logger.error(`Error updating bulk pricing tier: ${error.message}`);
      throw error;
    }
    
    return data[0];
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
export async function deleteBulkPricingTier(id: string): Promise<boolean> {
  try {
    const { error } = await supabaseClient.getClient()
      .from('bulk_pricing_tiers')
      .delete()
      .eq('id', id);
    
    if (error) {
      logger.error(`Error deleting bulk pricing tier: ${error.message}`);
      throw error;
    }
    
    return true;
  } catch (error) {
    logger.error(`Failed to delete bulk pricing tier: ${error}`);
    throw error;
  }
}

/**
 * Get the applicable bulk pricing tier for a quantity
 * @param type Bulk pricing type
 * @param quantity Quantity
 * @returns Applicable bulk pricing tier or null if none applies
 */
export async function getApplicableBulkPricingTier(
  type: BulkPricingType,
  quantity: number
): Promise<BulkPricingTier | null> {
  try {
    // Get all active tiers for the type
    const tiers = await getAllBulkPricingTiers(type);
    
    // Find the applicable tier
    const applicableTier = tiers.find(tier => 
      quantity >= tier.minQuantity && 
      (!tier.maxQuantity || quantity <= tier.maxQuantity)
    );
    
    return applicableTier || null;
  } catch (error) {
    logger.error(`Failed to get applicable bulk pricing tier: ${error}`);
    throw error;
  }
}

/**
 * Calculate the discounted price for a quantity
 * @param type Bulk pricing type
 * @param quantity Quantity
 * @param unitPrice Unit price
 * @returns Discounted price
 */
export async function calculateBulkPrice(
  type: BulkPricingType,
  quantity: number,
  unitPrice: number
): Promise<{ 
  originalPrice: number; 
  discountedPrice: number; 
  discountPercentage: number; 
  savings: number;
  appliedTier: BulkPricingTier | null;
}> {
  try {
    const originalPrice = quantity * unitPrice;
    
    // Get the applicable tier
    const tier = await getApplicableBulkPricingTier(type, quantity);
    
    if (!tier) {
      // No discount applies
      return {
        originalPrice,
        discountedPrice: originalPrice,
        discountPercentage: 0,
        savings: 0,
        appliedTier: null
      };
    }
    
    // Calculate discounted price
    const discountMultiplier = 1 - (tier.discountPercentage / 100);
    const discountedPrice = originalPrice * discountMultiplier;
    const savings = originalPrice - discountedPrice;
    
    return {
      originalPrice,
      discountedPrice,
      discountPercentage: tier.discountPercentage,
      savings,
      appliedTier: tier
    };
  } catch (error) {
    logger.error(`Failed to calculate bulk price: ${error}`);
    throw error;
  }
}

export default {
  getAllBulkPricingTiers,
  getBulkPricingTierById,
  createBulkPricingTier,
  updateBulkPricingTier,
  deleteBulkPricingTier,
  getApplicableBulkPricingTier,
  calculateBulkPrice,
  BulkPricingType
};

/**
 * Bulk Credit Model
 * 
 * This model handles the storage and retrieval of bulk credit packages,
 * which provide volume discounts for credit purchases.
 */

import { supabaseClient } from '../services/supabase/supabaseClient';
import { logger } from '../utils/logger';

/**
 * Bulk credit package
 */
export interface BulkCreditPackage {
  id: string;
  name: string;
  description?: string;
  creditAmount: number;
  price: number;
  currency: string;
  discountPercentage: number;
  stripePriceId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Get all bulk credit packages
 * @param includeInactive Whether to include inactive packages
 * @returns Array of bulk credit packages
 */
export async function getAllBulkCreditPackages(includeInactive: boolean = false): Promise<BulkCreditPackage[]> {
  try {
    let query = supabaseClient.getClient()
      .from('bulk_credit_packages')
      .select('*')
      .order('creditAmount', { ascending: true });
    
    if (!includeInactive) {
      query = query.eq('isActive', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      logger.error(`Error getting bulk credit packages: ${error.message}`);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    logger.error(`Failed to get bulk credit packages: ${error}`);
    throw error;
  }
}

/**
 * Get a bulk credit package by ID
 * @param id Bulk credit package ID
 * @returns Bulk credit package or null if not found
 */
export async function getBulkCreditPackageById(id: string): Promise<BulkCreditPackage | null> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('bulk_credit_packages')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error(`Error getting bulk credit package: ${error.message}`);
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(`Failed to get bulk credit package: ${error}`);
    throw error;
  }
}

/**
 * Create a new bulk credit package
 * @param pkg Bulk credit package data
 * @returns Created bulk credit package
 */
export async function createBulkCreditPackage(
  pkg: Omit<BulkCreditPackage, 'id' | 'createdAt' | 'updatedAt'>
): Promise<BulkCreditPackage> {
  try {
    const now = new Date();
    const newPackage = {
      ...pkg,
      createdAt: now,
      updatedAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('bulk_credit_packages')
      .insert([newPackage])
      .select();
    
    if (error) {
      logger.error(`Error creating bulk credit package: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to create bulk credit package: ${error}`);
    throw error;
  }
}

/**
 * Update a bulk credit package
 * @param id Bulk credit package ID
 * @param updates Updates to apply
 * @returns Updated bulk credit package
 */
export async function updateBulkCreditPackage(
  id: string,
  updates: Partial<Omit<BulkCreditPackage, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<BulkCreditPackage> {
  try {
    const now = new Date();
    const updatedPackage = {
      ...updates,
      updatedAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('bulk_credit_packages')
      .update(updatedPackage)
      .eq('id', id)
      .select();
    
    if (error) {
      logger.error(`Error updating bulk credit package: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to update bulk credit package: ${error}`);
    throw error;
  }
}

/**
 * Delete a bulk credit package
 * @param id Bulk credit package ID
 * @returns Whether the package was deleted
 */
export async function deleteBulkCreditPackage(id: string): Promise<boolean> {
  try {
    const { error } = await supabaseClient.getClient()
      .from('bulk_credit_packages')
      .delete()
      .eq('id', id);
    
    if (error) {
      logger.error(`Error deleting bulk credit package: ${error.message}`);
      throw error;
    }
    
    return true;
  } catch (error) {
    logger.error(`Failed to delete bulk credit package: ${error}`);
    throw error;
  }
}

/**
 * Get the applicable bulk credit package for a credit amount
 * @param creditAmount Credit amount
 * @returns Applicable bulk credit package or null if none applies
 */
export async function getApplicableBulkCreditPackage(creditAmount: number): Promise<BulkCreditPackage | null> {
  try {
    // Get all active packages
    const packages = await getAllBulkCreditPackages();
    
    // Find the package with the closest credit amount that is less than or equal to the requested amount
    let bestMatch: BulkCreditPackage | null = null;
    
    for (const pkg of packages) {
      if (pkg.creditAmount <= creditAmount && (!bestMatch || pkg.creditAmount > bestMatch.creditAmount)) {
        bestMatch = pkg;
      }
    }
    
    return bestMatch;
  } catch (error) {
    logger.error(`Failed to get applicable bulk credit package: ${error}`);
    throw error;
  }
}

/**
 * Calculate the price for a credit amount
 * @param creditAmount Credit amount
 * @param baseUnitPrice Base unit price per credit
 * @returns Calculated price
 */
export async function calculateCreditPrice(
  creditAmount: number,
  baseUnitPrice: number
): Promise<{ 
  originalPrice: number; 
  discountedPrice: number; 
  discountPercentage: number; 
  savings: number;
  appliedPackage: BulkCreditPackage | null;
}> {
  try {
    const originalPrice = creditAmount * baseUnitPrice;
    
    // Get the applicable package
    const pkg = await getApplicableBulkCreditPackage(creditAmount);
    
    if (!pkg) {
      // No discount applies
      return {
        originalPrice,
        discountedPrice: originalPrice,
        discountPercentage: 0,
        savings: 0,
        appliedPackage: null
      };
    }
    
    // Calculate discounted price
    const discountMultiplier = 1 - (pkg.discountPercentage / 100);
    const discountedPrice = originalPrice * discountMultiplier;
    const savings = originalPrice - discountedPrice;
    
    return {
      originalPrice,
      discountedPrice,
      discountPercentage: pkg.discountPercentage,
      savings,
      appliedPackage: pkg
    };
  } catch (error) {
    logger.error(`Failed to calculate credit price: ${error}`);
    throw error;
  }
}

export default {
  getAllBulkCreditPackages,
  getBulkCreditPackageById,
  createBulkCreditPackage,
  updateBulkCreditPackage,
  deleteBulkCreditPackage,
  getApplicableBulkCreditPackage,
  calculateCreditPrice
};

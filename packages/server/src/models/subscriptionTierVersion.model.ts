/**
 * Subscription Tier Version Model
 * 
 * This model handles versioning of subscription tiers, allowing for tracking changes
 * and managing transitions between different versions of subscription plans.
 */

import { supabaseClient } from '../services/supabase/supabaseClient';
import { logger } from '../utils/logger';
import { getTierById } from './subscriptionTier.model';

/**
 * Represents a subscription tier version
 */
export interface SubscriptionTierVersion {
  id: string;
  tierId: string;
  versionNumber: number;
  changes: Record<string, any>;
  effectiveDate: Date;
  createdAt: Date;
  createdBy: string;
}

/**
 * Get all versions of a subscription tier
 * @param tierId Subscription tier ID
 * @returns Array of subscription tier versions
 */
export async function getTierVersions(tierId: string): Promise<SubscriptionTierVersion[]> {
  try {
    // Type assertion applied earlier in the chain
    const { data, error } = await (supabaseClient.getClient()
      .from('subscription_tier_versions') as any)
      .select('*')
      .eq('tierId', tierId)
      .order('versionNumber', { ascending: false });
    
    if (error) {
      logger.error(`Error getting tier versions: ${error.message}`);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    logger.error(`Failed to get tier versions: ${error}`);
    throw error;
  }
}

/**
 * Get a specific version of a subscription tier
 * @param tierId Subscription tier ID
 * @param versionNumber Version number
 * @returns Subscription tier version or null if not found
 */
export async function getTierVersion(
  tierId: string,
  versionNumber: number
): Promise<SubscriptionTierVersion | null> {
  try {
    // Type assertion applied earlier in the chain
    const { data, error } = await (supabaseClient.getClient()
      .from('subscription_tier_versions') as any)
      .select('*')
      .eq('tierId', tierId)
      .eq('versionNumber', versionNumber)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No records found
        return null;
      }
      logger.error(`Error getting tier version: ${error.message}`);
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(`Failed to get tier version: ${error}`);
    throw error;
  }
}

/**
 * Get the latest version of a subscription tier
 * @param tierId Subscription tier ID
 * @returns Latest subscription tier version or null if none exists
 */
export async function getLatestTierVersion(tierId: string): Promise<SubscriptionTierVersion | null> {
  try {
    // Type assertion applied earlier in the chain
    const { data, error } = await (supabaseClient.getClient()
      .from('subscription_tier_versions') as any)
      .select('*')
      .eq('tierId', tierId)
      .order('versionNumber', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No records found
        return null;
      }
      logger.error(`Error getting latest tier version: ${error.message}`);
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(`Failed to get latest tier version: ${error}`);
    throw error;
  }
}

/**
 * Create a new version of a subscription tier
 * @param tierId Subscription tier ID
 * @param changes Changes from previous version
 * @param effectiveDate Date when the version becomes effective
 * @param createdBy User ID who created the version
 * @returns Created subscription tier version
 */
export async function createTierVersion(
  tierId: string,
  changes: Record<string, any>,
  effectiveDate: Date,
  createdBy: string
): Promise<SubscriptionTierVersion> {
  try {
    // Check if tier exists
    const tier = await getTierById(tierId);
    
    if (!tier) {
      throw new Error(`Subscription tier not found: ${tierId}`);
    }
    
    // Get latest version number
    const latestVersion = await getLatestTierVersion(tierId);
    const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
    
    // Create new version
    const now = new Date();
    const newVersion = {
      tierId,
      versionNumber,
      changes,
      effectiveDate,
      createdAt: now,
      createdBy
    };
    
    // Type assertion applied earlier in the chain
    const { data, error } = await (supabaseClient.getClient()
      .from('subscription_tier_versions') as any)
      .insert([newVersion])
      .select();
    
    if (error) {
      logger.error(`Error creating tier version: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to create tier version: ${error}`);
    throw error;
  }
}

/**
 * Apply a version to the subscription tier
 * @param tierId Subscription tier ID
 * @param versionNumber Version number to apply
 * @returns Updated subscription tier
 */
export async function applyTierVersion(
  tierId: string,
  versionNumber: number
): Promise<any> {
  try {
    // Get tier
    const tier = await getTierById(tierId);
    
    if (!tier) {
      throw new Error(`Subscription tier not found: ${tierId}`);
    }
    
    // Get version
    const version = await getTierVersion(tierId, versionNumber);
    
    if (!version) {
      throw new Error(`Subscription tier version not found: ${versionNumber}`);
    }
    
    // Apply changes to tier
    const updatedTier = {
      ...tier,
      ...version.changes
    };
    
    // Update tier in database
    // Type assertion applied earlier in the chain
    const { data, error } = await (supabaseClient.getClient()
      .from('subscription_tiers') as any)
      .update(updatedTier)
      .eq('id', tierId)
      .select();
    
    if (error) {
      logger.error(`Error updating tier: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to apply tier version: ${error}`);
    throw error;
  }
}

/**
 * Get the effective version of a subscription tier at a specific date
 * @param tierId Subscription tier ID
 * @param date Date to check
 * @returns Effective subscription tier version or null if none exists
 */
export async function getEffectiveTierVersion(
  tierId: string,
  date: Date = new Date()
): Promise<SubscriptionTierVersion | null> {
  try {
    // Type assertion applied earlier in the chain
    const { data, error } = await (supabaseClient.getClient()
      .from('subscription_tier_versions') as any)
      .select('*')
      .eq('tierId', tierId)
      .lte('effectiveDate', date)
      .order('effectiveDate', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No records found
        return null;
      }
      logger.error(`Error getting effective tier version: ${error.message}`);
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(`Failed to get effective tier version: ${error}`);
    throw error;
  }
}

export default {
  getTierVersions,
  getTierVersion,
  getLatestTierVersion,
  createTierVersion,
  applyTierVersion,
  getEffectiveTierVersion
};

/**
 * Pricing Version Model
 * 
 * This model handles the storage and retrieval of pricing versions,
 * which are used to implement grandfathered pricing.
 */

import { supabaseClient } from '../services/supabase/supabaseClient';
import { logger } from '../utils/logger';

/**
 * Pricing version
 */
export interface PricingVersion {
  id: string;
  name: string;
  description?: string;
  effectiveDate: Date;
  expirationDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  metadata?: Record<string, any>;
}

/**
 * Tier pricing in a version
 */
export interface TierPricing {
  id: string;
  versionId: string;
  tierId: string;
  price: number;
  currency: string;
  billingInterval: 'monthly' | 'yearly' | 'one-time';
  stripePriceId?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * User pricing assignment
 */
export interface UserPricingAssignment {
  id: string;
  userId: string;
  versionId: string;
  assignedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Get all pricing versions
 * @param includeInactive Whether to include inactive versions
 * @returns Array of pricing versions
 */
export async function getAllPricingVersions(includeInactive: boolean = false): Promise<PricingVersion[]> {
  try {
    let query = supabaseClient.getClient()
      .from('pricing_versions')
      .select('*')
      .order('effectiveDate', { ascending: false });
    
    if (!includeInactive) {
      query = query.eq('isActive', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      logger.error(`Error getting pricing versions: ${error.message}`);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    logger.error(`Failed to get pricing versions: ${error}`);
    throw error;
  }
}

/**
 * Get a pricing version by ID
 * @param id Pricing version ID
 * @returns Pricing version or null if not found
 */
export async function getPricingVersionById(id: string): Promise<PricingVersion | null> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('pricing_versions')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error(`Error getting pricing version: ${error.message}`);
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(`Failed to get pricing version: ${error}`);
    throw error;
  }
}

/**
 * Get the current pricing version
 * @returns Current pricing version or null if none is active
 */
export async function getCurrentPricingVersion(): Promise<PricingVersion | null> {
  try {
    const now = new Date();
    
    const { data, error } = await supabaseClient.getClient()
      .from('pricing_versions')
      .select('*')
      .eq('isActive', true)
      .lte('effectiveDate', now.toISOString())
      .is('expirationDate', null)
      .order('effectiveDate', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error(`Error getting current pricing version: ${error.message}`);
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(`Failed to get current pricing version: ${error}`);
    throw error;
  }
}

/**
 * Create a new pricing version
 * @param version Pricing version data
 * @returns Created pricing version
 */
export async function createPricingVersion(
  version: Omit<PricingVersion, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PricingVersion> {
  try {
    const now = new Date();
    const newVersion = {
      ...version,
      createdAt: now,
      updatedAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('pricing_versions')
      .insert([newVersion])
      .select();
    
    if (error) {
      logger.error(`Error creating pricing version: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to create pricing version: ${error}`);
    throw error;
  }
}

/**
 * Update a pricing version
 * @param id Pricing version ID
 * @param updates Updates to apply
 * @returns Updated pricing version
 */
export async function updatePricingVersion(
  id: string,
  updates: Partial<Omit<PricingVersion, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>
): Promise<PricingVersion> {
  try {
    const now = new Date();
    const updatedVersion = {
      ...updates,
      updatedAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('pricing_versions')
      .update(updatedVersion)
      .eq('id', id)
      .select();
    
    if (error) {
      logger.error(`Error updating pricing version: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to update pricing version: ${error}`);
    throw error;
  }
}

/**
 * Get tier pricing for a version
 * @param versionId Pricing version ID
 * @returns Array of tier pricing
 */
export async function getTierPricingForVersion(versionId: string): Promise<TierPricing[]> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('tier_pricing')
      .select('*')
      .eq('versionId', versionId);
    
    if (error) {
      logger.error(`Error getting tier pricing: ${error.message}`);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    logger.error(`Failed to get tier pricing: ${error}`);
    throw error;
  }
}

/**
 * Get tier pricing by ID
 * @param id Tier pricing ID
 * @returns Tier pricing or null if not found
 */
export async function getTierPricingById(id: string): Promise<TierPricing | null> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('tier_pricing')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error(`Error getting tier pricing: ${error.message}`);
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(`Failed to get tier pricing: ${error}`);
    throw error;
  }
}

/**
 * Create tier pricing
 * @param pricing Tier pricing data
 * @returns Created tier pricing
 */
export async function createTierPricing(
  pricing: Omit<TierPricing, 'id' | 'createdAt' | 'updatedAt'>
): Promise<TierPricing> {
  try {
    const now = new Date();
    const newPricing = {
      ...pricing,
      createdAt: now,
      updatedAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('tier_pricing')
      .insert([newPricing])
      .select();
    
    if (error) {
      logger.error(`Error creating tier pricing: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to create tier pricing: ${error}`);
    throw error;
  }
}

/**
 * Update tier pricing
 * @param id Tier pricing ID
 * @param updates Updates to apply
 * @returns Updated tier pricing
 */
export async function updateTierPricing(
  id: string,
  updates: Partial<Omit<TierPricing, 'id' | 'versionId' | 'tierId' | 'createdAt' | 'updatedAt'>>
): Promise<TierPricing> {
  try {
    const now = new Date();
    const updatedPricing = {
      ...updates,
      updatedAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('tier_pricing')
      .update(updatedPricing)
      .eq('id', id)
      .select();
    
    if (error) {
      logger.error(`Error updating tier pricing: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to update tier pricing: ${error}`);
    throw error;
  }
}

/**
 * Delete tier pricing
 * @param id Tier pricing ID
 * @returns Whether the pricing was deleted
 */
export async function deleteTierPricing(id: string): Promise<boolean> {
  try {
    const { error } = await supabaseClient.getClient()
      .from('tier_pricing')
      .delete()
      .eq('id', id);
    
    if (error) {
      logger.error(`Error deleting tier pricing: ${error.message}`);
      throw error;
    }
    
    return true;
  } catch (error) {
    logger.error(`Failed to delete tier pricing: ${error}`);
    throw error;
  }
}

/**
 * Get user pricing assignments
 * @param userId User ID
 * @returns Array of user pricing assignments
 */
export async function getUserPricingAssignments(userId: string): Promise<UserPricingAssignment[]> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('user_pricing_assignments')
      .select('*')
      .eq('userId', userId)
      .eq('isActive', true)
      .order('assignedAt', { ascending: false });
    
    if (error) {
      logger.error(`Error getting user pricing assignments: ${error.message}`);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    logger.error(`Failed to get user pricing assignments: ${error}`);
    throw error;
  }
}

/**
 * Get a user pricing assignment by ID
 * @param id User pricing assignment ID
 * @returns User pricing assignment or null if not found
 */
export async function getUserPricingAssignmentById(id: string): Promise<UserPricingAssignment | null> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('user_pricing_assignments')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error(`Error getting user pricing assignment: ${error.message}`);
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(`Failed to get user pricing assignment: ${error}`);
    throw error;
  }
}

/**
 * Create a user pricing assignment
 * @param assignment User pricing assignment data
 * @returns Created user pricing assignment
 */
export async function createUserPricingAssignment(
  assignment: Omit<UserPricingAssignment, 'id' | 'createdAt' | 'updatedAt'>
): Promise<UserPricingAssignment> {
  try {
    const now = new Date();
    const newAssignment = {
      ...assignment,
      createdAt: now,
      updatedAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('user_pricing_assignments')
      .insert([newAssignment])
      .select();
    
    if (error) {
      logger.error(`Error creating user pricing assignment: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to create user pricing assignment: ${error}`);
    throw error;
  }
}

/**
 * Update a user pricing assignment
 * @param id User pricing assignment ID
 * @param updates Updates to apply
 * @returns Updated user pricing assignment
 */
export async function updateUserPricingAssignment(
  id: string,
  updates: Partial<Omit<UserPricingAssignment, 'id' | 'userId' | 'versionId' | 'assignedAt' | 'createdAt' | 'updatedAt' | 'createdBy'>>
): Promise<UserPricingAssignment> {
  try {
    const now = new Date();
    const updatedAssignment = {
      ...updates,
      updatedAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('user_pricing_assignments')
      .update(updatedAssignment)
      .eq('id', id)
      .select();
    
    if (error) {
      logger.error(`Error updating user pricing assignment: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to update user pricing assignment: ${error}`);
    throw error;
  }
}

/**
 * Deactivate a user pricing assignment
 * @param id User pricing assignment ID
 * @returns Updated user pricing assignment
 */
export async function deactivateUserPricingAssignment(id: string): Promise<UserPricingAssignment> {
  try {
    const now = new Date();
    const updates = {
      isActive: false,
      expiresAt: now,
      updatedAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('user_pricing_assignments')
      .update(updates)
      .eq('id', id)
      .select();
    
    if (error) {
      logger.error(`Error deactivating user pricing assignment: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to deactivate user pricing assignment: ${error}`);
    throw error;
  }
}

/**
 * Get the active pricing version for a user
 * @param userId User ID
 * @returns Active pricing version or null if none is assigned
 */
export async function getUserActivePricingVersion(userId: string): Promise<PricingVersion | null> {
  try {
    const now = new Date();
    
    // Get the user's active pricing assignments
    const { data: assignments, error: assignmentError } = await supabaseClient.getClient()
      .from('user_pricing_assignments')
      .select('*')
      .eq('userId', userId)
      .eq('isActive', true)
      .is('expiresAt', null)
      .order('assignedAt', { ascending: false })
      .limit(1);
    
    if (assignmentError) {
      logger.error(`Error getting user pricing assignments: ${assignmentError.message}`);
      throw assignmentError;
    }
    
    if (!assignments || assignments.length === 0) {
      // No assignments, use current pricing
      return await getCurrentPricingVersion();
    }
    
    // Get the assigned pricing version
    const { data: version, error: versionError } = await supabaseClient.getClient()
      .from('pricing_versions')
      .select('*')
      .eq('id', assignments[0].versionId)
      .eq('isActive', true)
      .single();
    
    if (versionError) {
      if (versionError.code === 'PGRST116') {
        // Assigned version not found or inactive, use current pricing
        return await getCurrentPricingVersion();
      }
      logger.error(`Error getting pricing version: ${versionError.message}`);
      throw versionError;
    }
    
    return version;
  } catch (error) {
    logger.error(`Failed to get user active pricing version: ${error}`);
    throw error;
  }
}

/**
 * Get the price for a tier based on user's pricing version
 * @param userId User ID
 * @param tierId Subscription tier ID
 * @returns Tier pricing or null if not found
 */
export async function getUserTierPrice(userId: string, tierId: string): Promise<TierPricing | null> {
  try {
    // Get the user's active pricing version
    const version = await getUserActivePricingVersion(userId);
    
    if (!version) {
      return null;
    }
    
    // Get the tier pricing for this version
    const { data, error } = await supabaseClient.getClient()
      .from('tier_pricing')
      .select('*')
      .eq('versionId', version.id)
      .eq('tierId', tierId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error(`Error getting tier pricing: ${error.message}`);
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(`Failed to get user tier price: ${error}`);
    throw error;
  }
}

export default {
  getAllPricingVersions,
  getPricingVersionById,
  getCurrentPricingVersion,
  createPricingVersion,
  updatePricingVersion,
  getTierPricingForVersion,
  getTierPricingById,
  createTierPricing,
  updateTierPricing,
  deleteTierPricing,
  getUserPricingAssignments,
  getUserPricingAssignmentById,
  createUserPricingAssignment,
  updateUserPricingAssignment,
  deactivateUserPricingAssignment,
  getUserActivePricingVersion,
  getUserTierPrice
};

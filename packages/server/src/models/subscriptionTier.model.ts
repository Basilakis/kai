/**
 * Subscription Tier Model
 * 
 * This model defines the different subscription tiers available in the system,
 * including their access permissions to different modules and API rate limits.
 */

import { supabaseClient } from '../services/supabase/supabaseClient';
import { logger } from '../utils/logger';

/**
 * Represents a system module that can be enabled/disabled per subscription tier
 */
export interface ModuleAccess {
  name: string;             // Module name (e.g., 'agents', 'ml', 'knowledge-base')
  enabled: boolean;         // Whether the module is enabled for this tier
  specificFeatures?: {      // Optional specific features within the module
    [featureName: string]: boolean;
  };
  usageLimits?: {           // Optional usage limits for the module
    [limitType: string]: number;
  };
}

/**
 * Represents API limits for a subscription tier
 */
export interface ApiLimits {
  requestsPerMinute: number;   // Rate limit per minute
  requestsPerDay: number;      // Daily request limit
  requestsPerMonth: number;    // Monthly request limit
  maxPayloadSize?: number;     // Maximum payload size in KB
  includedModules: string[];   // API modules included in this tier
}

/**
 * Represents a subscription tier
 */
export interface SubscriptionTier {
  id: string;                  // Unique ID
  name: string;                // Display name (e.g., 'Free', 'Basic', 'Premium')
  description: string;         // Description of the tier
  price: number;               // Monthly price (0 for free)
  currency: string;            // Currency code (e.g., 'USD')
  stripePriceId?: string;      // ID for Stripe integration (future use)
  moduleAccess: ModuleAccess[]; // List of modules and their access permissions
  apiLimits: ApiLimits;        // API usage limits
  maxProjects?: number;        // Maximum number of projects
  maxTeamMembers?: number;     // Maximum number of team members
  supportLevel: 'basic' | 'priority' | 'dedicated'; // Support level
  customFeatures?: string[];   // Additional custom features
  isPublic: boolean;           // Whether tier is publicly available
  createdAt: Date;             // Creation date
  updatedAt: Date;             // Last update date
}

/**
 * Get all subscription tiers
 * @param includeNonPublic Whether to include non-public tiers
 * @returns Array of subscription tiers
 */
export async function getAllSubscriptionTiers(includeNonPublic = false): Promise<SubscriptionTier[]> {
  try {
    // Construct query with type assertion applied at the start
    const query = supabaseClient.getClient()
      .from('subscription_tiers') as any;
    
    // Build query
    const queryBuilder = query.select('*');
    
    // Filter out non-public tiers if required
    if (!includeNonPublic) {
      queryBuilder.eq('isPublic', true);
    }
    
    // Execute query
    const { data, error } = await queryBuilder.order('price', { ascending: true });
    
    if (error) {
      logger.error(`Error fetching subscription tiers: ${error.message}`);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    logger.error(`Failed to get subscription tiers: ${error}`);
    return [];
  }
}

/**
 * Get subscription tier by ID
 * @param id Tier ID
 * @returns Subscription tier or null if not found
 */
export async function getSubscriptionTierById(id: string): Promise<SubscriptionTier | null> {
  try {
    // Type assertion applied earlier in the chain
    const { data, error } = await (supabaseClient.getClient()
      .from('subscription_tiers') as any)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // Record not found
        return null;
      }
      logger.error(`Error fetching subscription tier: ${error.message}`);
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(`Failed to get subscription tier: ${error}`);
    return null;
  }
}

/**
 * Create a new subscription tier
 * @param tierData Subscription tier data
 * @returns Created subscription tier
 */
export async function createSubscriptionTier(tierData: Omit<SubscriptionTier, 'id' | 'createdAt' | 'updatedAt'>): Promise<SubscriptionTier> {
  try {
    const newTier = {
      ...tierData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Type assertion applied earlier in the chain
    const { data, error } = await (supabaseClient.getClient()
      .from('subscription_tiers') as any)
      .insert([newTier])
      .select();
    
    if (error) {
      logger.error(`Error creating subscription tier: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to create subscription tier: ${error}`);
    throw error;
  }
}

/**
 * Update an existing subscription tier
 * @param id Tier ID
 * @param tierData Updated subscription tier data
 * @returns Updated subscription tier
 */
export async function updateSubscriptionTier(id: string, tierData: Partial<Omit<SubscriptionTier, 'id' | 'createdAt' | 'updatedAt'>>): Promise<SubscriptionTier> {
  try {
    const updates = {
      ...tierData,
      updatedAt: new Date()
    };
    
    // Type assertion applied earlier in the chain
    const { data, error } = await (supabaseClient.getClient()
      .from('subscription_tiers') as any)
      .update(updates)
      .eq('id', id)
      .select();
    
    if (error) {
      logger.error(`Error updating subscription tier: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to update subscription tier: ${error}`);
    throw error;
  }
}

/**
 * Delete a subscription tier
 * @param id Tier ID
 * @returns True if deleted successfully
 */
export async function deleteSubscriptionTier(id: string): Promise<boolean> {
  try {
    // Type assertion applied earlier in the chain
    const { error } = await (supabaseClient.getClient()
      .from('subscription_tiers') as any)
      .delete()
      .eq('id', id);
    
    if (error) {
      logger.error(`Error deleting subscription tier: ${error.message}`);
      throw error;
    }
    
    return true;
  } catch (error) {
    logger.error(`Failed to delete subscription tier: ${error}`);
    return false;
  }
}
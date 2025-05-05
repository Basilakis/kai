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
 * Represents storage limits for a subscription tier
 */
export interface StorageLimits {
  maxStorageGB: number;        // Maximum storage in GB
  maxFileSize: number;         // Maximum file size in MB
  maxFilesPerProject: number;  // Maximum files per project
}

/**
 * Represents credit limits for a subscription tier
 */
export interface CreditLimits {
  includedCredits: number;     // Credits included with subscription
  maxPurchasableCredits: number; // Maximum credits that can be purchased
  creditPriceMultiplier: number; // Price multiplier for credits (e.g., 0.8 for 20% discount)
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
  stripePriceId?: string;      // ID for Stripe integration
  stripeProductId?: string;    // Stripe product ID
  billingInterval: 'monthly' | 'yearly' | 'one-time'; // Billing interval
  moduleAccess: ModuleAccess[]; // List of modules and their access permissions
  apiLimits: ApiLimits;        // API usage limits
  storageLimits: StorageLimits; // Storage limits
  creditLimits: CreditLimits;  // Credit limits
  maxProjects?: number;        // Maximum number of projects
  maxTeamMembers?: number;     // Maximum number of team members
  maxMoodboards?: number;      // Maximum number of moodboards
  supportLevel: 'basic' | 'priority' | 'dedicated'; // Support level
  isPublic: boolean;           // Whether the tier is publicly visible
  customFeatures?: string[];   // Additional custom features
  userTypes?: string[];        // User types that can access this tier ('user', 'factory', 'b2b', 'admin')
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

/**
 * Get subscription tiers for a specific user type
 * @param userType The user type to filter by
 * @param includeNonPublic Whether to include non-public tiers
 * @returns Array of subscription tiers available for the user type
 */
export async function getSubscriptionTiersByUserType(userType: string, includeNonPublic = false): Promise<SubscriptionTier[]> {
  try {
    // Get all tiers first
    const allTiers = await getAllSubscriptionTiers(includeNonPublic);

    // Get user type associations from the subscription_tier_user_types table
    const { data: userTypeAssociations, error } = await (supabaseClient.getClient()
      .from('subscription_tier_user_types') as any)
      .select('tier_id')
      .eq('user_type', userType);

    if (error) {
      logger.error(`Error fetching subscription tier user types: ${error.message}`);
      throw error;
    }

    if (!userTypeAssociations || userTypeAssociations.length === 0) {
      // If no specific associations, return tiers that don't have any user type restrictions
      return allTiers.filter(tier => !tier.userTypes || tier.userTypes.length === 0);
    }

    // Get the tier IDs associated with this user type
    const tierIds = userTypeAssociations.map(assoc => assoc.tier_id);

    // Filter tiers by the associated tier IDs or tiers with no user type restrictions
    return allTiers.filter(tier =>
      tierIds.includes(tier.id) ||
      !tier.userTypes ||
      tier.userTypes.length === 0 ||
      tier.userTypes.includes(userType)
    );
  } catch (error) {
    logger.error(`Failed to get subscription tiers by user type: ${error}`);
    return [];
  }
}

/**
 * Associate a subscription tier with a user type
 * @param tierId The subscription tier ID
 * @param userType The user type to associate with the tier
 * @returns True if the association was created successfully
 */
export async function associateTierWithUserType(tierId: string, userType: string): Promise<boolean> {
  try {
    // Check if the tier exists
    const tier = await getSubscriptionTierById(tierId);
    if (!tier) {
      throw new Error(`Subscription tier with ID ${tierId} not found`);
    }

    // Create the association
    const { error } = await (supabaseClient.getClient()
      .from('subscription_tier_user_types') as any)
      .insert([{
        tier_id: tierId,
        user_type: userType
      }]);

    if (error) {
      // If the error is a unique constraint violation, the association already exists
      if (error.code === '23505') {
        return true; // Already exists, consider it a success
      }
      logger.error(`Error associating tier with user type: ${error.message}`);
      throw error;
    }

    return true;
  } catch (error) {
    logger.error(`Failed to associate tier with user type: ${error}`);
    return false;
  }
}

/**
 * Remove an association between a subscription tier and a user type
 * @param tierId The subscription tier ID
 * @param userType The user type to disassociate from the tier
 * @returns True if the association was removed successfully
 */
export async function disassociateTierFromUserType(tierId: string, userType: string): Promise<boolean> {
  try {
    // Remove the association
    const { error } = await (supabaseClient.getClient()
      .from('subscription_tier_user_types') as any)
      .delete()
      .eq('tier_id', tierId)
      .eq('user_type', userType);

    if (error) {
      logger.error(`Error disassociating tier from user type: ${error.message}`);
      throw error;
    }

    return true;
  } catch (error) {
    logger.error(`Failed to disassociate tier from user type: ${error}`);
    return false;
  }
}

/**
 * Get all user types associated with a subscription tier
 * @param tierId The subscription tier ID
 * @returns Array of user types associated with the tier
 */
export async function getUserTypesForTier(tierId: string): Promise<string[]> {
  try {
    // Get the associations
    const { data, error } = await (supabaseClient.getClient()
      .from('subscription_tier_user_types') as any)
      .select('user_type')
      .eq('tier_id', tierId);

    if (error) {
      logger.error(`Error fetching user types for tier: ${error.message}`);
      throw error;
    }

    // Extract the user types
    return data ? data.map(item => item.user_type) : [];
  } catch (error) {
    logger.error(`Failed to get user types for tier: ${error}`);
    return [];
  }
}
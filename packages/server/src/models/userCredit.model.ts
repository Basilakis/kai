/**
 * User Credit Model
 *
 * This model handles user credits for purchasing additional resources
 * beyond what's included in their subscription plan.
 */

import { supabaseClient } from '../services/supabase/supabaseClient';
import { logger } from '../utils/logger';
import serviceCostModel from './serviceCost.model';

/**
 * Represents a credit transaction
 */
export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;  // Positive for additions, negative for usage
  balance: number; // Balance after transaction
  description: string;
  type: 'purchase' | 'usage' | 'refund' | 'expiration' | 'adjustment' | 'subscription';
  metadata?: Record<string, any>;
  serviceKey?: string; // Key of the service that used the credits
  serviceUsage?: Record<string, any>; // Details of service usage
  createdAt: Date;
  expiresAt?: Date; // Optional expiration date for credits
}

/**
 * Represents a user's credit balance
 */
export interface UserCredit {
  id: string;
  userId: string;
  balance: number;
  lastUpdatedAt: Date;
  createdAt: Date;
}

/**
 * Get user credit balance
 * @param userId User ID
 * @returns User credit object or null if not found
 */
export async function getUserCredit(userId: string): Promise<UserCredit | null> {
  try {
    // Type assertion applied earlier in the chain
    const { data, error } = await (supabaseClient.getClient()
      .from('user_credits') as any)
      .select('*')
      .eq('userId', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No records found
        return null;
      }
      logger.error(`Error getting user credit: ${error.message}`);
      throw error;
    }

    return data;
  } catch (error) {
    logger.error(`Failed to get user credit: ${error}`);
    throw error;
  }
}

/**
 * Create user credit record
 * @param userId User ID
 * @param initialBalance Initial credit balance
 * @returns Created user credit object
 */
export async function createUserCredit(
  userId: string,
  initialBalance: number = 0
): Promise<UserCredit> {
  try {
    const now = new Date();
    const newCredit = {
      userId,
      balance: initialBalance,
      lastUpdatedAt: now,
      createdAt: now
    };

    // Type assertion applied earlier in the chain
    const { data, error } = await (supabaseClient.getClient()
      .from('user_credits') as any)
      .insert([newCredit])
      .select();

    if (error) {
      logger.error(`Error creating user credit: ${error.message}`);
      throw error;
    }

    return data[0];
  } catch (error) {
    logger.error(`Failed to create user credit: ${error}`);
    throw error;
  }
}

/**
 * Update user credit balance
 * @param userId User ID
 * @param newBalance New credit balance
 * @returns Updated user credit object
 */
export async function updateUserCreditBalance(
  userId: string,
  newBalance: number
): Promise<UserCredit> {
  try {
    // Get current user credit
    let userCredit = await getUserCredit(userId);

    // If user credit doesn't exist, create it
    if (!userCredit) {
      userCredit = await createUserCredit(userId, newBalance);
      return userCredit;
    }

    // Update balance
    const now = new Date();
    const updatedCredit = {
      balance: newBalance,
      lastUpdatedAt: now
    };

    // Type assertion applied earlier in the chain
    const { data, error } = await (supabaseClient.getClient()
      .from('user_credits') as any)
      .update(updatedCredit)
      .eq('userId', userId)
      .select();

    if (error) {
      logger.error(`Error updating user credit: ${error.message}`);
      throw error;
    }

    return data[0];
  } catch (error) {
    logger.error(`Failed to update user credit: ${error}`);
    throw error;
  }
}

/**
 * Add credits to user
 * @param userId User ID
 * @param amount Amount to add
 * @param description Transaction description
 * @param type Transaction type
 * @param metadata Additional metadata
 * @param expiresAt Optional expiration date
 * @returns Updated user credit object and transaction
 */
export async function addCredits(
  userId: string,
  amount: number,
  description: string,
  type: CreditTransaction['type'] = 'purchase',
  metadata?: Record<string, any>,
  expiresAt?: Date
): Promise<{ userCredit: UserCredit; transaction: CreditTransaction }> {
  try {
    if (amount <= 0) {
      throw new Error('Amount must be positive when adding credits');
    }

    // Get current user credit
    let userCredit = await getUserCredit(userId);

    // If user credit doesn't exist, create it
    if (!userCredit) {
      userCredit = await createUserCredit(userId, 0);
    }

    // Calculate new balance
    const newBalance = userCredit.balance + amount;

    // Create transaction
    const now = new Date();
    const transaction = {
      userId,
      amount,
      balance: newBalance,
      description,
      type,
      metadata,
      createdAt: now,
      expiresAt
    };

    // Type assertion applied earlier in the chain
    const { data: transactionData, error: transactionError } = await (supabaseClient.getClient()
      .from('credit_transactions') as any)
      .insert([transaction])
      .select();

    if (transactionError) {
      logger.error(`Error creating credit transaction: ${transactionError.message}`);
      throw transactionError;
    }

    // Update user credit balance
    const updatedUserCredit = await updateUserCreditBalance(userId, newBalance);

    return {
      userCredit: updatedUserCredit,
      transaction: transactionData[0]
    };
  } catch (error) {
    logger.error(`Failed to add credits: ${error}`);
    throw error;
  }
}

/**
 * Use credits from user
 * @param userId User ID
 * @param amount Amount to use
 * @param description Transaction description
 * @param type Transaction type
 * @param metadata Additional metadata
 * @param serviceKey Optional service key for tracking service usage
 * @param serviceUsage Optional service usage details
 * @returns Updated user credit object and transaction
 */
export async function useCredits(
  userId: string,
  amount: number,
  description: string,
  type: CreditTransaction['type'] = 'usage',
  metadata?: Record<string, any>,
  serviceKey?: string,
  serviceUsage?: Record<string, any>
): Promise<{ userCredit: UserCredit; transaction: CreditTransaction }> {
  try {
    if (amount <= 0) {
      throw new Error('Amount must be positive when using credits');
    }

    // Get current user credit
    const userCredit = await getUserCredit(userId);

    // Check if user has enough credits
    if (!userCredit || userCredit.balance < amount) {
      throw new Error('Insufficient credits');
    }

    // Calculate new balance
    const newBalance = userCredit.balance - amount;

    // Create transaction (negative amount for usage)
    const now = new Date();
    const transaction = {
      userId,
      amount: -amount, // Negative for usage
      balance: newBalance,
      description,
      type,
      metadata,
      serviceKey,
      serviceUsage,
      createdAt: now
    };

    // Type assertion applied earlier in the chain
    const { data: transactionData, error: transactionError } = await (supabaseClient.getClient()
      .from('credit_transactions') as any)
      .insert([transaction])
      .select();

    if (transactionError) {
      logger.error(`Error creating credit transaction: ${transactionError.message}`);
      throw transactionError;
    }

    // Update user credit balance
    const updatedUserCredit = await updateUserCreditBalance(userId, newBalance);

    return {
      userCredit: updatedUserCredit,
      transaction: transactionData[0]
    };
  } catch (error) {
    logger.error(`Failed to use credits: ${error}`);
    throw error;
  }
}

/**
 * Get credit transactions for a user
 * @param userId User ID
 * @param limit Maximum number of transactions to return
 * @param offset Offset for pagination
 * @returns List of credit transactions
 */
export async function getCreditTransactions(
  userId: string,
  limit: number = 10,
  offset: number = 0
): Promise<CreditTransaction[]> {
  try {
    // Type assertion applied earlier in the chain
    const { data, error } = await (supabaseClient.getClient()
      .from('credit_transactions') as any)
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error(`Error getting credit transactions: ${error.message}`);
      throw error;
    }

    return data;
  } catch (error) {
    logger.error(`Failed to get credit transactions: ${error}`);
    throw error;
  }
}

/**
 * Check if user has enough credits
 * @param userId User ID
 * @param amount Amount to check
 * @returns Whether user has enough credits
 */
export async function hasEnoughCredits(userId: string, amount: number): Promise<boolean> {
  try {
    const userCredit = await getUserCredit(userId);
    return !!userCredit && userCredit.balance >= amount;
  } catch (error) {
    logger.error(`Failed to check if user has enough credits: ${error}`);
    return false;
  }
}

/**
 * Initialize user credit if it doesn't exist
 * @param userId User ID
 * @param initialBalance Initial credit balance
 * @returns User credit object
 */
export async function initializeUserCredit(
  userId: string,
  initialBalance: number = 0
): Promise<UserCredit> {
  try {
    // Check if user credit already exists
    const existingCredit = await getUserCredit(userId);

    if (existingCredit) {
      return existingCredit;
    }

    // Create new user credit
    return await createUserCredit(userId, initialBalance);
  } catch (error) {
    logger.error(`Failed to initialize user credit: ${error}`);
    throw error;
  }
}

/**
 * Use credits for a specific service
 * @param userId User ID
 * @param serviceKey Service key
 * @param units Number of units used
 * @param description Transaction description
 * @param metadata Additional metadata
 * @returns Updated user credit object and transaction
 */
export async function useServiceCredits(
  userId: string,
  serviceKey: string,
  units: number,
  description: string,
  metadata?: Record<string, any>
): Promise<{ userCredit: UserCredit; transaction: CreditTransaction }> {
  try {
    // Calculate credit cost based on service and units
    const creditCost = await serviceCostModel.calculateCreditCost(serviceKey, units);

    // Create service usage details
    const serviceUsage = {
      units,
      unitCost: creditCost / units,
      totalCost: creditCost
    };

    // Use credits with service tracking
    return await useCredits(
      userId,
      creditCost,
      description,
      'usage',
      metadata,
      serviceKey,
      serviceUsage
    );
  } catch (error) {
    logger.error(`Failed to use service credits: ${error}`);
    throw error;
  }
}

/**
 * Get credit usage by service
 * @param userId User ID
 * @param limit Maximum number of transactions to return
 * @param offset Offset for pagination
 * @returns List of credit transactions grouped by service
 */
export async function getCreditUsageByService(
  userId: string,
  limit: number = 10,
  offset: number = 0
): Promise<Record<string, { totalCredits: number, transactions: CreditTransaction[] }>> {
  try {
    // Type assertion applied earlier in the chain
    const { data, error } = await (supabaseClient.getClient()
      .from('credit_transactions') as any)
      .select('*')
      .eq('userId', userId)
      .eq('type', 'usage')
      .not('serviceKey', 'is', null)
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error(`Error getting credit usage by service: ${error.message}`);
      throw error;
    }

    // Group transactions by service
    const usageByService: Record<string, { totalCredits: number, transactions: CreditTransaction[] }> = {};

    for (const transaction of data) {
      const serviceKey = transaction.serviceKey || 'unknown';

      if (!usageByService[serviceKey]) {
        usageByService[serviceKey] = {
          totalCredits: 0,
          transactions: []
        };
      }

      // Add absolute value of amount (since usage transactions have negative amounts)
      usageByService[serviceKey].totalCredits += Math.abs(transaction.amount);
      usageByService[serviceKey].transactions.push(transaction);
    }

    return usageByService;
  } catch (error) {
    logger.error(`Failed to get credit usage by service: ${error}`);
    throw error;
  }
}

export default {
  getUserCredit,
  createUserCredit,
  updateUserCreditBalance,
  addCredits,
  useCredits,
  useServiceCredits,
  getCreditTransactions,
  getCreditUsageByService,
  hasEnoughCredits,
  initializeUserCredit
};

/**
 * Credit Top-up Model
 * 
 * This model handles the storage and retrieval of credit top-up settings,
 * which enable automatic credit purchases when a user's balance falls below a threshold.
 */

import { supabaseClient } from '../services/supabase/supabaseClient';
import { logger } from '../utils/logger';

/**
 * Credit top-up setting
 */
export interface CreditTopupSetting {
  id: string;
  userId: string;
  isEnabled: boolean;
  thresholdAmount: number;
  topupAmount: number;
  maxMonthlySpend?: number;
  paymentMethodId?: string;
  lastTopupAt?: Date;
  monthlySpend?: number;
  monthlySpendResetAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Credit top-up history
 */
export interface CreditTopupHistory {
  id: string;
  userId: string;
  settingId: string;
  creditAmount: number;
  price: number;
  currency: string;
  paymentId?: string;
  status: 'pending' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Get credit top-up setting for a user
 * @param userId User ID
 * @returns Credit top-up setting or null if not found
 */
export async function getUserTopupSetting(userId: string): Promise<CreditTopupSetting | null> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('credit_topup_settings')
      .select('*')
      .eq('userId', userId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error(`Error getting credit top-up setting: ${error.message}`);
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(`Failed to get credit top-up setting: ${error}`);
    throw error;
  }
}

/**
 * Create or update credit top-up setting
 * @param setting Credit top-up setting
 * @returns Created or updated credit top-up setting
 */
export async function createOrUpdateTopupSetting(
  setting: Omit<CreditTopupSetting, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CreditTopupSetting> {
  try {
    const now = new Date();
    
    // Check if setting already exists
    const existingSetting = await getUserTopupSetting(setting.userId);
    
    if (existingSetting) {
      // Update existing setting
      const updatedSetting = {
        ...setting,
        updatedAt: now
      };
      
      const { data, error } = await supabaseClient.getClient()
        .from('credit_topup_settings')
        .update(updatedSetting)
        .eq('id', existingSetting.id)
        .select();
      
      if (error) {
        logger.error(`Error updating credit top-up setting: ${error.message}`);
        throw error;
      }
      
      return data[0];
    } else {
      // Create new setting
      const newSetting = {
        ...setting,
        createdAt: now,
        updatedAt: now
      };
      
      const { data, error } = await supabaseClient.getClient()
        .from('credit_topup_settings')
        .insert([newSetting])
        .select();
      
      if (error) {
        logger.error(`Error creating credit top-up setting: ${error.message}`);
        throw error;
      }
      
      return data[0];
    }
  } catch (error) {
    logger.error(`Failed to create or update credit top-up setting: ${error}`);
    throw error;
  }
}

/**
 * Delete credit top-up setting
 * @param userId User ID
 * @returns Whether the setting was deleted
 */
export async function deleteTopupSetting(userId: string): Promise<boolean> {
  try {
    const { error } = await supabaseClient.getClient()
      .from('credit_topup_settings')
      .delete()
      .eq('userId', userId);
    
    if (error) {
      logger.error(`Error deleting credit top-up setting: ${error.message}`);
      throw error;
    }
    
    return true;
  } catch (error) {
    logger.error(`Failed to delete credit top-up setting: ${error}`);
    throw error;
  }
}

/**
 * Get credit top-up history for a user
 * @param userId User ID
 * @param limit Maximum number of records to return
 * @param offset Offset for pagination
 * @returns Array of credit top-up history records
 */
export async function getUserTopupHistory(
  userId: string,
  limit: number = 10,
  offset: number = 0
): Promise<CreditTopupHistory[]> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('credit_topup_history')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      logger.error(`Error getting credit top-up history: ${error.message}`);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    logger.error(`Failed to get credit top-up history: ${error}`);
    throw error;
  }
}

/**
 * Create credit top-up history record
 * @param history Credit top-up history
 * @returns Created credit top-up history record
 */
export async function createTopupHistory(
  history: Omit<CreditTopupHistory, 'id' | 'createdAt'>
): Promise<CreditTopupHistory> {
  try {
    const now = new Date();
    const newHistory = {
      ...history,
      createdAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('credit_topup_history')
      .insert([newHistory])
      .select();
    
    if (error) {
      logger.error(`Error creating credit top-up history: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to create credit top-up history: ${error}`);
    throw error;
  }
}

/**
 * Update credit top-up history record
 * @param id History record ID
 * @param updates Updates to apply
 * @returns Updated credit top-up history record
 */
export async function updateTopupHistory(
  id: string,
  updates: Partial<Omit<CreditTopupHistory, 'id' | 'userId' | 'settingId' | 'createdAt'>>
): Promise<CreditTopupHistory> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('credit_topup_history')
      .update(updates)
      .eq('id', id)
      .select();
    
    if (error) {
      logger.error(`Error updating credit top-up history: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to update credit top-up history: ${error}`);
    throw error;
  }
}

/**
 * Update monthly spend for a top-up setting
 * @param settingId Setting ID
 * @param amount Amount to add to monthly spend
 * @returns Updated credit top-up setting
 */
export async function updateMonthlySpend(settingId: string, amount: number): Promise<CreditTopupSetting> {
  try {
    // Get current setting
    const { data: setting, error: settingError } = await supabaseClient.getClient()
      .from('credit_topup_settings')
      .select('*')
      .eq('id', settingId)
      .single();
    
    if (settingError) {
      logger.error(`Error getting credit top-up setting: ${settingError.message}`);
      throw settingError;
    }
    
    const now = new Date();
    let monthlySpend = setting.monthlySpend || 0;
    let monthlySpendResetAt = setting.monthlySpendResetAt ? new Date(setting.monthlySpendResetAt) : null;
    
    // Check if we need to reset monthly spend
    if (!monthlySpendResetAt || now > monthlySpendResetAt) {
      // Reset monthly spend
      monthlySpend = amount;
      
      // Set reset date to first day of next month
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      monthlySpendResetAt = nextMonth;
    } else {
      // Add to monthly spend
      monthlySpend += amount;
    }
    
    // Update setting
    const updates = {
      monthlySpend,
      monthlySpendResetAt,
      updatedAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('credit_topup_settings')
      .update(updates)
      .eq('id', settingId)
      .select();
    
    if (error) {
      logger.error(`Error updating monthly spend: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to update monthly spend: ${error}`);
    throw error;
  }
}

/**
 * Update last top-up timestamp
 * @param settingId Setting ID
 * @returns Updated credit top-up setting
 */
export async function updateLastTopupTime(settingId: string): Promise<CreditTopupSetting> {
  try {
    const now = new Date();
    const updates = {
      lastTopupAt: now,
      updatedAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('credit_topup_settings')
      .update(updates)
      .eq('id', settingId)
      .select();
    
    if (error) {
      logger.error(`Error updating last top-up time: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to update last top-up time: ${error}`);
    throw error;
  }
}

/**
 * Get users who need a credit top-up
 * @returns Array of users who need a top-up
 */
export async function getUsersNeedingTopup(): Promise<{ userId: string; settingId: string; creditBalance: number; setting: CreditTopupSetting }[]> {
  try {
    // This query finds users who:
    // 1. Have enabled auto top-up
    // 2. Have a credit balance below their threshold
    // 3. Have not exceeded their monthly spend limit (if set)
    // 4. Have a payment method set up
    const { data, error } = await supabaseClient.getClient().rpc('get_users_needing_topup');
    
    if (error) {
      logger.error(`Error getting users needing top-up: ${error.message}`);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    logger.error(`Failed to get users needing top-up: ${error}`);
    throw error;
  }
}

export default {
  getUserTopupSetting,
  createOrUpdateTopupSetting,
  deleteTopupSetting,
  getUserTopupHistory,
  createTopupHistory,
  updateTopupHistory,
  updateMonthlySpend,
  updateLastTopupTime,
  getUsersNeedingTopup
};

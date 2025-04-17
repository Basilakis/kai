/**
 * Credit Alert Model
 * 
 * This model handles the storage and retrieval of credit alert settings,
 * which notify users when their credit balance falls below specified thresholds.
 */

import { supabaseClient } from '../services/supabase/supabaseClient';
import { logger } from '../utils/logger';

/**
 * Alert type
 */
export enum AlertType {
  EMAIL = 'email',
  SMS = 'sms',
  WEBHOOK = 'webhook',
  IN_APP = 'in_app'
}

/**
 * Credit alert setting
 */
export interface CreditAlertSetting {
  id: string;
  userId: string;
  isEnabled: boolean;
  thresholdAmount: number;
  alertTypes: AlertType[];
  emailAddresses?: string[];
  phoneNumbers?: string[];
  webhookUrls?: string[];
  lastTriggeredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Credit alert history
 */
export interface CreditAlertHistory {
  id: string;
  userId: string;
  settingId: string;
  creditBalance: number;
  thresholdAmount: number;
  alertTypes: AlertType[];
  status: 'pending' | 'sent' | 'failed';
  errorMessage?: string;
  createdAt: Date;
  sentAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Get credit alert settings for a user
 * @param userId User ID
 * @returns Array of credit alert settings
 */
export async function getUserAlertSettings(userId: string): Promise<CreditAlertSetting[]> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('credit_alert_settings')
      .select('*')
      .eq('userId', userId)
      .order('thresholdAmount', { ascending: true });
    
    if (error) {
      logger.error(`Error getting credit alert settings: ${error.message}`);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    logger.error(`Failed to get credit alert settings: ${error}`);
    throw error;
  }
}

/**
 * Get a credit alert setting by ID
 * @param id Alert setting ID
 * @returns Credit alert setting or null if not found
 */
export async function getAlertSettingById(id: string): Promise<CreditAlertSetting | null> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('credit_alert_settings')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error(`Error getting credit alert setting: ${error.message}`);
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(`Failed to get credit alert setting: ${error}`);
    throw error;
  }
}

/**
 * Create a credit alert setting
 * @param setting Credit alert setting
 * @returns Created credit alert setting
 */
export async function createAlertSetting(
  setting: Omit<CreditAlertSetting, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CreditAlertSetting> {
  try {
    const now = new Date();
    const newSetting = {
      ...setting,
      createdAt: now,
      updatedAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('credit_alert_settings')
      .insert([newSetting])
      .select();
    
    if (error) {
      logger.error(`Error creating credit alert setting: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to create credit alert setting: ${error}`);
    throw error;
  }
}

/**
 * Update a credit alert setting
 * @param id Alert setting ID
 * @param updates Updates to apply
 * @returns Updated credit alert setting
 */
export async function updateAlertSetting(
  id: string,
  updates: Partial<Omit<CreditAlertSetting, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<CreditAlertSetting> {
  try {
    const now = new Date();
    const updatedSetting = {
      ...updates,
      updatedAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('credit_alert_settings')
      .update(updatedSetting)
      .eq('id', id)
      .select();
    
    if (error) {
      logger.error(`Error updating credit alert setting: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to update credit alert setting: ${error}`);
    throw error;
  }
}

/**
 * Delete a credit alert setting
 * @param id Alert setting ID
 * @returns Whether the setting was deleted
 */
export async function deleteAlertSetting(id: string): Promise<boolean> {
  try {
    const { error } = await supabaseClient.getClient()
      .from('credit_alert_settings')
      .delete()
      .eq('id', id);
    
    if (error) {
      logger.error(`Error deleting credit alert setting: ${error.message}`);
      throw error;
    }
    
    return true;
  } catch (error) {
    logger.error(`Failed to delete credit alert setting: ${error}`);
    throw error;
  }
}

/**
 * Get credit alert history for a user
 * @param userId User ID
 * @param limit Maximum number of records to return
 * @param offset Offset for pagination
 * @returns Array of credit alert history records
 */
export async function getUserAlertHistory(
  userId: string,
  limit: number = 10,
  offset: number = 0
): Promise<CreditAlertHistory[]> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('credit_alert_history')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      logger.error(`Error getting credit alert history: ${error.message}`);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    logger.error(`Failed to get credit alert history: ${error}`);
    throw error;
  }
}

/**
 * Create a credit alert history record
 * @param history Credit alert history
 * @returns Created credit alert history record
 */
export async function createAlertHistory(
  history: Omit<CreditAlertHistory, 'id' | 'createdAt'>
): Promise<CreditAlertHistory> {
  try {
    const now = new Date();
    const newHistory = {
      ...history,
      createdAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('credit_alert_history')
      .insert([newHistory])
      .select();
    
    if (error) {
      logger.error(`Error creating credit alert history: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to create credit alert history: ${error}`);
    throw error;
  }
}

/**
 * Update a credit alert history record
 * @param id History record ID
 * @param updates Updates to apply
 * @returns Updated credit alert history record
 */
export async function updateAlertHistory(
  id: string,
  updates: Partial<Omit<CreditAlertHistory, 'id' | 'userId' | 'settingId' | 'createdAt'>>
): Promise<CreditAlertHistory> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('credit_alert_history')
      .update(updates)
      .eq('id', id)
      .select();
    
    if (error) {
      logger.error(`Error updating credit alert history: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to update credit alert history: ${error}`);
    throw error;
  }
}

/**
 * Update last triggered timestamp for an alert setting
 * @param id Alert setting ID
 * @returns Updated credit alert setting
 */
export async function updateLastTriggeredTime(id: string): Promise<CreditAlertSetting> {
  try {
    const now = new Date();
    const updates = {
      lastTriggeredAt: now,
      updatedAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('credit_alert_settings')
      .update(updates)
      .eq('id', id)
      .select();
    
    if (error) {
      logger.error(`Error updating last triggered time: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to update last triggered time: ${error}`);
    throw error;
  }
}

/**
 * Get users who need credit alerts
 * @returns Array of users who need alerts
 */
export async function getUsersNeedingAlerts(): Promise<{ 
  userId: string; 
  settingId: string; 
  creditBalance: number; 
  setting: CreditAlertSetting 
}[]> {
  try {
    // This query finds users who:
    // 1. Have enabled credit alerts
    // 2. Have a credit balance below their threshold
    // 3. Have not been alerted recently (within 24 hours)
    const { data, error } = await supabaseClient.getClient().rpc('get_users_needing_alerts');
    
    if (error) {
      logger.error(`Error getting users needing alerts: ${error.message}`);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    logger.error(`Failed to get users needing alerts: ${error}`);
    throw error;
  }
}

export default {
  getUserAlertSettings,
  getAlertSettingById,
  createAlertSetting,
  updateAlertSetting,
  deleteAlertSetting,
  getUserAlertHistory,
  createAlertHistory,
  updateAlertHistory,
  updateLastTriggeredTime,
  getUsersNeedingAlerts,
  AlertType
};

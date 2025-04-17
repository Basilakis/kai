/**
 * Two-Factor Authentication Model
 * 
 * This model handles the storage and retrieval of two-factor authentication
 * settings for users, including TOTP secrets, backup codes, and preferences.
 */

import { supabaseClient } from '../services/supabase/supabaseClient';
import { logger } from '../utils/logger';
import crypto from 'crypto';

/**
 * Represents a two-factor authentication method
 */
export enum TwoFactorMethod {
  TOTP = 'totp',
  SMS = 'sms',
  EMAIL = 'email'
}

/**
 * Represents a two-factor authentication setting
 */
export interface TwoFactorSetting {
  id: string;
  userId: string;
  method: TwoFactorMethod;
  secret?: string;
  phoneNumber?: string;
  email?: string;
  isVerified: boolean;
  isEnabled: boolean;
  backupCodes?: string[];
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents a two-factor authentication verification attempt
 */
export interface TwoFactorVerification {
  id: string;
  userId: string;
  method: TwoFactorMethod;
  code: string;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}

/**
 * Get two-factor settings for a user
 * @param userId User ID
 * @returns Two-factor settings or null if not found
 */
export async function getTwoFactorSettings(userId: string): Promise<TwoFactorSetting[]> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('two_factor_settings')
      .select('*')
      .eq('userId', userId);

    if (error) {
      logger.error(`Error getting two-factor settings: ${error.message}`);
      throw error;
    }

    return data || [];
  } catch (error) {
    logger.error(`Failed to get two-factor settings: ${error}`);
    throw error;
  }
}

/**
 * Get two-factor setting by ID
 * @param id Two-factor setting ID
 * @returns Two-factor setting or null if not found
 */
export async function getTwoFactorSettingById(id: string): Promise<TwoFactorSetting | null> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('two_factor_settings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error(`Error getting two-factor setting: ${error.message}`);
      throw error;
    }

    return data;
  } catch (error) {
    logger.error(`Failed to get two-factor setting: ${error}`);
    throw error;
  }
}

/**
 * Get two-factor setting by user ID and method
 * @param userId User ID
 * @param method Two-factor method
 * @returns Two-factor setting or null if not found
 */
export async function getTwoFactorSettingByMethod(userId: string, method: TwoFactorMethod): Promise<TwoFactorSetting | null> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('two_factor_settings')
      .select('*')
      .eq('userId', userId)
      .eq('method', method)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error(`Error getting two-factor setting: ${error.message}`);
      throw error;
    }

    return data;
  } catch (error) {
    logger.error(`Failed to get two-factor setting: ${error}`);
    throw error;
  }
}

/**
 * Create two-factor setting
 * @param setting Two-factor setting to create
 * @returns Created two-factor setting
 */
export async function createTwoFactorSetting(setting: Omit<TwoFactorSetting, 'id' | 'createdAt' | 'updatedAt'>): Promise<TwoFactorSetting> {
  try {
    const now = new Date();
    const newSetting = {
      ...setting,
      createdAt: now,
      updatedAt: now
    };

    const { data, error } = await supabaseClient.getClient()
      .from('two_factor_settings')
      .insert([newSetting])
      .select();

    if (error) {
      logger.error(`Error creating two-factor setting: ${error.message}`);
      throw error;
    }

    return data[0];
  } catch (error) {
    logger.error(`Failed to create two-factor setting: ${error}`);
    throw error;
  }
}

/**
 * Update two-factor setting
 * @param id Two-factor setting ID
 * @param updates Updates to apply
 * @returns Updated two-factor setting
 */
export async function updateTwoFactorSetting(
  id: string,
  updates: Partial<Omit<TwoFactorSetting, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<TwoFactorSetting> {
  try {
    const now = new Date();
    const updatedSetting = {
      ...updates,
      updatedAt: now
    };

    const { data, error } = await supabaseClient.getClient()
      .from('two_factor_settings')
      .update(updatedSetting)
      .eq('id', id)
      .select();

    if (error) {
      logger.error(`Error updating two-factor setting: ${error.message}`);
      throw error;
    }

    return data[0];
  } catch (error) {
    logger.error(`Failed to update two-factor setting: ${error}`);
    throw error;
  }
}

/**
 * Delete two-factor setting
 * @param id Two-factor setting ID
 * @returns Whether the setting was deleted
 */
export async function deleteTwoFactorSetting(id: string): Promise<boolean> {
  try {
    const { error } = await supabaseClient.getClient()
      .from('two_factor_settings')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error(`Error deleting two-factor setting: ${error.message}`);
      throw error;
    }

    return true;
  } catch (error) {
    logger.error(`Failed to delete two-factor setting: ${error}`);
    throw error;
  }
}

/**
 * Create a verification code
 * @param userId User ID
 * @param method Two-factor method
 * @param expiresInMinutes Minutes until the code expires
 * @returns Created verification code
 */
export async function createVerificationCode(
  userId: string,
  method: TwoFactorMethod,
  expiresInMinutes: number = 10
): Promise<TwoFactorVerification> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000);
    
    // Generate a random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    const verification = {
      userId,
      method,
      code,
      expiresAt,
      isUsed: false,
      createdAt: now
    };

    const { data, error } = await supabaseClient.getClient()
      .from('two_factor_verifications')
      .insert([verification])
      .select();

    if (error) {
      logger.error(`Error creating verification code: ${error.message}`);
      throw error;
    }

    return data[0];
  } catch (error) {
    logger.error(`Failed to create verification code: ${error}`);
    throw error;
  }
}

/**
 * Verify a verification code
 * @param userId User ID
 * @param method Two-factor method
 * @param code Verification code
 * @returns Whether the code is valid
 */
export async function verifyCode(
  userId: string,
  method: TwoFactorMethod,
  code: string
): Promise<boolean> {
  try {
    const now = new Date();
    
    // Get the most recent unused code for this user and method
    const { data, error } = await supabaseClient.getClient()
      .from('two_factor_verifications')
      .select('*')
      .eq('userId', userId)
      .eq('method', method)
      .eq('isUsed', false)
      .gt('expiresAt', now.toISOString())
      .order('createdAt', { ascending: false })
      .limit(1);

    if (error) {
      logger.error(`Error verifying code: ${error.message}`);
      throw error;
    }

    if (!data || data.length === 0) {
      return false; // No valid code found
    }

    const verification = data[0];
    
    // Check if the code matches
    if (verification.code !== code) {
      return false;
    }

    // Mark the code as used
    const { error: updateError } = await supabaseClient.getClient()
      .from('two_factor_verifications')
      .update({ isUsed: true })
      .eq('id', verification.id);

    if (updateError) {
      logger.error(`Error marking code as used: ${updateError.message}`);
      throw updateError;
    }

    return true;
  } catch (error) {
    logger.error(`Failed to verify code: ${error}`);
    throw error;
  }
}

/**
 * Generate backup codes for a user
 * @param count Number of backup codes to generate
 * @returns Array of backup codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    // Generate a random 10-character code (5 groups of 4 alphanumeric characters)
    const code = Array.from({ length: 5 }, () => 
      crypto.randomBytes(2).toString('hex')
    ).join('-');
    
    codes.push(code);
  }
  
  return codes;
}

/**
 * Verify a backup code
 * @param userId User ID
 * @param method Two-factor method
 * @param code Backup code
 * @returns Whether the code is valid
 */
export async function verifyBackupCode(
  userId: string,
  method: TwoFactorMethod,
  code: string
): Promise<boolean> {
  try {
    // Get the two-factor setting for this user and method
    const setting = await getTwoFactorSettingByMethod(userId, method);
    
    if (!setting || !setting.backupCodes || setting.backupCodes.length === 0) {
      return false;
    }
    
    // Check if the code is in the backup codes
    const index = setting.backupCodes.indexOf(code);
    if (index === -1) {
      return false;
    }
    
    // Remove the used backup code
    const backupCodes = [...setting.backupCodes];
    backupCodes.splice(index, 1);
    
    // Update the setting with the new backup codes
    await updateTwoFactorSetting(setting.id, { backupCodes });
    
    return true;
  } catch (error) {
    logger.error(`Failed to verify backup code: ${error}`);
    throw error;
  }
}

export default {
  getTwoFactorSettings,
  getTwoFactorSettingById,
  getTwoFactorSettingByMethod,
  createTwoFactorSetting,
  updateTwoFactorSetting,
  deleteTwoFactorSetting,
  createVerificationCode,
  verifyCode,
  generateBackupCodes,
  verifyBackupCode
};

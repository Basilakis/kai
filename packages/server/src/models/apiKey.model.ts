/**
 * API Key Model
 * 
 * This model handles the storage and retrieval of API keys,
 * including creation, validation, and revocation.
 */

import { supabaseClient } from '../services/supabase/supabaseClient';
import { logger } from '../utils/logger';
import crypto from 'crypto';

/**
 * Represents an API key
 */
export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  key: string; // Hashed key
  prefix: string; // First few characters of the key for display
  scopes: string[]; // Permissions
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  revokedAt?: Date;
  revokedReason?: string;
  metadata?: Record<string, any>;
}

/**
 * Get all API keys for a user
 * @param userId User ID
 * @returns Array of API keys
 */
export async function getUserApiKeys(userId: string): Promise<ApiKey[]> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('api_keys')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    if (error) {
      logger.error(`Error getting API keys: ${error.message}`);
      throw error;
    }

    return data || [];
  } catch (error) {
    logger.error(`Failed to get API keys: ${error}`);
    throw error;
  }
}

/**
 * Get an API key by ID
 * @param keyId API key ID
 * @returns API key or null if not found
 */
export async function getApiKeyById(keyId: string): Promise<ApiKey | null> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('api_keys')
      .select('*')
      .eq('id', keyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error(`Error getting API key: ${error.message}`);
      throw error;
    }

    return data;
  } catch (error) {
    logger.error(`Failed to get API key: ${error}`);
    throw error;
  }
}

/**
 * Get an API key by the actual key
 * @param key API key
 * @returns API key or null if not found
 */
export async function getApiKeyByKey(key: string): Promise<ApiKey | null> {
  try {
    // Extract the prefix (first 8 characters)
    const prefix = key.substring(0, 8);
    
    // Hash the key
    const hashedKey = hashApiKey(key);
    
    // Find the key
    const { data, error } = await supabaseClient.getClient()
      .from('api_keys')
      .select('*')
      .eq('key', hashedKey)
      .eq('prefix', prefix)
      .eq('isActive', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error(`Error getting API key by key: ${error.message}`);
      throw error;
    }

    return data;
  } catch (error) {
    logger.error(`Failed to get API key by key: ${error}`);
    throw error;
  }
}

/**
 * Create a new API key
 * @param userId User ID
 * @param name Key name
 * @param scopes Key scopes/permissions
 * @param expiresInDays Days until the key expires (0 for no expiration)
 * @param metadata Additional metadata
 * @returns Created API key and the raw key
 */
export async function createApiKey(
  userId: string,
  name: string,
  scopes: string[] = ['read'],
  expiresInDays: number = 0,
  metadata?: Record<string, any>
): Promise<{ apiKey: ApiKey; rawKey: string }> {
  try {
    const now = new Date();
    
    // Generate a random key
    const rawKey = generateApiKey();
    
    // Extract the prefix (first 8 characters)
    const prefix = rawKey.substring(0, 8);
    
    // Hash the key
    const hashedKey = hashApiKey(rawKey);
    
    // Calculate expiration date
    let expiresAt: Date | undefined;
    if (expiresInDays > 0) {
      expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);
    }
    
    // Create the API key
    const newApiKey = {
      userId,
      name,
      key: hashedKey,
      prefix,
      scopes,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      metadata
    };

    const { data, error } = await supabaseClient.getClient()
      .from('api_keys')
      .insert([newApiKey])
      .select();

    if (error) {
      logger.error(`Error creating API key: ${error.message}`);
      throw error;
    }

    return { apiKey: data[0], rawKey };
  } catch (error) {
    logger.error(`Failed to create API key: ${error}`);
    throw error;
  }
}

/**
 * Update an API key
 * @param keyId API key ID
 * @param updates Updates to apply
 * @returns Updated API key
 */
export async function updateApiKey(
  keyId: string,
  updates: Partial<Pick<ApiKey, 'name' | 'scopes' | 'expiresAt' | 'metadata'>>
): Promise<ApiKey> {
  try {
    const now = new Date();
    const updatedKey = {
      ...updates,
      updatedAt: now
    };

    const { data, error } = await supabaseClient.getClient()
      .from('api_keys')
      .update(updatedKey)
      .eq('id', keyId)
      .select();

    if (error) {
      logger.error(`Error updating API key: ${error.message}`);
      throw error;
    }

    return data[0];
  } catch (error) {
    logger.error(`Failed to update API key: ${error}`);
    throw error;
  }
}

/**
 * Revoke an API key
 * @param keyId API key ID
 * @param reason Reason for revocation
 * @returns Revoked API key
 */
export async function revokeApiKey(keyId: string, reason?: string): Promise<ApiKey> {
  try {
    const now = new Date();
    const updates = {
      isActive: false,
      revokedAt: now,
      revokedReason: reason || 'Manually revoked',
      updatedAt: now
    };

    const { data, error } = await supabaseClient.getClient()
      .from('api_keys')
      .update(updates)
      .eq('id', keyId)
      .select();

    if (error) {
      logger.error(`Error revoking API key: ${error.message}`);
      throw error;
    }

    return data[0];
  } catch (error) {
    logger.error(`Failed to revoke API key: ${error}`);
    throw error;
  }
}

/**
 * Update API key usage timestamp
 * @param keyId API key ID
 * @returns Updated API key
 */
export async function updateApiKeyUsage(keyId: string): Promise<ApiKey> {
  try {
    const now = new Date();
    const updates = {
      lastUsedAt: now,
      updatedAt: now
    };

    const { data, error } = await supabaseClient.getClient()
      .from('api_keys')
      .update(updates)
      .eq('id', keyId)
      .select();

    if (error) {
      logger.error(`Error updating API key usage: ${error.message}`);
      throw error;
    }

    return data[0];
  } catch (error) {
    logger.error(`Failed to update API key usage: ${error}`);
    throw error;
  }
}

/**
 * Validate an API key
 * @param key API key
 * @param requiredScopes Required scopes/permissions
 * @returns User ID if valid, null otherwise
 */
export async function validateApiKey(key: string, requiredScopes: string[] = []): Promise<string | null> {
  try {
    // Get the API key
    const apiKey = await getApiKeyByKey(key);
    
    if (!apiKey || !apiKey.isActive) {
      return null;
    }
    
    // Check if the key has expired
    if (apiKey.expiresAt && new Date() > new Date(apiKey.expiresAt)) {
      // Revoke the key
      await revokeApiKey(apiKey.id, 'Key expired');
      return null;
    }
    
    // Check if the key has the required scopes
    if (requiredScopes.length > 0) {
      const hasRequiredScopes = requiredScopes.every(scope => apiKey.scopes.includes(scope));
      if (!hasRequiredScopes) {
        return null;
      }
    }
    
    // Update usage timestamp
    await updateApiKeyUsage(apiKey.id);
    
    return apiKey.userId;
  } catch (error) {
    logger.error(`Failed to validate API key: ${error}`);
    return null;
  }
}

/**
 * Generate a new API key
 * @returns Generated API key
 */
export function generateApiKey(): string {
  // Generate a random key with a prefix
  const prefix = crypto.randomBytes(4).toString('hex');
  const key = crypto.randomBytes(24).toString('hex');
  return `${prefix}${key}`;
}

/**
 * Hash an API key for storage
 * @param key API key
 * @returns Hashed key
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Clean up expired API keys
 * @returns Number of keys cleaned up
 */
export async function cleanupExpiredApiKeys(): Promise<number> {
  try {
    const now = new Date();
    const updates = {
      isActive: false,
      revokedAt: now,
      revokedReason: 'Key expired',
      updatedAt: now
    };

    const { data, error } = await supabaseClient.getClient()
      .from('api_keys')
      .update(updates)
      .eq('isActive', true)
      .lt('expiresAt', now.toISOString())
      .select();

    if (error) {
      logger.error(`Error cleaning up expired API keys: ${error.message}`);
      throw error;
    }

    return data?.length || 0;
  } catch (error) {
    logger.error(`Failed to clean up expired API keys: ${error}`);
    throw error;
  }
}

export default {
  getUserApiKeys,
  getApiKeyById,
  getApiKeyByKey,
  createApiKey,
  updateApiKey,
  revokeApiKey,
  updateApiKeyUsage,
  validateApiKey,
  generateApiKey,
  hashApiKey,
  cleanupExpiredApiKeys
};

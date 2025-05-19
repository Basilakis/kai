/**
 * API Key Manager Service
 * 
 * This service provides functionality for managing API keys,
 * including creation, validation, and revocation.
 */

import { logger } from '../../utils/logger';
import {
  ApiKey,
  getUserApiKeys as getUserApiKeysFromModel,
  getApiKeyById,
  createApiKey as createApiKeyModel,
  updateApiKey as updateApiKeyModel,
  revokeApiKey as revokeApiKeyModel,
  validateApiKey as validateApiKeyModel,
  cleanupExpiredApiKeys
} from '../../models/apiKey.model';

/**
 * Available API key scopes
 */
export enum ApiKeyScope {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ADMIN = 'admin',
  AGENTS = 'agents',
  ML = 'ml',
  STORAGE = 'storage',
  ANALYTICS = 'analytics'
}

/**
 * Get all API keys for a user
 * @param userId User ID
 * @returns Array of API keys
 */
export async function getUserApiKeys(userId: string): Promise<ApiKey[]> {
  try {
    return await getUserApiKeysFromModel(userId);
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
export async function getApiKey(keyId: string): Promise<ApiKey | null> {
  try {
    return await getApiKeyById(keyId);
  } catch (error) {
    logger.error(`Failed to get API key: ${error}`);
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
  scopes: string[] = [ApiKeyScope.READ],
  expiresInDays: number = 0,
  metadata?: Record<string, any>
): Promise<{ apiKey: ApiKey; rawKey: string }> {
  try {
    // Validate scopes
    const validScopes = Object.values(ApiKeyScope);
    const invalidScopes = scopes.filter(scope => !validScopes.includes(scope as ApiKeyScope));
    
    if (invalidScopes.length > 0) {
      throw new Error(`Invalid scopes: ${invalidScopes.join(', ')}`);
    }
    
    return await createApiKeyModel(userId, name, scopes, expiresInDays, metadata);
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
    // Validate scopes if provided
    if (updates.scopes) {
      const validScopes = Object.values(ApiKeyScope);
      const invalidScopes = updates.scopes.filter(scope => !validScopes.includes(scope as ApiKeyScope));
      
      if (invalidScopes.length > 0) {
        throw new Error(`Invalid scopes: ${invalidScopes.join(', ')}`);
      }
    }
    
    return await updateApiKeyModel(keyId, updates);
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
    return await revokeApiKeyModel(keyId, reason);
  } catch (error) {
    logger.error(`Failed to revoke API key: ${error}`);
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
    return await validateApiKeyModel(key, requiredScopes);
  } catch (error) {
    logger.error(`Failed to validate API key: ${error}`);
    return null;
  }
}

/**
 * Schedule periodic cleanup of expired API keys
 * @param intervalMinutes Interval in minutes
 */
export function scheduleApiKeyCleanup(intervalMinutes: number = 60): void {
  setInterval(async () => {
    try {
      const count = await cleanupExpiredApiKeys();
      if (count > 0) {
        logger.info(`Cleaned up ${count} expired API keys`);
      }
    } catch (error) {
      logger.error(`Failed to clean up expired API keys: ${error}`);
    }
  }, intervalMinutes * 60 * 1000);
}

export default {
  getUserApiKeys,
  getApiKey,
  createApiKey,
  updateApiKey,
  revokeApiKey,
  validateApiKey,
  scheduleApiKeyCleanup,
  ApiKeyScope
};

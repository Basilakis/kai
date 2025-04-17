/**
 * API Key Controller
 * 
 * This controller handles API endpoints for managing API keys,
 * including creation, listing, and revocation.
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/error.middleware';
import apiKeyManager, { ApiKeyScope } from '../services/auth/apiKeyManager.service';
import { getUserApiKeys, getApiKeyById } from '../models/apiKey.model';

/**
 * Get all API keys for the current user
 * @route GET /api/api-keys
 * @access Private
 */
export const getApiKeys = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // Get all API keys for the user
    const apiKeys = await getUserApiKeys(userId);
    
    // Remove sensitive data
    const sanitizedKeys = apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      scopes: key.scopes,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
      isActive: key.isActive,
      revokedAt: key.revokedAt,
      revokedReason: key.revokedReason,
      metadata: key.metadata
    }));
    
    res.status(200).json({
      success: true,
      data: sanitizedKeys
    });
  } catch (error) {
    logger.error(`Error getting API keys: ${error}`);
    throw new ApiError(500, 'Failed to get API keys');
  }
};

/**
 * Get an API key by ID
 * @route GET /api/api-keys/:keyId
 * @access Private
 */
export const getApiKey = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { keyId } = req.params;
    
    // Get the API key
    const apiKey = await getApiKeyById(keyId);
    
    if (!apiKey) {
      throw new ApiError(404, 'API key not found');
    }
    
    // Check if the key belongs to the user
    if (apiKey.userId !== userId) {
      throw new ApiError(403, 'You do not have permission to access this API key');
    }
    
    // Remove sensitive data
    const sanitizedKey = {
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt,
      isActive: apiKey.isActive,
      revokedAt: apiKey.revokedAt,
      revokedReason: apiKey.revokedReason,
      metadata: apiKey.metadata
    };
    
    res.status(200).json({
      success: true,
      data: sanitizedKey
    });
  } catch (error) {
    logger.error(`Error getting API key: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to get API key');
  }
};

/**
 * Create a new API key
 * @route POST /api/api-keys
 * @access Private
 */
export const createApiKey = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { name, scopes = [ApiKeyScope.READ], expiresInDays = 0, metadata } = req.body;
    
    if (!name) {
      throw new ApiError(400, 'Name is required');
    }
    
    // Create the API key
    const result = await apiKeyManager.createApiKey(
      userId,
      name,
      scopes,
      expiresInDays,
      metadata
    );
    
    // Return the API key with the raw key (only shown once)
    const response = {
      id: result.apiKey.id,
      name: result.apiKey.name,
      key: result.rawKey, // Only returned once
      prefix: result.apiKey.prefix,
      scopes: result.apiKey.scopes,
      expiresAt: result.apiKey.expiresAt,
      createdAt: result.apiKey.createdAt,
      isActive: result.apiKey.isActive,
      metadata: result.apiKey.metadata
    };
    
    res.status(201).json({
      success: true,
      data: response,
      message: 'API key created successfully. Please save the key as it will not be shown again.'
    });
  } catch (error) {
    logger.error(`Error creating API key: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to create API key');
  }
};

/**
 * Update an API key
 * @route PUT /api/api-keys/:keyId
 * @access Private
 */
export const updateApiKey = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { keyId } = req.params;
    const { name, scopes, expiresInDays, metadata } = req.body;
    
    // Get the API key
    const apiKey = await getApiKeyById(keyId);
    
    if (!apiKey) {
      throw new ApiError(404, 'API key not found');
    }
    
    // Check if the key belongs to the user
    if (apiKey.userId !== userId) {
      throw new ApiError(403, 'You do not have permission to update this API key');
    }
    
    // Check if the key is active
    if (!apiKey.isActive) {
      throw new ApiError(400, 'Cannot update a revoked API key');
    }
    
    // Prepare updates
    const updates: any = {};
    
    if (name) {
      updates.name = name;
    }
    
    if (scopes) {
      updates.scopes = scopes;
    }
    
    if (expiresInDays !== undefined) {
      if (expiresInDays > 0) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
        updates.expiresAt = expiresAt;
      } else {
        updates.expiresAt = null;
      }
    }
    
    if (metadata) {
      updates.metadata = metadata;
    }
    
    // Update the API key
    const updatedKey = await apiKeyManager.updateApiKey(keyId, updates);
    
    // Remove sensitive data
    const sanitizedKey = {
      id: updatedKey.id,
      name: updatedKey.name,
      prefix: updatedKey.prefix,
      scopes: updatedKey.scopes,
      expiresAt: updatedKey.expiresAt,
      lastUsedAt: updatedKey.lastUsedAt,
      createdAt: updatedKey.createdAt,
      updatedAt: updatedKey.updatedAt,
      isActive: updatedKey.isActive,
      metadata: updatedKey.metadata
    };
    
    res.status(200).json({
      success: true,
      data: sanitizedKey,
      message: 'API key updated successfully'
    });
  } catch (error) {
    logger.error(`Error updating API key: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to update API key');
  }
};

/**
 * Revoke an API key
 * @route DELETE /api/api-keys/:keyId
 * @access Private
 */
export const revokeApiKey = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { keyId } = req.params;
    const { reason } = req.body;
    
    // Get the API key
    const apiKey = await getApiKeyById(keyId);
    
    if (!apiKey) {
      throw new ApiError(404, 'API key not found');
    }
    
    // Check if the key belongs to the user
    if (apiKey.userId !== userId) {
      throw new ApiError(403, 'You do not have permission to revoke this API key');
    }
    
    // Check if the key is already revoked
    if (!apiKey.isActive) {
      throw new ApiError(400, 'API key is already revoked');
    }
    
    // Revoke the API key
    await apiKeyManager.revokeApiKey(keyId, reason);
    
    res.status(200).json({
      success: true,
      message: 'API key revoked successfully'
    });
  } catch (error) {
    logger.error(`Error revoking API key: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to revoke API key');
  }
};

/**
 * Get available API key scopes
 * @route GET /api/api-keys/scopes
 * @access Private
 */
export const getApiKeyScopes = async (_req: Request, res: Response) => {
  try {
    const scopes = Object.values(ApiKeyScope);
    
    res.status(200).json({
      success: true,
      data: scopes
    });
  } catch (error) {
    logger.error(`Error getting API key scopes: ${error}`);
    throw new ApiError(500, 'Failed to get API key scopes');
  }
};

export default {
  getApiKeys,
  getApiKey,
  createApiKey,
  updateApiKey,
  revokeApiKey,
  getApiKeyScopes
};

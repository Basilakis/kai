/**
 * API Key Routes
 * 
 * This file defines the routes for API key management,
 * including creation, listing, and revocation.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import apiKeyController from '../../controllers/apiKey.controller';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /api/auth/api-keys
 * @desc    Get all API keys for the current user
 * @access  Private
 */
router.get(
  '/',
  asyncHandler(apiKeyController.getApiKeys)
);

/**
 * @route   GET /api/auth/api-keys/:keyId
 * @desc    Get an API key by ID
 * @access  Private
 */
router.get(
  '/:keyId',
  asyncHandler(apiKeyController.getApiKey)
);

/**
 * @route   POST /api/auth/api-keys
 * @desc    Create a new API key
 * @access  Private
 */
router.post(
  '/',
  asyncHandler(apiKeyController.createApiKey)
);

/**
 * @route   PUT /api/auth/api-keys/:keyId
 * @desc    Update an API key
 * @access  Private
 */
router.put(
  '/:keyId',
  asyncHandler(apiKeyController.updateApiKey)
);

/**
 * @route   DELETE /api/auth/api-keys/:keyId
 * @desc    Revoke an API key
 * @access  Private
 */
router.delete(
  '/:keyId',
  asyncHandler(apiKeyController.revokeApiKey)
);

/**
 * @route   GET /api/auth/api-keys/scopes
 * @desc    Get available API key scopes
 * @access  Private
 */
router.get(
  '/scopes',
  asyncHandler(apiKeyController.getApiKeyScopes)
);

export default router;

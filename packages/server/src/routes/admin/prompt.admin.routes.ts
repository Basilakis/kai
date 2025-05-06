/**
 * Admin Prompt Routes
 *
 * Defines API routes for admin management of system prompts.
 */

import express from 'express';
import { authMiddleware, authorize } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { NetworkAccessType } from '../../utils/network';
import {
  getAllSystemPrompts,
  getSystemPromptById,
  createSystemPrompt,
  updateSystemPrompt,
  deleteSystemPrompt,
  getSystemPromptVersions,
  getSystemPromptVersion,
  revertToPromptVersion,
  getPromptSuccessRate,
  getPromptVersionSuccessRate,
  updatePromptSuccessTracking
} from '../../controllers/admin/prompt.admin.controller';

const router = express.Router();

// Apply admin authentication and network restriction to all routes in this file
router.use(authMiddleware, authorize({
  roles: ['admin'],
  accessType: NetworkAccessType.INTERNAL_ONLY
}));

// Get all system prompts
router.get('/', asyncHandler(getAllSystemPrompts));

// Get system prompt by ID
router.get('/:id', asyncHandler(getSystemPromptById));

// Create a new system prompt
router.post('/', asyncHandler(createSystemPrompt));

// Update a system prompt
router.put('/:id', asyncHandler(updateSystemPrompt));

// Delete a system prompt
router.delete('/:id', asyncHandler(deleteSystemPrompt));

// Get all versions of a system prompt
router.get('/:promptId/versions', asyncHandler(getSystemPromptVersions));

// Get a specific version of a system prompt
router.get('/:promptId/versions/:versionNumber', asyncHandler(getSystemPromptVersion));

// Revert to a previous version of a system prompt
router.post('/:promptId/versions/:versionNumber/revert', asyncHandler(revertToPromptVersion));

// Get success rate for a system prompt
router.get('/:promptId/success-rate', asyncHandler(getPromptSuccessRate));

// Get success rate for a specific version of a system prompt
router.get('/:promptId/versions/:versionNumber/success-rate', asyncHandler(getPromptVersionSuccessRate));

// Update prompt success tracking
router.put('/tracking/:trackingId', asyncHandler(updatePromptSuccessTracking));

export default router;

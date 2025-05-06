/**
 * Admin Prompt Integration Routes
 * 
 * Defines API routes for admin management of prompt integration with external systems.
 */

import express from 'express';
import { authMiddleware, authorize } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { NetworkAccessType } from '../../utils/network';
import {
  getIntegrations,
  createIntegration,
  testIntegrationConnection,
  createDataExport,
  executePendingExports
} from '../../controllers/admin/prompt.integration.controller';

const router = express.Router();

// Apply admin authentication and network restriction to all routes in this file
router.use(authMiddleware, authorize({ 
  roles: ['admin'], 
  accessType: NetworkAccessType.INTERNAL_ONLY 
}));

// Get integrations
router.get('/', asyncHandler(getIntegrations));

// Create integration
router.post('/', asyncHandler(createIntegration));

// Test integration connection
router.post('/:integrationId/test', asyncHandler(testIntegrationConnection));

// Create data export
router.post('/exports', asyncHandler(createDataExport));

// Execute pending exports
router.post('/exports/execute', asyncHandler(executePendingExports));

export default router;

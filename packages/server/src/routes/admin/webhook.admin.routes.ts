/**
 * Admin Webhook Routes
 * 
 * Defines API routes for admin viewing of webhook configurations and logs.
 */

import express from 'express';
import { authMiddleware, authorize } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { NetworkAccessType } from '../../utils/network';
import {
  getAllWebhookConfigurations,
  getAllWebhookDeliveryLogs
} from '../../controllers/admin/webhook.admin.controller';

const router = express.Router();

// Apply admin authentication and network restriction to all routes in this file
router.use(authMiddleware, authorize({ 
  roles: ['admin'], 
  accessType: NetworkAccessType.INTERNAL_ONLY 
}));

// Webhook viewing routes
router.get('/configurations', asyncHandler(getAllWebhookConfigurations));
router.get('/logs', asyncHandler(getAllWebhookDeliveryLogs));

export default router;
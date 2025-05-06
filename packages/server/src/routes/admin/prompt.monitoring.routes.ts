/**
 * Admin Prompt Monitoring Routes
 * 
 * Defines API routes for admin management of prompt monitoring and analytics.
 */

import express from 'express';
import { authMiddleware, authorize } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { NetworkAccessType } from '../../utils/network';
import {
  getPromptUsageAnalytics,
  getActiveMonitoringAlerts,
  resolveMonitoringAlert,
  saveMonitoringSetting,
  submitPromptFeedback,
  autoDetectPromptSuccess
} from '../../controllers/admin/prompt.monitoring.controller';

const router = express.Router();

// Apply admin authentication and network restriction to all routes in this file
router.use(authMiddleware, authorize({ 
  roles: ['admin'], 
  accessType: NetworkAccessType.INTERNAL_ONLY 
}));

// Get prompt usage analytics
router.get('/analytics/:promptId', asyncHandler(getPromptUsageAnalytics));

// Get active monitoring alerts
router.get('/alerts', asyncHandler(getActiveMonitoringAlerts));

// Resolve a monitoring alert
router.post('/alerts/:alertId/resolve', asyncHandler(resolveMonitoringAlert));

// Save monitoring setting
router.post('/settings/:promptId', asyncHandler(saveMonitoringSetting));

// Submit feedback for a prompt
router.post('/feedback/:trackingId', asyncHandler(submitPromptFeedback));

// Auto-detect prompt success based on user behavior
router.post('/auto-detect/:trackingId', asyncHandler(autoDetectPromptSuccess));

export default router;

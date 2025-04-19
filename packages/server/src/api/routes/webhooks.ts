/**
 * Webhook API Routes
 * 
 * This module provides API endpoints for managing webhook configurations, including:
 * - Creating and managing webhook configurations
 * - Testing webhooks
 * - Viewing webhook delivery logs
 * - Regenerating webhook secrets
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { webhookController } from '../controllers/webhookController';

const router = Router();

// Get user webhook configurations
router.get(
  '/configurations',
  requireAuth,
  webhookController.getUserWebhookConfigurations
);

// Get webhook configuration by ID
router.get(
  '/configurations/:id',
  requireAuth,
  param('id').isUUID(),
  validateRequest,
  webhookController.getWebhookConfiguration
);

// Create webhook configuration
router.post(
  '/configurations',
  requireAuth,
  body('name').isString().notEmpty(),
  body('url').isURL(),
  body('events').isArray().notEmpty(),
  body('isActive').optional().isBoolean(),
  validateRequest,
  webhookController.createWebhookConfiguration
);

// Update webhook configuration
router.put(
  '/configurations/:id',
  requireAuth,
  param('id').isUUID(),
  body('name').optional().isString().notEmpty(),
  body('url').optional().isURL(),
  body('events').optional().isArray(),
  body('isActive').optional().isBoolean(),
  validateRequest,
  webhookController.updateWebhookConfiguration
);

// Delete webhook configuration
router.delete(
  '/configurations/:id',
  requireAuth,
  param('id').isUUID(),
  validateRequest,
  webhookController.deleteWebhookConfiguration
);

// Test webhook
router.post(
  '/configurations/:id/test',
  requireAuth,
  param('id').isUUID(),
  validateRequest,
  webhookController.testWebhook
);

// Regenerate webhook secret
router.post(
  '/configurations/:id/regenerate-secret',
  requireAuth,
  param('id').isUUID(),
  validateRequest,
  webhookController.regenerateWebhookSecret
);

// Get webhook delivery logs
router.get(
  '/configurations/:id/logs',
  requireAuth,
  param('id').isUUID(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('status').optional().isString().isIn(['success', 'error']),
  validateRequest,
  webhookController.getWebhookDeliveryLogs
);

// Admin: Get all webhook configurations
router.get(
  '/admin/configurations',
  requireAuth,
  requireAdmin,
  query('userId').optional().isUUID(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  validateRequest,
  webhookController.getAllWebhookConfigurations
);

// Admin: Get all webhook delivery logs
router.get(
  '/admin/logs',
  requireAuth,
  requireAdmin,
  query('configurationId').optional().isUUID(),
  query('userId').optional().isUUID(),
  query('status').optional().isString().isIn(['success', 'error']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  validateRequest,
  webhookController.getAllWebhookDeliveryLogs
);

// Admin: Get webhook stats
router.get(
  '/admin/stats',
  requireAuth,
  requireAdmin,
  query('startDate').optional().isString(),
  query('endDate').optional().isString(),
  validateRequest,
  webhookController.getWebhookStats
);

export default router;

/**
 * Webhook Routes
 *
 * These routes handle webhook events from external services like Stripe,
 * as well as managing webhook integrations for the application.
 */

import express from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import webhookController from '../controllers/webhook.controller';
import {
  getWebhookConfigurations,
  getWebhookConfigurationById,
  createWebhookConfiguration,
  updateWebhookConfiguration,
  deleteWebhookConfiguration,
  getWebhookDeliveryLogs,
  testWebhookConfiguration,
  regenerateWebhookSecret
} from '../controllers/webhook/webhook.controller';

// Use type assertion to handle TypeScript definition issue
const router = (express as any).Router();

/**
 * @route   POST /api/webhooks/stripe
 * @desc    Handle Stripe webhook events
 * @access  Public
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }), // Raw body for Stripe signature verification
  asyncHandler(webhookController.handleStripeWebhook)
);

// Webhook configuration routes (protected by authentication)
router.get(
  '/configurations',
  authMiddleware,
  asyncHandler(getWebhookConfigurations)
);

router.get(
  '/configurations/:id',
  authMiddleware,
  asyncHandler(getWebhookConfigurationById)
);

router.post(
  '/configurations',
  authMiddleware,
  asyncHandler(createWebhookConfiguration)
);

router.put(
  '/configurations/:id',
  authMiddleware,
  asyncHandler(updateWebhookConfiguration)
);

router.delete(
  '/configurations/:id',
  authMiddleware,
  asyncHandler(deleteWebhookConfiguration)
);

// Webhook delivery logs
router.get(
  '/configurations/:id/logs',
  authMiddleware,
  asyncHandler(getWebhookDeliveryLogs)
);

// Test webhook
router.post(
  '/configurations/:id/test',
  authMiddleware,
  asyncHandler(testWebhookConfiguration)
);

// Regenerate webhook secret
router.post(
  '/configurations/:id/regenerate-secret',
  authMiddleware,
  asyncHandler(regenerateWebhookSecret)
);

export default router;

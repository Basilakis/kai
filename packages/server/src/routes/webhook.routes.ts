/**
 * Webhook Routes
 * 
 * These routes handle webhook events from external services like Stripe.
 */

import express from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import webhookController from '../controllers/webhook.controller';

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

export default router;

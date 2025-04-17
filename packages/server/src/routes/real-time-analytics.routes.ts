/**
 * Real-Time Analytics Routes
 * 
 * This file defines routes for real-time analytics functionality,
 * allowing users to track and analyze events as they happen.
 */

import express from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import realTimeAnalyticsController from '../controllers/real-time-analytics.controller';
import { 
  authMiddleware, 
  tokenRefreshMiddleware, 
  rateLimitMiddleware 
} from '../middleware/auth.middleware';

const router = express.Router();

/**
 * @route   POST /api/analytics/real-time/event
 * @desc    Track a real-time analytics event
 * @access  Authenticated
 */
router.post(
  '/real-time/event',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware(30, 60), // 30 requests per minute
  asyncHandler(realTimeAnalyticsController.trackRealTimeEvent)
);

/**
 * @route   GET /api/analytics/real-time/events
 * @desc    Get recent real-time analytics events
 * @access  Authenticated
 */
router.get(
  '/real-time/events',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware(20, 60), // 20 requests per minute
  asyncHandler(realTimeAnalyticsController.getRecentEvents)
);

/**
 * @route   WebSocket /api/analytics/real-time
 * @desc    Subscribe to real-time analytics events
 * @access  Authenticated via query parameter
 * 
 * This route is handled by the WebSocket server in the real-time analytics service.
 * The actual handling is done by the WebSocket server, not by Express.
 */

export default router;

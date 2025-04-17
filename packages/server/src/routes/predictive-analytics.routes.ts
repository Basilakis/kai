/**
 * Predictive Analytics Routes
 * 
 * This file defines routes for predictive analytics functionality,
 * including time-series forecasting, anomaly detection, and user behavior prediction.
 */

import express from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import predictiveAnalyticsController from '../controllers/predictive-analytics.controller';
import { 
  authMiddleware, 
  tokenRefreshMiddleware, 
  rateLimitMiddleware,
  authorizeRoles
} from '../middleware/auth.middleware';

const router = express.Router();

/**
 * @route   POST /api/analytics/predictive/forecast
 * @desc    Generate a time-series forecast
 * @access  Authenticated
 */
router.post(
  '/predictive/forecast',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware(10, 60), // 10 requests per minute
  asyncHandler(predictiveAnalyticsController.generateForecast)
);

/**
 * @route   POST /api/analytics/predictive/anomalies
 * @desc    Detect anomalies in analytics data
 * @access  Authenticated
 */
router.post(
  '/predictive/anomalies',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware(10, 60), // 10 requests per minute
  asyncHandler(predictiveAnalyticsController.detectAnomalies)
);

/**
 * @route   POST /api/analytics/predictive/user-behavior
 * @desc    Predict user behavior
 * @access  Authenticated (Admin or Manager)
 */
router.post(
  '/predictive/user-behavior',
  authMiddleware,
  tokenRefreshMiddleware,
  authorizeRoles(['admin', 'manager']),
  rateLimitMiddleware(5, 60), // 5 requests per minute
  asyncHandler(predictiveAnalyticsController.predictUserBehavior)
);

export default router;

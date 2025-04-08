/**
 * Admin Analytics Routes
 * 
 * This file contains routes for accessing analytics data
 * including search history, agent prompts, and API usage statistics.
 * 
 * Sensitive operations like clearing analytics data are restricted to internal networks only.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import analyticsController from '../../controllers/analytics.controller';
import { authorize } from '../../middleware/auth.middleware';
import { NetworkAccessType } from '../../utils/network';

const router = express.Router();

/**
 * @route   GET /api/admin/analytics/events
 * @desc    Get analytics events with filtering options
 * @access  Private (Admin)
 */
router.get('/events', asyncHandler(analyticsController.getAnalyticsEvents));

/**
 * @route   GET /api/admin/analytics/trends
 * @desc    Get analytics trends over time
 * @access  Private (Admin)
 */
router.get('/trends', asyncHandler(analyticsController.getAnalyticsTrends));

/**
 * @route   GET /api/admin/analytics/stats
 * @desc    Get analytics statistics
 * @access  Private (Admin)
 */
router.get('/stats', asyncHandler(analyticsController.getAnalyticsStats));

/**
 * @route   GET /api/admin/analytics/searches
 * @desc    Get top search queries
 * @access  Private (Admin)
 */
router.get('/searches', asyncHandler(analyticsController.getTopSearchQueries));

/**
 * @route   GET /api/admin/analytics/agent-prompts
 * @desc    Get top agent prompts
 * @access  Private (Admin)
 */
router.get('/agent-prompts', asyncHandler(analyticsController.getTopAgentPrompts));

/**
 * @route   GET /api/admin/analytics/materials
 * @desc    Get top viewed materials
 * @access  Private (Admin)
 */
router.get('/materials', asyncHandler(analyticsController.getTopMaterials));

/**
 * @route   DELETE /api/admin/analytics/data
 * @desc    Clear analytics data (admin only)
 * @access  Private (Admin) - Internal Network Only
 */
router.delete(
  '/data', 
  authorize({ accessType: NetworkAccessType.INTERNAL_ONLY }), 
  asyncHandler(analyticsController.clearAnalyticsData)
);

// Example of additional internal-only endpoints that would be implemented
// in a real application. These are commented out since the controller
// methods don't exist yet.

/**
 * @route   POST /api/admin/analytics/rebuild-index
 * @desc    Rebuild analytics search index
 * @access  Private (Admin) - Internal Network Only
 */
// router.post(
//   '/rebuild-index',
//   authorize({ accessType: NetworkAccessType.INTERNAL_ONLY }),
//   asyncHandler((req, res) => {
//     // Implementation would go here
//     res.status(200).json({ 
//       success: true, 
//       message: 'Analytics index rebuilt successfully' 
//     });
//   })
// );

/**
 * @route   POST /api/admin/analytics/update-config
 * @desc    Update analytics configuration
 * @access  Private (Admin) - Internal Network Only
 */
// router.post(
//   '/update-config',
//   authorize({ accessType: NetworkAccessType.INTERNAL_ONLY }),
//   asyncHandler((req, res) => {
//     // Implementation would go here
//     res.status(200).json({ 
//       success: true, 
//       message: 'Analytics configuration updated successfully' 
//     });
//   })
// );

export default router;
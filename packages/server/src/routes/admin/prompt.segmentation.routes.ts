/**
 * Admin Prompt Segmentation Routes
 * 
 * Defines API routes for admin management of user segmentation.
 */

import express from 'express';
import { authMiddleware, authorize } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { NetworkAccessType } from '../../utils/network';
import {
  getUserSegments,
  createUserSegment,
  updateUserSegment,
  deleteUserSegment,
  getSegmentAnalytics,
  compareSegments
} from '../../controllers/admin/prompt.segmentation.controller';

const router = express.Router();

// Apply admin authentication and network restriction to all routes in this file
router.use(authMiddleware, authorize({ 
  roles: ['admin'], 
  accessType: NetworkAccessType.INTERNAL_ONLY 
}));

// Get all user segments
router.get('/', asyncHandler(getUserSegments));

// Create user segment
router.post('/', asyncHandler(createUserSegment));

// Update user segment
router.put('/:segmentId', asyncHandler(updateUserSegment));

// Delete user segment
router.delete('/:segmentId', asyncHandler(deleteUserSegment));

// Get segment analytics
router.get('/:segmentId/analytics', asyncHandler(getSegmentAnalytics));

// Compare segments
router.post('/compare', asyncHandler(compareSegments));

export default router;

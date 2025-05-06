/**
 * Admin Prompt Statistical Routes
 * 
 * Defines API routes for admin management of prompt statistical analysis.
 */

import express from 'express';
import { authMiddleware, authorize } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { NetworkAccessType } from '../../utils/network';
import {
  getStatisticalAnalyses,
  analyzeExperiment,
  compareSegments
} from '../../controllers/admin/prompt.statistical.controller';

const router = express.Router();

// Apply admin authentication and network restriction to all routes in this file
router.use(authMiddleware, authorize({ 
  roles: ['admin'], 
  accessType: NetworkAccessType.INTERNAL_ONLY 
}));

// Get statistical analyses
router.get('/', asyncHandler(getStatisticalAnalyses));

// Analyze experiment
router.post('/experiments/:experimentId/analyze', asyncHandler(analyzeExperiment));

// Compare segments
router.post('/segments/compare', asyncHandler(compareSegments));

export default router;

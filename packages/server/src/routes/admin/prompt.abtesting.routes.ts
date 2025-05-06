/**
 * Admin Prompt A/B Testing Routes
 * 
 * Defines API routes for admin management of prompt A/B testing.
 */

import express from 'express';
import { authMiddleware, authorize } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { NetworkAccessType } from '../../utils/network';
import {
  getABExperiments,
  getABExperimentById,
  createABExperiment,
  updateABExperiment,
  endABExperiment,
  getExperimentResults
} from '../../controllers/admin/prompt.abtesting.controller';

const router = express.Router();

// Apply admin authentication and network restriction to all routes in this file
router.use(authMiddleware, authorize({ 
  roles: ['admin'], 
  accessType: NetworkAccessType.INTERNAL_ONLY 
}));

// Get all A/B test experiments
router.get('/', asyncHandler(getABExperiments));

// Get A/B test experiment by ID
router.get('/:experimentId', asyncHandler(getABExperimentById));

// Create A/B test experiment
router.post('/', asyncHandler(createABExperiment));

// Update A/B test experiment
router.put('/:experimentId', asyncHandler(updateABExperiment));

// End A/B test experiment
router.post('/:experimentId/end', asyncHandler(endABExperiment));

// Get experiment results
router.get('/:experimentId/results', asyncHandler(getExperimentResults));

export default router;

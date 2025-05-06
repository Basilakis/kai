/**
 * Admin Prompt Optimization Routes
 * 
 * Defines API routes for admin management of prompt optimization.
 */

import express from 'express';
import { authMiddleware, authorize } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { NetworkAccessType } from '../../utils/network';
import {
  getOptimizationRules,
  createOptimizationRule,
  getOptimizationActions,
  executeOptimizationRules,
  executePendingActions
} from '../../controllers/admin/prompt.optimization.controller';

const router = express.Router();

// Apply admin authentication and network restriction to all routes in this file
router.use(authMiddleware, authorize({ 
  roles: ['admin'], 
  accessType: NetworkAccessType.INTERNAL_ONLY 
}));

// Get optimization rules
router.get('/rules', asyncHandler(getOptimizationRules));

// Create optimization rule
router.post('/rules', asyncHandler(createOptimizationRule));

// Get optimization actions
router.get('/actions', asyncHandler(getOptimizationActions));

// Execute optimization rules
router.post('/rules/execute', asyncHandler(executeOptimizationRules));

// Execute pending actions
router.post('/actions/execute', asyncHandler(executePendingActions));

export default router;

/**
 * Admin Prompt ML Routes
 * 
 * Defines API routes for admin management of prompt ML models and predictions.
 */

import express from 'express';
import { authMiddleware, authorize } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { NetworkAccessType } from '../../utils/network';
import {
  getMLModels,
  getMLModelById,
  createMLModel,
  trainMLModel,
  predictPromptSuccess,
  generateImprovementSuggestions,
  applyImprovementSuggestion
} from '../../controllers/admin/prompt.ml.controller';

const router = express.Router();

// Apply admin authentication and network restriction to all routes in this file
router.use(authMiddleware, authorize({ 
  roles: ['admin'], 
  accessType: NetworkAccessType.INTERNAL_ONLY 
}));

// Get all ML models
router.get('/', asyncHandler(getMLModels));

// Get ML model by ID
router.get('/:modelId', asyncHandler(getMLModelById));

// Create ML model
router.post('/', asyncHandler(createMLModel));

// Train ML model
router.post('/:modelId/train', asyncHandler(trainMLModel));

// Predict prompt success
router.get('/prompts/:promptId/predict', asyncHandler(predictPromptSuccess));

// Generate improvement suggestions
router.get('/prompts/:promptId/suggestions', asyncHandler(generateImprovementSuggestions));

// Apply improvement suggestion
router.post('/suggestions/:suggestionId/apply', asyncHandler(applyImprovementSuggestion));

export default router;

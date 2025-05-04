/**
 * Relationship-Aware Model Training Routes
 * 
 * API endpoints for relationship-aware model training.
 */

import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminMiddleware } from '../../middleware/admin.middleware';
import { validateRequestSchema } from '../../middleware/validate-request-schema.middleware';
import { relationshipAwareTrainingService } from '../../services/ai/relationship-aware-training/relationshipAwareTrainingService';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * @route POST /api/ai/relationship-aware-training/train
 * @desc Train a relationship-aware model
 * @access Private (Admin)
 */
router.post(
  '/train',
  authMiddleware,
  adminMiddleware,
  [
    body('materialType').isString().notEmpty().withMessage('Material type is required'),
    body('targetProperty').isString().notEmpty().withMessage('Target property is required'),
    body('options').optional().isObject()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { materialType, targetProperty, options } = req.body;
      
      // Train model
      const result = await relationshipAwareTrainingService.trainModel(
        materialType,
        targetProperty,
        options
      );
      
      res.status(200).json({
        success: true,
        message: `Trained relationship-aware model for ${targetProperty} (${materialType})`,
        result
      });
    } catch (error) {
      logger.error('Error training relationship-aware model:', error);
      res.status(500).json({
        success: false,
        message: 'Error training relationship-aware model',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/ai/relationship-aware-training/job/:jobId
 * @desc Get job status
 * @access Private (Admin)
 */
router.get(
  '/job/:jobId',
  authMiddleware,
  adminMiddleware,
  [
    param('jobId').isUUID().withMessage('Valid job ID is required')
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const jobId = req.params.jobId;
      
      // Get job status
      const status = await relationshipAwareTrainingService.getJobStatus(jobId);
      
      if (!status) {
        return res.status(404).json({
          success: false,
          message: `Job ${jobId} not found`
        });
      }
      
      res.status(200).json({
        success: true,
        status
      });
    } catch (error) {
      logger.error('Error getting job status:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting job status',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

export default router;

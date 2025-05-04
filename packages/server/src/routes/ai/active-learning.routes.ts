/**
 * Active Learning Routes
 * 
 * API endpoints for active learning to improve models.
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminMiddleware } from '../../middleware/admin.middleware';
import { validateRequestSchema } from '../../middleware/validate-request-schema.middleware';
import { 
  createActiveLearningSession,
  getActiveLearningSession,
  getAllActiveLearningSession,
  provideFeedback,
  retrainModelWithActiveLearningData
} from '@kai/ml/src/active-learning/active-learning';
import { MaterialType } from '@kai/ml';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * @route POST /api/ai/active-learning/sessions
 * @desc Create a new active learning session
 * @access Admin
 */
router.post(
  '/sessions',
  authMiddleware,
  adminMiddleware,
  [
    body('propertyName').isString().notEmpty().withMessage('Property name is required'),
    body('materialType').isString().notEmpty().withMessage('Material type is required'),
    body('modelId').isString().notEmpty().withMessage('Model ID is required'),
    body('options').optional().isObject()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { propertyName, materialType, modelId, options } = req.body;
      
      // Create active learning session
      const session = await createActiveLearningSession(
        propertyName,
        materialType as MaterialType,
        modelId,
        options
      );
      
      res.json({
        success: true,
        session
      });
    } catch (error) {
      logger.error('Error creating active learning session:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating active learning session',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/ai/active-learning/sessions
 * @desc Get all active learning sessions
 * @access Admin
 */
router.get(
  '/sessions',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const propertyName = req.query.propertyName as string | undefined;
      const materialType = req.query.materialType as MaterialType | undefined;
      
      // Get all active learning sessions
      const sessions = await getAllActiveLearningSession(propertyName, materialType);
      
      res.json({
        success: true,
        sessions
      });
    } catch (error) {
      logger.error('Error getting active learning sessions:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting active learning sessions',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/ai/active-learning/sessions/:sessionId
 * @desc Get an active learning session
 * @access Admin
 */
router.get(
  '/sessions/:sessionId',
  authMiddleware,
  adminMiddleware,
  [
    param('sessionId').isString().notEmpty().withMessage('Session ID is required')
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      // Get active learning session
      const session = await getActiveLearningSession(sessionId);
      
      res.json({
        success: true,
        session
      });
    } catch (error) {
      logger.error('Error getting active learning session:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting active learning session',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/ai/active-learning/sessions/:sessionId/feedback
 * @desc Provide feedback for an uncertain sample
 * @access Admin
 */
router.post(
  '/sessions/:sessionId/feedback',
  authMiddleware,
  adminMiddleware,
  [
    param('sessionId').isString().notEmpty().withMessage('Session ID is required'),
    body('sampleId').isString().notEmpty().withMessage('Sample ID is required'),
    body('correctValue').isString().notEmpty().withMessage('Correct value is required')
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { sampleId, correctValue } = req.body;
      
      // Provide feedback
      const session = await provideFeedback(
        sessionId,
        sampleId,
        correctValue,
        req.user!.id
      );
      
      res.json({
        success: true,
        session
      });
    } catch (error) {
      logger.error('Error providing feedback:', error);
      res.status(500).json({
        success: false,
        message: 'Error providing feedback',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/ai/active-learning/sessions/:sessionId/retrain
 * @desc Retrain model with active learning data
 * @access Admin
 */
router.post(
  '/sessions/:sessionId/retrain',
  authMiddleware,
  adminMiddleware,
  [
    param('sessionId').isString().notEmpty().withMessage('Session ID is required')
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      // Retrain model
      const improvementMetrics = await retrainModelWithActiveLearningData(sessionId);
      
      res.json({
        success: true,
        improvementMetrics
      });
    } catch (error) {
      logger.error('Error retraining model:', error);
      res.status(500).json({
        success: false,
        message: 'Error retraining model',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

export default router;

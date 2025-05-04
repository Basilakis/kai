/**
 * Model Comparison Routes
 * 
 * API endpoints for comparing different models for the same property.
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminMiddleware } from '../../middleware/admin.middleware';
import { validateRequestSchema } from '../../middleware/validate-request-schema.middleware';
import { 
  compareModels, 
  getModelVersions, 
  createModelVersion, 
  deleteModelVersion 
} from '@kai/ml/src/model-comparison/model-comparison';
import { MaterialType } from '@kai/ml';
import { logger } from '../../utils/logger';
import { prisma } from '../../services/prisma';

const router = Router();

/**
 * @route GET /api/ai/model-comparison/:propertyName/versions
 * @desc Get model versions for a property
 * @access Admin
 */
router.get(
  '/:propertyName/versions',
  authMiddleware,
  adminMiddleware,
  [
    param('propertyName').isString().notEmpty().withMessage('Property name is required')
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { propertyName } = req.params;
      const materialType = req.query.materialType as MaterialType || 'all';
      
      // Get model versions
      const versions = await getModelVersions(propertyName, materialType);
      
      // Get reference information
      const reference = await prisma.visualPropertyReference.findFirst({
        where: {
          propertyName,
          materialType
        }
      });
      
      res.json({
        success: true,
        versions,
        reference
      });
    } catch (error) {
      logger.error('Error getting model versions:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting model versions',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/ai/model-comparison/:propertyName/versions
 * @desc Create a new model version
 * @access Admin
 */
router.post(
  '/:propertyName/versions',
  authMiddleware,
  adminMiddleware,
  [
    param('propertyName').isString().notEmpty().withMessage('Property name is required'),
    body('materialType').isString().notEmpty().withMessage('Material type is required'),
    body('sourceModelId').optional().isString()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { propertyName } = req.params;
      const { materialType, sourceModelId } = req.body;
      
      // Create new model version
      const newModelId = await createModelVersion(
        propertyName,
        materialType as MaterialType,
        sourceModelId
      );
      
      res.json({
        success: true,
        message: 'Model version created',
        modelId: newModelId
      });
    } catch (error) {
      logger.error('Error creating model version:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating model version',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route DELETE /api/ai/model-comparison/:propertyName/versions/:modelId
 * @desc Delete a model version
 * @access Admin
 */
router.delete(
  '/:propertyName/versions/:modelId',
  authMiddleware,
  adminMiddleware,
  [
    param('propertyName').isString().notEmpty().withMessage('Property name is required'),
    param('modelId').isString().notEmpty().withMessage('Model ID is required')
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { propertyName, modelId } = req.params;
      const materialType = req.query.materialType as MaterialType || 'all';
      
      // Delete model version
      await deleteModelVersion(propertyName, materialType, modelId);
      
      res.json({
        success: true,
        message: 'Model version deleted'
      });
    } catch (error) {
      logger.error('Error deleting model version:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting model version',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/ai/model-comparison/:propertyName/compare
 * @desc Compare models for a property
 * @access Admin
 */
router.post(
  '/:propertyName/compare',
  authMiddleware,
  adminMiddleware,
  [
    param('propertyName').isString().notEmpty().withMessage('Property name is required'),
    body('materialType').isString().notEmpty().withMessage('Material type is required'),
    body('modelIds').isArray().notEmpty().withMessage('Model IDs are required'),
    body('testDataDir').optional().isString()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { propertyName } = req.params;
      const { materialType, modelIds, testDataDir } = req.body;
      
      // Compare models
      const result = await compareModels(
        propertyName,
        materialType as MaterialType,
        modelIds,
        testDataDir
      );
      
      res.json({
        success: true,
        result
      });
    } catch (error) {
      logger.error('Error comparing models:', error);
      res.status(500).json({
        success: false,
        message: 'Error comparing models',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

export default router;

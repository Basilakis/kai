/**
 * Cross-Property Routes
 * 
 * API endpoints for cross-property models that can recognize multiple properties at once.
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminMiddleware } from '../../middleware/admin.middleware';
import { validateRequestSchema } from '../../middleware/validate-request-schema.middleware';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { 
  createCrossPropertyModel,
  getCrossPropertyModel,
  getAllCrossPropertyModels,
  trainCrossPropertyModel,
  predictWithCrossPropertyModel,
  deleteCrossPropertyModel
} from '@kai/ml/src/cross-property/cross-property-model';
import { MaterialType } from '@kai/ml';
import { logger } from '../../utils/logger';

const router = Router();

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'temp');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ storage });

/**
 * @route POST /api/ai/cross-property/models
 * @desc Create a new cross-property model
 * @access Admin
 */
router.post(
  '/models',
  authMiddleware,
  adminMiddleware,
  [
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('materialType').isString().notEmpty().withMessage('Material type is required'),
    body('properties').isArray().notEmpty().withMessage('Properties are required'),
    body('description').optional().isString()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { name, materialType, properties, description } = req.body;
      
      // Create cross-property model
      const model = await createCrossPropertyModel(
        name,
        materialType as MaterialType,
        properties,
        description
      );
      
      res.json({
        success: true,
        model
      });
    } catch (error) {
      logger.error('Error creating cross-property model:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating cross-property model',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/ai/cross-property/models
 * @desc Get all cross-property models
 * @access Admin
 */
router.get(
  '/models',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const materialType = req.query.materialType as MaterialType | undefined;
      
      // Get all cross-property models
      const models = await getAllCrossPropertyModels(materialType);
      
      res.json({
        success: true,
        models
      });
    } catch (error) {
      logger.error('Error getting cross-property models:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting cross-property models',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/ai/cross-property/models/:modelId
 * @desc Get a cross-property model
 * @access Admin
 */
router.get(
  '/models/:modelId',
  authMiddleware,
  adminMiddleware,
  [
    param('modelId').isString().notEmpty().withMessage('Model ID is required')
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { modelId } = req.params;
      
      // Get cross-property model
      const model = await getCrossPropertyModel(modelId);
      
      res.json({
        success: true,
        model
      });
    } catch (error) {
      logger.error('Error getting cross-property model:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting cross-property model',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/ai/cross-property/models/:modelId/train
 * @desc Train a cross-property model
 * @access Admin
 */
router.post(
  '/models/:modelId/train',
  authMiddleware,
  adminMiddleware,
  [
    param('modelId').isString().notEmpty().withMessage('Model ID is required'),
    body('options').optional().isObject()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { modelId } = req.params;
      const { options } = req.body;
      
      // Train cross-property model
      const model = await trainCrossPropertyModel(modelId, options);
      
      res.json({
        success: true,
        model
      });
    } catch (error) {
      logger.error('Error training cross-property model:', error);
      res.status(500).json({
        success: false,
        message: 'Error training cross-property model',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/ai/cross-property/models/:modelId/predict
 * @desc Predict with a cross-property model
 * @access Admin
 */
router.post(
  '/models/:modelId/predict',
  authMiddleware,
  adminMiddleware,
  upload.single('image'),
  [
    param('modelId').isString().notEmpty().withMessage('Model ID is required')
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { modelId } = req.params;
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No image provided'
        });
      }
      
      // Predict with cross-property model
      const result = await predictWithCrossPropertyModel(modelId, req.file.path);
      
      // Clean up
      fs.unlinkSync(req.file.path);
      
      res.json({
        success: true,
        predictions: result.predictions,
        processingTime: result.processingTime
      });
    } catch (error) {
      logger.error('Error predicting with cross-property model:', error);
      
      // Clean up
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({
        success: false,
        message: 'Error predicting with cross-property model',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route DELETE /api/ai/cross-property/models/:modelId
 * @desc Delete a cross-property model
 * @access Admin
 */
router.delete(
  '/models/:modelId',
  authMiddleware,
  adminMiddleware,
  [
    param('modelId').isString().notEmpty().withMessage('Model ID is required')
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { modelId } = req.params;
      
      // Delete cross-property model
      await deleteCrossPropertyModel(modelId);
      
      res.json({
        success: true,
        message: 'Model deleted'
      });
    } catch (error) {
      logger.error('Error deleting cross-property model:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting cross-property model',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

export default router;

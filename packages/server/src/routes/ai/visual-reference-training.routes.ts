/**
 * Visual Reference Training Routes
 * 
 * API routes for training AI models using the Visual Reference Library
 */

import express from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminMiddleware } from '../../middleware/admin.middleware';
import { visualReferenceTrainingService } from '../../services/ai/visual-reference-training';
import { logger } from '../../utils/logger';

const router = express.Router();

/**
 * @route   POST /api/ai/visual-reference/datasets
 * @desc    Create a training dataset from visual references
 * @access  Admin
 */
router.post(
  '/datasets',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { propertyName, materialType } = req.body;
      
      if (!propertyName || !materialType) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: propertyName, materialType'
        });
      }
      
      const datasetId = await visualReferenceTrainingService.createTrainingDataset(
        propertyName,
        materialType
      );
      
      res.status(201).json({
        success: true,
        datasetId,
        message: `Created training dataset for ${propertyName} (${materialType})`
      });
    } catch (error) {
      logger.error('Error creating training dataset', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/ai/visual-reference/models
 * @desc    Train a model using a visual reference dataset
 * @access  Admin
 */
router.post(
  '/models',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { datasetId, modelType, options } = req.body;
      
      if (!datasetId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: datasetId'
        });
      }
      
      const modelId = await visualReferenceTrainingService.trainModel(
        datasetId,
        modelType,
        options
      );
      
      res.status(201).json({
        success: true,
        modelId,
        message: `Trained ${modelType || 'classification'} model using dataset ${datasetId}`
      });
    } catch (error) {
      logger.error('Error training model', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/ai/visual-reference/train
 * @desc    Create a dataset and train a model in one step
 * @access  Admin
 */
router.post(
  '/train',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { propertyName, materialType, modelType, options } = req.body;
      
      if (!propertyName || !materialType) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: propertyName, materialType'
        });
      }
      
      // Create dataset
      const datasetId = await visualReferenceTrainingService.createTrainingDataset(
        propertyName,
        materialType
      );
      
      // Train model
      const modelId = await visualReferenceTrainingService.trainModel(
        datasetId,
        modelType,
        options
      );
      
      res.status(201).json({
        success: true,
        datasetId,
        modelId,
        message: `Created dataset and trained ${modelType || 'classification'} model for ${propertyName} (${materialType})`
      });
    } catch (error) {
      logger.error('Error in combined dataset creation and model training', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export default router;

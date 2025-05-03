/**
 * Property Prediction Routes
 * 
 * API routes for predicting property values using AI models
 * enhanced with relationship data.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminMiddleware } from '../../middleware/admin.middleware';
import { propertyPredictionService } from '../../services/ai/property-prediction/propertyPredictionService';
import { logger } from '../../utils/logger';

const router = express.Router();

/**
 * @route   POST /api/ai/property-prediction/train
 * @desc    Train a model to predict a property
 * @access  Admin
 */
router.post(
  '/train',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { materialType, targetProperty, options } = req.body;
      
      if (!materialType || !targetProperty) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: materialType, targetProperty'
        });
      }
      
      const modelId = await propertyPredictionService.trainModel(
        materialType,
        targetProperty,
        options
      );
      
      res.status(201).json({
        success: true,
        modelId,
        message: `Trained model for ${targetProperty} (${materialType})`
      });
    } catch (error) {
      logger.error('Error training property prediction model', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/ai/property-prediction/predict
 * @desc    Predict a property value
 * @access  Private
 */
router.post(
  '/predict',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { modelId, properties } = req.body;
      
      if (!modelId || !properties) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: modelId, properties'
        });
      }
      
      const predictions = await propertyPredictionService.predictProperty(
        modelId,
        properties
      );
      
      res.json({
        success: true,
        predictions
      });
    } catch (error) {
      logger.error('Error predicting property', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export default router;

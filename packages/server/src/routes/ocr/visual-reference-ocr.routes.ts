/**
 * Visual Reference OCR Routes
 *
 * API routes for enhancing OCR extraction using the Visual Reference Library
 */

import express from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { visualReferenceOcrService } from '../../services/ocr/visual-reference-ocr';
import { logger } from '../../utils/logger';

const router = express.Router();

/**
 * @route   POST /api/ocr/visual-reference/enhance
 * @desc    Enhance OCR extraction with visual reference verification
 * @access  Private
 */
router.post(
  '/enhance',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { propertyName, extractedValue, imageUrl, materialType } = req.body;

      if (!propertyName || !extractedValue || !imageUrl || !materialType) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: propertyName, extractedValue, imageUrl, materialType'
        });
      }

      const result = await visualReferenceOcrService.enhanceExtraction(
        propertyName,
        extractedValue,
        imageUrl,
        materialType,
        req.user.id
      );

      res.json({
        success: true,
        result
      });
    } catch (error) {
      logger.error('Error enhancing OCR extraction', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/ocr/visual-reference/enhance-multiple
 * @desc    Enhance multiple OCR extractions with visual reference verification
 * @access  Private
 */
router.post(
  '/enhance-multiple',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { extractedProperties, imageUrl, materialType } = req.body;

      if (!extractedProperties || !imageUrl || !materialType) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: extractedProperties, imageUrl, materialType'
        });
      }

      const results = await visualReferenceOcrService.enhanceMultipleExtractions(
        extractedProperties,
        imageUrl,
        materialType,
        req.user.id
      );

      res.json({
        success: true,
        results
      });
    } catch (error) {
      logger.error('Error enhancing multiple OCR extractions', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/ocr/visual-reference/patterns/:propertyName/:materialType
 * @desc    Get extraction patterns for a property based on visual references
 * @access  Private
 */
router.get(
  '/patterns/:propertyName/:materialType',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { propertyName, materialType } = req.params;

      const patterns = await visualReferenceOcrService.getExtractionPatterns(
        propertyName,
        materialType
      );

      res.json({
        success: true,
        patterns
      });
    } catch (error) {
      logger.error('Error getting extraction patterns', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export default router;

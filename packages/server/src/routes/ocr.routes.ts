import { Router } from 'express';
import { 
  detectMaterialType, 
  extractMetadataFromOCR 
} from '@kai/ml';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequestSchema } from '../middleware/validate-request-schema.middleware';
import { body } from 'express-validator';

const router = Router();

/**
 * @route POST /api/ocr/detect-material-type
 * @desc Detect material type from OCR text
 * @access Private
 */
router.post(
  '/detect-material-type',
  authMiddleware,
  [
    body('text').isString().notEmpty().withMessage('Text is required'),
    body('imagePath').optional().isString()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { text, imagePath } = req.body;
      
      const result = await detectMaterialType(text, imagePath);
      
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Error detecting material type:', error);
      res.status(500).json({
        success: false,
        message: 'Error detecting material type',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/ocr/extract-metadata
 * @desc Extract metadata from OCR text using material-specific patterns
 * @access Private
 */
router.post(
  '/extract-metadata',
  authMiddleware,
  [
    body('text').isString().notEmpty().withMessage('Text is required'),
    body('imagePath').optional().isString(),
    body('materialType').optional().isString()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { text, imagePath } = req.body;
      
      const result = await extractMetadataFromOCR(text, imagePath);
      
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Error extracting metadata:', error);
      res.status(500).json({
        success: false,
        message: 'Error extracting metadata',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/ocr/test-extraction-pattern
 * @desc Test an extraction pattern against sample text
 * @access Private
 */
router.post(
  '/test-extraction-pattern',
  authMiddleware,
  [
    body('pattern').isString().notEmpty().withMessage('Pattern is required'),
    body('text').isString().notEmpty().withMessage('Text is required'),
    body('fieldType').optional().isString()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { pattern, text, fieldType = 'text' } = req.body;
      
      // Create a test field
      const testField = {
        id: 'test',
        name: 'test',
        displayName: 'Test Field',
        fieldType,
        extractionPatterns: [pattern],
        isRequired: false,
        order: 0,
        categories: [],
        isActive: true
      };
      
      // Try to extract value
      const extractionResult = extractValueFromOCR(testField, text);
      
      if (extractionResult) {
        res.json({
          success: true,
          matched: true,
          value: extractionResult.value,
          confidence: extractionResult.confidence,
          method: extractionResult.method
        });
      } else {
        res.json({
          success: true,
          matched: false
        });
      }
    } catch (error) {
      console.error('Error testing extraction pattern:', error);
      res.status(500).json({
        success: false,
        message: 'Error testing extraction pattern',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

export default router;

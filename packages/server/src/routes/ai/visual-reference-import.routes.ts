/**
 * Visual Reference Import Routes
 * 
 * API endpoints for importing visual references from various sources.
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminMiddleware } from '../../middleware/admin.middleware';
import { validateRequestSchema } from '../../middleware/validate-request-schema.middleware';
import { crawlerToVisualReferenceIntegration } from '../../services/integration/crawlerToVisualReferenceIntegration';
import { MaterialType } from '@kai/ml';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * @route POST /api/ai/visual-reference/import/crawler/:crawlJobId
 * @desc Import visual references from a crawler job
 * @access Admin
 */
router.post(
  '/crawler/:crawlJobId',
  authMiddleware,
  adminMiddleware,
  [
    param('crawlJobId').isString().notEmpty().withMessage('Crawler job ID is required'),
    body('propertyName').isString().notEmpty().withMessage('Property name is required'),
    body('materialType').isString().notEmpty().withMessage('Material type is required'),
    body('propertyValues').optional().isArray(),
    body('autoClassify').optional().isBoolean(),
    body('maxImages').optional().isInt({ min: 1, max: 1000 })
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { crawlJobId } = req.params;
      const { propertyName, materialType, propertyValues, autoClassify, maxImages } = req.body;
      
      // Import the crawled images
      const result = await crawlerToVisualReferenceIntegration.importCrawledImages(
        crawlJobId,
        {
          propertyName,
          materialType: materialType as MaterialType,
          propertyValues,
          autoClassify,
          maxImages
        }
      );
      
      res.json({
        success: true,
        message: `Imported ${result.imagesImported} images`,
        imagesImported: result.imagesImported,
        errors: result.errors
      });
    } catch (error) {
      logger.error('Error importing visual references from crawler:', error);
      res.status(500).json({
        success: false,
        message: 'Error importing visual references from crawler',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

export default router;

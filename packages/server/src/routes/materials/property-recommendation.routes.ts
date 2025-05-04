/**
 * Property-Based Recommendation Routes
 * 
 * API endpoints for getting property-based material recommendations.
 */

import { Router } from 'express';
import { body, query } from 'express-validator';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validateRequestSchema } from '../../middleware/validate-request-schema.middleware';
import { propertyRecommendationService } from '../../services/recommendations/property-recommendation.service';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * @route POST /api/materials/recommendations
 * @desc Get property-based material recommendations
 * @access Private
 */
router.post(
  '/recommendations',
  authMiddleware,
  [
    body('propertyRequirements').optional().isObject(),
    body('materialType').optional().isString(),
    body('count').optional().isInt({ min: 1, max: 50 }),
    body('excludeMaterialIds').optional().isArray(),
    body('projectContext').optional().isObject(),
    body('includeExplanations').optional().isBoolean(),
    body('minRelevance').optional().isFloat({ min: 0, max: 1 })
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const {
        propertyRequirements,
        materialType,
        count,
        excludeMaterialIds,
        projectContext,
        includeExplanations,
        minRelevance
      } = req.body;
      
      // Get recommendations
      const recommendations = await propertyRecommendationService.getRecommendations({
        userId: req.user!.id,
        propertyRequirements,
        materialType,
        count,
        excludeMaterialIds,
        projectContext,
        includeExplanations,
        minRelevance
      });
      
      res.json({
        success: true,
        recommendations
      });
    } catch (error) {
      logger.error('Error getting property-based recommendations:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting property-based recommendations',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/materials/preferences
 * @desc Save user property preferences
 * @access Private
 */
router.post(
  '/preferences',
  authMiddleware,
  [
    body('materialType').isString().notEmpty().withMessage('Material type is required'),
    body('propertyPreferences').isObject().notEmpty().withMessage('Property preferences are required')
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { materialType, propertyPreferences } = req.body;
      
      // Save user preferences
      await propertyRecommendationService.saveUserPropertyPreferences(
        req.user!.id,
        materialType,
        propertyPreferences
      );
      
      res.json({
        success: true,
        message: 'Property preferences saved'
      });
    } catch (error) {
      logger.error('Error saving property preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Error saving property preferences',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/materials/preferences
 * @desc Get user property preferences
 * @access Private
 */
router.get(
  '/preferences',
  authMiddleware,
  [
    query('materialType').optional().isString()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const materialType = req.query.materialType as string | undefined;
      
      // Get user preferences
      const preferences = await propertyRecommendationService.getUserPropertyPreferences(
        req.user!.id,
        materialType
      );
      
      res.json({
        success: true,
        preferences
      });
    } catch (error) {
      logger.error('Error getting property preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting property preferences',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/materials/project-context
 * @desc Save project context
 * @access Private
 */
router.post(
  '/project-context',
  authMiddleware,
  [
    body('projectId').isString().notEmpty().withMessage('Project ID is required'),
    body('projectType').optional().isString(),
    body('roomType').optional().isString(),
    body('existingMaterials').optional().isArray(),
    body('style').optional().isString(),
    body('budget').optional().isString(),
    body('purpose').optional().isString()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const {
        projectId,
        projectType,
        roomType,
        existingMaterials,
        style,
        budget,
        purpose
      } = req.body;
      
      // Save project context
      await propertyRecommendationService.saveProjectContext({
        projectId,
        projectType,
        roomType,
        existingMaterials,
        style,
        budget,
        purpose
      });
      
      res.json({
        success: true,
        message: 'Project context saved'
      });
    } catch (error) {
      logger.error('Error saving project context:', error);
      res.status(500).json({
        success: false,
        message: 'Error saving project context',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/materials/project-context/:projectId
 * @desc Get project context
 * @access Private
 */
router.get(
  '/project-context/:projectId',
  authMiddleware,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      
      // Get project context
      const context = await propertyRecommendationService.getProjectContext(projectId);
      
      res.json({
        success: true,
        context
      });
    } catch (error) {
      logger.error('Error getting project context:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting project context',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

export default router;

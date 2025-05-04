/**
 * Material Comparison Routes
 * 
 * API endpoints for comparing materials based on their properties.
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validateRequestSchema } from '../../middleware/validate-request-schema.middleware';
import { materialComparisonService } from '../../services/comparison/materialComparisonService';
import { logger } from '../../utils/logger';
import { prisma } from '../../services/prisma';

const router = Router();

/**
 * @route POST /api/materials/compare
 * @desc Compare two or more materials
 * @access Private
 */
router.post(
  '/compare',
  authMiddleware,
  [
    body('materialIds').isArray({ min: 2 }).withMessage('At least two material IDs are required'),
    body('materialIds.*').isString().withMessage('Material IDs must be strings'),
    body('options').optional().isObject()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { materialIds, options } = req.body;
      
      // Compare materials
      if (materialIds.length === 2) {
        // Compare two materials
        const result = await materialComparisonService.compareMaterials(
          materialIds[0],
          materialIds[1],
          options
        );
        
        res.json({
          success: true,
          comparison: result
        });
      } else {
        // Compare multiple materials
        const results = await materialComparisonService.compareMultipleMaterials(
          materialIds,
          options
        );
        
        res.json({
          success: true,
          comparisons: results
        });
      }
    } catch (error) {
      logger.error('Error comparing materials:', error);
      res.status(500).json({
        success: false,
        message: 'Error comparing materials',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/materials/:materialId/similar
 * @desc Find similar materials
 * @access Private
 */
router.get(
  '/:materialId/similar',
  authMiddleware,
  [
    param('materialId').isString().withMessage('Material ID is required'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('materialType').optional().isString()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { materialId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const materialType = req.query.materialType as string | undefined;
      
      // Find similar materials
      const similarMaterials = await materialComparisonService.findSimilarMaterials(
        materialId,
        {
          limit,
          materialType
        }
      );
      
      // Get full material details
      const materialIds = similarMaterials.map(item => item.materialId);
      const materials = await prisma.material.findMany({
        where: {
          id: {
            in: materialIds
          }
        }
      });
      
      // Combine similarity scores with material details
      const result = similarMaterials.map(item => {
        const material = materials.find(m => m.id === item.materialId);
        
        return {
          material,
          similarity: item.similarity,
          propertyComparisons: item.propertyComparisons
        };
      });
      
      res.json({
        success: true,
        similarMaterials: result
      });
    } catch (error) {
      logger.error('Error finding similar materials:', error);
      res.status(500).json({
        success: false,
        message: 'Error finding similar materials',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/materials/comparison-presets
 * @desc Create a comparison preset
 * @access Private
 */
router.post(
  '/comparison-presets',
  authMiddleware,
  [
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('propertyWeights').isObject().withMessage('Property weights are required'),
    body('materialType').optional().isString(),
    body('description').optional().isString(),
    body('includeProperties').optional().isArray(),
    body('excludeProperties').optional().isArray(),
    body('isDefault').optional().isBoolean()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const {
        name,
        propertyWeights,
        materialType,
        description,
        includeProperties,
        excludeProperties,
        isDefault
      } = req.body;
      
      // Create preset
      const preset = await prisma.materialComparisonPreset.create({
        data: {
          name,
          propertyWeights,
          materialType,
          description,
          includeProperties,
          excludeProperties,
          createdBy: req.user!.id,
          isDefault: isDefault || false
        }
      });
      
      res.json({
        success: true,
        preset
      });
    } catch (error) {
      logger.error('Error creating comparison preset:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating comparison preset',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/materials/comparison-presets
 * @desc Get comparison presets
 * @access Private
 */
router.get(
  '/comparison-presets',
  authMiddleware,
  async (req, res) => {
    try {
      const materialType = req.query.materialType as string | undefined;
      
      // Build query
      const where: any = {
        OR: [
          { createdBy: req.user!.id },
          { isDefault: true }
        ]
      };
      
      if (materialType) {
        where.materialType = materialType;
      }
      
      // Get presets
      const presets = await prisma.materialComparisonPreset.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      res.json({
        success: true,
        presets
      });
    } catch (error) {
      logger.error('Error getting comparison presets:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting comparison presets',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/materials/comparison-presets/:presetId
 * @desc Get a comparison preset
 * @access Private
 */
router.get(
  '/comparison-presets/:presetId',
  authMiddleware,
  [
    param('presetId').isString().withMessage('Preset ID is required')
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { presetId } = req.params;
      
      // Get preset
      const preset = await prisma.materialComparisonPreset.findUnique({
        where: { id: presetId }
      });
      
      if (!preset) {
        return res.status(404).json({
          success: false,
          message: 'Preset not found'
        });
      }
      
      // Check if user has access
      if (!preset.isDefault && preset.createdBy !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this preset'
        });
      }
      
      res.json({
        success: true,
        preset
      });
    } catch (error) {
      logger.error('Error getting comparison preset:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting comparison preset',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route PUT /api/materials/comparison-presets/:presetId
 * @desc Update a comparison preset
 * @access Private
 */
router.put(
  '/comparison-presets/:presetId',
  authMiddleware,
  [
    param('presetId').isString().withMessage('Preset ID is required'),
    body('name').optional().isString(),
    body('propertyWeights').optional().isObject(),
    body('materialType').optional().isString(),
    body('description').optional().isString(),
    body('includeProperties').optional().isArray(),
    body('excludeProperties').optional().isArray(),
    body('isDefault').optional().isBoolean()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { presetId } = req.params;
      const updates = req.body;
      
      // Get preset
      const preset = await prisma.materialComparisonPreset.findUnique({
        where: { id: presetId }
      });
      
      if (!preset) {
        return res.status(404).json({
          success: false,
          message: 'Preset not found'
        });
      }
      
      // Check if user has access
      if (preset.createdBy !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update this preset'
        });
      }
      
      // Update preset
      const updatedPreset = await prisma.materialComparisonPreset.update({
        where: { id: presetId },
        data: updates
      });
      
      res.json({
        success: true,
        preset: updatedPreset
      });
    } catch (error) {
      logger.error('Error updating comparison preset:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating comparison preset',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route DELETE /api/materials/comparison-presets/:presetId
 * @desc Delete a comparison preset
 * @access Private
 */
router.delete(
  '/comparison-presets/:presetId',
  authMiddleware,
  [
    param('presetId').isString().withMessage('Preset ID is required')
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { presetId } = req.params;
      
      // Get preset
      const preset = await prisma.materialComparisonPreset.findUnique({
        where: { id: presetId }
      });
      
      if (!preset) {
        return res.status(404).json({
          success: false,
          message: 'Preset not found'
        });
      }
      
      // Check if user has access
      if (preset.createdBy !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to delete this preset'
        });
      }
      
      // Delete preset
      await prisma.materialComparisonPreset.delete({
        where: { id: presetId }
      });
      
      res.json({
        success: true,
        message: 'Preset deleted'
      });
    } catch (error) {
      logger.error('Error deleting comparison preset:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting comparison preset',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

export default router;

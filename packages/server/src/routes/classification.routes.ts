/**
 * Classification Routes
 *
 * API routes for enhanced material classification.
 */

import express from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';
import { classificationService } from '@kai/shared/src/services/classification/classificationService';
import { logger } from '../utils/logger';
import {
  ClassificationSystemCreateInputSchema,
  ClassificationSystemUpdateInputSchema,
  ClassificationCategoryCreateInputSchema,
  ClassificationCategoryUpdateInputSchema,
  MaterialClassificationCreateInputSchema,
  MaterialClassificationUpdateInputSchema,
  ClassificationMappingCreateInputSchema,
  ClassificationMappingUpdateInputSchema,
  MappingType
} from '@kai/shared/src/types/classification';

const router = express.Router();

/**
 * @route   GET /api/classification/systems
 * @desc    Get all classification systems
 * @access  Public
 */
router.get(
  '/systems',
  asyncHandler(async (req, res) => {
    try {
      const activeOnly = req.query.activeOnly !== 'false';

      const systems = await classificationService.getClassificationSystems(activeOnly);

      res.json({
        success: true,
        systems
      });
    } catch (error) {
      logger.error('Error getting classification systems', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/classification/systems/:id
 * @desc    Get a classification system by ID
 * @access  Public
 */
router.get(
  '/systems/:id',
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      const system = await classificationService.getClassificationSystemById(id);

      res.json({
        success: true,
        system
      });
    } catch (error) {
      logger.error('Error getting classification system', { error });
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/classification/systems
 * @desc    Create a new classification system
 * @access  Admin
 */
router.post(
  '/systems',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const validatedData = ClassificationSystemCreateInputSchema.parse(req.body);

      const system = await classificationService.createClassificationSystem(validatedData);

      res.status(201).json({
        success: true,
        system
      });
    } catch (error) {
      logger.error('Error creating classification system', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   PUT /api/classification/systems/:id
 * @desc    Update a classification system
 * @access  Admin
 */
router.put(
  '/systems/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      const validatedData = ClassificationSystemUpdateInputSchema.parse({
        id,
        ...req.body
      });

      const system = await classificationService.updateClassificationSystem(validatedData);

      res.json({
        success: true,
        system
      });
    } catch (error) {
      logger.error('Error updating classification system', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/classification/categories
 * @desc    Get classification categories
 * @access  Public
 */
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    try {
      const { systemId, parentId } = req.query;
      const activeOnly = req.query.activeOnly !== 'false';

      const categories = await classificationService.getClassificationCategories(
        systemId as string | undefined,
        parentId as string | undefined,
        activeOnly
      );

      res.json({
        success: true,
        categories
      });
    } catch (error) {
      logger.error('Error getting classification categories', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/classification/categories/:id
 * @desc    Get a classification category by ID
 * @access  Public
 */
router.get(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      const category = await classificationService.getClassificationCategoryById(id);

      res.json({
        success: true,
        category
      });
    } catch (error) {
      logger.error('Error getting classification category', { error });
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/classification/categories
 * @desc    Create a new classification category
 * @access  Admin
 */
router.post(
  '/categories',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const validatedData = ClassificationCategoryCreateInputSchema.parse(req.body);

      const category = await classificationService.createClassificationCategory(validatedData);

      res.status(201).json({
        success: true,
        category
      });
    } catch (error) {
      logger.error('Error creating classification category', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   PUT /api/classification/categories/:id
 * @desc    Update a classification category
 * @access  Admin
 */
router.put(
  '/categories/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      const validatedData = ClassificationCategoryUpdateInputSchema.parse({
        id,
        ...req.body
      });

      const category = await classificationService.updateClassificationCategory(validatedData);

      res.json({
        success: true,
        category
      });
    } catch (error) {
      logger.error('Error updating classification category', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/classification/material-classifications
 * @desc    Get material classifications
 * @access  Public
 */
router.get(
  '/material-classifications',
  asyncHandler(async (req, res) => {
    try {
      const { materialId, categoryId, isPrimary } = req.query;

      const classifications = await classificationService.getMaterialClassifications(
        materialId as string | undefined,
        categoryId as string | undefined,
        isPrimary === 'true' ? true : isPrimary === 'false' ? false : undefined
      );

      res.json({
        success: true,
        classifications
      });
    } catch (error) {
      logger.error('Error getting material classifications', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/classification/material-classifications/:id
 * @desc    Get a material classification by ID
 * @access  Public
 */
router.get(
  '/material-classifications/:id',
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      const classification = await classificationService.getMaterialClassificationById(id);

      res.json({
        success: true,
        classification
      });
    } catch (error) {
      logger.error('Error getting material classification', { error });
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/classification/material-classifications
 * @desc    Create a new material classification
 * @access  Private
 */
router.post(
  '/material-classifications',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const validatedData = MaterialClassificationCreateInputSchema.parse(req.body);

      const classification = await classificationService.createMaterialClassification(validatedData);

      res.status(201).json({
        success: true,
        classification
      });
    } catch (error) {
      logger.error('Error creating material classification', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   PUT /api/classification/material-classifications/:id
 * @desc    Update a material classification
 * @access  Private
 */
router.put(
  '/material-classifications/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      const validatedData = MaterialClassificationUpdateInputSchema.parse({
        id,
        ...req.body
      });

      const classification = await classificationService.updateMaterialClassification(validatedData);

      res.json({
        success: true,
        classification
      });
    } catch (error) {
      logger.error('Error updating material classification', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   DELETE /api/classification/material-classifications/:id
 * @desc    Delete a material classification
 * @access  Private
 */
router.delete(
  '/material-classifications/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      await classificationService.deleteMaterialClassification(id);

      res.json({
        success: true,
        message: 'Material classification deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting material classification', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/classification/mappings
 * @desc    Get classification mappings
 * @access  Public
 */
router.get(
  '/mappings',
  asyncHandler(async (req, res) => {
    try {
      const { sourceCategoryId, targetCategoryId, mappingType } = req.query;

      const mappings = await classificationService.getClassificationMappings(
        sourceCategoryId as string | undefined,
        targetCategoryId as string | undefined,
        mappingType as MappingType | undefined
      );

      res.json({
        success: true,
        mappings
      });
    } catch (error) {
      logger.error('Error getting classification mappings', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/classification/mappings/:id
 * @desc    Get a classification mapping by ID
 * @access  Public
 */
router.get(
  '/mappings/:id',
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      const mapping = await classificationService.getClassificationMappingById(id);

      res.json({
        success: true,
        mapping
      });
    } catch (error) {
      logger.error('Error getting classification mapping', { error });
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/classification/mappings
 * @desc    Create a new classification mapping
 * @access  Admin
 */
router.post(
  '/mappings',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const validatedData = ClassificationMappingCreateInputSchema.parse(req.body);

      const mapping = await classificationService.createClassificationMapping(validatedData);

      res.status(201).json({
        success: true,
        mapping
      });
    } catch (error) {
      logger.error('Error creating classification mapping', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   PUT /api/classification/mappings/:id
 * @desc    Update a classification mapping
 * @access  Admin
 */
router.put(
  '/mappings/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      const validatedData = ClassificationMappingUpdateInputSchema.parse({
        id,
        ...req.body
      });

      const mapping = await classificationService.updateClassificationMapping(validatedData);

      res.json({
        success: true,
        mapping
      });
    } catch (error) {
      logger.error('Error updating classification mapping', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   DELETE /api/classification/mappings/:id
 * @desc    Delete a classification mapping
 * @access  Admin
 */
router.delete(
  '/mappings/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      await classificationService.deleteClassificationMapping(id);

      res.json({
        success: true,
        message: 'Classification mapping deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting classification mapping', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/classification/systems/:id/tree
 * @desc    Get a classification system with its categories as a tree
 * @access  Public
 */
router.get(
  '/systems/:id/tree',
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const activeOnly = req.query.activeOnly !== 'false';

      const systemWithTree = await classificationService.getClassificationSystemWithTree(id, activeOnly);

      res.json({
        success: true,
        ...systemWithTree
      });
    } catch (error) {
      logger.error('Error getting classification system tree', { error });
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/classification/materials/:materialId/classifications
 * @desc    Get material with all its classifications
 * @access  Public
 */
router.get(
  '/materials/:materialId/classifications',
  asyncHandler(async (req, res) => {
    try {
      const { materialId } = req.params;

      const materialWithClassifications = await classificationService.getMaterialWithClassifications(materialId);

      res.json({
        success: true,
        ...materialWithClassifications
      });
    } catch (error) {
      logger.error('Error getting material with classifications', { error });
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/classification/categories/:categoryId/equivalent
 * @desc    Find equivalent categories in another classification system
 * @access  Public
 */
router.get(
  '/categories/:categoryId/equivalent',
  asyncHandler(async (req, res) => {
    try {
      const { categoryId } = req.params;
      const { targetSystemId } = req.query;

      if (!targetSystemId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required query parameter: targetSystemId'
        });
      }

      const equivalentCategories = await classificationService.findEquivalentCategories(
        categoryId,
        targetSystemId as string
      );

      res.json({
        success: true,
        equivalentCategories
      });
    } catch (error) {
      logger.error('Error finding equivalent categories', { error });
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export default router;
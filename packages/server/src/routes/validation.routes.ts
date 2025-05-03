/**
 * Validation Routes
 * 
 * API routes for advanced property validation.
 */

import express from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';
import { validationService } from '@kai/shared/src/services/validation/validationService';
import { logger } from '../utils/logger';
import {
  ValidationRuleType,
  ValidationRuleCreateInputSchema,
  ValidationRuleUpdateInputSchema,
  ValidatePropertyInputSchema,
  BatchValidatePropertiesInputSchema
} from '@kai/shared/src/types/validation';

const router = express.Router();

/**
 * @route   GET /api/validation/rules
 * @desc    Get all validation rules
 * @access  Public
 */
router.get(
  '/rules',
  asyncHandler(async (req, res) => {
    try {
      const { propertyName, materialType, type, activeOnly } = req.query;
      
      const rules = await validationService.getValidationRules(
        propertyName as string | undefined,
        materialType as string | undefined,
        type as ValidationRuleType | undefined,
        activeOnly !== 'false'
      );
      
      res.json({
        success: true,
        rules
      });
    } catch (error) {
      logger.error('Error getting validation rules', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/validation/rules/:id
 * @desc    Get a validation rule by ID
 * @access  Public
 */
router.get(
  '/rules/:id',
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const rule = await validationService.getValidationRuleById(id);
      
      res.json({
        success: true,
        rule
      });
    } catch (error) {
      logger.error('Error getting validation rule', { error });
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/validation/rules
 * @desc    Create a new validation rule
 * @access  Admin
 */
router.post(
  '/rules',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const validatedData = ValidationRuleCreateInputSchema.parse(req.body);
      
      const rule = await validationService.createValidationRule(
        validatedData,
        req.user.id
      );
      
      res.status(201).json({
        success: true,
        rule
      });
    } catch (error) {
      logger.error('Error creating validation rule', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   PUT /api/validation/rules/:id
 * @desc    Update a validation rule
 * @access  Admin
 */
router.put(
  '/rules/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const validatedData = ValidationRuleUpdateInputSchema.parse({
        id,
        ...req.body
      });
      
      const rule = await validationService.updateValidationRule(validatedData);
      
      res.json({
        success: true,
        rule
      });
    } catch (error) {
      logger.error('Error updating validation rule', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   DELETE /api/validation/rules/:id
 * @desc    Delete a validation rule
 * @access  Admin
 */
router.delete(
  '/rules/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      await validationService.deleteValidationRule(id);
      
      res.json({
        success: true,
        message: 'Validation rule deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting validation rule', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/validation/validate
 * @desc    Validate a property value
 * @access  Public
 */
router.post(
  '/validate',
  asyncHandler(async (req, res) => {
    try {
      const validatedData = ValidatePropertyInputSchema.parse(req.body);
      
      const results = await validationService.validateProperty(validatedData);
      
      // Check if all validations passed
      const isValid = results.every(result => result.isValid);
      
      res.json({
        success: true,
        isValid,
        results
      });
    } catch (error) {
      logger.error('Error validating property', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/validation/validate-batch
 * @desc    Validate multiple properties in batch
 * @access  Public
 */
router.post(
  '/validate-batch',
  asyncHandler(async (req, res) => {
    try {
      const validatedData = BatchValidatePropertiesInputSchema.parse(req.body);
      
      const result = await validationService.validateProperties(validatedData);
      
      res.json({
        success: true,
        isValid: result.isValid,
        results: result.results
      });
    } catch (error) {
      logger.error('Error validating properties', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export default router;

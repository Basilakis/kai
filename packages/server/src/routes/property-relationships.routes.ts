/**
 * Property Relationships Routes
 * 
 * API routes for managing property relationships, correlations, and compatibility rules.
 */

import express from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { propertyRelationshipService } from '@kai/shared/src/services/property-relationships/propertyRelationshipService';
import { logger } from '../utils/logger';
import {
  PropertyRelationshipCreateInputSchema,
  PropertyRelationshipUpdateInputSchema,
  PropertyValueCorrelationCreateInputSchema,
  PropertyValueCorrelationUpdateInputSchema,
  PropertyCompatibilityRuleCreateInputSchema,
  PropertyCompatibilityRuleUpdateInputSchema,
  PropertyValidationRequestSchema,
  PropertyRecommendationRequestSchema
} from '@kai/shared/src/types/property-relationships';

const router = express.Router();

/**
 * @route   POST /api/property-relationships
 * @desc    Create a new property relationship
 * @access  Private
 */
router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const validatedData = PropertyRelationshipCreateInputSchema.parse(req.body);
      
      const relationship = await propertyRelationshipService.createRelationship(validatedData);
      
      res.status(201).json({
        success: true,
        relationship
      });
    } catch (error) {
      logger.error('Error creating property relationship', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/property-relationships/:id
 * @desc    Get a property relationship by ID
 * @access  Private
 */
router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const relationship = await propertyRelationshipService.getRelationshipById(id);
      
      res.json({
        success: true,
        relationship
      });
    } catch (error) {
      logger.error('Error getting property relationship', { error });
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/property-relationships/material/:materialType
 * @desc    Get property relationships by material type
 * @access  Private
 */
router.get(
  '/material/:materialType',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { materialType } = req.params;
      
      const relationships = await propertyRelationshipService.getRelationshipsByMaterialType(materialType);
      
      res.json({
        success: true,
        relationships
      });
    } catch (error) {
      logger.error('Error getting property relationships', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/property-relationships/source/:sourceProperty
 * @desc    Get property relationships by source property
 * @access  Private
 */
router.get(
  '/source/:sourceProperty',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { sourceProperty } = req.params;
      const { materialType } = req.query;
      
      const relationships = await propertyRelationshipService.getRelationshipsBySourceProperty(
        sourceProperty,
        materialType as string | undefined
      );
      
      res.json({
        success: true,
        relationships
      });
    } catch (error) {
      logger.error('Error getting property relationships', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/property-relationships/target/:targetProperty
 * @desc    Get property relationships by target property
 * @access  Private
 */
router.get(
  '/target/:targetProperty',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { targetProperty } = req.params;
      const { materialType } = req.query;
      
      const relationships = await propertyRelationshipService.getRelationshipsByTargetProperty(
        targetProperty,
        materialType as string | undefined
      );
      
      res.json({
        success: true,
        relationships
      });
    } catch (error) {
      logger.error('Error getting property relationships', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   PUT /api/property-relationships/:id
 * @desc    Update a property relationship
 * @access  Private
 */
router.put(
  '/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const validatedData = PropertyRelationshipUpdateInputSchema.parse({
        id,
        ...req.body
      });
      
      const relationship = await propertyRelationshipService.updateRelationship(validatedData);
      
      res.json({
        success: true,
        relationship
      });
    } catch (error) {
      logger.error('Error updating property relationship', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   DELETE /api/property-relationships/:id
 * @desc    Delete a property relationship
 * @access  Private
 */
router.delete(
  '/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      await propertyRelationshipService.deleteRelationship(id);
      
      res.json({
        success: true,
        message: 'Property relationship deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting property relationship', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/property-relationships/:relationshipId/correlations
 * @desc    Create a new property value correlation
 * @access  Private
 */
router.post(
  '/:relationshipId/correlations',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { relationshipId } = req.params;
      
      const validatedData = PropertyValueCorrelationCreateInputSchema.parse({
        relationshipId,
        ...req.body
      });
      
      const correlation = await propertyRelationshipService.createValueCorrelation(validatedData);
      
      res.status(201).json({
        success: true,
        correlation
      });
    } catch (error) {
      logger.error('Error creating property value correlation', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/property-relationships/:relationshipId/correlations
 * @desc    Get property value correlations by relationship ID
 * @access  Private
 */
router.get(
  '/:relationshipId/correlations',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { relationshipId } = req.params;
      
      const correlations = await propertyRelationshipService.getValueCorrelationsByRelationshipId(relationshipId);
      
      res.json({
        success: true,
        correlations
      });
    } catch (error) {
      logger.error('Error getting property value correlations', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   PUT /api/property-relationships/correlations/:id
 * @desc    Update a property value correlation
 * @access  Private
 */
router.put(
  '/correlations/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const validatedData = PropertyValueCorrelationUpdateInputSchema.parse({
        id,
        ...req.body
      });
      
      const correlation = await propertyRelationshipService.updateValueCorrelation(validatedData);
      
      res.json({
        success: true,
        correlation
      });
    } catch (error) {
      logger.error('Error updating property value correlation', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   DELETE /api/property-relationships/correlations/:id
 * @desc    Delete a property value correlation
 * @access  Private
 */
router.delete(
  '/correlations/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      await propertyRelationshipService.deleteValueCorrelation(id);
      
      res.json({
        success: true,
        message: 'Property value correlation deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting property value correlation', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/property-relationships/:relationshipId/compatibility
 * @desc    Create a new property compatibility rule
 * @access  Private
 */
router.post(
  '/:relationshipId/compatibility',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { relationshipId } = req.params;
      
      const validatedData = PropertyCompatibilityRuleCreateInputSchema.parse({
        relationshipId,
        ...req.body
      });
      
      const rule = await propertyRelationshipService.createCompatibilityRule(validatedData);
      
      res.status(201).json({
        success: true,
        rule
      });
    } catch (error) {
      logger.error('Error creating property compatibility rule', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/property-relationships/:relationshipId/compatibility
 * @desc    Get property compatibility rules by relationship ID
 * @access  Private
 */
router.get(
  '/:relationshipId/compatibility',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { relationshipId } = req.params;
      
      const rules = await propertyRelationshipService.getCompatibilityRulesByRelationshipId(relationshipId);
      
      res.json({
        success: true,
        rules
      });
    } catch (error) {
      logger.error('Error getting property compatibility rules', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   PUT /api/property-relationships/compatibility/:id
 * @desc    Update a property compatibility rule
 * @access  Private
 */
router.put(
  '/compatibility/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const validatedData = PropertyCompatibilityRuleUpdateInputSchema.parse({
        id,
        ...req.body
      });
      
      const rule = await propertyRelationshipService.updateCompatibilityRule(validatedData);
      
      res.json({
        success: true,
        rule
      });
    } catch (error) {
      logger.error('Error updating property compatibility rule', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   DELETE /api/property-relationships/compatibility/:id
 * @desc    Delete a property compatibility rule
 * @access  Private
 */
router.delete(
  '/compatibility/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      await propertyRelationshipService.deleteCompatibilityRule(id);
      
      res.json({
        success: true,
        message: 'Property compatibility rule deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting property compatibility rule', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/property-relationships/validate
 * @desc    Validate a set of property values
 * @access  Private
 */
router.post(
  '/validate',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const validatedData = PropertyValidationRequestSchema.parse(req.body);
      
      const result = await propertyRelationshipService.validateProperties(validatedData);
      
      res.json({
        success: true,
        result
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

/**
 * @route   POST /api/property-relationships/recommend
 * @desc    Get property recommendations
 * @access  Private
 */
router.post(
  '/recommend',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const validatedData = PropertyRecommendationRequestSchema.parse(req.body);
      
      const result = await propertyRelationshipService.getPropertyRecommendations(validatedData);
      
      res.json({
        success: true,
        result
      });
    } catch (error) {
      logger.error('Error getting property recommendations', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/property-relationships/graph/:materialType
 * @desc    Get property graph visualization data
 * @access  Private
 */
router.get(
  '/graph/:materialType',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { materialType } = req.params;
      
      const graph = await propertyRelationshipService.getPropertyGraphVisualization(materialType);
      
      res.json({
        success: true,
        graph
      });
    } catch (error) {
      logger.error('Error getting property graph visualization', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export default router;

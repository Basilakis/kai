/**
 * Material Property Analytics Routes
 * 
 * API endpoints for material property analytics.
 */

import { Router } from 'express';
import { query, param } from 'express-validator';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validateRequestSchema } from '../../middleware/validate-request-schema.middleware';
import { materialPropertyAnalyticsService } from '../../services/analytics/materialPropertyAnalytics.service';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * @route GET /api/analytics/material-properties/distribution
 * @desc Get property distribution
 * @access Private
 */
router.get(
  '/distribution',
  authMiddleware,
  [
    query('property').isString().notEmpty().withMessage('Property is required'),
    query('materialType').optional().isString()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const property = req.query.property as string;
      const materialType = req.query.materialType as string | undefined;
      
      // Get property distribution
      const distribution = await materialPropertyAnalyticsService.getPropertyDistribution(
        property,
        materialType
      );
      
      res.json({
        success: true,
        distribution
      });
    } catch (error) {
      logger.error('Error getting property distribution:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting property distribution',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/analytics/material-properties/trends
 * @desc Get property trends
 * @access Private
 */
router.get(
  '/trends',
  authMiddleware,
  [
    query('property').isString().notEmpty().withMessage('Property is required'),
    query('timeUnit').isIn(['day', 'week', 'month', 'year']).withMessage('Valid time unit is required'),
    query('materialType').optional().isString()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const property = req.query.property as string;
      const timeUnit = req.query.timeUnit as 'day' | 'week' | 'month' | 'year';
      const materialType = req.query.materialType as string | undefined;
      
      // Get property trends
      const trends = await materialPropertyAnalyticsService.getPropertyTrends(
        property,
        timeUnit,
        materialType
      );
      
      res.json({
        success: true,
        trends
      });
    } catch (error) {
      logger.error('Error getting property trends:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting property trends',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/analytics/material-properties/correlation
 * @desc Get property correlation
 * @access Private
 */
router.get(
  '/correlation',
  authMiddleware,
  [
    query('property1').isString().notEmpty().withMessage('Property 1 is required'),
    query('property2').isString().notEmpty().withMessage('Property 2 is required'),
    query('materialType').optional().isString()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const property1 = req.query.property1 as string;
      const property2 = req.query.property2 as string;
      const materialType = req.query.materialType as string | undefined;
      
      // Get property correlation
      const correlation = await materialPropertyAnalyticsService.getPropertyCorrelation(
        property1,
        property2,
        materialType
      );
      
      res.json({
        success: true,
        correlation
      });
    } catch (error) {
      logger.error('Error getting property correlation:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting property correlation',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/analytics/material-properties/anomalies
 * @desc Get property anomalies
 * @access Private
 */
router.get(
  '/anomalies',
  authMiddleware,
  [
    query('property').isString().notEmpty().withMessage('Property is required'),
    query('materialType').optional().isString(),
    query('threshold').optional().isFloat({ min: 0 })
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const property = req.query.property as string;
      const materialType = req.query.materialType as string | undefined;
      const threshold = req.query.threshold ? parseFloat(req.query.threshold as string) : undefined;
      
      // Get property anomalies
      const anomalies = await materialPropertyAnalyticsService.getPropertyAnomalies(
        property,
        materialType,
        threshold
      );
      
      res.json({
        success: true,
        anomalies
      });
    } catch (error) {
      logger.error('Error getting property anomalies:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting property anomalies',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

export default router;

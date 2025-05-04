/**
 * Specialized Crawler Routes
 * 
 * API endpoints for specialized crawlers for different property types.
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminMiddleware } from '../../middleware/admin.middleware';
import { validateRequestSchema } from '../../middleware/validate-request-schema.middleware';
import { specializedCrawlerService } from '../../services/crawler/specialized-crawlers';
import { MaterialType } from '@kai/ml';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * @route POST /api/ai/specialized-crawler/configs
 * @desc Create a specialized crawler configuration
 * @access Admin
 */
router.post(
  '/configs',
  authMiddleware,
  adminMiddleware,
  [
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('propertyName').isString().notEmpty().withMessage('Property name is required'),
    body('materialType').isString().notEmpty().withMessage('Material type is required'),
    body('crawlerType').isString().notEmpty().withMessage('Crawler type is required'),
    body('baseConfig').isObject().notEmpty().withMessage('Base configuration is required'),
    body('extractionRules').isObject().notEmpty().withMessage('Extraction rules are required'),
    body('description').optional().isString()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { name, propertyName, materialType, crawlerType, baseConfig, extractionRules, description } = req.body;
      
      // Create crawler configuration
      const config = await specializedCrawlerService.createCrawlerConfig(
        name,
        propertyName,
        materialType as MaterialType,
        crawlerType,
        baseConfig,
        extractionRules,
        description
      );
      
      res.json({
        success: true,
        config
      });
    } catch (error) {
      logger.error('Error creating specialized crawler config:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating specialized crawler config',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/ai/specialized-crawler/configs
 * @desc Get all specialized crawler configurations
 * @access Admin
 */
router.get(
  '/configs',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const propertyName = req.query.propertyName as string | undefined;
      const materialType = req.query.materialType as MaterialType | undefined;
      
      // Get all crawler configurations
      const configs = await specializedCrawlerService.getAllCrawlerConfigs(propertyName, materialType);
      
      res.json({
        success: true,
        configs
      });
    } catch (error) {
      logger.error('Error getting specialized crawler configs:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting specialized crawler configs',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/ai/specialized-crawler/configs/:configId
 * @desc Get a specialized crawler configuration
 * @access Admin
 */
router.get(
  '/configs/:configId',
  authMiddleware,
  adminMiddleware,
  [
    param('configId').isString().notEmpty().withMessage('Config ID is required')
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { configId } = req.params;
      
      // Get crawler configuration
      const config = await specializedCrawlerService.getCrawlerConfig(configId);
      
      res.json({
        success: true,
        config
      });
    } catch (error) {
      logger.error('Error getting specialized crawler config:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting specialized crawler config',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route PUT /api/ai/specialized-crawler/configs/:configId
 * @desc Update a specialized crawler configuration
 * @access Admin
 */
router.put(
  '/configs/:configId',
  authMiddleware,
  adminMiddleware,
  [
    param('configId').isString().notEmpty().withMessage('Config ID is required'),
    body('name').optional().isString(),
    body('description').optional().isString(),
    body('baseConfig').optional().isObject(),
    body('extractionRules').optional().isObject()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { configId } = req.params;
      const updates = req.body;
      
      // Update crawler configuration
      const config = await specializedCrawlerService.updateCrawlerConfig(configId, updates);
      
      res.json({
        success: true,
        config
      });
    } catch (error) {
      logger.error('Error updating specialized crawler config:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating specialized crawler config',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route DELETE /api/ai/specialized-crawler/configs/:configId
 * @desc Delete a specialized crawler configuration
 * @access Admin
 */
router.delete(
  '/configs/:configId',
  authMiddleware,
  adminMiddleware,
  [
    param('configId').isString().notEmpty().withMessage('Config ID is required')
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { configId } = req.params;
      
      // Delete crawler configuration
      await specializedCrawlerService.deleteCrawlerConfig(configId);
      
      res.json({
        success: true,
        message: 'Crawler configuration deleted'
      });
    } catch (error) {
      logger.error('Error deleting specialized crawler config:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting specialized crawler config',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/ai/specialized-crawler/configs/:configId/run
 * @desc Run a specialized crawler
 * @access Admin
 */
router.post(
  '/configs/:configId/run',
  authMiddleware,
  adminMiddleware,
  [
    param('configId').isString().notEmpty().withMessage('Config ID is required'),
    body('startUrl').optional().isString(),
    body('maxPages').optional().isInt({ min: 1 }),
    body('maxDepth').optional().isInt({ min: 1 }),
    body('credentials').optional().isObject()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { configId } = req.params;
      const { startUrl, maxPages, maxDepth, credentials } = req.body;
      
      // Run crawler
      const result = await specializedCrawlerService.runCrawler(configId, {
        startUrl,
        maxPages,
        maxDepth,
        credentials
      });
      
      res.json({
        success: true,
        jobId: result.jobId,
        status: result.status
      });
    } catch (error) {
      logger.error('Error running specialized crawler:', error);
      res.status(500).json({
        success: false,
        message: 'Error running specialized crawler',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/ai/specialized-crawler/jobs
 * @desc Get all specialized crawler jobs
 * @access Admin
 */
router.get(
  '/jobs',
  authMiddleware,
  adminMiddleware,
  [
    query('propertyName').optional().isString(),
    query('materialType').optional().isString(),
    query('status').optional().isString()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const propertyName = req.query.propertyName as string | undefined;
      const materialType = req.query.materialType as MaterialType | undefined;
      const status = req.query.status as string | undefined;
      
      // Get all crawler jobs
      const jobs = await specializedCrawlerService.getAllCrawlerJobs(propertyName, materialType, status);
      
      res.json({
        success: true,
        jobs
      });
    } catch (error) {
      logger.error('Error getting specialized crawler jobs:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting specialized crawler jobs',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/ai/specialized-crawler/jobs/:jobId
 * @desc Get a specialized crawler job
 * @access Admin
 */
router.get(
  '/jobs/:jobId',
  authMiddleware,
  adminMiddleware,
  [
    param('jobId').isString().notEmpty().withMessage('Job ID is required')
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { jobId } = req.params;
      
      // Get crawler job
      const job = await specializedCrawlerService.getCrawlerJob(jobId);
      
      res.json({
        success: true,
        job
      });
    } catch (error) {
      logger.error('Error getting specialized crawler job:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting specialized crawler job',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/ai/specialized-crawler/jobs/:jobId/import
 * @desc Import crawler results to visual reference library
 * @access Admin
 */
router.post(
  '/jobs/:jobId/import',
  authMiddleware,
  adminMiddleware,
  [
    param('jobId').isString().notEmpty().withMessage('Job ID is required'),
    body('autoClassify').optional().isBoolean(),
    body('maxImages').optional().isInt({ min: 1 })
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { jobId } = req.params;
      const { autoClassify, maxImages } = req.body;
      
      // Import to visual reference library
      const result = await specializedCrawlerService.importToVisualReferenceLibrary(jobId, {
        autoClassify,
        maxImages
      });
      
      res.json({
        success: true,
        result
      });
    } catch (error) {
      logger.error('Error importing to visual reference library:', error);
      res.status(500).json({
        success: false,
        message: 'Error importing to visual reference library',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

export default router;

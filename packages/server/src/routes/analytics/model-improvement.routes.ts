/**
 * Model Improvement Routes
 *
 * API routes for model improvement features:
 * - Fine-tuning based on feedback
 * - Error pattern analysis
 * - Improvement suggestions
 */

import express from 'express';
import { body, query, param } from 'express-validator';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware, authorize } from '../../middleware/auth.middleware';
import { NetworkAccessType } from '../../utils/network';
import { logger } from '../../utils/logger';
import { validationResult } from 'express-validator';

import * as modelImprovementController from '../../controllers/analytics/model-improvement.controller';
import { ErrorCategory } from '../../services/analytics/response-quality.service';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Log the registration of these routes for network access control
logger.info('Registering model improvement routes with network access control');

// These routes should be registered in the network access control system
// Run the register-api-endpoints.ts script to ensure they are properly registered

/**
 * @route   GET /api/analytics/model-improvement/fine-tuning/jobs
 * @desc    Get fine-tuning jobs
 * @access  Private (Admin)
 */
router.get(
  '/fine-tuning/jobs',
  authorize({ roles: ['admin'], accessType: NetworkAccessType.ANY }),
  [
    query('modelId').optional().isUUID().withMessage('Invalid model ID'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer')
  ],
  asyncHandler(async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await modelImprovementController.getFineTuningJobs(req, res);
  })
);

/**
 * @route   GET /api/analytics/model-improvement/fine-tuning/jobs/:jobId
 * @desc    Get fine-tuning job by ID
 * @access  Private (Admin)
 */
router.get(
  '/fine-tuning/jobs/:jobId',
  authorize({ roles: ['admin'], accessType: NetworkAccessType.ANY }),
  [
    param('jobId').isUUID().withMessage('Invalid job ID')
  ],
  asyncHandler(async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await modelImprovementController.getFineTuningJob(req, res);
  })
);

/**
 * @route   POST /api/analytics/model-improvement/fine-tuning/check
 * @desc    Check if a model should be fine-tuned
 * @access  Private (Admin)
 */
router.post(
  '/fine-tuning/check',
  authorize({ roles: ['admin'], accessType: NetworkAccessType.ANY }),
  [
    body('modelId').isUUID().withMessage('Model ID is required'),
    body('conditions.minFeedbackCount').optional().isInt({ min: 1 }).withMessage('Minimum feedback count must be at least 1'),
    body('conditions.minErrorPercentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Minimum error percentage must be between 0 and 100'),
    body('conditions.minDaysSinceLastTraining').optional().isInt({ min: 0 }).withMessage('Minimum days since last training must be non-negative'),
    body('conditions.specificErrorCategories').optional().isArray().withMessage('Specific error categories must be an array')
  ],
  asyncHandler(async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await modelImprovementController.checkFineTuning(req, res);
  })
);

/**
 * @route   POST /api/analytics/model-improvement/fine-tuning/jobs
 * @desc    Create a new fine-tuning job
 * @access  Private (Admin)
 */
router.post(
  '/fine-tuning/jobs',
  authorize({ roles: ['admin'], accessType: NetworkAccessType.INTERNAL_ONLY }),
  [
    body('modelId').isUUID().withMessage('Model ID is required')
  ],
  asyncHandler(async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await modelImprovementController.createFineTuningJob(req, res);
  })
);

/**
 * @route   POST /api/analytics/model-improvement/fine-tuning/jobs/:jobId/start
 * @desc    Start a fine-tuning job
 * @access  Private (Admin)
 */
router.post(
  '/fine-tuning/jobs/:jobId/start',
  authorize({ roles: ['admin'], accessType: NetworkAccessType.INTERNAL_ONLY }),
  [
    param('jobId').isUUID().withMessage('Invalid job ID')
  ],
  asyncHandler(async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await modelImprovementController.startFineTuningJob(req, res);
  })
);

/**
 * @route   POST /api/analytics/model-improvement/fine-tuning/jobs/:jobId/cancel
 * @desc    Cancel a fine-tuning job
 * @access  Private (Admin)
 */
router.post(
  '/fine-tuning/jobs/:jobId/cancel',
  authorize({ roles: ['admin'], accessType: NetworkAccessType.INTERNAL_ONLY }),
  [
    param('jobId').isUUID().withMessage('Invalid job ID')
  ],
  asyncHandler(async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await modelImprovementController.cancelFineTuningJob(req, res);
  })
);

/**
 * @route   GET /api/analytics/model-improvement/error-patterns
 * @desc    Analyze error patterns for a model
 * @access  Private (Admin)
 */
router.get(
  '/error-patterns',
  authorize({ roles: ['admin'], accessType: NetworkAccessType.ANY }),
  [
    query('modelId').isUUID().withMessage('Model ID is required'),
    query('startDate').isISO8601().withMessage('Start date must be a valid ISO date'),
    query('endDate').isISO8601().withMessage('End date must be a valid ISO date'),
    query('minFrequency').optional().isInt({ min: 1 }).withMessage('Minimum frequency must be at least 1')
  ],
  asyncHandler(async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await modelImprovementController.analyzeErrorPatterns(req, res);
  })
);

/**
 * @route   GET /api/analytics/model-improvement/error-trends
 * @desc    Get error trends for a model
 * @access  Private (Admin)
 */
router.get(
  '/error-trends',
  authorize({ roles: ['admin'], accessType: NetworkAccessType.ANY }),
  [
    query('modelId').isUUID().withMessage('Model ID is required'),
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365')
  ],
  asyncHandler(async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await modelImprovementController.getErrorTrends(req, res);
  })
);

/**
 * @route   POST /api/analytics/model-improvement/improvement-suggestions
 * @desc    Generate improvement suggestions for error patterns
 * @access  Private (Admin)
 */
router.post(
  '/improvement-suggestions',
  authorize({ roles: ['admin'], accessType: NetworkAccessType.ANY }),
  [
    body('patterns').isArray().withMessage('Patterns must be an array'),
    body('patterns.*.id').isString().withMessage('Pattern ID must be a string'),
    body('patterns.*.category').isIn(Object.values(ErrorCategory)).withMessage('Invalid error category'),
    body('patterns.*.frequency').isInt({ min: 1 }).withMessage('Frequency must be at least 1')
  ],
  asyncHandler(async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await modelImprovementController.generateImprovementSuggestions(req, res);
  })
);

/**
 * @route   POST /api/analytics/model-improvement/error-patterns
 * @desc    Store an error pattern
 * @access  Private (Admin)
 */
router.post(
  '/error-patterns',
  authorize({ roles: ['admin'], accessType: NetworkAccessType.INTERNAL_ONLY }),
  [
    body('pattern').isObject().withMessage('Pattern is required'),
    body('pattern.id').isString().withMessage('Pattern ID must be a string'),
    body('pattern.category').isIn(Object.values(ErrorCategory)).withMessage('Invalid error category'),
    body('pattern.description').isString().withMessage('Description must be a string'),
    body('pattern.frequency').isInt({ min: 1 }).withMessage('Frequency must be at least 1'),
    body('pattern.examples').isArray().withMessage('Examples must be an array'),
    body('pattern.status').isIn(['active', 'fixed', 'monitoring']).withMessage('Invalid status')
  ],
  asyncHandler(async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await modelImprovementController.storeErrorPattern(req, res);
  })
);

/**
 * @route   GET /api/analytics/model-improvement/stored-error-patterns
 * @desc    Get stored error patterns
 * @access  Private (Admin)
 */
router.get(
  '/stored-error-patterns',
  authorize({ roles: ['admin'], accessType: NetworkAccessType.ANY }),
  [
    query('modelId').optional().isUUID().withMessage('Invalid model ID'),
    query('status').optional().isIn(['active', 'fixed', 'monitoring']).withMessage('Invalid status'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer')
  ],
  asyncHandler(async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await modelImprovementController.getStoredErrorPatterns(req, res);
  })
);

/**
 * @route   PATCH /api/analytics/model-improvement/error-patterns/:patternId/status
 * @desc    Update error pattern status
 * @access  Private (Admin)
 */
router.patch(
  '/error-patterns/:patternId/status',
  authorize({ roles: ['admin'], accessType: NetworkAccessType.INTERNAL_ONLY }),
  [
    param('patternId').isString().withMessage('Invalid pattern ID'),
    body('status').isIn(['active', 'fixed', 'monitoring']).withMessage('Invalid status')
  ],
  asyncHandler(async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await modelImprovementController.updateErrorPatternStatus(req, res);
  })
);

/**
 * @route   GET /api/analytics/model-improvement/improvement-suggestions
 * @desc    Get stored improvement suggestions
 * @access  Private (Admin)
 */
router.get(
  '/improvement-suggestions',
  authorize({ roles: ['admin'], accessType: NetworkAccessType.ANY }),
  [
    query('patternId').optional().isString().withMessage('Invalid pattern ID'),
    query('status').optional().isIn(['pending', 'implemented', 'rejected']).withMessage('Invalid status'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer')
  ],
  asyncHandler(async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await modelImprovementController.getStoredImprovementSuggestions(req, res);
  })
);

/**
 * @route   PATCH /api/analytics/model-improvement/improvement-suggestions/:suggestionId/status
 * @desc    Update improvement suggestion status
 * @access  Private (Admin)
 */
router.patch(
  '/improvement-suggestions/:suggestionId/status',
  authorize({ roles: ['admin'], accessType: NetworkAccessType.INTERNAL_ONLY }),
  [
    param('suggestionId').isString().withMessage('Invalid suggestion ID'),
    body('status').isIn(['pending', 'implemented', 'rejected']).withMessage('Invalid status')
  ],
  asyncHandler(async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await modelImprovementController.updateImprovementSuggestionStatus(req, res);
  })
);

export default router;

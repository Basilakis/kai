import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { asyncHandler } from '../../middleware/async-handler';
import { authMiddleware, authorize } from '../../middleware/auth.middleware';
import { NetworkAccessType } from '../../utils/network';
import { logger } from '../../utils/logger';
import ResponseQualityService, {
  FeedbackType,
  ErrorCategory,
  ResponseFeedback
} from '../../services/analytics/response-quality.service';
import { supabase } from '../../config/supabase';

const router = Router();
const responseQualityService = new ResponseQualityService(supabase);

// All routes require authentication
router.use(authMiddleware);

// Log the registration of these routes for network access control
logger.info('Registering response quality routes with network access control');

// These routes should be registered in the network access control system
// Run the register-api-endpoints.ts script to ensure they are properly registered

/**
 * @route   POST /api/analytics/response-quality/feedback
 * @desc    Record user feedback for a response
 * @access  Private
 */
router.post(
  '/feedback',
  authorize({ accessType: NetworkAccessType.ANY }),
  [
    body('responseId').notEmpty().withMessage('Response ID is required'),
    body('userId').notEmpty().withMessage('User ID is required'),
    body('modelId').notEmpty().withMessage('Model ID is required'),
    body('feedbackType').isIn(Object.values(FeedbackType)).withMessage('Invalid feedback type'),
    body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('isPositive').optional().isBoolean().withMessage('isPositive must be a boolean'),
    body('errorCategory').optional().isIn(Object.values(ErrorCategory)).withMessage('Invalid error category'),
    body('feedbackText').optional().isString().withMessage('Feedback text must be a string')
  ],
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const feedback: ResponseFeedback = {
      responseId: req.body.responseId,
      userId: req.body.userId,
      modelId: req.body.modelId,
      feedbackType: req.body.feedbackType,
      rating: req.body.rating,
      isPositive: req.body.isPositive,
      errorCategory: req.body.errorCategory,
      feedbackText: req.body.feedbackText
    };

    logger.info('Recording response feedback', {
      responseId: feedback.responseId,
      userId: feedback.userId,
      feedbackType: feedback.feedbackType
    });

    const result = await responseQualityService.recordFeedback(feedback);
    res.status(201).json(result);
  })
);

/**
 * @route   GET /api/analytics/response-quality/metrics
 * @desc    Get response quality metrics
 * @access  Private (Admin)
 */
router.get(
  '/metrics',
  authorize({ roles: ['admin'], accessType: NetworkAccessType.ANY }),
  [
    query('startDate').notEmpty().withMessage('Start date is required'),
    query('endDate').notEmpty().withMessage('End date is required'),
    query('modelId').optional().isString().withMessage('Model ID must be a string')
  ],
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const startDate = new Date(req.query.startDate as string);
    const endDate = new Date(req.query.endDate as string);
    const modelId = req.query.modelId as string | undefined;

    logger.info('Fetching response quality metrics', { startDate, endDate, modelId });

    const metrics = await responseQualityService.getQualityMetrics(startDate, endDate, modelId);
    res.json(metrics);
  })
);

/**
 * @route   POST /api/analytics/response-quality/response
 * @desc    Record a model response with optional feedback
 * @access  Private
 */
router.post(
  '/response',
  authorize({ accessType: NetworkAccessType.ANY }),
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('modelId').notEmpty().withMessage('Model ID is required'),
    body('queryText').notEmpty().withMessage('Query text is required'),
    body('responseText').notEmpty().withMessage('Response text is required'),
    body('tokensUsed').optional().isInt().withMessage('Tokens used must be an integer'),
    body('responseTimeMs').optional().isInt().withMessage('Response time must be an integer'),
    body('contextUsed').optional().isArray().withMessage('Context used must be an array'),
    body('feedback.feedbackType').optional().isIn(Object.values(FeedbackType)).withMessage('Invalid feedback type'),
    body('feedback.rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('feedback.isPositive').optional().isBoolean().withMessage('isPositive must be a boolean'),
    body('feedback.errorCategory').optional().isIn(Object.values(ErrorCategory)).withMessage('Invalid error category'),
    body('feedback.feedbackText').optional().isString().withMessage('Feedback text must be a string')
  ],
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      userId,
      modelId,
      queryText,
      responseText,
      tokensUsed,
      responseTimeMs,
      contextUsed,
      feedback,
      metadata
    } = req.body;

    logger.info('Recording model response', {
      userId,
      modelId,
      hasFeedback: !!feedback
    });

    try {
      // Use the database function to record response with feedback in one transaction
      const { data, error } = await supabase.rpc('record_response_with_feedback', {
        p_user_id: userId,
        p_model_id: modelId,
        p_query_text: queryText,
        p_response_text: responseText,
        p_tokens_used: tokensUsed,
        p_response_time_ms: responseTimeMs,
        p_context_used: contextUsed,
        p_feedback_type: feedback?.feedbackType,
        p_rating: feedback?.rating,
        p_is_positive: feedback?.isPositive,
        p_error_category: feedback?.errorCategory,
        p_feedback_text: feedback?.feedbackText,
        p_metadata: metadata
      });

      if (error) {
        logger.error('Error recording response with feedback', { error });
        throw error;
      }

      res.status(201).json({ id: data, success: true });
    } catch (err) {
      logger.error('Error in recordResponseWithFeedback', { err });
      res.status(500).json({ error: 'Failed to record response' });
    }
  })
);

/**
 * @route   GET /api/analytics/response-quality/problematic
 * @desc    Get problematic responses
 * @access  Private (Admin)
 */
router.get(
  '/problematic',
  authorize({ roles: ['admin'], accessType: NetworkAccessType.ANY }),
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
    query('modelId').optional().isString().withMessage('Model ID must be a string'),
    query('errorCategory').optional().isIn(Object.values(ErrorCategory)).withMessage('Invalid error category'),
    query('minRating').optional().isInt({ min: 1, max: 5 }).withMessage('Min rating must be between 1 and 5'),
    query('maxRating').optional().isInt({ min: 1, max: 5 }).withMessage('Max rating must be between 1 and 5'),
    query('startDate').optional().isString().withMessage('Start date must be a string'),
    query('endDate').optional().isString().withMessage('End date must be a string')
  ],
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const filters = {
      modelId: req.query.modelId as string | undefined,
      errorCategory: req.query.errorCategory as ErrorCategory | undefined,
      minRating: req.query.minRating ? parseInt(req.query.minRating as string) : undefined,
      maxRating: req.query.maxRating ? parseInt(req.query.maxRating as string) : undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
    };

    logger.info('Fetching problematic responses', { limit, offset, filters });

    const responses = await responseQualityService.getProblematicResponses(limit, offset, filters);
    res.json(responses);
  })
);

export default router;

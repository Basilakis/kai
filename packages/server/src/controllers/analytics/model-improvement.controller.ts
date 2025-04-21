/**
 * Model Improvement Controller
 * 
 * This controller handles requests related to model improvement features:
 * - Fine-tuning based on feedback
 * - Error pattern analysis
 * - Improvement suggestions
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import feedbackBasedTrainingService, { 
  FinetuningJobStatus, 
  FinetuningTriggerConditions 
} from '../../services/training/feedback-based-training.service';
import errorPatternAnalysisService, { 
  ErrorPattern, 
  ImprovementSuggestion 
} from '../../services/analytics/error-pattern-analysis.service';
import { ErrorCategory } from '../../services/analytics/response-quality.service';

/**
 * Get fine-tuning jobs
 * @param req Request
 * @param res Response
 */
export const getFineTuningJobs = async (req: Request, res: Response) => {
  try {
    const modelId = req.query.modelId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await feedbackBasedTrainingService.getFineTuningJobs(modelId, limit, offset);

    res.json(result);
  } catch (error) {
    logger.error('Error getting fine-tuning jobs', { error });
    res.status(500).json({ error: 'Failed to get fine-tuning jobs' });
  }
};

/**
 * Get fine-tuning job by ID
 * @param req Request
 * @param res Response
 */
export const getFineTuningJob = async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId;
    const job = await feedbackBasedTrainingService.getFineTuningJob(jobId);

    res.json(job);
  } catch (error) {
    logger.error('Error getting fine-tuning job', { error, jobId: req.params.jobId });
    res.status(500).json({ error: 'Failed to get fine-tuning job' });
  }
};

/**
 * Check if a model should be fine-tuned
 * @param req Request
 * @param res Response
 */
export const checkFineTuning = async (req: Request, res: Response) => {
  try {
    const { modelId, conditions } = req.body;

    // Default conditions if not provided
    const defaultConditions: FinetuningTriggerConditions = {
      minFeedbackCount: 50,
      minErrorPercentage: 10,
      minDaysSinceLastTraining: 7
    };

    const result = await feedbackBasedTrainingService.shouldFineTuneModel(
      modelId,
      { ...defaultConditions, ...conditions }
    );

    res.json(result);
  } catch (error) {
    logger.error('Error checking if model should be fine-tuned', { error, modelId: req.body.modelId });
    res.status(500).json({ error: 'Failed to check if model should be fine-tuned' });
  }
};

/**
 * Create a new fine-tuning job
 * @param req Request
 * @param res Response
 */
export const createFineTuningJob = async (req: Request, res: Response) => {
  try {
    const { modelId } = req.body;
    const userId = req.user!.id;

    const job = await feedbackBasedTrainingService.createFineTuningJob(modelId, userId);

    res.status(201).json(job);
  } catch (error) {
    logger.error('Error creating fine-tuning job', { error, modelId: req.body.modelId });
    res.status(500).json({ error: 'Failed to create fine-tuning job' });
  }
};

/**
 * Start a fine-tuning job
 * @param req Request
 * @param res Response
 */
export const startFineTuningJob = async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId;
    const job = await feedbackBasedTrainingService.startFineTuningJob(jobId);

    res.json(job);
  } catch (error) {
    logger.error('Error starting fine-tuning job', { error, jobId: req.params.jobId });
    res.status(500).json({ error: 'Failed to start fine-tuning job' });
  }
};

/**
 * Cancel a fine-tuning job
 * @param req Request
 * @param res Response
 */
export const cancelFineTuningJob = async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId;
    const job = await feedbackBasedTrainingService.cancelFineTuningJob(jobId);

    res.json(job);
  } catch (error) {
    logger.error('Error cancelling fine-tuning job', { error, jobId: req.params.jobId });
    res.status(500).json({ error: 'Failed to cancel fine-tuning job' });
  }
};

/**
 * Analyze error patterns for a model
 * @param req Request
 * @param res Response
 */
export const analyzeErrorPatterns = async (req: Request, res: Response) => {
  try {
    const modelId = req.query.modelId as string;
    const startDate = new Date(req.query.startDate as string);
    const endDate = new Date(req.query.endDate as string);
    const minFrequency = parseInt(req.query.minFrequency as string) || 3;

    const patterns = await errorPatternAnalysisService.analyzeErrorPatterns(
      modelId,
      startDate,
      endDate,
      minFrequency
    );

    res.json(patterns);
  } catch (error) {
    logger.error('Error analyzing error patterns', { error, modelId: req.query.modelId });
    res.status(500).json({ error: 'Failed to analyze error patterns' });
  }
};

/**
 * Get error trends for a model
 * @param req Request
 * @param res Response
 */
export const getErrorTrends = async (req: Request, res: Response) => {
  try {
    const modelId = req.query.modelId as string;
    const days = parseInt(req.query.days as string) || 30;

    const trends = await errorPatternAnalysisService.getErrorTrends(modelId, days);

    res.json(trends);
  } catch (error) {
    logger.error('Error getting error trends', { error, modelId: req.query.modelId });
    res.status(500).json({ error: 'Failed to get error trends' });
  }
};

/**
 * Generate improvement suggestions for error patterns
 * @param req Request
 * @param res Response
 */
export const generateImprovementSuggestions = async (req: Request, res: Response) => {
  try {
    const { patterns } = req.body;
    const suggestions = errorPatternAnalysisService.generateImprovementSuggestions(patterns);

    res.json(suggestions);
  } catch (error) {
    logger.error('Error generating improvement suggestions', { error });
    res.status(500).json({ error: 'Failed to generate improvement suggestions' });
  }
};

/**
 * Store an error pattern
 * @param req Request
 * @param res Response
 */
export const storeErrorPattern = async (req: Request, res: Response) => {
  try {
    const { pattern } = req.body;
    const patternId = await errorPatternAnalysisService.storeErrorPattern(pattern);

    res.status(201).json({ id: patternId });
  } catch (error) {
    logger.error('Error storing error pattern', { error });
    res.status(500).json({ error: 'Failed to store error pattern' });
  }
};

/**
 * Get stored error patterns
 * @param req Request
 * @param res Response
 */
export const getStoredErrorPatterns = async (req: Request, res: Response) => {
  try {
    const modelId = req.query.modelId as string | undefined;
    const status = req.query.status as 'active' | 'fixed' | 'monitoring' | undefined;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await errorPatternAnalysisService.getStoredErrorPatterns(
      modelId,
      status,
      limit,
      offset
    );

    res.json(result);
  } catch (error) {
    logger.error('Error getting stored error patterns', { error });
    res.status(500).json({ error: 'Failed to get stored error patterns' });
  }
};

/**
 * Update error pattern status
 * @param req Request
 * @param res Response
 */
export const updateErrorPatternStatus = async (req: Request, res: Response) => {
  try {
    const patternId = req.params.patternId;
    const { status } = req.body;

    const pattern = await errorPatternAnalysisService.updateErrorPatternStatus(
      patternId,
      status
    );

    res.json(pattern);
  } catch (error) {
    logger.error('Error updating error pattern status', { error, patternId: req.params.patternId });
    res.status(500).json({ error: 'Failed to update error pattern status' });
  }
};

/**
 * Get stored improvement suggestions
 * @param req Request
 * @param res Response
 */
export const getStoredImprovementSuggestions = async (req: Request, res: Response) => {
  try {
    const patternId = req.query.patternId as string | undefined;
    const status = req.query.status as 'pending' | 'implemented' | 'rejected' | undefined;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await errorPatternAnalysisService.getStoredImprovementSuggestions(
      patternId,
      status,
      limit,
      offset
    );

    res.json(result);
  } catch (error) {
    logger.error('Error getting stored improvement suggestions', { error });
    res.status(500).json({ error: 'Failed to get stored improvement suggestions' });
  }
};

/**
 * Update improvement suggestion status
 * @param req Request
 * @param res Response
 */
export const updateImprovementSuggestionStatus = async (req: Request, res: Response) => {
  try {
    const suggestionId = req.params.suggestionId;
    const { status } = req.body;

    const suggestion = await errorPatternAnalysisService.updateImprovementSuggestionStatus(
      suggestionId,
      status
    );

    res.json(suggestion);
  } catch (error) {
    logger.error('Error updating improvement suggestion status', { error, suggestionId: req.params.suggestionId });
    res.status(500).json({ error: 'Failed to update improvement suggestion status' });
  }
};

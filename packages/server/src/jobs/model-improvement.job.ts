/**
 * Model Improvement Jobs
 * 
 * This file contains scheduled jobs for model improvement features:
 * - Automatic model fine-tuning based on feedback
 * - Error pattern analysis and reporting
 */

import { CronJob } from 'cron';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import feedbackBasedTrainingService, { FinetuningTriggerConditions } from '../services/training/feedback-based-training.service';
import errorPatternAnalysisService from '../services/analytics/error-pattern-analysis.service';
import { ErrorCategory } from '../services/analytics/response-quality.service';

/**
 * Check for models that need fine-tuning
 */
export const checkModelsForFineTuning = async () => {
  try {
    logger.info('Starting scheduled job: checkModelsForFineTuning');

    // Get all active models
    const { data: models, error } = await supabase
      .from('models')
      .select('id, name, last_fine_tuned')
      .eq('status', 'active');

    if (error) {
      logger.error('Error getting active models', { error });
      return;
    }

    if (!models || models.length === 0) {
      logger.info('No active models found');
      return;
    }

    logger.info(`Found ${models.length} active models to check for fine-tuning`);

    // Get fine-tuning trigger conditions from settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'fine_tuning_trigger_conditions')
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      logger.error('Error getting fine-tuning trigger conditions', { error: settingsError });
      return;
    }

    // Default conditions if not found in settings
    const defaultConditions: FinetuningTriggerConditions = {
      minFeedbackCount: 50,
      minErrorPercentage: 10,
      minDaysSinceLastTraining: 7
    };

    // Parse conditions from settings or use defaults
    const conditions: FinetuningTriggerConditions = settings?.value || defaultConditions;

    // Check each model
    for (const model of models) {
      try {
        logger.info(`Checking if model ${model.name} (${model.id}) needs fine-tuning`);

        const result = await feedbackBasedTrainingService.shouldFineTuneModel(model.id, conditions);

        if (result.shouldFineTune) {
          logger.info(`Model ${model.name} (${model.id}) should be fine-tuned: ${result.reason}`, { stats: result.stats });

          // Get admin user for job creation
          const { data: adminUser, error: adminError } = await supabase
            .from('auth.users')
            .select('id')
            .eq('role', 'admin')
            .limit(1)
            .single();

          if (adminError) {
            logger.error('Error getting admin user', { error: adminError });
            continue;
          }

          // Create fine-tuning job
          const job = await feedbackBasedTrainingService.createFineTuningJob(model.id, adminUser.id);
          logger.info(`Created fine-tuning job ${job.id} for model ${model.name} (${model.id})`);

          // Start fine-tuning job
          await feedbackBasedTrainingService.startFineTuningJob(job.id);
          logger.info(`Started fine-tuning job ${job.id} for model ${model.name} (${model.id})`);
        } else {
          logger.info(`Model ${model.name} (${model.id}) does not need fine-tuning: ${result.reason}`);
        }
      } catch (modelError) {
        logger.error(`Error checking model ${model.name} (${model.id})`, { error: modelError });
        continue;
      }
    }

    logger.info('Completed scheduled job: checkModelsForFineTuning');
  } catch (error) {
    logger.error('Error in checkModelsForFineTuning job', { error });
  }
};

/**
 * Analyze error patterns for all models
 */
export const analyzeErrorPatternsForAllModels = async () => {
  try {
    logger.info('Starting scheduled job: analyzeErrorPatternsForAllModels');

    // Get all active models
    const { data: models, error } = await supabase
      .from('models')
      .select('id, name')
      .eq('status', 'active');

    if (error) {
      logger.error('Error getting active models', { error });
      return;
    }

    if (!models || models.length === 0) {
      logger.info('No active models found');
      return;
    }

    logger.info(`Found ${models.length} active models to analyze error patterns`);

    // Set date range for analysis (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    // Analyze each model
    for (const model of models) {
      try {
        logger.info(`Analyzing error patterns for model ${model.name} (${model.id})`);

        const patterns = await errorPatternAnalysisService.analyzeErrorPatterns(
          model.id,
          startDate,
          endDate,
          3 // Minimum frequency
        );

        if (patterns.length === 0) {
          logger.info(`No error patterns found for model ${model.name} (${model.id})`);
          continue;
        }

        logger.info(`Found ${patterns.length} error patterns for model ${model.name} (${model.id})`);

        // Store each pattern
        for (const pattern of patterns) {
          try {
            await errorPatternAnalysisService.storeErrorPattern(pattern);
            logger.info(`Stored error pattern ${pattern.id} for model ${model.name} (${model.id})`);
          } catch (patternError) {
            logger.error(`Error storing error pattern for model ${model.name} (${model.id})`, { error: patternError });
            continue;
          }
        }

        // Generate improvement suggestions
        const suggestions = errorPatternAnalysisService.generateImprovementSuggestions(patterns);
        logger.info(`Generated ${suggestions.length} improvement suggestions for model ${model.name} (${model.id})`);

        // Store each suggestion
        for (const suggestion of suggestions) {
          try {
            await errorPatternAnalysisService.storeImprovementSuggestion(suggestion);
            logger.info(`Stored improvement suggestion ${suggestion.id} for pattern ${suggestion.patternId}`);
          } catch (suggestionError) {
            logger.error(`Error storing improvement suggestion for pattern ${suggestion.patternId}`, { error: suggestionError });
            continue;
          }
        }
      } catch (modelError) {
        logger.error(`Error analyzing model ${model.name} (${model.id})`, { error: modelError });
        continue;
      }
    }

    logger.info('Completed scheduled job: analyzeErrorPatternsForAllModels');
  } catch (error) {
    logger.error('Error in analyzeErrorPatternsForAllModels job', { error });
  }
};

/**
 * Initialize model improvement jobs
 */
export const initializeModelImprovementJobs = () => {
  // Check for models that need fine-tuning every day at 2:00 AM
  const fineTuningJob = new CronJob('0 2 * * *', checkModelsForFineTuning);
  fineTuningJob.start();
  logger.info('Scheduled job: checkModelsForFineTuning (0 2 * * *)');

  // Analyze error patterns for all models every Monday at 3:00 AM
  const errorPatternJob = new CronJob('0 3 * * 1', analyzeErrorPatternsForAllModels);
  errorPatternJob.start();
  logger.info('Scheduled job: analyzeErrorPatternsForAllModels (0 3 * * 1)');
};

export default {
  checkModelsForFineTuning,
  analyzeErrorPatternsForAllModels,
  initializeModelImprovementJobs
};

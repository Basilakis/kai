/**
 * Feedback-Based Training Service
 *
 * This service analyzes user feedback on model responses and uses it to:
 * 1. Identify patterns in model errors
 * 2. Prepare datasets for fine-tuning
 * 3. Trigger model retraining when appropriate
 * 4. Track improvements in model performance
 */

import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import { mcpClientService } from '../mcp/mcp-client.service';
import { creditService } from '../credit/credit.service';
import { MCPServiceKey } from '../../types/mcp';
import { v4 as uuidv4 } from 'uuid';

// Error category types from response quality service
import { ErrorCategory } from '../analytics/response-quality.service';

// Fine-tuning job status
export enum FinetuningJobStatus {
  PENDING = 'pending',
  PREPARING_DATA = 'preparing_data',
  TRAINING = 'training',
  EVALUATING = 'evaluating',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Fine-tuning job interface
export interface FinetuningJob {
  id: string;
  modelId: string;
  modelName: string;
  status: FinetuningJobStatus;
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  metrics?: {
    beforeAccuracy?: number;
    afterAccuracy?: number;
    improvementPercentage?: number;
    errorReduction?: {
      [key in ErrorCategory]?: number;
    };
  };
  datasetStats?: {
    totalSamples: number;
    errorCategories: {
      [key in ErrorCategory]?: number;
    };
  };
  userId: string;
}

// Fine-tuning trigger conditions
export interface FinetuningTriggerConditions {
  minFeedbackCount: number;
  minErrorPercentage: number;
  minDaysSinceLastTraining: number;
  specificErrorCategories?: ErrorCategory[];
}

/**
 * Feedback-Based Training Service
 */
class FeedbackBasedTrainingService {
  /**
   * Check if a model should be fine-tuned based on feedback data
   * @param modelId Model ID
   * @param conditions Trigger conditions
   * @returns Whether the model should be fine-tuned
   */
  public async shouldFineTuneModel(
    modelId: string,
    conditions: FinetuningTriggerConditions
  ): Promise<{ shouldFineTune: boolean; reason: string; stats?: any }> {
    try {
      // Get total feedback count for this model
      const { count: feedbackCount, error: countError } = await supabase
        .from('response_feedback')
        .select('*', { count: 'exact', head: true })
        .eq('model_id', modelId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

      if (countError) {
        logger.error('Error counting feedback', { error: countError, modelId });
        throw countError;
      }

      if (!feedbackCount || feedbackCount < conditions.minFeedbackCount) {
        return {
          shouldFineTune: false,
          reason: `Insufficient feedback: ${feedbackCount || 0}/${conditions.minFeedbackCount} required`
        };
      }

      // Get error percentage
      const { count: errorCount, error: errorCountError } = await supabase
        .from('response_feedback')
        .select('*', { count: 'exact', head: true })
        .eq('model_id', modelId)
        .not('error_category', 'is', null)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (errorCountError) {
        logger.error('Error counting errors', { error: errorCountError, modelId });
        throw errorCountError;
      }

      const errorPercentage = (errorCount || 0) / feedbackCount * 100;

      if (errorPercentage < conditions.minErrorPercentage) {
        return {
          shouldFineTune: false,
          reason: `Error percentage too low: ${errorPercentage.toFixed(1)}%/${conditions.minErrorPercentage}% required`
        };
      }

      // Check when the model was last fine-tuned
      const { data: lastJob, error: lastJobError } = await supabase
        .from('finetuning_jobs')
        .select('completed_at')
        .eq('model_id', modelId)
        .eq('status', FinetuningJobStatus.COMPLETED)
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();

      if (lastJobError && lastJobError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        logger.error('Error getting last fine-tuning job', { error: lastJobError, modelId });
        throw lastJobError;
      }

      if (lastJob) {
        const daysSinceLastTraining = (Date.now() - new Date(lastJob.completed_at).getTime()) / (24 * 60 * 60 * 1000);

        if (daysSinceLastTraining < conditions.minDaysSinceLastTraining) {
          return {
            shouldFineTune: false,
            reason: `Last training too recent: ${daysSinceLastTraining.toFixed(1)}/${conditions.minDaysSinceLastTraining} days required`
          };
        }
      }

      // Check for specific error categories if specified
      if (conditions.specificErrorCategories && conditions.specificErrorCategories.length > 0) {
        const { data: errorCategories, error: categoriesError } = await supabase
          .from('response_feedback')
          .select('error_category, count')
          .eq('model_id', modelId)
          .not('error_category', 'is', null)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .group('error_category');

        if (categoriesError) {
          logger.error('Error getting error categories', { error: categoriesError, modelId });
          throw categoriesError;
        }

        const hasSpecificErrors = errorCategories?.some(
          category => conditions.specificErrorCategories?.includes(category.error_category as ErrorCategory)
        );

        if (!hasSpecificErrors) {
          return {
            shouldFineTune: false,
            reason: `No errors in specified categories: ${conditions.specificErrorCategories.join(', ')}`
          };
        }
      }

      // All conditions met, should fine-tune
      return {
        shouldFineTune: true,
        reason: 'All conditions met',
        stats: {
          feedbackCount,
          errorCount,
          errorPercentage
        }
      };
    } catch (error) {
      logger.error('Error checking if model should be fine-tuned', { error, modelId });
      throw error;
    }
  }

  /**
   * Prepare a dataset for fine-tuning based on feedback data
   * @param modelId Model ID
   * @returns Dataset statistics
   */
  public async prepareFineTuningDataset(modelId: string): Promise<{
    datasetId: string;
    stats: {
      totalSamples: number;
      errorCategories: {
        [key in ErrorCategory]?: number;
      };
    };
  }> {
    try {
      // Get feedback data with errors
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('response_feedback')
        .select(`
          id,
          response_id,
          model_id,
          error_category,
          feedback_text,
          response:model_responses(query_text, response_text)
        `)
        .eq('model_id', modelId)
        .not('error_category', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1000); // Limit to 1000 most recent feedback items

      if (feedbackError) {
        logger.error('Error getting feedback data', { error: feedbackError, modelId });
        throw feedbackError;
      }

      if (!feedbackData || feedbackData.length === 0) {
        throw new Error('No feedback data available for fine-tuning');
      }

      // Count error categories
      const errorCategories: { [key in ErrorCategory]?: number } = {};

      feedbackData.forEach(feedback => {
        const category = feedback.error_category as ErrorCategory;
        errorCategories[category] = (errorCategories[category] || 0) + 1;
      });

      // Create a dataset record
      const datasetId = uuidv4();
      const { error: insertError } = await supabase
        .from('finetuning_datasets')
        .insert({
          id: datasetId,
          model_id: modelId,
          sample_count: feedbackData.length,
          error_categories: errorCategories,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        logger.error('Error creating dataset record', { error: insertError, modelId });
        throw insertError;
      }

      // Insert dataset samples
      const datasetSamples = feedbackData.map(feedback => ({
        id: uuidv4(),
        dataset_id: datasetId,
        feedback_id: feedback.id,
        query: feedback.response?.query_text,
        incorrect_response: feedback.response?.response_text,
        error_category: feedback.error_category,
        created_at: new Date().toISOString()
      }));

      const { error: samplesError } = await supabase
        .from('finetuning_dataset_samples')
        .insert(datasetSamples);

      if (samplesError) {
        logger.error('Error inserting dataset samples', { error: samplesError, modelId });
        throw samplesError;
      }

      return {
        datasetId,
        stats: {
          totalSamples: feedbackData.length,
          errorCategories
        }
      };
    } catch (error) {
      logger.error('Error preparing fine-tuning dataset', { error, modelId });
      throw error;
    }
  }

  /**
   * Create a new fine-tuning job
   * @param modelId Model ID
   * @param userId User ID
   * @returns Created job
   */
  public async createFineTuningJob(modelId: string, userId: string): Promise<FinetuningJob> {
    try {
      // Get model details
      const { data: model, error: modelError } = await supabase
        .from('models')
        .select('name')
        .eq('id', modelId)
        .single();

      if (modelError) {
        logger.error('Error getting model details', { error: modelError, modelId });
        throw modelError;
      }

      // Create job record
      const jobId = uuidv4();
      const job: FinetuningJob = {
        id: jobId,
        modelId,
        modelName: model.name,
        status: FinetuningJobStatus.PENDING,
        progress: 0,
        createdAt: new Date(),
        userId
      };

      const { error: insertError } = await supabase
        .from('finetuning_jobs')
        .insert({
          id: job.id,
          model_id: job.modelId,
          model_name: job.modelName,
          status: job.status,
          progress: job.progress,
          created_at: job.createdAt.toISOString(),
          user_id: job.userId
        });

      if (insertError) {
        logger.error('Error creating fine-tuning job', { error: insertError, modelId });
        throw insertError;
      }

      return job;
    } catch (error) {
      logger.error('Error creating fine-tuning job', { error, modelId });
      throw error;
    }
  }

  /**
   * Start a fine-tuning job
   * @param jobId Job ID
   * @returns Updated job
   */
  public async startFineTuningJob(jobId: string): Promise<FinetuningJob> {
    try {
      // Get job details
      const { data: job, error: jobError } = await supabase
        .from('finetuning_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError) {
        logger.error('Error getting job details', { error: jobError, jobId });
        throw jobError;
      }

      // Update job status
      const startedAt = new Date();
      const { error: updateError } = await supabase
        .from('finetuning_jobs')
        .update({
          status: FinetuningJobStatus.PREPARING_DATA,
          progress: 5,
          started_at: startedAt.toISOString()
        })
        .eq('id', jobId);

      if (updateError) {
        logger.error('Error updating job status', { error: updateError, jobId });
        throw updateError;
      }

      // Prepare dataset
      try {
        await this.updateJobStatus(jobId, FinetuningJobStatus.PREPARING_DATA, 10);

        const dataset = await this.prepareFineTuningDataset(job.model_id);

        await this.updateJobStatus(jobId, FinetuningJobStatus.PREPARING_DATA, 30, {
          datasetStats: dataset.stats
        });

        // Start training with MCP
        await this.updateJobStatus(jobId, FinetuningJobStatus.TRAINING, 40);

        // Call MCP to start training
        const trainingResult = await mcpClientService.fineTuneModel({
          modelId: job.model_id,
          datasetId: dataset.datasetId,
          jobId,
          userId: job.user_id // Pass user ID for credit tracking
        });

        // Update job with training results
        await this.updateJobStatus(jobId, FinetuningJobStatus.COMPLETED, 100, {
          completedAt: new Date(),
          metrics: trainingResult.metrics
        });

        // Get updated job
        const { data: updatedJob, error: getError } = await supabase
          .from('finetuning_jobs')
          .select('*')
          .eq('id', jobId)
          .single();

        if (getError) {
          logger.error('Error getting updated job', { error: getError, jobId });
          throw getError;
        }

        return {
          id: updatedJob.id,
          modelId: updatedJob.model_id,
          modelName: updatedJob.model_name,
          status: updatedJob.status as FinetuningJobStatus,
          progress: updatedJob.progress,
          createdAt: new Date(updatedJob.created_at),
          startedAt: updatedJob.started_at ? new Date(updatedJob.started_at) : undefined,
          completedAt: updatedJob.completed_at ? new Date(updatedJob.completed_at) : undefined,
          errorMessage: updatedJob.error_message,
          metrics: updatedJob.metrics,
          datasetStats: updatedJob.dataset_stats,
          userId: updatedJob.user_id
        };
      } catch (error) {
        // Update job status to failed
        await this.updateJobStatus(jobId, FinetuningJobStatus.FAILED, 0, {
          errorMessage: error instanceof Error ? error.message : String(error)
        });

        throw error;
      }
    } catch (error) {
      logger.error('Error starting fine-tuning job', { error, jobId });
      throw error;
    }
  }

  /**
   * Update job status
   * @param jobId Job ID
   * @param status New status
   * @param progress Progress percentage
   * @param additionalData Additional data to update
   */
  private async updateJobStatus(
    jobId: string,
    status: FinetuningJobStatus,
    progress: number,
    additionalData: any = {}
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('finetuning_jobs')
        .update({
          status,
          progress,
          ...additionalData
        })
        .eq('id', jobId);

      if (error) {
        logger.error('Error updating job status', { error, jobId, status });
        throw error;
      }
    } catch (error) {
      logger.error('Error in updateJobStatus', { error, jobId });
      throw error;
    }
  }

  /**
   * Get fine-tuning job by ID
   * @param jobId Job ID
   * @returns Fine-tuning job
   */
  public async getFineTuningJob(jobId: string): Promise<FinetuningJob> {
    try {
      const { data, error } = await supabase
        .from('finetuning_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) {
        logger.error('Error getting fine-tuning job', { error, jobId });
        throw error;
      }

      return {
        id: data.id,
        modelId: data.model_id,
        modelName: data.model_name,
        status: data.status as FinetuningJobStatus,
        progress: data.progress,
        createdAt: new Date(data.created_at),
        startedAt: data.started_at ? new Date(data.started_at) : undefined,
        completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
        errorMessage: data.error_message,
        metrics: data.metrics,
        datasetStats: data.dataset_stats,
        userId: data.user_id
      };
    } catch (error) {
      logger.error('Error in getFineTuningJob', { error, jobId });
      throw error;
    }
  }

  /**
   * Get fine-tuning jobs for a model
   * @param modelId Model ID
   * @param limit Limit
   * @param offset Offset
   * @returns Fine-tuning jobs
   */
  public async getFineTuningJobs(
    modelId?: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{ jobs: FinetuningJob[]; total: number }> {
    try {
      let query = supabase
        .from('finetuning_jobs')
        .select('*', { count: 'exact' });

      if (modelId) {
        query = query.eq('model_id', modelId);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Error getting fine-tuning jobs', { error, modelId });
        throw error;
      }

      const jobs: FinetuningJob[] = data.map(job => ({
        id: job.id,
        modelId: job.model_id,
        modelName: job.model_name,
        status: job.status as FinetuningJobStatus,
        progress: job.progress,
        createdAt: new Date(job.created_at),
        startedAt: job.started_at ? new Date(job.started_at) : undefined,
        completedAt: job.completed_at ? new Date(job.completed_at) : undefined,
        errorMessage: job.error_message,
        metrics: job.metrics,
        datasetStats: job.dataset_stats,
        userId: job.user_id
      }));

      return {
        jobs,
        total: count || 0
      };
    } catch (error) {
      logger.error('Error in getFineTuningJobs', { error, modelId });
      throw error;
    }
  }

  /**
   * Cancel a fine-tuning job
   * @param jobId Job ID
   * @returns Cancelled job
   */
  public async cancelFineTuningJob(jobId: string): Promise<FinetuningJob> {
    try {
      // Get job details
      const { data: job, error: jobError } = await supabase
        .from('finetuning_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError) {
        logger.error('Error getting job details', { error: jobError, jobId });
        throw jobError;
      }

      // Check if job can be cancelled
      if (
        job.status === FinetuningJobStatus.COMPLETED ||
        job.status === FinetuningJobStatus.FAILED ||
        job.status === FinetuningJobStatus.CANCELLED
      ) {
        throw new Error(`Job cannot be cancelled: status is ${job.status}`);
      }

      // Update job status
      const { error: updateError } = await supabase
        .from('finetuning_jobs')
        .update({
          status: FinetuningJobStatus.CANCELLED,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (updateError) {
        logger.error('Error updating job status', { error: updateError, jobId });
        throw updateError;
      }

      // Try to cancel the job in MCP if it's running
      try {
        await mcpClientService.cancelFineTuningJob(jobId, job.user_id);
      } catch (mcpError) {
        logger.warn('Error cancelling job in MCP', { error: mcpError, jobId });
        // Continue even if MCP cancellation fails
      }

      // Get updated job
      const { data: updatedJob, error: getError } = await supabase
        .from('finetuning_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (getError) {
        logger.error('Error getting updated job', { error: getError, jobId });
        throw getError;
      }

      return {
        id: updatedJob.id,
        modelId: updatedJob.model_id,
        modelName: updatedJob.model_name,
        status: updatedJob.status as FinetuningJobStatus,
        progress: updatedJob.progress,
        createdAt: new Date(updatedJob.created_at),
        startedAt: updatedJob.started_at ? new Date(updatedJob.started_at) : undefined,
        completedAt: updatedJob.completed_at ? new Date(updatedJob.completed_at) : undefined,
        errorMessage: updatedJob.error_message,
        metrics: updatedJob.metrics,
        datasetStats: updatedJob.dataset_stats,
        userId: updatedJob.user_id
      };
    } catch (error) {
      logger.error('Error cancelling fine-tuning job', { error, jobId });
      throw error;
    }
  }
}

export const feedbackBasedTrainingService = new FeedbackBasedTrainingService();
export default feedbackBasedTrainingService;

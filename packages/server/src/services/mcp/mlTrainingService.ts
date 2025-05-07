import mcpClientService, { MCPServiceKey } from './mcpClientService';
import { logger } from '../../utils/logger';
import { supabase } from '../supabase/supabaseClient';

/**
 * Service for ML model training and prediction using MCP
 */
class MLTrainingService {
  /**
   * Train a model
   * @param userId User ID
   * @param modelId Model ID
   * @param versionId Version ID
   * @param modelType Model type
   * @param modelParameters Model parameters
   * @param trainingData Training data
   * @returns Training job ID
   */
  async trainModel(
    userId: string,
    modelId: string,
    versionId: string,
    modelType: string,
    modelParameters: any,
    trainingData: any[]
  ): Promise<string> {
    try {
      // Prepare training data for MCP
      const mcpData = {
        modelId,
        versionId,
        modelType,
        modelParameters,
        trainingData
      };

      // Call MCP endpoint with credit tracking
      const response = await mcpClientService.callEndpoint<{ jobId: string }>(
        userId,
        MCPServiceKey.MODEL_TRAINING,
        'ml/train',
        mcpData,
        10 // 10 credits for model training
      );

      const jobId = response.jobId;

      // Register a callback for when the job completes
      await this.registerTrainingCallback(userId, jobId, versionId);

      return jobId;
    } catch (error) {
      logger.error(`Error in trainModel: ${error}`);
      throw error;
    }
  }

  /**
   * Handle training completion callback
   * @param versionId Version ID
   * @param trainingResults Training results
   */
  async handleTrainingCompletion(versionId: string, trainingResults: any): Promise<void> {
    try {
      // Update the model version with the training results
      const { data: version, error: versionError } = await supabase
        .from('prompt_ml_model_versions')
        .select('model_id')
        .eq('id', versionId)
        .single();

      if (versionError) {
        logger.error(`Error fetching model version: ${versionError.message}`);
        throw new Error(`Failed to fetch model version: ${versionError.message}`);
      }

      const modelId = version.model_id;

      // Update the model version with the training results
      const { error: updateError } = await supabase
        .from('prompt_ml_model_versions')
        .update({
          model_data: trainingResults.modelData,
          accuracy: trainingResults.metrics.accuracy,
          precision: trainingResults.metrics.precision,
          recall: trainingResults.metrics.recall,
          f1_score: trainingResults.metrics.f1Score,
          auc: trainingResults.metrics.auc,
          confusion_matrix: trainingResults.metrics.confusionMatrix,
          training_history: trainingResults.trainingHistory,
          training_time: trainingResults.trainingTime,
          sample_size: trainingResults.sampleSize,
          is_active: true
        })
        .eq('id', versionId);

      if (updateError) {
        logger.error(`Error updating model version: ${updateError.message}`);
        throw new Error(`Failed to update model version: ${updateError.message}`);
      }

      // Deactivate other versions
      await supabase
        .from('prompt_ml_model_versions')
        .update({ is_active: false })
        .eq('model_id', modelId)
        .neq('id', versionId);

      // Save feature importance
      if (trainingResults.featureImportance) {
        const featureImportanceData = Object.entries(trainingResults.featureImportance).map(
          ([feature, importance]) => ({
            model_id: modelId,
            model_version_id: versionId,
            feature,
            importance: importance as number
          })
        );

        const { error: featureError } = await supabase
          .from('prompt_feature_importance')
          .insert(featureImportanceData);

        if (featureError) {
          logger.error(`Error saving feature importance: ${featureError.message}`);
          // Don't throw, just log the error
        }
      }
    } catch (error) {
      logger.error(`Error in handleTrainingCompletion: ${error}`);
      throw error;
    }
  }

  /**
   * Register a callback for training completion
   * @param userId User ID
   * @param jobId Job ID
   * @param versionId Version ID
   */
  private async registerTrainingCallback(userId: string, jobId: string, versionId: string): Promise<void> {
    try {
      // Get server URL from environment
      const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';

      // Register callback with MCP
      await mcpClientService.callEndpoint(
        userId,
        MCPServiceKey.MODEL_TRAINING,
        'callbacks/register',
        {
          jobId,
          callbackUrl: `${serverUrl}/api/callbacks/ml-training/${versionId}`,
          callbackType: 'ml-training'
        },
        1 // 1 credit for callback registration
      );
    } catch (error) {
      logger.error(`Error registering training callback: ${error}`);
      // Don't throw, just log the error
    }
  }

  /**
   * Make a prediction
   * @param userId User ID
   * @param modelId Model ID
   * @param features Input features
   * @returns Prediction results
   */
  async predict(userId: string, modelId: string, features: any): Promise<any> {
    try {
      // Get the active model version
      const { data: version, error: versionError } = await supabase
        .from('prompt_ml_model_versions')
        .select('*')
        .eq('model_id', modelId)
        .eq('is_active', true)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      if (versionError) {
        logger.error(`Error fetching active model version: ${versionError.message}`);
        throw new Error(`Failed to fetch active model version: ${versionError.message}`);
      }

      // Prepare prediction data for MCP
      const mcpData = {
        modelId,
        versionId: version.id,
        features
      };

      // Call MCP endpoint with credit tracking
      const response = await mcpClientService.callEndpoint(
        userId,
        MCPServiceKey.MODEL_TRAINING,
        'ml/predict',
        mcpData,
        1 // 1 credit for prediction
      );

      return response;
    } catch (error) {
      logger.error(`Error in predict: ${error}`);
      throw error;
    }
  }

  /**
   * Generate improvement suggestions
   * @param userId User ID
   * @param promptContent Prompt content
   * @param promptType Prompt type
   * @returns Improvement suggestions
   */
  async generateImprovementSuggestions(userId: string, promptContent: string, promptType: string): Promise<any> {
    try {
      // Prepare suggestion data for MCP
      const mcpData = {
        promptContent,
        promptType
      };

      // Call MCP endpoint with credit tracking
      const response = await mcpClientService.callEndpoint(
        userId,
        MCPServiceKey.TEXT_GENERATION,
        'ml/generate-suggestions',
        mcpData,
        2 // 2 credits for suggestion generation
      );

      return response;
    } catch (error) {
      logger.error(`Error in generateImprovementSuggestions: ${error}`);
      throw error;
    }
  }

  /**
   * Apply an improvement suggestion
   * @param userId User ID
   * @param promptContent Original prompt content
   * @param suggestion Suggestion to apply
   * @returns Updated prompt content
   */
  async applyImprovementSuggestion(userId: string, promptContent: string, suggestion: any): Promise<string> {
    try {
      // Prepare suggestion application data for MCP
      const mcpData = {
        promptContent,
        suggestion
      };

      // Call MCP endpoint with credit tracking
      const response = await mcpClientService.callEndpoint<{ updatedContent: string }>(
        userId,
        MCPServiceKey.TEXT_GENERATION,
        'ml/apply-suggestion',
        mcpData,
        1 // 1 credit for suggestion application
      );

      return response.updatedContent;
    } catch (error) {
      logger.error(`Error in applyImprovementSuggestion: ${error}`);
      throw error;
    }
  }
}

export default new MLTrainingService();

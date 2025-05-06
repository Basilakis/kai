/**
 * Prompt ML Service
 *
 * Provides machine learning capabilities for prompt success prediction and improvement suggestions.
 */

import { logger } from '../../utils/logger';
import { supabaseClient } from '../supabase/supabaseClient';
import * as tf from '@tensorflow/tfjs-node';
import { PromptData } from './promptService';

/**
 * ML model data
 */
export interface MLModelData {
  id: string;
  name: string;
  description?: string;
  modelType: string;
  modelParameters: Record<string, any>;
  trainingDataQuery?: string;
  trainingMetrics?: Record<string, any>;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ML model version data
 */
export interface MLModelVersionData {
  id: string;
  modelId: string;
  versionNumber: number;
  modelData?: Buffer;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  trainingDate: Date;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
}

/**
 * ML prediction data
 */
export interface MLPredictionData {
  id: string;
  promptId: string;
  modelId: string;
  modelVersionId: string;
  predictedSuccessRate: number;
  predictionFeatures: Record<string, any>;
  confidence: number;
  createdAt: Date;
}

/**
 * Improvement suggestion data
 */
export interface ImprovementSuggestionData {
  id: string;
  promptId: string;
  modelId: string;
  suggestionType: string;
  suggestion: string;
  predictedImprovement?: number;
  confidence?: number;
  isApplied: boolean;
  appliedAt?: Date;
  createdAt: Date;
}

/**
 * Feature extraction result
 */
interface FeatureExtractionResult {
  features: Record<string, number>;
  featureVector: number[];
}

/**
 * Prompt ML Service class
 */
export class PromptMLService {
  private models: Map<string, tf.LayersModel> = new Map();

  /**
   * Constructor
   */
  constructor() {
    logger.info('Initializing Prompt ML Service');
  }

  /**
   * Get all ML models
   * @param isActive Filter by active status
   * @returns Array of ML models
   */
  async getMLModels(isActive?: boolean): Promise<MLModelData[]> {
    try {
      let query = supabaseClient.getClient()
        .from('prompt_ml_models')
        .select('*');

      if (isActive !== undefined) {
        query = query.eq('is_active', isActive);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get ML models: ${error.message}`);
      }

      return (data || []).map(this.mapModelFromDb);
    } catch (error) {
      logger.error(`Failed to get ML models: ${error}`);
      throw error;
    }
  }

  /**
   * Get ML model by ID
   * @param modelId Model ID
   * @returns ML model data
   */
  async getMLModelById(modelId: string): Promise<MLModelData> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('prompt_ml_models')
        .select('*')
        .eq('id', modelId)
        .single();

      if (error) {
        throw new Error(`Failed to get ML model: ${error.message}`);
      }

      return this.mapModelFromDb(data);
    } catch (error) {
      logger.error(`Failed to get ML model by ID: ${error}`);
      throw error;
    }
  }

  /**
   * Create ML model
   * @param model Model data
   * @returns Created model ID
   */
  async createMLModel(
    model: Omit<MLModelData, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('prompt_ml_models')
        .insert({
          name: model.name,
          description: model.description,
          model_type: model.modelType,
          model_parameters: model.modelParameters,
          training_data_query: model.trainingDataQuery,
          training_metrics: model.trainingMetrics,
          is_active: model.isActive,
          created_by: model.createdBy
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create ML model: ${error.message}`);
      }

      return data.id;
    } catch (error) {
      logger.error(`Failed to create ML model: ${error}`);
      throw error;
    }
  }

  /**
   * Train ML model
   * @param modelId Model ID
   * @param trainingData Optional training data (if not provided, will use query from model)
   * @returns Model version ID
   */
  async trainModel(
    modelId: string,
    trainingData?: { promptId: string; features: Record<string, number>; successRate: number }[]
  ): Promise<string> {
    try {
      // Get the model
      const model = await this.getMLModelById(modelId);

      // If training data not provided, fetch using the query
      if (!trainingData && model.trainingDataQuery) {
        trainingData = await this.fetchTrainingData(model.trainingDataQuery);
      }

      if (!trainingData || trainingData.length === 0) {
        throw new Error('No training data available');
      }

      // Extract features and labels
      const { features, labels } = this.prepareTrainingData(trainingData);

      // Create and train the model
      const tfModel = this.createTFModel(model.modelParameters);
      await this.trainTFModel(tfModel, features, labels, model.modelParameters);

      // Evaluate the model
      const metrics = await this.evaluateModel(tfModel, features, labels);

      // Save the model
      const modelBuffer = await this.serializeModel(tfModel);

      // Get the next version number
      const { data: versionData, error: versionError } = await supabaseClient.getClient()
        .from('prompt_ml_model_versions')
        .select('version_number')
        .eq('model_id', modelId)
        .order('version_number', { ascending: false })
        .limit(1);

      if (versionError) {
        throw new Error(`Failed to get version number: ${versionError.message}`);
      }

      const nextVersionNumber = versionData && versionData.length > 0 ? versionData[0].version_number + 1 : 1;

      // Create a new version
      const { data, error } = await supabaseClient.getClient()
        .from('prompt_ml_model_versions')
        .insert({
          model_id: modelId,
          version_number: nextVersionNumber,
          model_data: modelBuffer,
          accuracy: metrics.accuracy,
          precision: metrics.precision,
          recall: metrics.recall,
          f1_score: metrics.f1Score,
          is_active: true,
          created_by: model.createdBy
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create model version: ${error.message}`);
      }

      // Update model training metrics
      await supabaseClient.getClient()
        .from('prompt_ml_models')
        .update({
          training_metrics: metrics,
          updated_at: new Date()
        })
        .eq('id', modelId);

      return data.id;
    } catch (error) {
      logger.error(`Failed to train model: ${error}`);
      throw error;
    }
  }

  /**
   * Predict prompt success
   * @param promptId Prompt ID
   * @param promptContent Prompt content
   * @param promptType Prompt type
   * @returns Prediction data
   */
  async predictPromptSuccess(
    promptId: string,
    promptContent: string,
    promptType: string
  ): Promise<MLPredictionData> {
    try {
      // Get the active model for this prompt type
      const { data: modelData, error: modelError } = await supabaseClient.getClient()
        .from('prompt_ml_models')
        .select('*')
        .eq('is_active', true)
        .eq('model_parameters->promptType', promptType)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (modelError) {
        throw new Error(`Failed to get active model: ${modelError.message}`);
      }

      const modelId = modelData.id;

      // Get the active version of this model
      const { data: versionData, error: versionError } = await supabaseClient.getClient()
        .from('prompt_ml_model_versions')
        .select('*')
        .eq('model_id', modelId)
        .eq('is_active', true)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      if (versionError) {
        throw new Error(`Failed to get active model version: ${versionError.message}`);
      }

      const modelVersionId = versionData.id;

      // Load the model if not already loaded
      if (!this.models.has(modelVersionId)) {
        const model = await this.loadModel(versionData.model_data);
        this.models.set(modelVersionId, model);
      }

      // Extract features from the prompt
      const { features, featureVector } = this.extractFeatures(promptContent, promptType);

      // Make prediction
      const tfModel = this.models.get(modelVersionId)!;
      const prediction = await tfModel.predict(tf.tensor2d([featureVector])) as tf.Tensor;
      const predictedSuccessRate = (await prediction.data())[0] * 100;

      // Calculate confidence based on model metrics and prediction value
      const confidence = this.calculateConfidence(predictedSuccessRate, versionData.accuracy);

      // Save prediction to database
      const { data, error } = await supabaseClient.getClient()
        .from('prompt_ml_predictions')
        .insert({
          prompt_id: promptId,
          model_id: modelId,
          model_version_id: modelVersionId,
          predicted_success_rate: predictedSuccessRate,
          prediction_features: features,
          confidence
        })
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to save prediction: ${error.message}`);
      }

      return this.mapPredictionFromDb(data);
    } catch (error) {
      logger.error(`Failed to predict prompt success: ${error}`);
      throw error;
    }
  }

  /**
   * Generate improvement suggestions
   * @param promptId Prompt ID
   * @param promptContent Prompt content
   * @param promptType Prompt type
   * @returns Array of improvement suggestions
   */
  async generateImprovementSuggestions(
    promptId: string,
    promptContent: string,
    promptType: string
  ): Promise<ImprovementSuggestionData[]> {
    try {
      // Get the active model for this prompt type
      const { data: modelData, error: modelError } = await supabaseClient.getClient()
        .from('prompt_ml_models')
        .select('*')
        .eq('is_active', true)
        .eq('model_parameters->promptType', promptType)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (modelError) {
        throw new Error(`Failed to get active model: ${modelError.message}`);
      }

      const modelId = modelData.id;

      // Extract features from the prompt
      const { features } = this.extractFeatures(promptContent, promptType);

      // Generate suggestions based on features
      const suggestions = this.generateSuggestions(promptContent, features, promptType);

      // Save suggestions to database
      const savedSuggestions: ImprovementSuggestionData[] = [];

      for (const suggestion of suggestions) {
        const { data, error } = await supabaseClient.getClient()
          .from('prompt_improvement_suggestions')
          .insert({
            prompt_id: promptId,
            model_id: modelId,
            suggestion_type: suggestion.type,
            suggestion: suggestion.text,
            predicted_improvement: suggestion.predictedImprovement,
            confidence: suggestion.confidence,
            is_applied: false
          })
          .select('*')
          .single();

        if (error) {
          logger.error(`Failed to save suggestion: ${error.message}`);
          continue;
        }

        savedSuggestions.push(this.mapSuggestionFromDb(data));
      }

      return savedSuggestions;
    } catch (error) {
      logger.error(`Failed to generate improvement suggestions: ${error}`);
      throw error;
    }
  }

  /**
   * Apply improvement suggestion
   * @param suggestionId Suggestion ID
   * @returns Updated prompt content
   */
  async applyImprovementSuggestion(suggestionId: string): Promise<string> {
    try {
      // Get the suggestion
      const { data: suggestionData, error: suggestionError } = await supabaseClient.getClient()
        .from('prompt_improvement_suggestions')
        .select('*, system_prompts!inner(*)')
        .eq('id', suggestionId)
        .single();

      if (suggestionError) {
        throw new Error(`Failed to get suggestion: ${suggestionError.message}`);
      }

      const suggestion = this.mapSuggestionFromDb(suggestionData);
      const prompt = suggestionData.system_prompts;

      // Apply the suggestion to the prompt content
      const updatedContent = this.applySuggestion(prompt.content, suggestion.suggestion, suggestion.suggestionType);

      // Update the prompt
      const { error: updateError } = await supabaseClient.getClient()
        .from('system_prompts')
        .update({
          content: updatedContent,
          updated_at: new Date()
        })
        .eq('id', prompt.id);

      if (updateError) {
        throw new Error(`Failed to update prompt: ${updateError.message}`);
      }

      // Mark suggestion as applied
      const { error: markError } = await supabaseClient.getClient()
        .from('prompt_improvement_suggestions')
        .update({
          is_applied: true,
          applied_at: new Date()
        })
        .eq('id', suggestionId);

      if (markError) {
        throw new Error(`Failed to mark suggestion as applied: ${markError.message}`);
      }

      return updatedContent;
    } catch (error) {
      logger.error(`Failed to apply improvement suggestion: ${error}`);
      throw error;
    }
  }

  /**
   * Fetch training data using a query
   * @param query SQL query to fetch training data
   * @returns Training data
   */
  private async fetchTrainingData(
    query: string
  ): Promise<{ promptId: string; features: Record<string, number>; successRate: number }[]> {
    try {
      // Execute the query
      const { data, error } = await supabaseClient.getClient().rpc('execute_query', { query_text: query });

      if (error) {
        throw new Error(`Failed to execute query: ${error.message}`);
      }

      // Transform the data
      return data.map((row: any) => ({
        promptId: row.prompt_id,
        features: row.features,
        successRate: row.success_rate
      }));
    } catch (error) {
      logger.error(`Failed to fetch training data: ${error}`);
      throw error;
    }
  }

  /**
   * Prepare training data
   * @param trainingData Training data
   * @returns Features and labels tensors
   */
  private prepareTrainingData(
    trainingData: { promptId: string; features: Record<string, number>; successRate: number }[]
  ): { features: tf.Tensor2D; labels: tf.Tensor2D } {
    // Extract feature names from the first item
    const featureNames = Object.keys(trainingData[0].features);

    // Convert to tensors
    const featureArrays = trainingData.map(item => {
      return featureNames.map(name => item.features[name] || 0);
    });

    const labelArrays = trainingData.map(item => [item.successRate / 100]); // Normalize to 0-1

    return {
      features: tf.tensor2d(featureArrays),
      labels: tf.tensor2d(labelArrays)
    };
  }

  /**
   * Create TensorFlow model
   * @param modelParameters Model parameters
   * @returns TensorFlow model
   */
  private createTFModel(modelParameters: Record<string, any>): tf.LayersModel {
    const inputShape = [modelParameters.inputDimension || 10];
    const hiddenLayers = modelParameters.hiddenLayers || [64, 32];
    const activation = modelParameters.activation || 'relu';
    const outputActivation = modelParameters.outputActivation || 'sigmoid';

    const model = tf.sequential();

    // Input layer
    model.add(tf.layers.dense({
      inputShape,
      units: hiddenLayers[0],
      activation
    }));

    // Hidden layers
    for (let i = 1; i < hiddenLayers.length; i++) {
      model.add(tf.layers.dense({
        units: hiddenLayers[i],
        activation
      }));
    }

    // Output layer
    model.add(tf.layers.dense({
      units: 1,
      activation: outputActivation
    }));

    // Compile the model
    model.compile({
      optimizer: modelParameters.optimizer || 'adam',
      loss: modelParameters.loss || 'meanSquaredError',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Train TensorFlow model
   * @param model TensorFlow model
   * @param features Features tensor
   * @param labels Labels tensor
   * @param modelParameters Model parameters
   * @returns Training history
   */
  private async trainTFModel(
    model: tf.LayersModel,
    features: tf.Tensor2D,
    labels: tf.Tensor2D,
    modelParameters: Record<string, any>
  ): Promise<tf.History> {
    const epochs = modelParameters.epochs || 100;
    const batchSize = modelParameters.batchSize || 32;
    const validationSplit = modelParameters.validationSplit || 0.2;

    return await model.fit(features, labels, {
      epochs,
      batchSize,
      validationSplit,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          logger.debug(`Epoch ${epoch}: loss = ${logs?.loss}, accuracy = ${logs?.acc}`);
        }
      }
    });
  }

  /**
   * Evaluate model
   * @param model TensorFlow model
   * @param features Features tensor
   * @param labels Labels tensor
   * @returns Evaluation metrics
   */
  private async evaluateModel(
    model: tf.LayersModel,
    features: tf.Tensor2D,
    labels: tf.Tensor2D
  ): Promise<{ accuracy: number; precision: number; recall: number; f1Score: number }> {
    // Make predictions
    const predictions = model.predict(features) as tf.Tensor;
    const predValues = await predictions.data();
    const labelValues = await labels.data();

    // Convert to binary for metrics calculation (threshold 0.5)
    const binaryPreds = Array.from(predValues).map(p => p > 0.5 ? 1 : 0);
    const binaryLabels = Array.from(labelValues).map(l => l > 0.5 ? 1 : 0);

    // Calculate metrics
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;

    for (let i = 0; i < binaryPreds.length; i++) {
      if (binaryPreds[i] === 1 && binaryLabels[i] === 1) truePositives++;
      if (binaryPreds[i] === 1 && binaryLabels[i] === 0) falsePositives++;
      if (binaryPreds[i] === 0 && binaryLabels[i] === 0) trueNegatives++;
      if (binaryPreds[i] === 0 && binaryLabels[i] === 1) falseNegatives++;
    }

    const accuracy = (truePositives + trueNegatives) / binaryPreds.length;
    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    const f1Score = 2 * precision * recall / (precision + recall) || 0;

    return { accuracy, precision, recall, f1Score };
  }

  /**
   * Serialize model to buffer
   * @param model TensorFlow model
   * @returns Model buffer
   */
  private async serializeModel(model: tf.LayersModel): Promise<Buffer> {
    // Save model to temp location
    const modelPath = 'file://./tmp/model';
    await model.save(modelPath);

    // Read the model files
    const fs = require('fs');
    const modelJson = fs.readFileSync('./tmp/model/model.json', 'utf8');
    const weightsData = fs.readFileSync('./tmp/model/weights.bin');

    // Create a buffer with model data
    const modelData = {
      modelJson,
      weightsData: Array.from(new Uint8Array(weightsData))
    };

    return Buffer.from(JSON.stringify(modelData));
  }

  /**
   * Load model from buffer
   * @param modelBuffer Model buffer
   * @returns TensorFlow model
   */
  private async loadModel(modelBuffer: Buffer): Promise<tf.LayersModel> {
    // Parse the buffer
    const modelData = JSON.parse(modelBuffer.toString());

    // Write model files to temp location
    const fs = require('fs');
    const path = require('path');

    const tempDir = './tmp/model';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    fs.writeFileSync(path.join(tempDir, 'model.json'), modelData.modelJson);
    fs.writeFileSync(path.join(tempDir, 'weights.bin'), Buffer.from(modelData.weightsData));

    // Load the model
    return await tf.loadLayersModel('file://./tmp/model/model.json');
  }

  /**
   * Extract features from prompt content
   * @param promptContent Prompt content
   * @param promptType Prompt type
   * @returns Extracted features
   */
  private extractFeatures(promptContent: string, promptType: string): FeatureExtractionResult {
    // Basic features
    const features: Record<string, number> = {
      length: promptContent.length,
      wordCount: promptContent.split(/\s+/).length,
      avgWordLength: promptContent.split(/\s+/).reduce((sum, word) => sum + word.length, 0) / promptContent.split(/\s+/).length,
      questionCount: (promptContent.match(/\?/g) || []).length,
      exclamationCount: (promptContent.match(/!/g) || []).length,
      uppercaseRatio: promptContent.split('').filter(c => c.match(/[A-Z]/)).length / promptContent.length,
      numericRatio: promptContent.split('').filter(c => c.match(/[0-9]/)).length / promptContent.length,
      specialCharRatio: promptContent.split('').filter(c => c.match(/[^a-zA-Z0-9\s]/)).length / promptContent.length
    };

    // Advanced features based on prompt type
    if (promptType === 'material_specific') {
      features.materialTerms = this.countTerms(promptContent, ['material', 'texture', 'color', 'pattern', 'finish']);
      features.instructionClarity = this.calculateInstructionClarity(promptContent);
    } else if (promptType === 'agent') {
      features.agentTerms = this.countTerms(promptContent, ['agent', 'task', 'goal', 'action', 'decision']);
      features.contextRichness = this.calculateContextRichness(promptContent);
    } else if (promptType === 'rag') {
      features.ragTerms = this.countTerms(promptContent, ['document', 'reference', 'source', 'information', 'context']);
      features.queryClarity = this.calculateQueryClarity(promptContent);
    }

    // Convert to feature vector
    const featureNames = Object.keys(features);
    const featureVector = featureNames.map(name => features[name]);

    return { features, featureVector };
  }

  /**
   * Count terms in prompt content
   * @param content Prompt content
   * @param terms Terms to count
   * @returns Term count
   */
  private countTerms(content: string, terms: string[]): number {
    const lowerContent = content.toLowerCase();
    return terms.reduce((count, term) => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      return count + (lowerContent.match(regex) || []).length;
    }, 0);
  }

  /**
   * Calculate instruction clarity
   * @param content Prompt content
   * @returns Instruction clarity score
   */
  private calculateInstructionClarity(content: string): number {
    // Simple heuristic based on instruction keywords
    const instructionKeywords = ['describe', 'explain', 'list', 'provide', 'generate', 'create', 'analyze'];
    const keywordCount = this.countTerms(content, instructionKeywords);

    // Check for step numbering
    const hasNumberedSteps = /\b\d+\.\s/.test(content);

    // Check for clear sections
    const hasSections = /\n\s*[A-Z][^a-z]+:/.test(content);

    return (keywordCount * 0.5) + (hasNumberedSteps ? 1 : 0) + (hasSections ? 1 : 0);
  }

  /**
   * Calculate context richness
   * @param content Prompt content
   * @returns Context richness score
   */
  private calculateContextRichness(content: string): number {
    // Check for context markers
    const contextMarkers = ['context', 'background', 'situation', 'scenario', 'environment'];
    const markerCount = this.countTerms(content, contextMarkers);

    // Check for detailed descriptions
    const hasDetailedDescriptions = content.includes(':') && content.split(':')[1].length > 50;

    // Check for examples
    const hasExamples = /\bexample[s]?:|\bfor example\b|\be\.g\.\b/i.test(content);

    return (markerCount * 0.5) + (hasDetailedDescriptions ? 1 : 0) + (hasExamples ? 1 : 0);
  }

  /**
   * Calculate query clarity
   * @param content Prompt content
   * @returns Query clarity score
   */
  private calculateQueryClarity(content: string): number {
    // Check for query keywords
    const queryKeywords = ['find', 'search', 'retrieve', 'query', 'look for', 'get'];
    const keywordCount = this.countTerms(content, queryKeywords);

    // Check for specific search terms
    const hasSpecificTerms = /\bspecific\b|\bexact\b|\bprecise\b/i.test(content);

    // Check for search constraints
    const hasConstraints = /\blimit\b|\bonly\b|\bexclude\b|\bnot\b/i.test(content);

    return (keywordCount * 0.5) + (hasSpecificTerms ? 1 : 0) + (hasConstraints ? 1 : 0);
  }

  /**
   * Calculate confidence
   * @param predictedSuccessRate Predicted success rate
   * @param modelAccuracy Model accuracy
   * @returns Confidence score
   */
  private calculateConfidence(predictedSuccessRate: number, modelAccuracy: number): number {
    // Base confidence on model accuracy
    let confidence = modelAccuracy * 100;

    // Adjust based on prediction extremity
    // Predictions closer to 0 or 100 are often less reliable
    const extremityPenalty = Math.abs(predictedSuccessRate - 50) / 50 * 10;
    confidence = Math.max(0, confidence - extremityPenalty);

    return confidence;
  }

  /**
   * Generate suggestions based on features
   * @param promptContent Prompt content
   * @param features Extracted features
   * @param promptType Prompt type
   * @returns Array of suggestions
   */
  private generateSuggestions(
    promptContent: string,
    features: Record<string, number>,
    promptType: string
  ): Array<{ type: string; text: string; predictedImprovement: number; confidence: number }> {
    const suggestions: Array<{ type: string; text: string; predictedImprovement: number; confidence: number }> = [];

    // Check length
    if (features.length < 100) {
      suggestions.push({
        type: 'length',
        text: 'Add more detail to the prompt. Short prompts often lack necessary context.',
        predictedImprovement: 15,
        confidence: 80
      });
    } else if (features.length > 500) {
      suggestions.push({
        type: 'length',
        text: 'Consider shortening the prompt. Very long prompts may contain unnecessary information.',
        predictedImprovement: 5,
        confidence: 60
      });
    }

    // Check clarity
    if (features.questionCount === 0) {
      suggestions.push({
        type: 'clarity',
        text: 'Add a clear question or request to the prompt to guide the response.',
        predictedImprovement: 20,
        confidence: 85
      });
    }

    // Type-specific suggestions
    if (promptType === 'material_specific' && features.materialTerms < 3) {
      suggestions.push({
        type: 'content',
        text: 'Include more specific material terms like texture, color, pattern, or finish.',
        predictedImprovement: 25,
        confidence: 90
      });
    } else if (promptType === 'agent' && features.contextRichness < 2) {
      suggestions.push({
        type: 'context',
        text: 'Provide more context about the task or goal for the agent.',
        predictedImprovement: 30,
        confidence: 85
      });
    } else if (promptType === 'rag' && features.queryClarity < 2) {
      suggestions.push({
        type: 'query',
        text: 'Make the search query more specific with clear search terms.',
        predictedImprovement: 35,
        confidence: 90
      });
    }

    // Structure suggestions
    if (!promptContent.includes('\n')) {
      suggestions.push({
        type: 'structure',
        text: 'Break the prompt into sections or paragraphs for better readability.',
        predictedImprovement: 10,
        confidence: 75
      });
    }

    return suggestions;
  }

  /**
   * Apply suggestion to prompt content
   * @param promptContent Original prompt content
   * @param suggestion Suggestion text
   * @param suggestionType Suggestion type
   * @returns Updated prompt content
   */
  private applySuggestion(promptContent: string, suggestion: string, suggestionType: string): string {
    let updatedContent = promptContent;

    switch (suggestionType) {
      case 'length':
        // For length suggestions, we can't automatically apply them
        // Just return the original content
        break;

      case 'clarity':
        // Add a clear question at the end
        if (!updatedContent.trim().endsWith('?')) {
          updatedContent += '\n\nPlease provide a detailed response to this request.';
        }
        break;

      case 'content':
        // Add a prompt for specific details
        updatedContent += '\n\nPlease include details about texture, color, pattern, and finish in your response.';
        break;

      case 'context':
        // Add a context section
        updatedContent += '\n\nContext: This information will be used to [purpose]. The target audience is [audience].';
        break;

      case 'query':
        // Add search guidance
        updatedContent += '\n\nPlease search for specific information about [topic] and exclude any unrelated results.';
        break;

      case 'structure':
        // Add structure by breaking into sections
        const sentences = updatedContent.split(/(?<=[.!?])\s+/);
        let structured = '';

        // Group sentences into paragraphs of 2-3 sentences
        for (let i = 0; i < sentences.length; i += 2) {
          const paragraph = sentences.slice(i, i + 2).join(' ');
          structured += paragraph + '\n\n';
        }

        updatedContent = structured.trim();
        break;
    }

    return updatedContent;
  }

  /**
   * Map database model to MLModelData
   * @param dbModel Database model
   * @returns Mapped model data
   */
  private mapModelFromDb(dbModel: any): MLModelData {
    return {
      id: dbModel.id,
      name: dbModel.name,
      description: dbModel.description,
      modelType: dbModel.model_type,
      modelParameters: dbModel.model_parameters,
      trainingDataQuery: dbModel.training_data_query,
      trainingMetrics: dbModel.training_metrics,
      isActive: dbModel.is_active,
      createdBy: dbModel.created_by,
      createdAt: new Date(dbModel.created_at),
      updatedAt: new Date(dbModel.updated_at)
    };
  }

  /**
   * Map database model version to MLModelVersionData
   * @param dbVersion Database model version
   * @returns Mapped model version data
   */
  private mapModelVersionFromDb(dbVersion: any): MLModelVersionData {
    return {
      id: dbVersion.id,
      modelId: dbVersion.model_id,
      versionNumber: dbVersion.version_number,
      modelData: dbVersion.model_data,
      accuracy: dbVersion.accuracy,
      precision: dbVersion.precision,
      recall: dbVersion.recall,
      f1Score: dbVersion.f1_score,
      trainingDate: new Date(dbVersion.training_date),
      isActive: dbVersion.is_active,
      createdBy: dbVersion.created_by,
      createdAt: new Date(dbVersion.created_at)
    };
  }

  /**
   * Map database prediction to MLPredictionData
   * @param dbPrediction Database prediction
   * @returns Mapped prediction data
   */
  private mapPredictionFromDb(dbPrediction: any): MLPredictionData {
    return {
      id: dbPrediction.id,
      promptId: dbPrediction.prompt_id,
      modelId: dbPrediction.model_id,
      modelVersionId: dbPrediction.model_version_id,
      predictedSuccessRate: dbPrediction.predicted_success_rate,
      predictionFeatures: dbPrediction.prediction_features,
      confidence: dbPrediction.confidence,
      createdAt: new Date(dbPrediction.created_at)
    };
  }

  /**
   * Map database suggestion to ImprovementSuggestionData
   * @param dbSuggestion Database suggestion
   * @returns Mapped suggestion data
   */
  private mapSuggestionFromDb(dbSuggestion: any): ImprovementSuggestionData {
    return {
      id: dbSuggestion.id,
      promptId: dbSuggestion.prompt_id,
      modelId: dbSuggestion.model_id,
      suggestionType: dbSuggestion.suggestion_type,
      suggestion: dbSuggestion.suggestion,
      predictedImprovement: dbSuggestion.predicted_improvement,
      confidence: dbSuggestion.confidence,
      isApplied: dbSuggestion.is_applied,
      appliedAt: dbSuggestion.applied_at ? new Date(dbSuggestion.applied_at) : undefined,
      createdAt: new Date(dbSuggestion.created_at)
    };
  }
}

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
   * @param userId User ID
   * @param modelId Model ID
   * @param trainingData Optional training data (if not provided, will use query from model)
   * @returns Model version ID
   */
  async trainModel(
    userId: string,
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

      // Train the model based on type
      let trainedModel: any;
      let trainingMetrics: Record<string, any>;
      let modelBuffer: Buffer;

      switch (model.modelType) {
        case 'neural_network':
          ({ trainedModel, trainingMetrics } = await this.trainNeuralNetwork(model.modelParameters, features, labels));
          modelBuffer = await this.serializeModel(trainedModel);
          break;
        case 'lstm':
          ({ trainedModel, trainingMetrics } = await this.trainNeuralNetwork(
            { ...model.modelParameters, modelType: 'lstm' },
            features,
            labels
          ));
          modelBuffer = await this.serializeModel(trainedModel);
          break;
        case 'transformer':
          ({ trainedModel, trainingMetrics } = await this.trainNeuralNetwork(
            { ...model.modelParameters, modelType: 'transformer' },
            features,
            labels
          ));
          modelBuffer = await this.serializeModel(trainedModel);
          break;
        case 'random_forest':
          ({ trainedModel, trainingMetrics } = await this.trainRandomForest(model.modelParameters, features, labels));
          modelBuffer = Buffer.from(JSON.stringify(trainedModel));
          break;
        case 'gradient_boosting':
          ({ trainedModel, trainingMetrics } = await this.trainGradientBoosting(model.modelParameters, features, labels));
          modelBuffer = Buffer.from(JSON.stringify(trainedModel));
          break;
        default:
          // Default to neural network
          ({ trainedModel, trainingMetrics } = await this.trainNeuralNetwork(model.modelParameters, features, labels));
          modelBuffer = await this.serializeModel(trainedModel);
      }

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
          accuracy: trainingMetrics.accuracy,
          precision: trainingMetrics.precision,
          recall: trainingMetrics.recall,
          f1_score: trainingMetrics.f1Score,
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
          training_metrics: trainingMetrics,
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
   * @param userId User ID
   * @param promptId Prompt ID
   * @param promptContent Prompt content
   * @param promptType Prompt type
   * @returns Prediction data
   */
  async predictPromptSuccess(
    userId: string,
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
      const modelType = modelData.model_type;

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

      // Extract features from the prompt
      const { features, featureVector } = this.extractFeatures(promptContent, promptType);

      // Make prediction based on model type
      let predictedSuccessRate: number;

      if (modelType === 'random_forest' || modelType === 'gradient_boosting') {
        // For traditional ML models, load from JSON
        if (!this.models.has(modelVersionId)) {
          const modelData = JSON.parse(versionData.model_data.toString());
          this.models.set(modelVersionId, modelData);
        }

        const classifier = this.models.get(modelVersionId)!;

        // Convert feature vector to array
        const featureArray = featureVector;

        // Make prediction
        const prediction = classifier.predict([featureArray]);
        predictedSuccessRate = prediction[0] * 100;
      } else {
        // For neural network models, load TensorFlow model
        if (!this.models.has(modelVersionId)) {
          const model = await this.loadModel(versionData.model_data);
          this.models.set(modelVersionId, model);
        }

        // Make prediction with TensorFlow model
        const tfModel = this.models.get(modelVersionId)!;
        const prediction = await tfModel.predict(tf.tensor2d([featureVector])) as tf.Tensor;
        predictedSuccessRate = (await prediction.data())[0] * 100;
      }

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
   * @param userId User ID
   * @param promptId Prompt ID
   * @param promptContent Prompt content
   * @param promptType Prompt type
   * @returns Array of improvement suggestions
   */
  async generateImprovementSuggestions(
    userId: string,
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
   * @param userId User ID
   * @param suggestionId Suggestion ID
   * @returns Updated prompt content
   */
  async applyImprovementSuggestion(userId: string, suggestionId: string): Promise<string> {
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
    const modelType = modelParameters.modelType || 'neural_network';

    switch (modelType) {
      case 'neural_network':
        return this.createNeuralNetwork(modelParameters);
      case 'lstm':
        return this.createLSTM(modelParameters);
      case 'transformer':
        return this.createTransformer(modelParameters);
      default:
        return this.createNeuralNetwork(modelParameters);
    }
  }

  /**
   * Create neural network model
   * @param modelParameters Model parameters
   * @returns Neural network model
   */
  private createNeuralNetwork(modelParameters: Record<string, any>): tf.LayersModel {
    const inputShape = [modelParameters.inputDimension || 10];
    const hiddenLayers = modelParameters.hiddenLayers || [64, 32];
    const activation = modelParameters.activation || 'relu';
    const outputActivation = modelParameters.outputActivation || 'sigmoid';
    const dropoutRate = modelParameters.dropoutRate || 0;

    const model = tf.sequential();

    // Input layer
    model.add(tf.layers.dense({
      inputShape,
      units: hiddenLayers[0],
      activation
    }));

    // Add dropout if specified
    if (dropoutRate > 0) {
      model.add(tf.layers.dropout({ rate: dropoutRate }));
    }

    // Hidden layers
    for (let i = 1; i < hiddenLayers.length; i++) {
      model.add(tf.layers.dense({
        units: hiddenLayers[i],
        activation
      }));

      // Add dropout if specified
      if (dropoutRate > 0) {
        model.add(tf.layers.dropout({ rate: dropoutRate }));
      }
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
   * Create LSTM model
   * @param modelParameters Model parameters
   * @returns LSTM model
   */
  private createLSTM(modelParameters: Record<string, any>): tf.LayersModel {
    const inputShape = [modelParameters.sequenceLength || 10, modelParameters.inputDimension || 10];
    const lstmUnits = modelParameters.lstmUnits || [64, 32];
    const activation = modelParameters.activation || 'tanh';
    const recurrentActivation = modelParameters.recurrentActivation || 'hardSigmoid';
    const outputActivation = modelParameters.outputActivation || 'sigmoid';
    const dropoutRate = modelParameters.dropoutRate || 0;
    const recurrentDropoutRate = modelParameters.recurrentDropoutRate || 0;

    const model = tf.sequential();

    // Input LSTM layer
    model.add(tf.layers.lstm({
      inputShape,
      units: lstmUnits[0],
      activation,
      recurrentActivation,
      returnSequences: lstmUnits.length > 1,
      dropout: dropoutRate,
      recurrentDropout: recurrentDropoutRate
    }));

    // Additional LSTM layers
    for (let i = 1; i < lstmUnits.length; i++) {
      model.add(tf.layers.lstm({
        units: lstmUnits[i],
        activation,
        recurrentActivation,
        returnSequences: i < lstmUnits.length - 1,
        dropout: dropoutRate,
        recurrentDropout: recurrentDropoutRate
      }));
    }

    // Dense output layer
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
   * Create Transformer model
   * @param modelParameters Model parameters
   * @returns Transformer model
   */
  private createTransformer(modelParameters: Record<string, any>): tf.LayersModel {
    const inputShape = [modelParameters.sequenceLength || 10, modelParameters.inputDimension || 10];
    const headSize = modelParameters.headSize || 64;
    const numHeads = modelParameters.numHeads || 4;
    const ffDim = modelParameters.ffDim || 128;
    const numTransformerBlocks = modelParameters.numTransformerBlocks || 2;
    const mlpUnits = modelParameters.mlpUnits || [64, 32];
    const dropoutRate = modelParameters.dropoutRate || 0.1;
    const outputActivation = modelParameters.outputActivation || 'sigmoid';

    const inputs = tf.input({ shape: [inputShape[0], inputShape[1]] });

    // Create transformer blocks
    let x = inputs;
    for (let i = 0; i < numTransformerBlocks; i++) {
      // Multi-head attention
      const attention = tf.layers.multiHeadAttention({
        numHeads,
        keyDim: headSize
      }).apply(x) as tf.SymbolicTensor;

      // Add & normalize
      const add1 = tf.layers.add().apply([x, attention]) as tf.SymbolicTensor;
      const layerNorm1 = tf.layers.layerNormalization().apply(add1) as tf.SymbolicTensor;

      // Feed-forward network
      const ffn1 = tf.layers.dense({ units: ffDim, activation: 'relu' }).apply(layerNorm1) as tf.SymbolicTensor;
      const ffn2 = tf.layers.dense({ units: inputShape[1] }).apply(ffn1) as tf.SymbolicTensor;

      // Add & normalize
      const add2 = tf.layers.add().apply([layerNorm1, ffn2]) as tf.SymbolicTensor;
      x = tf.layers.layerNormalization().apply(add2) as tf.SymbolicTensor;

      // Apply dropout
      if (dropoutRate > 0) {
        x = tf.layers.dropout({ rate: dropoutRate }).apply(x) as tf.SymbolicTensor;
      }
    }

    // Global average pooling
    x = tf.layers.globalAveragePooling1D().apply(x) as tf.SymbolicTensor;

    // MLP head
    for (const units of mlpUnits) {
      x = tf.layers.dense({ units, activation: 'relu' }).apply(x) as tf.SymbolicTensor;
      if (dropoutRate > 0) {
        x = tf.layers.dropout({ rate: dropoutRate }).apply(x) as tf.SymbolicTensor;
      }
    }

    // Output layer
    const outputs = tf.layers.dense({ units: 1, activation: outputActivation }).apply(x) as tf.SymbolicTensor;

    // Create and compile model
    const model = tf.model({ inputs, outputs });
    model.compile({
      optimizer: modelParameters.optimizer || 'adam',
      loss: modelParameters.loss || 'binaryCrossentropy',
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
   * Train neural network
   * @param modelParameters Model parameters
   * @param features Features tensor
   * @param labels Labels tensor
   * @returns Trained model and metrics
   */
  private async trainNeuralNetwork(
    modelParameters: Record<string, any>,
    features: tf.Tensor2D,
    labels: tf.Tensor2D
  ): Promise<{ trainedModel: any; trainingMetrics: Record<string, any> }> {
    try {
      // Create model
      const model = this.createNeuralNetwork(modelParameters);

      // Apply transfer learning if specified
      if (modelParameters.transferLearning && modelParameters.baseModelId) {
        await this.applyTransferLearning(model, modelParameters.baseModelId);
      }

      // Split data for validation if needed
      let trainFeatures = features;
      let trainLabels = labels;
      let valFeatures: tf.Tensor2D | null = null;
      let valLabels: tf.Tensor2D | null = null;

      if (modelParameters.useValidationSet) {
        const validationSplit = modelParameters.validationSplit || 0.2;
        const splitIndex = Math.floor(features.shape[0] * (1 - validationSplit));

        // Split the data
        trainFeatures = features.slice([0, 0], [splitIndex, features.shape[1]]) as tf.Tensor2D;
        trainLabels = labels.slice([0, 0], [splitIndex, labels.shape[1]]) as tf.Tensor2D;
        valFeatures = features.slice([splitIndex, 0], [-1, features.shape[1]]) as tf.Tensor2D;
        valLabels = labels.slice([splitIndex, 0], [-1, labels.shape[1]]) as tf.Tensor2D;
      }

      // Train model
      const epochs = modelParameters.epochs || 100;
      const batchSize = modelParameters.batchSize || 32;
      const validationSplit = modelParameters.useValidationSet ? 0 : (modelParameters.validationSplit || 0.2);

      const callbacks = [
        tf.callbacks.earlyStopping({
          monitor: 'val_loss',
          patience: modelParameters.earlyStoppingPatience || 10,
          minDelta: 0.001,
          verbose: 1
        })
      ];

      if (modelParameters.useLearningRateScheduler) {
        callbacks.push(
          tf.callbacks.learningRateScheduler((epoch) => {
            const initialLr = modelParameters.learningRate || 0.001;
            const decay = modelParameters.learningRateDecay || 0.1;
            return initialLr * Math.pow(decay, Math.floor(epoch / 10));
          })
        );
      }

      const history = await model.fit(
        trainFeatures,
        trainLabels,
        {
          epochs,
          batchSize,
          validationSplit,
          validationData: modelParameters.useValidationSet ? [valFeatures, valLabels] : undefined,
          callbacks: {
            onEpochEnd: (epoch, logs) => {
              logger.debug(`Epoch ${epoch}: loss = ${logs?.loss}, accuracy = ${logs?.acc}`);
            },
            ...callbacks
          }
        }
      );

      // Evaluate model
      const metrics = await this.evaluateModel(model, features, labels);

      // Calculate feature importance if requested
      let featureImportance = {};
      if (modelParameters.calculateFeatureImportance) {
        featureImportance = await this.calculateFeatureImportance(model, features, labels);
      }

      // Add training history to metrics
      const trainingMetrics = {
        ...metrics,
        history: {
          loss: history.history.loss,
          accuracy: history.history.acc,
          valLoss: history.history.val_loss,
          valAccuracy: history.history.val_acc
        },
        featureImportance
      };

      return {
        trainedModel: model,
        trainingMetrics
      };
    } catch (error) {
      logger.error(`Failed to train neural network: ${error}`);
      throw error;
    }
  }

  /**
   * Apply transfer learning from a base model
   * @param model Target model
   * @param baseModelId Base model ID
   */
  private async applyTransferLearning(model: tf.LayersModel, baseModelId: string): Promise<void> {
    try {
      // Get the base model
      const { data, error } = await supabaseClient.getClient()
        .from('prompt_ml_model_versions')
        .select('model_data')
        .eq('model_id', baseModelId)
        .eq('is_active', true)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        throw new Error(`Failed to get base model: ${error.message}`);
      }

      if (!data) {
        throw new Error(`Base model not found: ${baseModelId}`);
      }

      // Load the base model
      const baseModel = await this.loadModel(data.model_data);

      // Copy weights from base model to target model
      // Only copy weights for layers with matching shapes
      const baseWeights = baseModel.getWeights();
      const targetWeights = model.getWeights();

      for (let i = 0; i < Math.min(baseWeights.length, targetWeights.length); i++) {
        const baseWeight = baseWeights[i];
        const targetWeight = targetWeights[i];

        // Check if shapes match
        if (baseWeight.shape.toString() === targetWeight.shape.toString()) {
          targetWeight.assign(baseWeight);
        }
      }

      // Set the weights on the target model
      model.setWeights(targetWeights);
    } catch (error) {
      logger.error(`Failed to apply transfer learning: ${error}`);
      throw error;
    }
  }

  /**
   * Calculate feature importance
   * @param model Trained model
   * @param features Features tensor
   * @param labels Labels tensor
   * @returns Feature importance scores
   */
  private async calculateFeatureImportance(
    model: tf.LayersModel,
    features: tf.Tensor2D,
    labels: tf.Tensor2D
  ): Promise<Record<string, number>> {
    try {
      // Get baseline prediction
      const baseline = model.predict(features) as tf.Tensor;
      const baselineValues = await baseline.data();

      // Get feature names
      const featureCount = features.shape[1];
      const featureNames = Array.from({ length: featureCount }, (_, i) => `feature_${i}`);

      // Calculate importance for each feature
      const importance: Record<string, number> = {};

      for (let i = 0; i < featureCount; i++) {
        // Create a copy of features with the current feature permuted
        const permutedFeatures = features.clone();
        const featureValues = await features.slice([0, i], [-1, 1]).data();

        // Shuffle the feature values
        const shuffledValues = tf.tensor1d(this.shuffleArray(Array.from(featureValues)));

        // Replace the feature column with shuffled values
        const updated = permutedFeatures.slice([0, i], [-1, 1]).assign(shuffledValues.reshape([-1, 1]));

        // Predict with permuted features
        const permutedPrediction = model.predict(permutedFeatures) as tf.Tensor;
        const permutedValues = await permutedPrediction.data();

        // Calculate mean absolute difference
        let totalDiff = 0;
        for (let j = 0; j < baselineValues.length; j++) {
          totalDiff += Math.abs(baselineValues[j] - permutedValues[j]);
        }

        // Store importance score
        importance[featureNames[i]] = totalDiff / baselineValues.length;

        // Clean up tensors
        permutedFeatures.dispose();
        shuffledValues.dispose();
        permutedPrediction.dispose();
      }

      // Clean up baseline tensor
      baseline.dispose();

      return importance;
    } catch (error) {
      logger.error(`Failed to calculate feature importance: ${error}`);
      return {};
    }
  }

  /**
   * Shuffle array
   * @param array Array to shuffle
   * @returns Shuffled array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Train Random Forest model
   * @param modelParameters Model parameters
   * @param features Features array
   * @param labels Labels array
   * @returns Trained model and metrics
   */
  private async trainRandomForest(
    modelParameters: Record<string, any>,
    features: tf.Tensor2D,
    labels: tf.Tensor2D
  ): Promise<{ trainedModel: any; trainingMetrics: Record<string, any> }> {
    try {
      // Convert tensors to arrays
      const featureArrays = await features.array();
      const labelArrays = await labels.array();
      const labelValues = labelArrays.map(l => l[0]);

      // Split data into training and validation sets
      const validationSplit = modelParameters.validationSplit || 0.2;
      const splitIndex = Math.floor(featureArrays.length * (1 - validationSplit));

      const trainFeatures = featureArrays.slice(0, splitIndex);
      const trainLabels = labelValues.slice(0, splitIndex);
      const valFeatures = featureArrays.slice(splitIndex);
      const valLabels = labelValues.slice(splitIndex);

      // Create and train Random Forest model
      const RandomForest = require('ml-random-forest');

      const rfOptions = {
        seed: 42,
        nEstimators: modelParameters.nEstimators || 100,
        maxDepth: modelParameters.maxDepth || 10,
        minSamplesSplit: modelParameters.minSamplesSplit || 2,
        maxFeatures: modelParameters.maxFeatures || 'sqrt',
        replacement: modelParameters.replacement !== false,
        treeOptions: {
          gainFunction: modelParameters.gainFunction || 'gini',
          maxDepth: modelParameters.maxDepth || 10,
          minNumSamples: modelParameters.minNumSamples || 3
        }
      };

      // Train the model
      const classifier = new RandomForest.RandomForestClassifier(rfOptions);
      classifier.train(trainFeatures, trainLabels.map(l => l > 0.5 ? 1 : 0));

      // Make predictions on validation set
      const predictions = classifier.predict(valFeatures);

      // Calculate metrics
      const metrics = this.calculateMetrics(predictions, valLabels.map(l => l > 0.5 ? 1 : 0));

      return {
        trainedModel: classifier,
        trainingMetrics: metrics
      };
    } catch (error) {
      logger.error(`Failed to train Random Forest model: ${error}`);
      throw error;
    }
  }

  /**
   * Train Gradient Boosting model
   * @param modelParameters Model parameters
   * @param features Features array
   * @param labels Labels array
   * @returns Trained model and metrics
   */
  private async trainGradientBoosting(
    modelParameters: Record<string, any>,
    features: tf.Tensor2D,
    labels: tf.Tensor2D
  ): Promise<{ trainedModel: any; trainingMetrics: Record<string, any> }> {
    try {
      // Convert tensors to arrays
      const featureArrays = await features.array();
      const labelArrays = await labels.array();
      const labelValues = labelArrays.map(l => l[0]);

      // Split data into training and validation sets
      const validationSplit = modelParameters.validationSplit || 0.2;
      const splitIndex = Math.floor(featureArrays.length * (1 - validationSplit));

      const trainFeatures = featureArrays.slice(0, splitIndex);
      const trainLabels = labelValues.slice(0, splitIndex);
      const valFeatures = featureArrays.slice(splitIndex);
      const valLabels = labelValues.slice(splitIndex);

      // Create and train Gradient Boosting model
      const GradientBoosting = require('ml-gradient-boosting');

      const gbOptions = {
        seed: 42,
        nEstimators: modelParameters.nEstimators || 100,
        maxDepth: modelParameters.maxDepth || 5,
        minSamplesSplit: modelParameters.minSamplesSplit || 2,
        maxFeatures: modelParameters.maxFeatures || 'sqrt',
        learningRate: modelParameters.learningRate || 0.1,
        subsample: modelParameters.subsample || 1.0,
        treeOptions: {
          gainFunction: modelParameters.gainFunction || 'gini',
          maxDepth: modelParameters.maxDepth || 5,
          minNumSamples: modelParameters.minNumSamples || 3
        }
      };

      // Train the model
      const classifier = new GradientBoosting.GradientBoostingClassifier(gbOptions);
      classifier.train(trainFeatures, trainLabels.map(l => l > 0.5 ? 1 : 0));

      // Make predictions on validation set
      const predictions = classifier.predict(valFeatures);

      // Calculate metrics
      const metrics = this.calculateMetrics(predictions, valLabels.map(l => l > 0.5 ? 1 : 0));

      return {
        trainedModel: classifier,
        trainingMetrics: metrics
      };
    } catch (error) {
      logger.error(`Failed to train Gradient Boosting model: ${error}`);
      throw error;
    }
  }

  /**
   * Calculate metrics for traditional ML models
   * @param predictions Predicted values
   * @param actual Actual values
   * @returns Metrics object
   */
  private calculateMetrics(predictions: number[], actual: number[]): Record<string, number> {
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;

    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === 1 && actual[i] === 1) truePositives++;
      if (predictions[i] === 1 && actual[i] === 0) falsePositives++;
      if (predictions[i] === 0 && actual[i] === 0) trueNegatives++;
      if (predictions[i] === 0 && actual[i] === 1) falseNegatives++;
    }

    const accuracy = (truePositives + trueNegatives) / predictions.length;
    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    const f1Score = 2 * precision * recall / (precision + recall) || 0;

    return { accuracy, precision, recall, f1Score };
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
      specialCharRatio: promptContent.split('').filter(c => c.match(/[^a-zA-Z0-9\s]/)).length / promptContent.length,
      sentenceCount: (promptContent.match(/[.!?]+\s+|\n|$/g) || []).length,
      avgSentenceLength: promptContent.length / ((promptContent.match(/[.!?]+\s+|\n|$/g) || []).length || 1),
      paragraphCount: (promptContent.match(/\n\s*\n/g) || []).length + 1,
      bulletPointCount: (promptContent.match(/^[\s]*[-*•][\s]+/gm) || []).length,
      numberListCount: (promptContent.match(/^[\s]*\d+\.[\s]+/gm) || []).length
    };

    // Structural features
    features.hasHeadings = /^#+\s+.+$/m.test(promptContent) ? 1 : 0;
    features.hasCodeBlocks = /```[\s\S]*?```/.test(promptContent) ? 1 : 0;
    features.hasQuotes = /^>[\s\S]*?$/m.test(promptContent) ? 1 : 0;
    features.hasLinks = /\[.*?\]\(.*?\)/.test(promptContent) ? 1 : 0;
    features.hasEmphasis = /\*\*.*?\*\*|\*.*?\*|__.*?__|_.*?_/.test(promptContent) ? 1 : 0;
    features.structureScore = features.hasHeadings + features.hasCodeBlocks + features.hasQuotes +
                             features.hasLinks + features.hasEmphasis +
                             (features.bulletPointCount > 0 ? 1 : 0) +
                             (features.numberListCount > 0 ? 1 : 0);

    // Readability metrics
    features.fleschKincaidScore = this.calculateFleschKincaidScore(promptContent);
    features.fogIndex = this.calculateFogIndex(promptContent);

    // Semantic features
    features.exampleCount = this.countExamples(promptContent);
    features.definitionCount = this.countDefinitions(promptContent);
    features.conditionalCount = this.countConditionals(promptContent);
    features.instructionCount = this.countInstructions(promptContent);

    // Advanced features based on prompt type
    if (promptType === 'material_specific') {
      // Material-specific terms
      const materialTerms = [
        'material', 'texture', 'color', 'pattern', 'finish', 'surface', 'grain', 'tone',
        'hue', 'shade', 'tint', 'gloss', 'matte', 'satin', 'rough', 'smooth', 'polished',
        'natural', 'synthetic', 'organic', 'inorganic', 'composite', 'blend', 'mixture',
        'ceramic', 'metal', 'wood', 'glass', 'plastic', 'fabric', 'leather', 'stone',
        'concrete', 'brick', 'tile', 'marble', 'granite', 'quartz', 'limestone', 'slate'
      ];
      features.materialTerms = this.countTerms(promptContent, materialTerms);
      features.materialTermRatio = features.materialTerms / features.wordCount;
      features.instructionClarity = this.calculateInstructionClarity(promptContent);
      features.specificationDetail = this.calculateSpecificationDetail(promptContent);
      features.visualDescriptors = this.countVisualDescriptors(promptContent);
    } else if (promptType === 'agent') {
      // Agent-specific terms
      const agentTerms = [
        'agent', 'task', 'goal', 'action', 'decision', 'plan', 'strategy', 'objective',
        'mission', 'target', 'outcome', 'result', 'success', 'failure', 'constraint',
        'requirement', 'condition', 'environment', 'state', 'observation', 'perception',
        'knowledge', 'belief', 'intention', 'desire', 'preference', 'utility', 'reward',
        'penalty', 'cost', 'benefit', 'risk', 'uncertainty', 'probability', 'likelihood'
      ];
      features.agentTerms = this.countTerms(promptContent, agentTerms);
      features.agentTermRatio = features.agentTerms / features.wordCount;
      features.contextRichness = this.calculateContextRichness(promptContent);
      features.goalClarity = this.calculateGoalClarity(promptContent);
      features.constraintSpecificity = this.calculateConstraintSpecificity(promptContent);
    } else if (promptType === 'rag') {
      // RAG-specific terms
      const ragTerms = [
        'document', 'reference', 'source', 'information', 'context', 'retrieve', 'search',
        'query', 'find', 'locate', 'extract', 'summarize', 'analyze', 'compare', 'contrast',
        'database', 'knowledge base', 'corpus', 'collection', 'repository', 'archive',
        'index', 'catalog', 'library', 'resource', 'material', 'content', 'data', 'text',
        'article', 'paper', 'book', 'chapter', 'section', 'paragraph', 'sentence', 'phrase'
      ];
      features.ragTerms = this.countTerms(promptContent, ragTerms);
      features.ragTermRatio = features.ragTerms / features.wordCount;
      features.queryClarity = this.calculateQueryClarity(promptContent);
      features.searchSpecificity = this.calculateSearchSpecificity(promptContent);
      features.contextualConstraints = this.countContextualConstraints(promptContent);
    } else if (promptType === 'general') {
      // General purpose features
      features.instructionClarity = this.calculateInstructionClarity(promptContent);
      features.contextRichness = this.calculateContextRichness(promptContent);
      features.queryClarity = this.calculateQueryClarity(promptContent);
      features.generalPurposeScore = (features.instructionClarity + features.contextRichness + features.queryClarity) / 3;
    }

    // Convert to feature vector
    const featureNames = Object.keys(features);
    const featureVector = featureNames.map(name => features[name]);

    return { features, featureVector };
  }

  /**
   * Calculate Flesch-Kincaid readability score
   * @param text Text to analyze
   * @returns Flesch-Kincaid score
   */
  private calculateFleschKincaidScore(text: string): number {
    const sentences = text.split(/[.!?]+\s+|\n|$/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.trim().length > 0);
    const syllables = words.reduce((count, word) => count + this.countSyllables(word), 0);

    if (sentences.length === 0 || words.length === 0) return 0;

    // Flesch-Kincaid formula: 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)
    const score = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length);

    // Normalize to 0-10 range
    return Math.max(0, Math.min(10, score / 10));
  }

  /**
   * Calculate Gunning Fog Index
   * @param text Text to analyze
   * @returns Gunning Fog Index
   */
  private calculateFogIndex(text: string): number {
    const sentences = text.split(/[.!?]+\s+|\n|$/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.trim().length > 0);

    if (sentences.length === 0 || words.length === 0) return 0;

    // Count complex words (3+ syllables)
    const complexWords = words.filter(word => this.countSyllables(word) >= 3);

    // Gunning Fog formula: 0.4 * ((words / sentences) + 100 * (complexWords / words))
    const score = 0.4 * ((words.length / sentences.length) + 100 * (complexWords.length / words.length));

    // Normalize to 0-10 range
    return Math.max(0, Math.min(10, score / 20));
  }

  /**
   * Count syllables in a word
   * @param word Word to count syllables in
   * @returns Syllable count
   */
  private countSyllables(word: string): number {
    word = word.toLowerCase().replace(/[^a-z]/g, '');

    // Special cases
    if (word.length <= 3) return 1;

    // Count vowel groups
    const vowelGroups = word.match(/[aeiouy]+/g) || [];
    let count = vowelGroups.length;

    // Adjust for special cases
    if (word.endsWith('e')) count--;
    if (word.endsWith('le') && word.length > 2 && !['a', 'e', 'i', 'o', 'u', 'y'].includes(word[word.length - 3])) count++;
    if (word.endsWith('es') || word.endsWith('ed')) count--;

    // Ensure at least one syllable
    return Math.max(1, count);
  }

  /**
   * Count examples in text
   * @param text Text to analyze
   * @returns Example count
   */
  private countExamples(text: string): number {
    const examplePatterns = [
      /for example/gi,
      /e\.g\./gi,
      /such as/gi,
      /like this:/gi,
      /example:/gi,
      /here's an example/gi,
      /for instance/gi
    ];

    return examplePatterns.reduce((count, pattern) => {
      const matches = text.match(pattern) || [];
      return count + matches.length;
    }, 0);
  }

  /**
   * Count definitions in text
   * @param text Text to analyze
   * @returns Definition count
   */
  private countDefinitions(text: string): number {
    const definitionPatterns = [
      /is defined as/gi,
      /refers to/gi,
      /means/gi,
      /is a/gi,
      /are a/gi,
      /definition:/gi,
      /:\s*[A-Z]/g
    ];

    return definitionPatterns.reduce((count, pattern) => {
      const matches = text.match(pattern) || [];
      return count + matches.length;
    }, 0);
  }

  /**
   * Count conditionals in text
   * @param text Text to analyze
   * @returns Conditional count
   */
  private countConditionals(text: string): number {
    const conditionalPatterns = [
      /if\s+.+\s+then/gi,
      /if\s+.+,/gi,
      /when\s+.+,/gi,
      /unless/gi,
      /otherwise/gi,
      /in case/gi,
      /assuming/gi,
      /provided that/gi
    ];

    return conditionalPatterns.reduce((count, pattern) => {
      const matches = text.match(pattern) || [];
      return count + matches.length;
    }, 0);
  }

  /**
   * Count instructions in text
   * @param text Text to analyze
   * @returns Instruction count
   */
  private countInstructions(text: string): number {
    const instructionPatterns = [
      /please/gi,
      /should/gi,
      /must/gi,
      /need to/gi,
      /have to/gi,
      /required to/gi,
      /^do\s+/gim,
      /^don't\s+/gim,
      /^avoid\s+/gim,
      /^ensure\s+/gim
    ];

    return instructionPatterns.reduce((count, pattern) => {
      const matches = text.match(pattern) || [];
      return count + matches.length;
    }, 0);
  }

  /**
   * Calculate specification detail
   * @param content Prompt content
   * @returns Specification detail score
   */
  private calculateSpecificationDetail(content: string): number {
    // Check for specific measurements
    const hasMeasurements = /\d+\s*(mm|cm|m|inch|ft|px|%)/i.test(content);

    // Check for color specifications
    const hasColorSpecs = /#[0-9A-Fa-f]{3,6}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/i.test(content);

    // Check for material properties
    const materialProperties = [
      'density', 'hardness', 'strength', 'durability', 'flexibility',
      'conductivity', 'resistance', 'reflectivity', 'opacity', 'transparency'
    ];
    const hasMaterialProps = this.countTerms(content, materialProperties) > 0;

    // Check for comparison terms
    const comparisonTerms = [
      'similar to', 'like', 'resembling', 'comparable to', 'in contrast to',
      'different from', 'unlike', 'versus', 'as opposed to'
    ];
    const hasComparisons = this.countTerms(content, comparisonTerms) > 0;

    return (hasMeasurements ? 1 : 0) +
           (hasColorSpecs ? 1 : 0) +
           (hasMaterialProps ? 1 : 0) +
           (hasComparisons ? 1 : 0);
  }

  /**
   * Count visual descriptors
   * @param content Prompt content
   * @returns Visual descriptor count
   */
  private countVisualDescriptors(content: string): number {
    const visualDescriptors = [
      'shiny', 'matte', 'glossy', 'textured', 'smooth', 'rough', 'bumpy', 'grainy',
      'polished', 'brushed', 'distressed', 'weathered', 'aged', 'new', 'fresh',
      'bright', 'dark', 'light', 'vibrant', 'dull', 'faded', 'saturated', 'desaturated',
      'transparent', 'translucent', 'opaque', 'reflective', 'non-reflective',
      'patterned', 'solid', 'striped', 'spotted', 'checkered', 'floral', 'geometric'
    ];

    return this.countTerms(content, visualDescriptors);
  }

  /**
   * Calculate goal clarity
   * @param content Prompt content
   * @returns Goal clarity score
   */
  private calculateGoalClarity(content: string): number {
    // Check for goal statements
    const goalStatements = [
      'goal is', 'objective is', 'aim is', 'purpose is', 'task is',
      'should achieve', 'needs to accomplish', 'must complete',
      'success means', 'successful when'
    ];
    const hasGoalStatement = this.countTerms(content, goalStatements) > 0;

    // Check for measurable outcomes
    const measurableOutcomes = [
      'measure', 'metric', 'kpi', 'indicator', 'benchmark',
      'target', 'threshold', 'minimum', 'maximum', 'optimal'
    ];
    const hasMeasurableOutcomes = this.countTerms(content, measurableOutcomes) > 0;

    // Check for time constraints
    const timeConstraints = [
      'by', 'within', 'before', 'after', 'during',
      'deadline', 'timeframe', 'schedule', 'timeline'
    ];
    const hasTimeConstraints = this.countTerms(content, timeConstraints) > 0;

    // Check for priority indicators
    const priorityIndicators = [
      'priority', 'important', 'critical', 'essential', 'crucial',
      'primary', 'secondary', 'tertiary', 'first', 'last'
    ];
    const hasPriorityIndicators = this.countTerms(content, priorityIndicators) > 0;

    return (hasGoalStatement ? 1 : 0) +
           (hasMeasurableOutcomes ? 1 : 0) +
           (hasTimeConstraints ? 1 : 0) +
           (hasPriorityIndicators ? 1 : 0);
  }

  /**
   * Calculate constraint specificity
   * @param content Prompt content
   * @returns Constraint specificity score
   */
  private calculateConstraintSpecificity(content: string): number {
    // Check for constraint statements
    const constraintStatements = [
      'constraint', 'limitation', 'restriction', 'boundary', 'limit',
      'cannot', 'must not', 'should not', 'avoid', 'prevent'
    ];
    const hasConstraintStatement = this.countTerms(content, constraintStatements) > 0;

    // Check for resource limitations
    const resourceLimitations = [
      'budget', 'cost', 'time', 'resource', 'personnel',
      'equipment', 'material', 'space', 'capacity'
    ];
    const hasResourceLimitations = this.countTerms(content, resourceLimitations) > 0;

    // Check for rule specifications
    const ruleSpecifications = [
      'rule', 'policy', 'procedure', 'protocol', 'guideline',
      'standard', 'regulation', 'law', 'code', 'requirement'
    ];
    const hasRuleSpecifications = this.countTerms(content, ruleSpecifications) > 0;

    // Check for conditional constraints
    const conditionalConstraints = [
      'if', 'when', 'unless', 'only if', 'except when',
      'provided that', 'assuming that', 'in case'
    ];
    const hasConditionalConstraints = this.countTerms(content, conditionalConstraints) > 0;

    return (hasConstraintStatement ? 1 : 0) +
           (hasResourceLimitations ? 1 : 0) +
           (hasRuleSpecifications ? 1 : 0) +
           (hasConditionalConstraints ? 1 : 0);
  }

  /**
   * Calculate search specificity
   * @param content Prompt content
   * @returns Search specificity score
   */
  private calculateSearchSpecificity(content: string): number {
    // Check for search terms
    const searchTerms = [
      'search for', 'find', 'locate', 'retrieve', 'get',
      'query for', 'look up', 'seek', 'hunt for'
    ];
    const hasSearchTerms = this.countTerms(content, searchTerms) > 0;

    // Check for specific entities
    const specificEntities = /\"[^\"]+\"|\'[^\']+\'|\[[^\]]+\]|\([^\)]+\)/g;
    const hasSpecificEntities = (content.match(specificEntities) || []).length > 0;

    // Check for filter terms
    const filterTerms = [
      'filter', 'where', 'containing', 'that has', 'with',
      'excluding', 'without', 'except', 'not including'
    ];
    const hasFilterTerms = this.countTerms(content, filterTerms) > 0;

    // Check for sort/order terms
    const sortTerms = [
      'sort', 'order', 'rank', 'arrange', 'organize',
      'by date', 'by relevance', 'by importance', 'ascending', 'descending'
    ];
    const hasSortTerms = this.countTerms(content, sortTerms) > 0;

    return (hasSearchTerms ? 1 : 0) +
           (hasSpecificEntities ? 1 : 0) +
           (hasFilterTerms ? 1 : 0) +
           (hasSortTerms ? 1 : 0);
  }

  /**
   * Count contextual constraints
   * @param content Prompt content
   * @returns Contextual constraint count
   */
  private countContextualConstraints(content: string): number {
    const contextualConstraints = [
      'only from', 'limited to', 'restricted to', 'within the context of',
      'in the domain of', 'in the field of', 'in the area of',
      'from sources', 'from documents', 'from the database',
      'published', 'authored', 'created', 'dated', 'between', 'after', 'before'
    ];

    return this.countTerms(content, contextualConstraints);
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

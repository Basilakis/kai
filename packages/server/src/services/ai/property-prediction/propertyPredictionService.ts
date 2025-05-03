/**
 * Property Prediction Service
 * 
 * This service uses AI models to predict property values based on other properties,
 * enhanced with relationship data from the Property Relationship Graph.
 */

import { relationshipFeatureExtractor } from './relationshipFeatureExtractor';
import { logger } from '../../../utils/logger';
import * as tf from '@tensorflow/tfjs-node';
import { supabase } from '../../../config/supabase';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Property Prediction Service
 */
export class PropertyPredictionService {
  /**
   * Train a model to predict a property based on other properties
   * 
   * @param materialType The type of material
   * @param targetProperty The property to predict
   * @param options Training options
   * @returns The ID of the trained model
   */
  public async trainModel(
    materialType: string,
    targetProperty: string,
    options: {
      sampleSize?: number;
      epochs?: number;
      batchSize?: number;
      validationSplit?: number;
    } = {}
  ): Promise<string> {
    try {
      logger.info(`Training model for ${targetProperty} (${materialType})`);
      
      // Generate training data with relationship features
      const trainingData = await relationshipFeatureExtractor.generateTrainingData(
        materialType,
        targetProperty,
        options.sampleSize || 1000
      );
      
      if (trainingData.length === 0) {
        throw new Error('Failed to generate training data');
      }
      
      // Extract feature names and target values
      const featureNames = Object.keys(trainingData[0].features);
      const targetValues = [...new Set(trainingData.map(item => item.label))];
      
      // Convert training data to tensors
      const { xs, ys } = this.convertToTensors(trainingData, featureNames, targetValues);
      
      // Create and train the model
      const model = await this.createAndTrainModel(
        xs,
        ys,
        featureNames.length,
        targetValues.length,
        {
          epochs: options.epochs || 50,
          batchSize: options.batchSize || 32,
          validationSplit: options.validationSplit || 0.2
        }
      );
      
      // Generate model ID
      const modelId = uuidv4();
      
      // Create model directory
      const modelDir = path.join(process.cwd(), 'data', 'models', modelId);
      fs.mkdirSync(modelDir, { recursive: true });
      
      // Save model metadata
      const metadata = {
        id: modelId,
        materialType,
        targetProperty,
        featureNames,
        targetValues,
        createdAt: new Date().toISOString(),
        options: {
          sampleSize: options.sampleSize || 1000,
          epochs: options.epochs || 50,
          batchSize: options.batchSize || 32,
          validationSplit: options.validationSplit || 0.2
        }
      };
      
      fs.writeFileSync(
        path.join(modelDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );
      
      // Save model
      await model.save(`file://${modelDir}/model`);
      
      // Register model in database
      await this.registerModel(modelId, materialType, targetProperty);
      
      logger.info(`Trained model ${modelId} for ${targetProperty} (${materialType})`);
      
      return modelId;
    } catch (error) {
      logger.error('Failed to train model', { error });
      throw error;
    }
  }
  
  /**
   * Predict a property value based on other properties
   * 
   * @param modelId The ID of the model to use
   * @param properties The current property values
   * @returns Predicted property values with probabilities
   */
  public async predictProperty(
    modelId: string,
    properties: Record<string, string>
  ): Promise<Array<{
    value: string;
    probability: number;
  }>> {
    try {
      // Load model metadata
      const modelDir = path.join(process.cwd(), 'data', 'models', modelId);
      const metadataPath = path.join(modelDir, 'metadata.json');
      
      if (!fs.existsSync(metadataPath)) {
        throw new Error(`Model ${modelId} not found`);
      }
      
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      const { materialType, targetProperty, featureNames, targetValues } = metadata;
      
      // Extract relationship features
      const relationshipFeatures = await relationshipFeatureExtractor.extractFeatures(
        materialType,
        properties,
        targetProperty
      );
      
      // Combine properties and relationship features
      const features = {
        ...properties,
        ...relationshipFeatures
      };
      
      // Convert features to tensor
      const featuresTensor = this.convertFeaturesToTensor(features, featureNames);
      
      // Load model
      const model = await tf.loadLayersModel(`file://${modelDir}/model/model.json`);
      
      // Make prediction
      const prediction = model.predict(featuresTensor) as tf.Tensor;
      const probabilities = await prediction.array() as number[][];
      
      // Convert probabilities to predictions
      const predictions = probabilities[0].map((probability, index) => ({
        value: targetValues[index],
        probability
      }));
      
      // Sort by probability (highest first)
      predictions.sort((a, b) => b.probability - a.probability);
      
      // Enhance predictions with relationship data
      const enhancedPredictions = await relationshipFeatureExtractor.enhancePredictions(
        materialType,
        properties,
        targetProperty,
        predictions
      );
      
      // Return top predictions
      return enhancedPredictions.map(({ value, probability }) => ({
        value,
        probability
      }));
    } catch (error) {
      logger.error('Failed to predict property', { error });
      throw error;
    }
  }
  
  /**
   * Convert training data to tensors
   */
  private convertToTensors(
    data: Array<{
      features: Record<string, number | string>;
      label: string;
    }>,
    featureNames: string[],
    targetValues: string[]
  ): { xs: tf.Tensor2D; ys: tf.Tensor2D } {
    // Create arrays for features and labels
    const xsData: number[][] = [];
    const ysData: number[][] = [];
    
    // Process each training example
    for (const example of data) {
      // Convert features to array
      const featureArray: number[] = [];
      
      for (const featureName of featureNames) {
        const value = example.features[featureName];
        
        if (typeof value === 'number') {
          featureArray.push(value);
        } else if (typeof value === 'string') {
          // One-hot encode string values
          // This is a simplified approach - in a real system, you would use a more sophisticated encoding
          featureArray.push(1); // Placeholder
        } else {
          featureArray.push(0); // Default for missing values
        }
      }
      
      xsData.push(featureArray);
      
      // One-hot encode the label
      const labelArray = new Array(targetValues.length).fill(0);
      const labelIndex = targetValues.indexOf(example.label);
      
      if (labelIndex >= 0) {
        labelArray[labelIndex] = 1;
      }
      
      ysData.push(labelArray);
    }
    
    // Convert to tensors
    const xs = tf.tensor2d(xsData);
    const ys = tf.tensor2d(ysData);
    
    return { xs, ys };
  }
  
  /**
   * Convert features to tensor
   */
  private convertFeaturesToTensor(
    features: Record<string, number | string>,
    featureNames: string[]
  ): tf.Tensor2D {
    // Convert features to array
    const featureArray: number[] = [];
    
    for (const featureName of featureNames) {
      const value = features[featureName];
      
      if (typeof value === 'number') {
        featureArray.push(value);
      } else if (typeof value === 'string') {
        // One-hot encode string values
        // This is a simplified approach - in a real system, you would use a more sophisticated encoding
        featureArray.push(1); // Placeholder
      } else {
        featureArray.push(0); // Default for missing values
      }
    }
    
    // Convert to tensor
    return tf.tensor2d([featureArray]);
  }
  
  /**
   * Create and train a model
   */
  private async createAndTrainModel(
    xs: tf.Tensor2D,
    ys: tf.Tensor2D,
    inputSize: number,
    outputSize: number,
    options: {
      epochs: number;
      batchSize: number;
      validationSplit: number;
    }
  ): Promise<tf.LayersModel> {
    // Create a sequential model
    const model = tf.sequential();
    
    // Add layers
    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu',
      inputShape: [inputSize]
    }));
    
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu'
    }));
    
    model.add(tf.layers.dense({
      units: outputSize,
      activation: 'softmax'
    }));
    
    // Compile the model
    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    // Train the model
    await model.fit(xs, ys, {
      epochs: options.epochs,
      batchSize: options.batchSize,
      validationSplit: options.validationSplit,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          logger.info(`Epoch ${epoch + 1}: loss = ${logs?.loss.toFixed(4)}, accuracy = ${logs?.acc.toFixed(4)}`);
        }
      }
    });
    
    return model;
  }
  
  /**
   * Register a model in the database
   */
  private async registerModel(
    modelId: string,
    materialType: string,
    targetProperty: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .getClient()
        .from('ml_models')
        .insert({
          id: modelId,
          name: `${targetProperty}-predictor-${materialType}`,
          type: 'property-prediction',
          version: '1.0.0',
          storage_path: `models/${modelId}`,
          metadata: {
            materialType,
            targetProperty,
            source: 'property-relationship-graph'
          },
          is_active: true
        });
      
      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error('Failed to register model', { error });
      throw error;
    }
  }
}

// Export a singleton instance
export const propertyPredictionService = new PropertyPredictionService();

/**
 * Cross-Property Model Module
 * 
 * This module provides functionality for training and using models
 * that can recognize multiple properties at once.
 */

import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { logger } from '../utils/logger';
import { MaterialType } from '../utils/material-type-detector';

/**
 * Cross-Property Model Configuration
 */
export interface CrossPropertyModelConfig {
  id: string;
  name: string;
  description?: string;
  materialType: MaterialType;
  properties: string[];
  modelPath?: string;
  createdAt: Date;
  lastTrainedAt?: Date;
  accuracy?: Record<string, number>;
  trainingDataSize?: number;
  parameters?: Record<string, any>;
}

/**
 * Cross-Property Prediction Result
 */
export interface CrossPropertyPredictionResult {
  predictions: Record<string, {
    value: string;
    confidence: number;
  }>;
  processingTime: number;
}

/**
 * Create a cross-property model configuration
 * 
 * @param name The name of the model
 * @param materialType The type of material
 * @param properties The properties to include in the model
 * @param description Optional description of the model
 * @returns The model configuration
 */
export async function createCrossPropertyModel(
  name: string,
  materialType: MaterialType,
  properties: string[],
  description?: string
): Promise<CrossPropertyModelConfig> {
  try {
    logger.info(`Creating cross-property model: ${name} (${materialType})`);
    
    if (properties.length < 2) {
      throw new Error('At least two properties are required for a cross-property model');
    }
    
    // Create model ID
    const id = `cross-${materialType}-${Date.now()}`;
    
    // Create model configuration
    const config: CrossPropertyModelConfig = {
      id,
      name,
      description,
      materialType,
      properties,
      createdAt: new Date()
    };
    
    // Create model directory
    const modelsDir = path.join(process.cwd(), 'models', 'cross-property');
    fs.mkdirSync(modelsDir, { recursive: true });
    
    // Save model configuration
    const configPath = path.join(modelsDir, `${id}.json`);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    return config;
  } catch (error) {
    logger.error(`Error creating cross-property model: ${error}`);
    throw error;
  }
}

/**
 * Get a cross-property model configuration
 * 
 * @param modelId The ID of the model
 * @returns The model configuration
 */
export async function getCrossPropertyModel(
  modelId: string
): Promise<CrossPropertyModelConfig> {
  try {
    logger.info(`Getting cross-property model: ${modelId}`);
    
    // Get model configuration
    const configPath = path.join(process.cwd(), 'models', 'cross-property', `${modelId}.json`);
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Model not found: ${modelId}`);
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    return config;
  } catch (error) {
    logger.error(`Error getting cross-property model: ${error}`);
    throw error;
  }
}

/**
 * Get all cross-property models
 * 
 * @param materialType Optional material type filter
 * @returns The list of model configurations
 */
export async function getAllCrossPropertyModels(
  materialType?: MaterialType
): Promise<CrossPropertyModelConfig[]> {
  try {
    logger.info(`Getting all cross-property models`);
    
    // Get models directory
    const modelsDir = path.join(process.cwd(), 'models', 'cross-property');
    
    if (!fs.existsSync(modelsDir)) {
      return [];
    }
    
    // Read all model configuration files
    const configFiles = fs.readdirSync(modelsDir).filter(file => file.endsWith('.json'));
    
    const models: CrossPropertyModelConfig[] = [];
    
    for (const file of configFiles) {
      const configPath = path.join(modelsDir, file);
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // Apply material type filter
      if (materialType && config.materialType !== materialType) {
        continue;
      }
      
      models.push(config);
    }
    
    return models;
  } catch (error) {
    logger.error(`Error getting all cross-property models: ${error}`);
    throw error;
  }
}

/**
 * Train a cross-property model
 * 
 * @param modelId The ID of the model
 * @param options Training options
 * @returns The updated model configuration
 */
export async function trainCrossPropertyModel(
  modelId: string,
  options: {
    epochs?: number;
    batchSize?: number;
    learningRate?: number;
    useTransferLearning?: boolean;
    useDataAugmentation?: boolean;
  } = {}
): Promise<CrossPropertyModelConfig> {
  try {
    logger.info(`Training cross-property model: ${modelId}`);
    
    // Get model configuration
    const config = await getCrossPropertyModel(modelId);
    
    // Set default options
    const epochs = options.epochs || 20;
    const batchSize = options.batchSize || 32;
    const learningRate = options.learningRate || 0.001;
    const useTransferLearning = options.useTransferLearning !== undefined ? options.useTransferLearning : true;
    const useDataAugmentation = options.useDataAugmentation !== undefined ? options.useDataAugmentation : true;
    
    // Create model directory
    const modelDir = path.join(process.cwd(), 'models', 'cross-property', modelId);
    fs.mkdirSync(modelDir, { recursive: true });
    
    // Create temporary config file
    const trainingConfigPath = path.join(process.cwd(), 'temp', 'cross-property-training-config.json');
    fs.mkdirSync(path.dirname(trainingConfigPath), { recursive: true });
    
    const trainingConfig = {
      modelId,
      materialType: config.materialType,
      properties: config.properties,
      modelDir,
      epochs,
      batchSize,
      learningRate,
      useTransferLearning,
      useDataAugmentation
    };
    
    fs.writeFileSync(trainingConfigPath, JSON.stringify(trainingConfig, null, 2));
    
    // Run Python script
    const scriptPath = path.join(__dirname, '..', 'python', 'train_cross_property_model.py');
    
    const result = await new Promise<any>((resolve, reject) => {
      const process = spawn('python', [scriptPath, trainingConfigPath]);
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Script failed with code ${code}: ${stderr}`));
          return;
        }
        
        try {
          // Parse results
          const results = JSON.parse(stdout);
          
          // Clean up
          fs.unlinkSync(trainingConfigPath);
          
          resolve(results);
        } catch (error) {
          reject(new Error(`Error parsing results: ${error}`));
        }
      });
    });
    
    // Update model configuration
    config.modelPath = path.join(modelDir, 'model.h5');
    config.lastTrainedAt = new Date();
    config.accuracy = result.accuracy;
    config.trainingDataSize = result.trainingDataSize;
    config.parameters = {
      epochs: result.epochs,
      batchSize,
      learningRate,
      useTransferLearning,
      useDataAugmentation
    };
    
    // Save updated configuration
    const configPath = path.join(process.cwd(), 'models', 'cross-property', `${modelId}.json`);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    return config;
  } catch (error) {
    logger.error(`Error training cross-property model: ${error}`);
    throw error;
  }
}

/**
 * Predict properties using a cross-property model
 * 
 * @param modelId The ID of the model
 * @param imagePath The path to the image
 * @returns The prediction result
 */
export async function predictWithCrossPropertyModel(
  modelId: string,
  imagePath: string
): Promise<CrossPropertyPredictionResult> {
  try {
    logger.info(`Predicting with cross-property model: ${modelId}`);
    
    // Get model configuration
    const config = await getCrossPropertyModel(modelId);
    
    if (!config.modelPath) {
      throw new Error(`Model not trained: ${modelId}`);
    }
    
    // Create temporary config file
    const predictionConfigPath = path.join(process.cwd(), 'temp', 'cross-property-prediction-config.json');
    fs.mkdirSync(path.dirname(predictionConfigPath), { recursive: true });
    
    const predictionConfig = {
      modelPath: config.modelPath,
      properties: config.properties,
      imagePath
    };
    
    fs.writeFileSync(predictionConfigPath, JSON.stringify(predictionConfig, null, 2));
    
    // Run Python script
    const scriptPath = path.join(__dirname, '..', 'python', 'predict_cross_property.py');
    
    const result = await new Promise<any>((resolve, reject) => {
      const process = spawn('python', [scriptPath, predictionConfigPath]);
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Script failed with code ${code}: ${stderr}`));
          return;
        }
        
        try {
          // Parse results
          const results = JSON.parse(stdout);
          
          // Clean up
          fs.unlinkSync(predictionConfigPath);
          
          resolve(results);
        } catch (error) {
          reject(new Error(`Error parsing results: ${error}`));
        }
      });
    });
    
    return {
      predictions: result.predictions,
      processingTime: result.processingTime
    };
  } catch (error) {
    logger.error(`Error predicting with cross-property model: ${error}`);
    throw error;
  }
}

/**
 * Delete a cross-property model
 * 
 * @param modelId The ID of the model
 */
export async function deleteCrossPropertyModel(
  modelId: string
): Promise<void> {
  try {
    logger.info(`Deleting cross-property model: ${modelId}`);
    
    // Get model configuration
    const configPath = path.join(process.cwd(), 'models', 'cross-property', `${modelId}.json`);
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Model not found: ${modelId}`);
    }
    
    // Delete model directory
    const modelDir = path.join(process.cwd(), 'models', 'cross-property', modelId);
    
    if (fs.existsSync(modelDir)) {
      fs.rmSync(modelDir, { recursive: true, force: true });
    }
    
    // Delete configuration file
    fs.unlinkSync(configPath);
  } catch (error) {
    logger.error(`Error deleting cross-property model: ${error}`);
    throw error;
  }
}

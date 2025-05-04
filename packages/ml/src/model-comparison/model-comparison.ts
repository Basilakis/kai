/**
 * Model Comparison Module
 * 
 * This module provides functionality for comparing different models
 * for the same property.
 */

import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { logger } from '../utils/logger';
import { MaterialType } from '../utils/material-type-detector';

/**
 * Model Comparison Result
 */
export interface ModelComparisonResult {
  propertyName: string;
  materialType: MaterialType;
  models: ModelInfo[];
  comparisonMetrics: {
    accuracyDifference: number;
    confusionMatrix?: number[][];
    disagreementRate: number;
    disagreementExamples: DisagreementExample[];
  };
  bestModel: string;
  recommendation: string;
}

/**
 * Model Information
 */
export interface ModelInfo {
  modelId: string;
  modelPath: string;
  version: string;
  trainedAt: Date;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  trainingDataSize: number;
  trainingTime: number;
  parameters: Record<string, any>;
}

/**
 * Disagreement Example
 */
export interface DisagreementExample {
  imagePath: string;
  actualValue?: string;
  predictions: {
    modelId: string;
    predictedValue: string;
    confidence: number;
  }[];
}

/**
 * Compare models for a specific property
 * 
 * @param propertyName The name of the property
 * @param materialType The type of material
 * @param modelIds The IDs of the models to compare
 * @param testDataDir Optional path to test data directory
 * @returns The comparison result
 */
export async function compareModels(
  propertyName: string,
  materialType: MaterialType,
  modelIds: string[],
  testDataDir?: string
): Promise<ModelComparisonResult> {
  try {
    logger.info(`Comparing models for ${propertyName} (${materialType}): ${modelIds.join(', ')}`);
    
    if (modelIds.length < 2) {
      throw new Error('At least two models are required for comparison');
    }
    
    // Get model information
    const models: ModelInfo[] = [];
    
    for (const modelId of modelIds) {
      const modelInfo = await getModelInfo(propertyName, materialType, modelId);
      models.push(modelInfo);
    }
    
    // Prepare test data if not provided
    const testDataPath = testDataDir || await prepareTestData(propertyName, materialType);
    
    // Run comparison script
    const comparisonResult = await runComparisonScript(models, testDataPath);
    
    // Determine the best model
    const bestModel = determineBestModel(models, comparisonResult);
    
    // Generate recommendation
    const recommendation = generateRecommendation(models, comparisonResult, bestModel);
    
    return {
      propertyName,
      materialType,
      models,
      comparisonMetrics: comparisonResult,
      bestModel,
      recommendation
    };
  } catch (error) {
    logger.error(`Error comparing models: ${error}`);
    throw error;
  }
}

/**
 * Get model information
 * 
 * @param propertyName The name of the property
 * @param materialType The type of material
 * @param modelId The ID of the model
 * @returns The model information
 */
async function getModelInfo(
  propertyName: string,
  materialType: MaterialType,
  modelId: string
): Promise<ModelInfo> {
  try {
    // Get model directory
    const modelDir = path.join(process.cwd(), 'models', 'visual-references', materialType, propertyName, modelId);
    
    // Check if model exists
    if (!fs.existsSync(modelDir)) {
      throw new Error(`Model not found: ${modelId}`);
    }
    
    // Read model metadata
    const metadataPath = path.join(modelDir, 'metadata.json');
    
    if (!fs.existsSync(metadataPath)) {
      throw new Error(`Model metadata not found: ${metadataPath}`);
    }
    
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    
    return {
      modelId,
      modelPath: path.join(modelDir, 'model.h5'),
      version: metadata.version || '1.0.0',
      trainedAt: new Date(metadata.trainedAt || Date.now()),
      accuracy: metadata.accuracy || 0,
      precision: metadata.precision || 0,
      recall: metadata.recall || 0,
      f1Score: metadata.f1Score || 0,
      trainingDataSize: metadata.trainingDataSize || 0,
      trainingTime: metadata.trainingTime || 0,
      parameters: metadata.parameters || {}
    };
  } catch (error) {
    logger.error(`Error getting model info: ${error}`);
    throw error;
  }
}

/**
 * Prepare test data for model comparison
 * 
 * @param propertyName The name of the property
 * @param materialType The type of material
 * @returns The path to the test data directory
 */
async function prepareTestData(
  propertyName: string,
  materialType: MaterialType
): Promise<string> {
  try {
    // Create test data directory
    const testDataDir = path.join(process.cwd(), 'data', 'test', materialType, propertyName);
    fs.mkdirSync(testDataDir, { recursive: true });
    
    // Check if test data already exists
    if (fs.readdirSync(testDataDir).length > 0) {
      logger.info(`Using existing test data in ${testDataDir}`);
      return testDataDir;
    }
    
    // Create test data from validation set
    const validationDataDir = path.join(process.cwd(), 'data', 'validation', materialType, propertyName);
    
    if (!fs.existsSync(validationDataDir)) {
      throw new Error(`Validation data not found: ${validationDataDir}`);
    }
    
    // Copy validation data to test data directory
    const classes = fs.readdirSync(validationDataDir);
    
    for (const cls of classes) {
      const classDir = path.join(validationDataDir, cls);
      const testClassDir = path.join(testDataDir, cls);
      
      if (fs.statSync(classDir).isDirectory()) {
        fs.mkdirSync(testClassDir, { recursive: true });
        
        const files = fs.readdirSync(classDir);
        
        for (const file of files) {
          const sourcePath = path.join(classDir, file);
          const targetPath = path.join(testClassDir, file);
          
          fs.copyFileSync(sourcePath, targetPath);
        }
      }
    }
    
    logger.info(`Created test data in ${testDataDir}`);
    return testDataDir;
  } catch (error) {
    logger.error(`Error preparing test data: ${error}`);
    throw error;
  }
}

/**
 * Run comparison script
 * 
 * @param models The models to compare
 * @param testDataPath The path to the test data
 * @returns The comparison metrics
 */
async function runComparisonScript(
  models: ModelInfo[],
  testDataPath: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      // Create temporary config file
      const configPath = path.join(process.cwd(), 'temp', 'model-comparison-config.json');
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      
      const config = {
        models: models.map(model => ({
          id: model.modelId,
          path: model.modelPath
        })),
        testDataPath
      };
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      // Run Python script
      const scriptPath = path.join(__dirname, '..', 'python', 'model_comparison.py');
      
      const process = spawn('python', [scriptPath, configPath]);
      
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
          reject(new Error(`Comparison script failed with code ${code}: ${stderr}`));
          return;
        }
        
        try {
          // Parse results
          const results = JSON.parse(stdout);
          
          // Clean up
          fs.unlinkSync(configPath);
          
          resolve(results);
        } catch (error) {
          reject(new Error(`Error parsing comparison results: ${error}`));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Determine the best model
 * 
 * @param models The models to compare
 * @param comparisonResult The comparison result
 * @returns The ID of the best model
 */
function determineBestModel(
  models: ModelInfo[],
  comparisonResult: any
): string {
  // Sort models by F1 score (primary) and accuracy (secondary)
  const sortedModels = [...models].sort((a, b) => {
    if (a.f1Score !== b.f1Score) {
      return b.f1Score - a.f1Score;
    }
    
    return b.accuracy - a.accuracy;
  });
  
  return sortedModels[0].modelId;
}

/**
 * Generate recommendation
 * 
 * @param models The models to compare
 * @param comparisonResult The comparison result
 * @param bestModelId The ID of the best model
 * @returns The recommendation
 */
function generateRecommendation(
  models: ModelInfo[],
  comparisonResult: any,
  bestModelId: string
): string {
  const bestModel = models.find(model => model.modelId === bestModelId)!;
  const otherModels = models.filter(model => model.modelId !== bestModelId);
  
  // Generate recommendation
  let recommendation = `Model ${bestModelId} is recommended for production use with an accuracy of ${(bestModel.accuracy * 100).toFixed(1)}% and F1 score of ${(bestModel.f1Score * 100).toFixed(1)}%.`;
  
  // Add comparison with other models
  if (otherModels.length > 0) {
    const comparisons = otherModels.map(model => {
      const accuracyDiff = (bestModel.accuracy - model.accuracy) * 100;
      const f1Diff = (bestModel.f1Score - model.f1Score) * 100;
      
      return `It outperforms model ${model.modelId} by ${accuracyDiff.toFixed(1)}% in accuracy and ${f1Diff.toFixed(1)}% in F1 score.`;
    });
    
    recommendation += ` ${comparisons.join(' ')}`;
  }
  
  // Add disagreement information
  if (comparisonResult.disagreementRate > 0.1) {
    recommendation += ` However, there is a ${(comparisonResult.disagreementRate * 100).toFixed(1)}% disagreement rate between models, suggesting that further training with more diverse data might be beneficial.`;
  } else {
    recommendation += ` The models show good agreement with only ${(comparisonResult.disagreementRate * 100).toFixed(1)}% disagreement rate.`;
  }
  
  return recommendation;
}

/**
 * Get model versions for a specific property
 * 
 * @param propertyName The name of the property
 * @param materialType The type of material
 * @returns The list of model versions
 */
export async function getModelVersions(
  propertyName: string,
  materialType: MaterialType
): Promise<string[]> {
  try {
    // Get model directory
    const modelBaseDir = path.join(process.cwd(), 'models', 'visual-references', materialType, propertyName);
    
    // Check if directory exists
    if (!fs.existsSync(modelBaseDir)) {
      return [];
    }
    
    // Get subdirectories (model versions)
    const entries = fs.readdirSync(modelBaseDir, { withFileTypes: true });
    const versions = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
    
    return versions;
  } catch (error) {
    logger.error(`Error getting model versions: ${error}`);
    throw error;
  }
}

/**
 * Create a new model version
 * 
 * @param propertyName The name of the property
 * @param materialType The type of material
 * @param sourceModelId The ID of the source model to copy
 * @returns The ID of the new model version
 */
export async function createModelVersion(
  propertyName: string,
  materialType: MaterialType,
  sourceModelId?: string
): Promise<string> {
  try {
    // Get model directory
    const modelBaseDir = path.join(process.cwd(), 'models', 'visual-references', materialType, propertyName);
    
    // Create directory if it doesn't exist
    fs.mkdirSync(modelBaseDir, { recursive: true });
    
    // Generate new model ID
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
    const newModelId = `model_${timestamp}`;
    
    // Create new model directory
    const newModelDir = path.join(modelBaseDir, newModelId);
    fs.mkdirSync(newModelDir, { recursive: true });
    
    // If source model is provided, copy it
    if (sourceModelId) {
      const sourceModelDir = path.join(modelBaseDir, sourceModelId);
      
      if (!fs.existsSync(sourceModelDir)) {
        throw new Error(`Source model not found: ${sourceModelId}`);
      }
      
      // Copy model files
      const files = fs.readdirSync(sourceModelDir);
      
      for (const file of files) {
        const sourcePath = path.join(sourceModelDir, file);
        const targetPath = path.join(newModelDir, file);
        
        if (fs.statSync(sourcePath).isFile()) {
          fs.copyFileSync(sourcePath, targetPath);
        }
      }
      
      // Update metadata
      const metadataPath = path.join(newModelDir, 'metadata.json');
      
      if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        
        metadata.version = metadata.version ? incrementVersion(metadata.version) : '1.0.0';
        metadata.trainedAt = new Date().toISOString();
        metadata.sourceModelId = sourceModelId;
        
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      }
    } else {
      // Create empty metadata
      const metadata = {
        version: '1.0.0',
        trainedAt: new Date().toISOString(),
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        trainingDataSize: 0,
        trainingTime: 0,
        parameters: {}
      };
      
      fs.writeFileSync(path.join(newModelDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
    }
    
    return newModelId;
  } catch (error) {
    logger.error(`Error creating model version: ${error}`);
    throw error;
  }
}

/**
 * Increment version string
 * 
 * @param version The version string (e.g., "1.0.0")
 * @returns The incremented version string
 */
function incrementVersion(version: string): string {
  const parts = version.split('.');
  
  if (parts.length !== 3) {
    return '1.0.0';
  }
  
  const major = parseInt(parts[0]);
  const minor = parseInt(parts[1]);
  const patch = parseInt(parts[2]) + 1;
  
  return `${major}.${minor}.${patch}`;
}

/**
 * Delete a model version
 * 
 * @param propertyName The name of the property
 * @param materialType The type of material
 * @param modelId The ID of the model to delete
 */
export async function deleteModelVersion(
  propertyName: string,
  materialType: MaterialType,
  modelId: string
): Promise<void> {
  try {
    // Get model directory
    const modelDir = path.join(process.cwd(), 'models', 'visual-references', materialType, propertyName, modelId);
    
    // Check if model exists
    if (!fs.existsSync(modelDir)) {
      throw new Error(`Model not found: ${modelId}`);
    }
    
    // Delete model directory
    fs.rmSync(modelDir, { recursive: true, force: true });
  } catch (error) {
    logger.error(`Error deleting model version: ${error}`);
    throw error;
  }
}

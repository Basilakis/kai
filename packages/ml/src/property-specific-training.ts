/**
 * Property-Specific Training Module
 * 
 * This module provides functions for training models to recognize specific material properties
 * from visual references. It's used as part of the Visual Reference Library feature.
 */

import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { logger } from './utils/logger';
import { 
  getMetadataFieldsByMaterialType, 
  MetadataField 
} from './utils/metadata-field-utils';
import { MaterialType } from './utils/material-type-detector';

// Get Python scripts directory
const PYTHON_SCRIPTS_DIR = path.join(__dirname, '..', 'python');

/**
 * Interface for property-specific training options
 */
export interface PropertySpecificTrainingOptions {
  propertyName: string;
  materialType: MaterialType;
  trainingDataDir: string;
  modelOutputDir: string;
  modelType?: 'classification' | 'regression' | 'detection';
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  apiBaseUrl?: string;
  apiKey?: string;
  validationSplit?: number;
  augmentation?: boolean;
  transferLearning?: boolean;
  baseModel?: string;
}

/**
 * Interface for property-specific training result
 */
export interface PropertySpecificTrainingResult {
  propertyName: string;
  materialType: MaterialType;
  accuracy: number;
  loss: number;
  modelPath: string;
  trainingTime: number;
  epochs: number;
  validationAccuracy?: number;
  validationLoss?: number;
  confusionMatrix?: number[][];
  classLabels?: string[];
  propertyMetadata?: {
    fieldType: string;
    options?: Array<{ value: string; label: string }>;
    validation?: {
      min?: number;
      max?: number;
      step?: number;
    };
    unit?: string;
  };
}

/**
 * Train a model for a specific property
 * 
 * @param options Training options
 * @returns Promise with training results
 */
export async function trainModelForProperty(
  options: PropertySpecificTrainingOptions
): Promise<PropertySpecificTrainingResult> {
  const {
    propertyName,
    materialType,
    trainingDataDir,
    modelOutputDir,
    modelType = 'classification',
    epochs = 20,
    batchSize = 32,
    learningRate = 0.001,
    apiBaseUrl,
    apiKey,
    validationSplit = 0.2,
    augmentation = true,
    transferLearning = true,
    baseModel = 'efficientnet'
  } = options;
  
  logger.info(`Starting property-specific training for ${propertyName} (${materialType})`, {
    propertyName,
    materialType,
    modelType,
    epochs,
    batchSize
  });
  
  try {
    // Get metadata field information
    const metadataFields = await getMetadataFieldsByMaterialType(materialType, apiBaseUrl, apiKey);
    const propertyField = metadataFields.find(field => field.name === propertyName);
    
    if (!propertyField) {
      throw new Error(`Property ${propertyName} not found for material type ${materialType}`);
    }
    
    logger.info(`Found metadata field for ${propertyName}`, {
      fieldType: propertyField.fieldType,
      isRequired: propertyField.isRequired,
      options: propertyField.options?.length || 0
    });
    
    // Determine model type based on field type if not specified
    const inferredModelType = getModelTypeForField(propertyField);
    const finalModelType = modelType || inferredModelType;
    
    // Create output directory if it doesn't exist
    const propertyOutputDir = path.join(modelOutputDir, materialType, propertyName);
    fs.mkdirSync(propertyOutputDir, { recursive: true });
    
    // Save property metadata
    const metadataPath = path.join(propertyOutputDir, 'property_metadata.json');
    const propertyMetadata = {
      name: propertyField.name,
      displayName: propertyField.displayName,
      description: propertyField.description,
      fieldType: propertyField.fieldType,
      options: propertyField.options,
      validation: propertyField.validation,
      unit: propertyField.unit,
      materialType
    };
    
    fs.writeFileSync(metadataPath, JSON.stringify(propertyMetadata, null, 2));
    
    // Run the Python script for property-specific training
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'property_specific_trainer.py');
    
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', [
        scriptPath,
        '--property', propertyName,
        '--material-type', materialType,
        '--data-dir', trainingDataDir,
        '--output-dir', propertyOutputDir,
        '--model-type', finalModelType,
        '--epochs', epochs.toString(),
        '--batch-size', batchSize.toString(),
        '--learning-rate', learningRate.toString(),
        '--validation-split', validationSplit.toString(),
        '--metadata-path', metadataPath,
        ...(augmentation ? ['--augmentation'] : []),
        ...(transferLearning ? ['--transfer-learning'] : []),
        '--base-model', baseModel
      ]);
      
      let resultData = '';
      let errorData = '';
      
      // Collect data from stdout
      pythonProcess.stdout.on('data', (data: Buffer) => {
        resultData += data.toString();
      });
      
      // Collect data from stderr
      pythonProcess.stderr.on('data', (data: Buffer) => {
        errorData += data.toString();
        logger.warn(`Training stderr: ${data.toString()}`);
      });
      
      // Handle process completion
      pythonProcess.on('close', (code: number) => {
        if (code !== 0) {
          logger.error(`Training process exited with code ${code}`, { errorData });
          reject(new Error(`Training process failed: ${errorData}`));
          return;
        }
        
        try {
          // Parse the result
          const result = JSON.parse(resultData);
          
          // Add property name and material type to result
          result.propertyName = propertyName;
          result.materialType = materialType;
          
          logger.info(`Training completed successfully for ${propertyName} (${materialType})`, {
            accuracy: result.accuracy,
            loss: result.loss,
            trainingTime: result.trainingTime
          });
          
          resolve(result);
        } catch (error) {
          logger.error('Failed to parse training result', { error, resultData });
          reject(new Error(`Failed to parse training result: ${error}`));
        }
      });
    });
  } catch (error) {
    logger.error(`Error in property-specific training for ${propertyName}`, { error });
    throw error;
  }
}

/**
 * Train models for multiple properties
 * 
 * @param properties Array of property names to train models for
 * @param materialType Material type
 * @param baseOptions Base training options (without propertyName)
 * @returns Promise with training results for each property
 */
export async function trainModelsForProperties(
  properties: string[],
  materialType: MaterialType,
  baseOptions: Omit<PropertySpecificTrainingOptions, 'propertyName' | 'materialType'>
): Promise<Record<string, PropertySpecificTrainingResult>> {
  const results: Record<string, PropertySpecificTrainingResult> = {};
  
  logger.info(`Starting training for ${properties.length} properties of ${materialType}`, { properties });
  
  for (const propertyName of properties) {
    try {
      // Create property-specific output directory
      const propertyOutputDir = path.join(baseOptions.modelOutputDir, materialType, propertyName);
      
      // Train model for this property
      const result = await trainModelForProperty({
        ...baseOptions,
        propertyName,
        materialType,
        modelOutputDir: baseOptions.modelOutputDir
      });
      
      results[propertyName] = result;
    } catch (error) {
      logger.error(`Error training model for ${propertyName}`, { error });
      results[propertyName] = {
        propertyName,
        materialType,
        accuracy: 0,
        loss: 0,
        modelPath: '',
        trainingTime: 0,
        epochs: 0,
        error: error instanceof Error ? error.message : String(error)
      } as any;
    }
  }
  
  return results;
}

/**
 * Get appropriate model type for a metadata field
 * 
 * @param field Metadata field
 * @returns Model type ('classification', 'regression', or 'detection')
 */
function getModelTypeForField(field: MetadataField): 'classification' | 'regression' | 'detection' {
  switch (field.fieldType) {
    case 'dropdown':
    case 'boolean':
      return 'classification';
      
    case 'number':
      return 'regression';
      
    case 'text':
    case 'textarea':
      // For text fields, we need to determine if it's a classification or detection task
      // If the field has options, it's likely a classification task
      if (field.options && field.options.length > 0) {
        return 'classification';
      }
      
      // If the field has extraction patterns, it might be a detection task
      if (field.extractionPatterns && field.extractionPatterns.length > 0) {
        return 'detection';
      }
      
      // Default to classification for text fields
      return 'classification';
      
    default:
      return 'classification';
  }
}

/**
 * Prepare dataset for property-specific training
 * 
 * @param propertyName Property name
 * @param materialType Material type
 * @param inputDir Directory containing raw data
 * @param outputDir Directory to save prepared data
 * @param apiBaseUrl Optional API base URL
 * @param apiKey Optional API key
 * @returns Promise with preparation results
 */
export async function prepareDatasetForProperty(
  propertyName: string,
  materialType: MaterialType,
  inputDir: string,
  outputDir: string,
  apiBaseUrl?: string,
  apiKey?: string
): Promise<{
  propertyName: string;
  materialType: MaterialType;
  datasetPath: string;
  numSamples: number;
  classDistribution?: Record<string, number>;
  valueRange?: { min: number; max: number };
}> {
  logger.info(`Preparing dataset for ${propertyName} (${materialType})`, { inputDir, outputDir });
  
  try {
    // Get metadata field information
    const metadataFields = await getMetadataFieldsByMaterialType(materialType, apiBaseUrl, apiKey);
    const propertyField = metadataFields.find(field => field.name === propertyName);
    
    if (!propertyField) {
      throw new Error(`Property ${propertyName} not found for material type ${materialType}`);
    }
    
    // Create property-specific output directory
    const propertyOutputDir = path.join(outputDir, materialType, propertyName);
    fs.mkdirSync(propertyOutputDir, { recursive: true });
    
    // Save property metadata
    const metadataPath = path.join(propertyOutputDir, 'property_metadata.json');
    const propertyMetadata = {
      name: propertyField.name,
      displayName: propertyField.displayName,
      description: propertyField.description,
      fieldType: propertyField.fieldType,
      options: propertyField.options,
      validation: propertyField.validation,
      unit: propertyField.unit,
      materialType
    };
    
    fs.writeFileSync(metadataPath, JSON.stringify(propertyMetadata, null, 2));
    
    // Run the Python script for dataset preparation
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'property_dataset_preparer.py');
    
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', [
        scriptPath,
        '--property', propertyName,
        '--material-type', materialType,
        '--input-dir', inputDir,
        '--output-dir', propertyOutputDir,
        '--metadata-path', metadataPath
      ]);
      
      let resultData = '';
      let errorData = '';
      
      // Collect data from stdout
      pythonProcess.stdout.on('data', (data: Buffer) => {
        resultData += data.toString();
      });
      
      // Collect data from stderr
      pythonProcess.stderr.on('data', (data: Buffer) => {
        errorData += data.toString();
        logger.warn(`Dataset preparation stderr: ${data.toString()}`);
      });
      
      // Handle process completion
      pythonProcess.on('close', (code: number) => {
        if (code !== 0) {
          logger.error(`Dataset preparation process exited with code ${code}`, { errorData });
          reject(new Error(`Dataset preparation process failed: ${errorData}`));
          return;
        }
        
        try {
          // Parse the result
          const result = JSON.parse(resultData);
          
          // Add property name and material type to result
          result.propertyName = propertyName;
          result.materialType = materialType;
          
          logger.info(`Dataset preparation completed successfully for ${propertyName} (${materialType})`, {
            numSamples: result.numSamples
          });
          
          resolve(result);
        } catch (error) {
          logger.error('Failed to parse dataset preparation result', { error, resultData });
          reject(new Error(`Failed to parse dataset preparation result: ${error}`));
        }
      });
    });
  } catch (error) {
    logger.error(`Error in dataset preparation for ${propertyName}`, { error });
    throw error;
  }
}

/**
 * Predict property value from image
 * 
 * @param propertyName Property name
 * @param materialType Material type
 * @param imagePath Path to image file
 * @param modelDir Directory containing trained models
 * @returns Promise with prediction result
 */
export async function predictPropertyFromImage(
  propertyName: string,
  materialType: MaterialType,
  imagePath: string,
  modelDir: string
): Promise<{
  propertyName: string;
  materialType: MaterialType;
  value: any;
  confidence: number;
  alternatives?: Array<{ value: any; confidence: number }>;
}> {
  logger.info(`Predicting ${propertyName} for ${materialType} from image: ${imagePath}`);
  
  try {
    // Get model path
    const modelPath = path.join(modelDir, materialType, propertyName);
    
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model not found for ${propertyName} (${materialType})`);
    }
    
    // Run the Python script for prediction
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'property_predictor.py');
    
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', [
        scriptPath,
        '--property', propertyName,
        '--material-type', materialType,
        '--image', imagePath,
        '--model-dir', modelPath
      ]);
      
      let resultData = '';
      let errorData = '';
      
      // Collect data from stdout
      pythonProcess.stdout.on('data', (data: Buffer) => {
        resultData += data.toString();
      });
      
      // Collect data from stderr
      pythonProcess.stderr.on('data', (data: Buffer) => {
        errorData += data.toString();
        logger.warn(`Prediction stderr: ${data.toString()}`);
      });
      
      // Handle process completion
      pythonProcess.on('close', (code: number) => {
        if (code !== 0) {
          logger.error(`Prediction process exited with code ${code}`, { errorData });
          reject(new Error(`Prediction process failed: ${errorData}`));
          return;
        }
        
        try {
          // Parse the result
          const result = JSON.parse(resultData);
          
          // Add property name and material type to result
          result.propertyName = propertyName;
          result.materialType = materialType;
          
          logger.info(`Prediction completed successfully for ${propertyName} (${materialType})`, {
            value: result.value,
            confidence: result.confidence
          });
          
          resolve(result);
        } catch (error) {
          logger.error('Failed to parse prediction result', { error, resultData });
          reject(new Error(`Failed to parse prediction result: ${error}`));
        }
      });
    });
  } catch (error) {
    logger.error(`Error in prediction for ${propertyName}`, { error });
    throw error;
  }
}

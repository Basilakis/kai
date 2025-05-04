/**
 * Material-Specific Training Module
 * 
 * This module provides functions for training models with material-specific metadata fields.
 * It ensures that only relevant metadata fields are used for each material type.
 */

import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { logger } from './utils/logger';
import { 
  getMetadataFieldsByMaterialType, 
  createTrainingDataStructure,
  prepareTrainingConfigForMaterialType,
  MetadataField
} from './utils/metadata-field-utils';

// Get Python scripts directory
const PYTHON_SCRIPTS_DIR = path.join(__dirname, '..', 'python');

/**
 * Options for material-specific training
 */
export interface MaterialSpecificTrainingOptions {
  materialType: string;
  trainingDataDir: string;
  modelOutputDir: string;
  modelType?: 'hybrid' | 'feature-based' | 'ml-based';
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  apiBaseUrl?: string;
  apiKey?: string;
}

/**
 * Train a model for a specific material type
 * 
 * @param options Training options
 * @returns Promise with training results
 */
export async function trainModelForMaterialType(
  options: MaterialSpecificTrainingOptions
): Promise<{
  accuracy: number;
  loss: number;
  modelPath: string;
  materialType: string;
  metadataFields: string[];
}> {
  const {
    materialType,
    trainingDataDir,
    modelOutputDir,
    modelType = 'hybrid',
    epochs = 10,
    batchSize = 32,
    learningRate = 0.001,
    apiBaseUrl,
    apiKey
  } = options;
  
  logger.info(`Starting material-specific training for ${materialType}`, {
    materialType,
    modelType,
    epochs,
    batchSize
  });
  
  try {
    // Get metadata fields for this material type
    const metadataFields = await getMetadataFieldsByMaterialType(materialType, apiBaseUrl, apiKey);
    
    if (metadataFields.length === 0) {
      logger.warn(`No metadata fields found for material type: ${materialType}`);
    } else {
      logger.info(`Found ${metadataFields.length} metadata fields for ${materialType}`);
    }
    
    // Create training data structure
    const trainingConfig = createTrainingDataStructure(materialType, metadataFields);
    
    // Save training configuration to a file
    const configPath = path.join(modelOutputDir, 'training_config.json');
    fs.mkdirSync(modelOutputDir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(trainingConfig, null, 2));
    
    logger.info(`Saved training configuration to ${configPath}`);
    
    // Run the Python script for model training with material-specific configuration
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'material_specific_trainer.py');
    
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', [
        scriptPath,
        trainingDataDir,
        modelOutputDir,
        '--material-type', materialType,
        '--model-type', modelType,
        '--epochs', epochs.toString(),
        '--batch-size', batchSize.toString(),
        '--learning-rate', learningRate.toString(),
        '--config-path', configPath
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
          
          // Add material type and metadata fields to result
          result.materialType = materialType;
          result.metadataFields = metadataFields.map((field: MetadataField) => field.name);
          
          logger.info(`Training completed successfully for ${materialType}`, {
            accuracy: result.accuracy,
            loss: result.loss
          });
          
          resolve(result);
        } catch (error) {
          logger.error('Failed to parse training result', { error, resultData });
          reject(new Error(`Failed to parse training result: ${error}`));
        }
      });
    });
  } catch (error) {
    logger.error(`Error in material-specific training for ${materialType}`, { error });
    throw error;
  }
}

/**
 * Train models for multiple material types
 * 
 * @param materialTypes Array of material types to train models for
 * @param baseOptions Base training options (without materialType)
 * @returns Promise with training results for each material type
 */
export async function trainModelsForMaterialTypes(
  materialTypes: string[],
  baseOptions: Omit<MaterialSpecificTrainingOptions, 'materialType'>
): Promise<Record<string, any>> {
  const results: Record<string, any> = {};
  
  logger.info(`Starting training for ${materialTypes.length} material types`, { materialTypes });
  
  for (const materialType of materialTypes) {
    try {
      // Create material-specific output directory
      const materialOutputDir = path.join(baseOptions.modelOutputDir, materialType);
      
      // Train model for this material type
      const result = await trainModelForMaterialType({
        ...baseOptions,
        materialType,
        modelOutputDir: materialOutputDir
      });
      
      results[materialType] = result;
    } catch (error) {
      logger.error(`Error training model for ${materialType}`, { error });
      results[materialType] = { error: error instanceof Error ? error.message : String(error) };
    }
  }
  
  return results;
}

/**
 * Prepare training data for a specific material type
 * 
 * @param materialType Material type to prepare data for
 * @param inputDir Directory containing raw data
 * @param outputDir Directory to save prepared data
 * @param apiBaseUrl Optional API base URL
 * @param apiKey Optional API key
 * @returns Promise with preparation results
 */
export async function prepareTrainingDataForMaterialType(
  materialType: string,
  inputDir: string,
  outputDir: string,
  apiBaseUrl?: string,
  apiKey?: string
): Promise<{
  materialType: string;
  datasetPath: string;
  numSamples: number;
  metadataFields: string[];
}> {
  logger.info(`Preparing training data for ${materialType}`, { inputDir, outputDir });
  
  try {
    // Get metadata fields for this material type
    const metadataFields = await getMetadataFieldsByMaterialType(materialType, apiBaseUrl, apiKey);
    
    if (metadataFields.length === 0) {
      logger.warn(`No metadata fields found for material type: ${materialType}`);
    } else {
      logger.info(`Found ${metadataFields.length} metadata fields for ${materialType}`);
    }
    
    // Create material-specific output directory
    const materialOutputDir = path.join(outputDir, materialType);
    fs.mkdirSync(materialOutputDir, { recursive: true });
    
    // Create training data structure
    const trainingConfig = createTrainingDataStructure(materialType, metadataFields);
    
    // Save training configuration to a file
    const configPath = path.join(materialOutputDir, 'metadata_config.json');
    fs.writeFileSync(configPath, JSON.stringify(trainingConfig, null, 2));
    
    // Run the Python script for data preparation
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'material_data_preparer.py');
    
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', [
        scriptPath,
        inputDir,
        materialOutputDir,
        '--material-type', materialType,
        '--config-path', configPath
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
        logger.warn(`Data preparation stderr: ${data.toString()}`);
      });
      
      // Handle process completion
      pythonProcess.on('close', (code: number) => {
        if (code !== 0) {
          logger.error(`Data preparation process exited with code ${code}`, { errorData });
          reject(new Error(`Data preparation process failed: ${errorData}`));
          return;
        }
        
        try {
          // Parse the result
          const result = JSON.parse(resultData);
          
          // Add material type and metadata fields to result
          result.materialType = materialType;
          result.metadataFields = metadataFields.map((field: MetadataField) => field.name);
          
          logger.info(`Data preparation completed successfully for ${materialType}`, {
            numSamples: result.numSamples
          });
          
          resolve(result);
        } catch (error) {
          logger.error('Failed to parse data preparation result', { error, resultData });
          reject(new Error(`Failed to parse data preparation result: ${error}`));
        }
      });
    });
  } catch (error) {
    logger.error(`Error in data preparation for ${materialType}`, { error });
    throw error;
  }
}

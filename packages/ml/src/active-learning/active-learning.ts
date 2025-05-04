/**
 * Active Learning Module
 * 
 * This module provides functionality for active learning to improve models
 * by identifying and collecting references for uncertain cases.
 */

import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { logger } from '../utils/logger';
import { MaterialType } from '../utils/material-type-detector';

/**
 * Uncertainty Sample
 */
export interface UncertaintySample {
  id: string;
  imagePath: string;
  propertyName: string;
  materialType: MaterialType;
  predictions: {
    value: string;
    confidence: number;
  }[];
  entropy: number;
  needsFeedback: boolean;
  userFeedback?: {
    correctValue: string;
    timestamp: Date;
    userId: string;
  };
}

/**
 * Active Learning Session
 */
export interface ActiveLearningSession {
  id: string;
  propertyName: string;
  materialType: MaterialType;
  modelId: string;
  status: 'active' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  samples: UncertaintySample[];
  progress: number;
  improvementMetrics?: {
    initialAccuracy: number;
    finalAccuracy: number;
    accuracyImprovement: number;
    confusionReduction: number;
  };
}

/**
 * Find uncertain samples for active learning
 * 
 * @param propertyName The name of the property
 * @param materialType The type of material
 * @param modelId The ID of the model
 * @param options Options for finding uncertain samples
 * @returns The list of uncertain samples
 */
export async function findUncertainSamples(
  propertyName: string,
  materialType: MaterialType,
  modelId: string,
  options: {
    maxSamples?: number;
    minConfidence?: number;
    maxConfidence?: number;
    useEntropy?: boolean;
    includeValidationSet?: boolean;
  } = {}
): Promise<UncertaintySample[]> {
  try {
    logger.info(`Finding uncertain samples for ${propertyName} (${materialType})`);
    
    // Set default options
    const maxSamples = options.maxSamples || 50;
    const minConfidence = options.minConfidence || 0;
    const maxConfidence = options.maxConfidence || 0.8;
    const useEntropy = options.useEntropy !== undefined ? options.useEntropy : true;
    const includeValidationSet = options.includeValidationSet !== undefined ? options.includeValidationSet : false;
    
    // Get model path
    const modelDir = path.join(process.cwd(), 'models', 'visual-references', materialType, propertyName, modelId);
    
    if (!fs.existsSync(modelDir)) {
      throw new Error(`Model not found: ${modelId}`);
    }
    
    const modelPath = path.join(modelDir, 'model.h5');
    
    // Get data paths
    const dataPaths = [];
    
    // Always include unlabeled data
    const unlabeledDataDir = path.join(process.cwd(), 'data', 'unlabeled', materialType);
    if (fs.existsSync(unlabeledDataDir)) {
      dataPaths.push(unlabeledDataDir);
    }
    
    // Optionally include validation data
    if (includeValidationSet) {
      const validationDataDir = path.join(process.cwd(), 'data', 'validation', materialType, propertyName);
      if (fs.existsSync(validationDataDir)) {
        dataPaths.push(validationDataDir);
      }
    }
    
    if (dataPaths.length === 0) {
      logger.warn(`No data found for ${propertyName} (${materialType})`);
      return [];
    }
    
    // Create temporary config file
    const configPath = path.join(process.cwd(), 'temp', 'active-learning-config.json');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    
    const config = {
      modelPath,
      dataPaths,
      maxSamples,
      minConfidence,
      maxConfidence,
      useEntropy
    };
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    // Run Python script
    const scriptPath = path.join(__dirname, '..', 'python', 'find_uncertain_samples.py');
    
    const result = await new Promise<UncertaintySample[]>((resolve, reject) => {
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
          reject(new Error(`Script failed with code ${code}: ${stderr}`));
          return;
        }
        
        try {
          // Parse results
          const results = JSON.parse(stdout);
          
          // Clean up
          fs.unlinkSync(configPath);
          
          resolve(results.samples);
        } catch (error) {
          reject(new Error(`Error parsing results: ${error}`));
        }
      });
    });
    
    // Convert to UncertaintySample objects
    return result.map((sample: any, index: number) => ({
      id: `${propertyName}-${materialType}-${Date.now()}-${index}`,
      imagePath: sample.imagePath,
      propertyName,
      materialType,
      predictions: sample.predictions,
      entropy: sample.entropy,
      needsFeedback: true
    }));
  } catch (error) {
    logger.error(`Error finding uncertain samples: ${error}`);
    throw error;
  }
}

/**
 * Create an active learning session
 * 
 * @param propertyName The name of the property
 * @param materialType The type of material
 * @param modelId The ID of the model
 * @param options Options for creating the session
 * @returns The active learning session
 */
export async function createActiveLearningSession(
  propertyName: string,
  materialType: MaterialType,
  modelId: string,
  options: {
    maxSamples?: number;
    minConfidence?: number;
    maxConfidence?: number;
    useEntropy?: boolean;
    includeValidationSet?: boolean;
  } = {}
): Promise<ActiveLearningSession> {
  try {
    logger.info(`Creating active learning session for ${propertyName} (${materialType})`);
    
    // Find uncertain samples
    const samples = await findUncertainSamples(
      propertyName,
      materialType,
      modelId,
      options
    );
    
    // Create session
    const session: ActiveLearningSession = {
      id: `session-${propertyName}-${materialType}-${Date.now()}`,
      propertyName,
      materialType,
      modelId,
      status: 'active',
      createdAt: new Date(),
      samples,
      progress: 0
    };
    
    // Save session
    const sessionsDir = path.join(process.cwd(), 'data', 'active-learning', 'sessions');
    fs.mkdirSync(sessionsDir, { recursive: true });
    
    const sessionPath = path.join(sessionsDir, `${session.id}.json`);
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
    
    return session;
  } catch (error) {
    logger.error(`Error creating active learning session: ${error}`);
    throw error;
  }
}

/**
 * Get an active learning session
 * 
 * @param sessionId The ID of the session
 * @returns The active learning session
 */
export async function getActiveLearningSession(
  sessionId: string
): Promise<ActiveLearningSession> {
  try {
    logger.info(`Getting active learning session: ${sessionId}`);
    
    // Get session path
    const sessionPath = path.join(process.cwd(), 'data', 'active-learning', 'sessions', `${sessionId}.json`);
    
    if (!fs.existsSync(sessionPath)) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    // Read session
    const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    
    return session;
  } catch (error) {
    logger.error(`Error getting active learning session: ${error}`);
    throw error;
  }
}

/**
 * Get all active learning sessions
 * 
 * @param propertyName Optional property name filter
 * @param materialType Optional material type filter
 * @returns The list of active learning sessions
 */
export async function getAllActiveLearningSession(
  propertyName?: string,
  materialType?: MaterialType
): Promise<ActiveLearningSession[]> {
  try {
    logger.info(`Getting all active learning sessions`);
    
    // Get sessions directory
    const sessionsDir = path.join(process.cwd(), 'data', 'active-learning', 'sessions');
    
    if (!fs.existsSync(sessionsDir)) {
      return [];
    }
    
    // Read all session files
    const sessionFiles = fs.readdirSync(sessionsDir).filter(file => file.endsWith('.json'));
    
    const sessions: ActiveLearningSession[] = [];
    
    for (const file of sessionFiles) {
      const sessionPath = path.join(sessionsDir, file);
      const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
      
      // Apply filters
      if (propertyName && session.propertyName !== propertyName) {
        continue;
      }
      
      if (materialType && session.materialType !== materialType) {
        continue;
      }
      
      sessions.push(session);
    }
    
    return sessions;
  } catch (error) {
    logger.error(`Error getting all active learning sessions: ${error}`);
    throw error;
  }
}

/**
 * Provide feedback for an uncertain sample
 * 
 * @param sessionId The ID of the session
 * @param sampleId The ID of the sample
 * @param correctValue The correct value
 * @param userId The ID of the user providing feedback
 * @returns The updated active learning session
 */
export async function provideFeedback(
  sessionId: string,
  sampleId: string,
  correctValue: string,
  userId: string
): Promise<ActiveLearningSession> {
  try {
    logger.info(`Providing feedback for sample ${sampleId} in session ${sessionId}`);
    
    // Get session
    const session = await getActiveLearningSession(sessionId);
    
    // Find sample
    const sampleIndex = session.samples.findIndex(sample => sample.id === sampleId);
    
    if (sampleIndex === -1) {
      throw new Error(`Sample not found: ${sampleId}`);
    }
    
    // Update sample
    session.samples[sampleIndex].needsFeedback = false;
    session.samples[sampleIndex].userFeedback = {
      correctValue,
      timestamp: new Date(),
      userId
    };
    
    // Update progress
    const feedbackCount = session.samples.filter(sample => !sample.needsFeedback).length;
    session.progress = feedbackCount / session.samples.length;
    
    // Save session
    const sessionPath = path.join(process.cwd(), 'data', 'active-learning', 'sessions', `${sessionId}.json`);
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
    
    // If all samples have feedback, update the training data
    if (session.progress === 1) {
      await updateTrainingData(session);
    }
    
    return session;
  } catch (error) {
    logger.error(`Error providing feedback: ${error}`);
    throw error;
  }
}

/**
 * Update training data with feedback
 * 
 * @param session The active learning session
 * @returns The updated session
 */
async function updateTrainingData(
  session: ActiveLearningSession
): Promise<ActiveLearningSession> {
  try {
    logger.info(`Updating training data for session ${session.id}`);
    
    // Get training data directory
    const trainingDataDir = path.join(process.cwd(), 'data', 'training', session.materialType, session.propertyName);
    fs.mkdirSync(trainingDataDir, { recursive: true });
    
    // Process each sample with feedback
    for (const sample of session.samples) {
      if (!sample.userFeedback) {
        continue;
      }
      
      // Get correct value
      const correctValue = sample.userFeedback.correctValue;
      
      // Create directory for the value if it doesn't exist
      const valueDir = path.join(trainingDataDir, correctValue);
      fs.mkdirSync(valueDir, { recursive: true });
      
      // Copy image to training data directory
      const imageName = path.basename(sample.imagePath);
      const targetPath = path.join(valueDir, `al_${session.id}_${imageName}`);
      
      fs.copyFileSync(sample.imagePath, targetPath);
      
      logger.info(`Added image to training data: ${targetPath}`);
    }
    
    // Update session status
    session.status = 'completed';
    session.completedAt = new Date();
    
    // Save session
    const sessionPath = path.join(process.cwd(), 'data', 'active-learning', 'sessions', `${session.id}.json`);
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
    
    return session;
  } catch (error) {
    logger.error(`Error updating training data: ${error}`);
    throw error;
  }
}

/**
 * Retrain model with active learning data
 * 
 * @param sessionId The ID of the session
 * @returns The improvement metrics
 */
export async function retrainModelWithActiveLearningData(
  sessionId: string
): Promise<any> {
  try {
    logger.info(`Retraining model with active learning data for session ${sessionId}`);
    
    // Get session
    const session = await getActiveLearningSession(sessionId);
    
    if (session.status !== 'completed') {
      throw new Error(`Session is not completed: ${sessionId}`);
    }
    
    // Get model path
    const modelDir = path.join(process.cwd(), 'models', 'visual-references', session.materialType, session.propertyName, session.modelId);
    
    if (!fs.existsSync(modelDir)) {
      throw new Error(`Model not found: ${session.modelId}`);
    }
    
    const modelPath = path.join(modelDir, 'model.h5');
    
    // Get training data path
    const trainingDataDir = path.join(process.cwd(), 'data', 'training', session.materialType, session.propertyName);
    
    // Create temporary config file
    const configPath = path.join(process.cwd(), 'temp', 'active-learning-retrain-config.json');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    
    const config = {
      modelPath,
      trainingDataDir,
      epochs: 10,
      batchSize: 32,
      learningRate: 0.001,
      useTransferLearning: true,
      useDataAugmentation: true
    };
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    // Run Python script
    const scriptPath = path.join(__dirname, '..', 'python', 'retrain_model.py');
    
    const result = await new Promise<any>((resolve, reject) => {
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
          reject(new Error(`Script failed with code ${code}: ${stderr}`));
          return;
        }
        
        try {
          // Parse results
          const results = JSON.parse(stdout);
          
          // Clean up
          fs.unlinkSync(configPath);
          
          resolve(results);
        } catch (error) {
          reject(new Error(`Error parsing results: ${error}`));
        }
      });
    });
    
    // Update session with improvement metrics
    session.improvementMetrics = {
      initialAccuracy: result.initialAccuracy,
      finalAccuracy: result.finalAccuracy,
      accuracyImprovement: result.finalAccuracy - result.initialAccuracy,
      confusionReduction: result.confusionReduction
    };
    
    // Save session
    const sessionPath = path.join(process.cwd(), 'data', 'active-learning', 'sessions', `${session.id}.json`);
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
    
    return session.improvementMetrics;
  } catch (error) {
    logger.error(`Error retraining model: ${error}`);
    throw error;
  }
}

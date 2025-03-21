/**
 * Training Progress Service
 * 
 * A flexible service for tracking and reporting model training progress.
 * This implementation uses file-based storage but can be extended to use
 * WebSockets for real-time updates when the ws package is installed.
 * 
 * Now supports dynamic parameter adjustment during training.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';

// Type declarations for Node.js fs module functions
declare namespace NodeJS {
  interface ErrnoException extends Error {
    errno?: number;
    code?: string;
    path?: string;
    syscall?: string;
  }
}

// Explicitly declare fs function types
declare namespace FsTypes {
  type Callback<T> = (err: NodeJS.ErrnoException | null, result?: T) => void;
  type NoParamCallback = (err: NodeJS.ErrnoException | null) => void;
}

// Constants needed for fs.access
const F_OK = 0;

// Training progress event data structure
export interface TrainingProgressEvent {
  jobId: string;
  type: 'start' | 'progress' | 'complete' | 'error';
  timestamp: number;
  data: {
    progress?: number;
    currentEpoch?: number;
    totalEpochs?: number;
    loss?: number;
    accuracy?: number;
    eta?: number;
    error?: string;
    message?: string;
    modelType?: string;
    parameter_updates?: Record<string, number | string>;
    current_learning_rate?: number;
    [key: string]: any;
  };
}

/**
 * Parameter adjustment interface
 */
export interface ParameterAdjustment {
  learning_rate?: number;
  batch_size?: number;
  epochs?: number;
  [key: string]: any;
}

/**
 * Progress Storage Provider interface
 * Allows for different storage mechanisms (file, db, memory, websocket)
 */
interface ProgressStorageProvider {
  saveProgress(event: TrainingProgressEvent): Promise<void>;
  getProgress(jobId: string): Promise<TrainingProgressEvent | null>;
  getAllJobs(): Promise<string[]>;
  cleanupJobs(olderThan: number): Promise<void>;
}

/**
 * File-based progress storage provider
 * Stores progress events in JSON files
 */
class FileProgressStorage implements ProgressStorageProvider {
  private storageDir: string;

  constructor(storageDir?: string) {
    this.storageDir = storageDir || path.join(process.cwd(), 'data', 'training-progress');
    
    // Ensure the storage directory exists
    fs.mkdirSync(this.storageDir, { recursive: true });
    logger.info(`File progress storage initialized at: ${this.storageDir}`);
  }

  /**
   * Save progress event to a file
   * @param event Progress event to save
   */
  async saveProgress(event: TrainingProgressEvent): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const filePath = path.join(this.storageDir, `${event.jobId}.json`);
      fs.writeFile(filePath, JSON.stringify(event, null, 2), (err) => {
        if (err) {
          logger.error(`Failed to save progress for job ${event.jobId}: ${err}`);
          reject(err);
        } else {
          logger.debug(`Progress saved for job ${event.jobId}`);
          resolve();
        }
      });
    });
  }

  /**
   * Get progress for a specific job
   * @param jobId Job ID
   * @returns Progress event or null if not found
   */
  async getProgress(jobId: string): Promise<TrainingProgressEvent | null> {
    return new Promise<TrainingProgressEvent | null>((resolve) => {
      const filePath = path.join(this.storageDir, `${jobId}.json`);
      
      // Check if file exists
      fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
          // File doesn't exist
          resolve(null);
          return;
        }
        
        // Read and parse the file
        fs.readFile(filePath, 'utf-8', (err, data) => {
          if (err) {
            logger.error(`Failed to read progress for job ${jobId}: ${err}`);
            resolve(null);
            return;
          }
          
          try {
            resolve(JSON.parse(data) as TrainingProgressEvent);
          } catch (parseErr) {
            logger.error(`Failed to parse progress for job ${jobId}: ${parseErr}`);
            resolve(null);
          }
        });
      });
    });
  }

  /**
   * Get all job IDs
   * @returns List of job IDs
   */
  async getAllJobs(): Promise<string[]> {
    return new Promise<string[]>((resolve) => {
      fs.readdir(this.storageDir, (err, files) => {
        if (err) {
          logger.error(`Failed to get all jobs: ${err}`);
          resolve([]);
          return;
        }
        
        const jobIds = files
          .filter((file: string) => file.endsWith('.json'))
          .map((file: string) => file.replace('.json', ''));
        
        resolve(jobIds);
      });
    });
  }

  /**
   * Clean up old jobs
   * @param olderThan Timestamp (ms) - jobs older than this will be removed
   */
  async cleanupJobs(olderThan: number): Promise<void> {
    try {
      const jobIds = await this.getAllJobs();
      
      for (const jobId of jobIds) {
        const progress = await this.getProgress(jobId);
        
        if (progress && progress.timestamp < olderThan) {
          await this.removeJob(jobId);
        }
      }
    } catch (err) {
      logger.error(`Failed to clean up old jobs: ${err}`);
    }
  }
  
  /**
   * Remove a job file
   * @param jobId Job ID to remove
   */
  private async removeJob(jobId: string): Promise<void> {
    return new Promise<void>((resolve) => {
      const filePath = path.join(this.storageDir, `${jobId}.json`);
      fs.unlink(filePath, (err) => {
        if (err) {
          logger.error(`Failed to remove job ${jobId}: ${err}`);
        } else {
          logger.info(`Cleaned up old job: ${jobId}`);
        }
        resolve();
      });
    });
  }
}

/**
 * Training Progress Service
 * Central service for tracking and reporting model training progress
 */
class TrainingProgressService {
  private storage: ProgressStorageProvider;
  private subscribers: Map<string, Set<(event: TrainingProgressEvent) => void>> = new Map();

  constructor(storage?: ProgressStorageProvider) {
    // Default to file storage if none provided
    this.storage = storage || new FileProgressStorage();
    
    // Set up periodic cleanup of old jobs (every hour)
    setInterval(() => {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      this.storage.cleanupJobs(oneWeekAgo).catch(err => {
        logger.error(`Job cleanup failed: ${err}`);
      });
    }, 60 * 60 * 1000);
  }

  /**
   * Update progress for a training job
   * @param progressEvent Progress event data
   */
  async updateProgress(progressEvent: TrainingProgressEvent): Promise<void> {
    // Add timestamp if not provided
    if (!progressEvent.timestamp) {
      progressEvent.timestamp = Date.now();
    }
    
    // Check for parameter update acknowledgments
    if (progressEvent.data.parameter_updates) {
      this.checkParameterAcknowledgment(progressEvent);
    }
    
    // Save to storage
    await this.storage.saveProgress(progressEvent);
    
    // Notify subscribers
    this.notifySubscribers(progressEvent);
    
    // Log progress
    if (progressEvent.type === 'start') {
      logger.info(`Training job ${progressEvent.jobId} started`);
    } else if (progressEvent.type === 'complete') {
      logger.info(`Training job ${progressEvent.jobId} completed`);
      // Clean up parameter files when job is complete
      this.cleanupParameterFiles(progressEvent.jobId);
    } else if (progressEvent.type === 'error') {
      logger.error(`Training job ${progressEvent.jobId} failed: ${progressEvent.data.error}`);
      // Clean up parameter files when job errors out
      this.cleanupParameterFiles(progressEvent.jobId);
    } else {
      const { currentEpoch, totalEpochs, progress, current_learning_rate } = progressEvent.data;
      
      let logMessage = "";
      
      if (currentEpoch !== undefined && totalEpochs !== undefined) {
        logMessage = `Training job ${progressEvent.jobId}: Epoch ${currentEpoch}/${totalEpochs} (${Math.round((progress || 0) * 100)}%)`;
      } else if (progress !== undefined) {
        logMessage = `Training job ${progressEvent.jobId}: ${Math.round(progress * 100)}% complete`;
      }
      
      if (current_learning_rate !== undefined) {
        logMessage += ` [lr=${current_learning_rate}]`;
      }
      
      if (logMessage) {
        logger.debug(logMessage);
      }
    }
  }

  /**
   * Get progress for a specific job
   * @param jobId Job ID
   * @returns Progress event or null if not found
   */
  async getProgress(jobId: string): Promise<TrainingProgressEvent | null> {
    return this.storage.getProgress(jobId);
  }

  /**
   * Get all active jobs
   * @returns List of job IDs
   */
  async getActiveJobs(): Promise<string[]> {
    const jobIds = await this.storage.getAllJobs();
    const activeJobs: string[] = [];
    
    for (const jobId of jobIds) {
      const progress = await this.storage.getProgress(jobId);
      if (progress && progress.type !== 'complete' && progress.type !== 'error') {
        activeJobs.push(jobId);
      }
    }
    
    return activeJobs;
  }

  /**
   * Subscribe to progress updates for a specific job
   * @param jobId Job ID
   * @param callback Function to call when progress updates
   * @returns Unsubscribe function
   */
  subscribe(jobId: string, callback: (event: TrainingProgressEvent) => void): () => void {
    // Initialize set if needed
    if (!this.subscribers.has(jobId)) {
      this.subscribers.set(jobId, new Set());
    }
    
    // Add subscriber
    const subscribers = this.subscribers.get(jobId);
    if (subscribers) {
      subscribers.add(callback);
    }
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(jobId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscribers.delete(jobId);
        }
      }
    };
  }

  /**
   * Notify subscribers of a progress update
   * @param event Progress event
   */
  private notifySubscribers(event: TrainingProgressEvent): void {
    const subscribers = this.subscribers.get(event.jobId);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(event);
        } catch (err) {
          logger.error(`Error in progress subscriber callback: ${err}`);
        }
      });
    }
  }

  /**
   * Request parameter adjustment for a job
   * @param jobId Job ID
   * @param parameters Parameters to adjust
   * @returns True if request was successful, false otherwise
   */
  async requestParameterAdjustment(jobId: string, parameters: ParameterAdjustment): Promise<boolean> {
    try {
      // Check if job exists and is active
      const progress = await this.getProgress(jobId);
      if (!progress || progress.type === 'complete' || progress.type === 'error') {
        logger.warn(`Cannot adjust parameters for inactive job: ${jobId}`);
        return false;
      }
      
      // Validate parameters
      const validParams = ['learning_rate', 'batch_size', 'epochs'];
      const validatedParams: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(parameters)) {
        if (!validParams.includes(key)) {
          logger.warn(`Ignoring invalid parameter: ${key}`);
          continue;
        }
        
        // Type checks
        if (key === 'learning_rate' && typeof value === 'number' && value > 0) {
          validatedParams[key] = value;
        } else if ((key === 'batch_size' || key === 'epochs') && 
                  typeof value === 'number' && Number.isInteger(value) && value > 0) {
          validatedParams[key] = value;
        } else {
          logger.warn(`Invalid value for parameter ${key}: ${value}`);
        }
      }
      
      if (Object.keys(validatedParams).length === 0) {
        logger.warn('No valid parameters provided for adjustment');
        return false;
      }
      
      // Create parameter update request
      const paramDir = path.join(process.cwd(), 'data', 'parameter_updates');
      fs.mkdirSync(paramDir, { recursive: true });
      
      const updateRequest = {
        job_id: jobId,
        timestamp: Date.now(),
        parameters: validatedParams
      };
      
      fs.writeFileSync(
        path.join(paramDir, `${jobId}_update_request.json`),
        JSON.stringify(updateRequest, null, 2)
      );
      
      logger.info(`Parameter adjustment requested for job ${jobId}: ${JSON.stringify(validatedParams)}`);
      return true;
    } catch (err) {
      logger.error(`Failed to request parameter adjustment: ${err}`);
      return false;
    }
  }
  
  /**
   * Check for parameter update acknowledgments
   * @param progressEvent Progress event data
   */
  private checkParameterAcknowledgment(progressEvent: TrainingProgressEvent): void {
    if (progressEvent.data.parameter_updates) {
      logger.info(
        `Parameter update acknowledged for job ${progressEvent.jobId}: ${JSON.stringify(progressEvent.data.parameter_updates)}`
      );
      
      // Clean up acknowledgment file
      this.cleanupParameterFiles(progressEvent.jobId, true);
    }
  }
  
  /**
   * Clean up parameter files for a job
   * @param jobId Job ID
   * @param onlyAcknowledgment Whether to only clean up acknowledgment files
   */
  private cleanupParameterFiles(jobId: string, onlyAcknowledgment: boolean = false): void {
    try {
      const paramDir = path.join(process.cwd(), 'data', 'parameter_updates');
      
      // Files to check
      const files = [
        onlyAcknowledgment ? null : `${jobId}_params.json`,
        onlyAcknowledgment ? null : `${jobId}_update_request.json`,
        `${jobId}_update_ack.json`
      ].filter(Boolean) as string[];
      
      for (const file of files) {
        const filePath = path.join(paramDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.debug(`Cleaned up parameter file: ${file}`);
        }
      }
    } catch (err) {
      logger.error(`Failed to clean up parameter files: ${err}`);
    }
  }

  /**
   * WebSocket Integration:
   * 
   * The system now supports dynamic parameter adjustment during training through:
   * 1. Direct file-based parameter updates
   * 2. API endpoints that manage parameter adjustments
   * 3. WebSocket messages for real-time parameter updates
   * 
   * Parameter adjustments are processed as follows:
   * 1. Client requests parameter change (via API or WebSocket)
   * 2. System writes parameter update request to filesystem
   * 3. Training process detects and applies the parameter change
   * 4. Training process acknowledges the change in next progress update
   * 5. System notifies clients of the applied change
   */
}

// Export singleton instance
export const trainingProgressService = new TrainingProgressService();

// Export interfaces and classes for extensibility
export { ProgressStorageProvider, FileProgressStorage };
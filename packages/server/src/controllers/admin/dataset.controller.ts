/**
 * Dataset Admin Controller
 *
 * Handles administrative actions related to datasets, such as splitting
 * and initiating training jobs.
 */
// Removed import from '../../types/middleware'
import { datasetManagementService, TrainingConfiguration } from '../../services/datasets/dataset-management.service';
import { logger } from '../../utils/logger';
import { ApiError } from '../../middleware/error.middleware'; // Corrected path
import { Request, Response } from 'express'; // Use standard Express types

// Removed TypedRequest interface

interface SplitDatasetRequest {
  splitRatios: { train: number; validation: number; test: number };
  stratified?: boolean;
}

interface StartTrainingRequest {
  config: TrainingConfiguration;
}

/**
 * Controller class for dataset admin operations
 */
export class DatasetAdminController {

  /**
   * Split a dataset into train/validation/test sets
   */
  // Use standard Request and Response types
  public async splitDataset(
    req: Request<{ id: string }, any, SplitDatasetRequest>, // Use Request generic for params and body
    res: Response
  ): Promise<void> {
    const { id: datasetId } = req.params;
    const { splitRatios, stratified } = req.body;

    try {
      if (!splitRatios || typeof splitRatios.train !== 'number' || typeof splitRatios.validation !== 'number' || typeof splitRatios.test !== 'number') {
        throw new ApiError(400, 'Invalid splitRatios provided.');
      }

      const result = await datasetManagementService.splitDataset(
        datasetId,
        splitRatios,
        stratified !== undefined ? stratified : true // Default to stratified
      );

      res.status(200).json({
        message: `Dataset ${datasetId} split successfully.`,
        splitInfo: result
      });

    } catch (err) {
      // Correctly handle unknown error type
      const message = err instanceof Error ? err.message : String(err);
      const error = err instanceof ApiError ? err : new ApiError(500, `Failed to split dataset ${datasetId}: ${message}`);
      logger.error(`Error splitting dataset: ${error.message}`, { datasetId, error: err }); // Log original error
      // Remove details property as base ApiError doesn't have it
      res.status(error.statusCode).json({ error: error.message }); 
    }
  }

  /**
   * Start a training job for a specific dataset
   */
  // Use standard Request and Response types
  public async startTrainingJob(
    req: Request<{ id: string }, any, StartTrainingRequest>, // Use Request generic for params and body
    res: Response
  ): Promise<void> {
    const { id: datasetId } = req.params;
    const { config } = req.body;

    try {
      if (!config) {
        throw new ApiError(400, 'Training configuration is required.');
      }
      
      // Add user ID from authenticated user if available
      // Ensure req.user exists and has an id property before assigning
      const userId = req.user?.id; 
      if (userId) {
        config.userId = userId; 
      } else {
        // Handle case where user is not authenticated or ID is missing, if required
        logger.warn(`User ID not found on request for training job on dataset ${datasetId}`);
        // Depending on requirements, you might throw an error or proceed without userId
      }

      const result = await datasetManagementService.startDatasetTrainingJob(datasetId, config);

      res.status(202).json({ // 202 Accepted, as job is likely queued
        message: `Training job for dataset ${datasetId} submitted successfully.`,
        jobId: result.jobId,
        status: result.status
      });

    } catch (err) {
      // Correctly handle unknown error type
      const message = err instanceof Error ? err.message : String(err);
      const error = err instanceof ApiError ? err : new ApiError(500, `Failed to start training job for dataset ${datasetId}: ${message}`);
      logger.error(`Error starting training job: ${error.message}`, { datasetId, config, error: err }); // Log original error
      // Remove details property as base ApiError doesn't have it
      res.status(error.statusCode).json({ error: error.message });
    }
  }
}

// Export an instance of the controller
export const datasetAdminController = new DatasetAdminController();
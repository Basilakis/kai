/**
 * WebSocket server for real-time training progress monitoring and parameter adjustment
 * 
 * IMPORTANT: This implementation requires the following dependencies:
 * - ws (WebSocket implementation)
 * - @types/ws (TypeScript definitions for WebSocket)
 * 
 * Install with: npm install ws @types/ws --save
 */

// Regular imports (requires the packages to be installed)
import { Server } from 'http';
import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';

// For TypeScript compatibility until the packages are installed
declare module 'ws' {
  interface WebSocket {
    on(event: 'message', listener: (data: string) => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    send(data: string): void;
  }
  
  namespace WebSocket {
    class Server {
      constructor(options: { server: Server });
      on(event: 'connection', listener: (ws: WebSocket) => void): this;
      close(callback?: () => void): void;
    }
  }
}

/**
 * Training progress event data structure
 */
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
 * Parameter adjustment request structure
 */
export interface ParameterAdjustmentRequest {
  jobId: string;
  parameters: {
    learning_rate?: number;
    batch_size?: number;
    epochs?: number;
    [key: string]: any;
  };
}

/**
 * Training progress WebSocket server
 * Manages WebSocket connections for real-time training progress updates
 */
export class TrainingProgressServer {
  private wss: WebSocket.Server | null = null;
  private clients: Map<WebSocket, { userId: string; jobIds: Set<string> }> = new Map();
  private activeJobs: Map<string, TrainingProgressEvent> = new Map();

  /**
   * Initialize the WebSocket server
   * @param httpServer HTTP server instance to attach the WebSocket server to
   */
  initialize(httpServer: Server): void {
    // Create WebSocket server
    this.wss = new WebSocket.Server({ server: httpServer });

    // Setup connection handler
    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('WebSocket client connected for training progress');

      // Set initial client data
      this.clients.set(ws, { userId: '', jobIds: new Set() });

      // Handle messages from clients
      ws.on('message', (message: string) => {
        try {
          const parsedMessage = JSON.parse(message);
          this.handleClientMessage(ws, parsedMessage);
        } catch (err) {
          logger.error(`Failed to parse WebSocket message: ${err}`);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      // Handle client disconnection
      ws.on('close', () => {
        logger.info('WebSocket client disconnected');
        this.clients.delete(ws);
      });

      // Handle errors
      ws.on('error', (err) => {
        logger.error(`WebSocket error: ${err}`);
      });
    });

    logger.info('Training progress WebSocket server initialized');
  }

  /**
   * Handle messages from clients
   * @param ws WebSocket connection
   * @param message Parsed message from client
   */
  private handleClientMessage(ws: WebSocket, message: any): void {
    const clientData = this.clients.get(ws);
    if (!clientData) return;

    // Handle different message types
    switch (message.type) {
      case 'auth':
        // Authenticate client and store user ID
        if (message.userId) {
          clientData.userId = message.userId;
          logger.info(`WebSocket client authenticated: ${message.userId}`);
          
          // Send confirmation
          ws.send(JSON.stringify({
            type: 'auth_success',
            userId: message.userId
          }));
        }
        break;

      case 'subscribe':
        // Subscribe to job progress updates
        if (message.jobId) {
          clientData.jobIds.add(message.jobId);
          logger.info(`Client subscribed to job: ${message.jobId}`);
          
          // Send current job state if available
          const jobState = this.activeJobs.get(message.jobId);
          if (jobState) {
            ws.send(JSON.stringify(jobState));
          }
          
          // Send confirmation
          ws.send(JSON.stringify({
            type: 'subscribe_success',
            jobId: message.jobId
          }));
        }
        break;

      case 'unsubscribe':
        // Unsubscribe from job progress updates
        if (message.jobId) {
          clientData.jobIds.delete(message.jobId);
          logger.info(`Client unsubscribed from job: ${message.jobId}`);
          
          // Send confirmation
          ws.send(JSON.stringify({
            type: 'unsubscribe_success',
            jobId: message.jobId
          }));
        }
        break;

      case 'adjust_parameters':
        // Handle parameter adjustment requests
        this.handleParameterAdjustment(ws, message);
        break;

      default:
        logger.warn(`Unknown message type: ${message.type}`);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Unknown message type'
        }));
    }
  }

  /**
   * Handle parameter adjustment requests
   * @param ws WebSocket connection
   * @param message Parameter adjustment message
   */
  private handleParameterAdjustment(ws: WebSocket, message: any): void {
    const clientData = this.clients.get(ws);
    if (!clientData) return;

    // Validate message structure
    if (!message.jobId || !message.parameters) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid parameter adjustment request format'
      }));
      return;
    }

    const { jobId, parameters } = message;

    // Check if client is subscribed to the job
    if (!clientData.jobIds.has(jobId)) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Not subscribed to this job'
      }));
      return;
    }

    // Check if job is active
    if (!this.activeJobs.has(jobId) || 
        ['complete', 'error'].includes(this.activeJobs.get(jobId)?.type || '')) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Job is not active or has completed'
      }));
      return;
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
      ws.send(JSON.stringify({
        type: 'error',
        message: 'No valid parameters provided'
      }));
      return;
    }

    // Forward parameter adjustment to the training script
    // This is done via a file in the server's file system that the parameter_manager reads
    try {
      // Ensure directory exists
      const paramDir = path.join(process.cwd(), 'data', 'parameter_updates');
      if (!fs.existsSync(paramDir)) {
        fs.mkdirSync(paramDir, { recursive: true });
      }
      
      // Write parameter update request
      const updateRequest = {
        job_id: jobId,
        timestamp: Date.now(),
        parameters: validatedParams
      };
      
      fs.writeFileSync(
        path.join(paramDir, `${jobId}_update_request.json`),
        JSON.stringify(updateRequest, null, 2)
      );
      
      // Send confirmation
      ws.send(JSON.stringify({
        type: 'parameter_adjustment_requested',
        jobId,
        parameters: validatedParams
      }));
      
      logger.info(`Parameter adjustment requested for job ${jobId}: ${JSON.stringify(validatedParams)}`);
    } catch (err) {
      logger.error(`Failed to request parameter adjustment: ${err}`);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to request parameter adjustment'
      }));
    }
  }

  /**
   * Update training progress for a job
   * @param progressEvent Training progress event data
   */
  updateProgress(progressEvent: TrainingProgressEvent): void {
    if (!this.wss) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    // Store current job state
    this.activeJobs.set(progressEvent.jobId, progressEvent);

    // Check for parameter update acknowledgments
    this.checkParameterAcknowledgment(progressEvent);

    // Broadcast progress to subscribed clients
    this.clients.forEach((clientData, ws) => {
      if (clientData.jobIds.has(progressEvent.jobId)) {
        ws.send(JSON.stringify(progressEvent));
      }
    });

    // Clean up completed or failed jobs
    if (progressEvent.type === 'complete' || progressEvent.type === 'error') {
      setTimeout(() => {
        this.activeJobs.delete(progressEvent.jobId);
        this.cleanupParameterFiles(progressEvent.jobId);
      }, 1000 * 60 * 60); // Keep job data for 1 hour after completion
    }
  }

  /**
   * Check for parameter update acknowledgments
   * @param progressEvent Training progress event data
   */
  private checkParameterAcknowledgment(progressEvent: TrainingProgressEvent): void {
    if (progressEvent.data.parameter_updates) {
      logger.info(`Parameter update acknowledged for job ${progressEvent.jobId}: ${JSON.stringify(progressEvent.data.parameter_updates)}`);
      
      // The training script may have cleaned up the acknowledgment file already,
      // but we'll try to clean it up here too to be safe
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
      if (!fs.existsSync(paramDir)) return;
      
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
   * Get active jobs for a specific user
   * @param userId User ID
   * @returns List of active job IDs
   */
  getActiveJobsForUser(userId: string): string[] {
    const activeJobIds: string[] = [];
    
    this.activeJobs.forEach((event, jobId) => {
      // In a real implementation, you would check if the job belongs to the user
      // This is a simplified version
      if (event.type !== 'complete' && event.type !== 'error') {
        activeJobIds.push(jobId);
      }
    });
    
    return activeJobIds;
  }

  /**
   * Close the WebSocket server
   */
  close(): void {
    if (this.wss) {
      this.wss.close(() => {
        logger.info('Training progress WebSocket server closed');
      });
      this.wss = null;
      this.clients.clear();
      this.activeJobs.clear();
    }
  }
}

// Export singleton instance
export const trainingProgressServer = new TrainingProgressServer();
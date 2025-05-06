/**
 * Client-side Prompt Service
 * 
 * Provides functionality for interacting with the prompt service API
 * and tracking prompt success.
 */

import axios from 'axios';
import { createPromptSuccessTracker, PromptSuccessTracker } from '../utils/promptSuccessTracker';
import { logger } from '../utils/logger';

/**
 * Prompt types
 */
export enum PromptType {
  MATERIAL_SPECIFIC = 'material_specific',
  AGENT = 'agent',
  RAG = 'rag',
  GENERATIVE_ENHANCER = 'generative_enhancer',
  HYBRID_RETRIEVER = 'hybrid_retriever',
  OTHER = 'other'
}

/**
 * Prompt render options
 */
export interface PromptRenderOptions {
  promptId?: string;
  promptName?: string;
  promptType?: PromptType;
  data: Record<string, any>;
  trackSuccess?: boolean;
}

/**
 * Prompt service class
 */
class PromptService {
  private apiBase: string;
  private activeTrackers: Map<string, PromptSuccessTracker> = new Map();
  
  /**
   * Constructor
   * @param apiBase API base URL
   */
  constructor(apiBase: string = '/api') {
    this.apiBase = apiBase;
    logger.info('Client prompt service initialized');
    
    // Add event listener for page unload to auto-detect success for any active trackers
    window.addEventListener('beforeunload', this.handlePageUnload);
  }
  
  /**
   * Handle page unload
   */
  private handlePageUnload = async (): Promise<void> => {
    // Auto-detect success for all active trackers
    const promises = Array.from(this.activeTrackers.values()).map(tracker => 
      tracker.autoDetectSuccess().catch(err => {
        logger.error('Error auto-detecting success on page unload:', err);
        return false;
      })
    );
    
    try {
      await Promise.all(promises);
    } catch (error) {
      logger.error('Error handling page unload:', error);
    }
  };
  
  /**
   * Render a prompt
   * @param options Render options
   * @returns Rendered prompt content and tracking ID
   */
  async renderPrompt(options: PromptRenderOptions): Promise<{ content: string; trackingId?: string }> {
    try {
      const startTime = Date.now();
      
      // Generate a tracking ID if tracking is enabled
      const trackingId = options.trackSuccess ? this.generateTrackingId() : undefined;
      
      // Prepare request data
      const requestData: any = {
        data: options.data
      };
      
      if (options.promptId) {
        requestData.promptId = options.promptId;
      } else if (options.promptName && options.promptType) {
        requestData.promptName = options.promptName;
        requestData.promptType = options.promptType;
      } else {
        throw new Error('Either promptId or promptName+promptType must be provided');
      }
      
      if (trackingId) {
        requestData.trackingId = trackingId;
      }
      
      // Send request to API
      const response = await axios.post(`${this.apiBase}/prompts/render`, requestData);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to render prompt');
      }
      
      const responseTime = Date.now() - startTime;
      
      // Create a success tracker if tracking is enabled
      if (trackingId && options.trackSuccess) {
        const tracker = createPromptSuccessTracker(
          trackingId,
          responseTime,
          `${this.apiBase}/prompt-monitoring`
        );
        
        this.activeTrackers.set(trackingId, tracker);
      }
      
      return {
        content: response.data.content,
        trackingId
      };
    } catch (error) {
      logger.error('Error rendering prompt:', error);
      throw error;
    }
  }
  
  /**
   * Submit feedback for a prompt
   * @param trackingId Tracking ID
   * @param isSuccessful Whether the prompt was successful
   * @param feedback Optional feedback text
   * @param rating Optional rating (1-5)
   * @param category Optional feedback category
   * @param tags Optional feedback tags
   * @returns Success indicator
   */
  async submitFeedback(
    trackingId: string,
    isSuccessful: boolean,
    feedback?: string,
    rating?: number,
    category?: string,
    tags?: string[]
  ): Promise<boolean> {
    try {
      // Get the tracker for this tracking ID
      const tracker = this.activeTrackers.get(trackingId);
      
      if (tracker) {
        // Use the tracker to submit feedback
        const success = await tracker.submitFeedback(
          isSuccessful,
          feedback,
          rating,
          category,
          tags
        );
        
        // Remove the tracker from active trackers
        this.activeTrackers.delete(trackingId);
        
        return success;
      } else {
        // If no tracker exists, submit feedback directly
        const response = await axios.post(`${this.apiBase}/prompt-monitoring/feedback/${trackingId}`, {
          isSuccessful,
          feedback,
          feedbackRating: rating,
          feedbackCategory: category,
          feedbackTags: tags
        });
        
        return response.data.success;
      }
    } catch (error) {
      logger.error('Error submitting feedback:', error);
      throw error;
    }
  }
  
  /**
   * Record a follow-up question for a prompt
   * @param trackingId Tracking ID
   */
  recordFollowupQuestion(trackingId: string): void {
    const tracker = this.activeTrackers.get(trackingId);
    
    if (tracker) {
      tracker.recordFollowupQuestion();
    }
  }
  
  /**
   * Auto-detect success for a prompt
   * @param trackingId Tracking ID
   * @returns Success indicator
   */
  async autoDetectSuccess(trackingId: string): Promise<boolean> {
    try {
      const tracker = this.activeTrackers.get(trackingId);
      
      if (tracker) {
        const success = await tracker.autoDetectSuccess();
        
        // Remove the tracker from active trackers
        this.activeTrackers.delete(trackingId);
        
        return success;
      } else {
        logger.warn(`No active tracker found for tracking ID: ${trackingId}`);
        return false;
      }
    } catch (error) {
      logger.error('Error auto-detecting success:', error);
      throw error;
    }
  }
  
  /**
   * Generate a tracking ID
   * @returns Tracking ID
   */
  private generateTrackingId(): string {
    return `pt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}

// Create and export the prompt service instance
export const promptService = new PromptService();

export default promptService;

/**
 * Prompt Service
 *
 * Provides functionality for managing and retrieving AI system prompts.
 * Supports different prompt types and dynamic content substitution.
 */

import { logger } from '../../utils/logger';
import { supabaseClient } from '../supabase/supabaseClient';
// import fs from 'fs'; // Unused
// import path from 'path'; // Unused

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
 * Prompt data
 */
export interface PromptData {
  id: string;
  name: string;
  description?: string;
  promptType: PromptType;
  content: string;
  variables?: string[];
  isActive: boolean;
  location: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  currentVersion?: number;
  successRate?: number;
}

/**
 * Prompt version data
 */
export interface PromptVersionData {
  id: string;
  promptId: string;
  versionNumber: number;
  content: string;
  variables?: string[];
  isActive: boolean;
  createdAt: Date;
  createdBy?: string;
}

/**
 * Prompt success tracking data
 */
export interface PromptSuccessData {
  id: string;
  promptId: string;
  promptVersionId?: string;
  isSuccessful: boolean;
  feedback?: string;
  feedbackRating?: number;
  feedbackCategory?: string;
  feedbackTags?: string[];
  responseTimeMs?: number;
  userSessionId?: string;
  autoDetected?: boolean;
  detectionMethod?: string;
  userId?: string;
  createdAt: Date;
  context?: Record<string, any>;
  segmentId?: string;      // Added
  experimentId?: string;   // Added
  variantId?: string;      // Added
  interactionCount?: number; // Added
  interactionDurationMs?: number; // Added
  interactionPattern?: string[]; // Added
  followUpSentiment?: string; // Added
  sentimentScore?: number; // Added
}

/**
 * Prompt usage analytics data
 */
export interface PromptUsageAnalytics {
  id: string;
  promptId: string;
  date: Date;
  totalUses: number;
  successfulUses: number;
  failedUses: number;
  averageRating?: number;
  averageResponseTimeMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Prompt monitoring alert data
 */
export interface PromptMonitoringAlert {
  id: string;
  promptId: string;
  alertType: string;
  threshold: number;
  currentValue: number;
  isActive: boolean;
  triggeredAt: Date;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Prompt monitoring settings data
 */
export interface PromptMonitoringSetting {
  id: string;
  promptId: string;
  settingType: string;
  threshold: number;
  isActive: boolean;
  notificationEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Alert types
 */
export enum AlertType {
  LOW_SUCCESS_RATE = 'low_success_rate',
  LOW_RATING = 'low_rating',
  HIGH_RESPONSE_TIME = 'high_response_time',
  HIGH_FAILURE_RATE = 'high_failure_rate'
}

/**
 * A/B experiment data
 */
export interface ABExperimentData {
  id: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  trafficAllocation: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  variants?: ABVariantData[];
}

/**
 * A/B variant data
 */
export interface ABVariantData {
  id: string;
  experimentId: string;
  promptId: string;
  variantName: string;
  isControl: boolean;
  weight: number;
  createdAt: Date;
  updatedAt: Date;
  promptName?: string;
  successRate?: number;
}

/**
 * A/B assignment data
 */
export interface ABAssignmentData {
  id: string;
  experimentId: string;
  variantId: string;
  userId?: string;
  sessionId?: string;
  assignedAt: Date;
}

/**
 * User segment data
 */
export interface UserSegmentData {
  id: string;
  name: string;
  description?: string;
  segmentType: string;
  segmentCriteria: Record<string, any>;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User segment assignment data
 */
export interface UserSegmentAssignmentData {
  id: string;
  segmentId: string;
  userId?: string;
  sessionId?: string;
  assignedAt: Date;
}

/**
 * Enhanced user actions for auto-detection
 */
export interface EnhancedUserActions {
  timeSpentOnPage?: number;
  scrollDepth?: number;
  clickedLinks?: number;
  copiedText?: boolean;
  followupQuestions?: number;
  interactionCount?: number;
  interactionDurationMs?: number;
  interactionPattern?: string[];
  followUpSentiment?: string;
  sentimentScore?: number;
}

/**
 * Prompt render options
 */
export interface PromptRenderOptions {
  promptId?: string;
  promptName?: string;
  promptContent?: string;
  data: Record<string, any>;
  trackingId?: string;
  userId?: string;
  sessionId?: string;
  experimentId?: string;
  segmentId?: string;
  abTestingEnabled?: boolean;
}

/**
 * Prompt service class
 */
class PromptService {
  private promptCache: Map<string, string> = new Map();

  constructor() {
    logger.info('Prompt service initialized');
  }

  /**
   * Get all prompts
   * @param type Optional prompt type filter
   * @returns Array of prompts
   */
  async getAllPrompts(type?: PromptType): Promise<PromptData[]> {
    try {
      let query = supabaseClient.getClient()
        .from('system_prompts')
        .select('*');

      if (type) {
        query = query.eq('prompt_type', type);
      }

      const { data, error } = await query.order('name', { ascending: true });

      if (error) {
        throw new Error(`Failed to get prompts: ${error.message}`);
      }

      return (data || []).map(this.mapPromptFromDb);
    } catch (error) {
      logger.error(`Failed to get all prompts: ${error}`);
      throw error;
    }
  }

  /**
   * Get prompt by ID
   * @param id Prompt ID
   * @returns Prompt data
   */
  async getPromptById(id: string): Promise<PromptData> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('system_prompts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw new Error(`Failed to get prompt: ${error.message}`);
      }

      if (!data) {
        throw new Error(`Prompt with ID ${id} not found`);
      }

      return this.mapPromptFromDb(data);
    } catch (error) {
      logger.error(`Failed to get prompt by ID: ${error}`);
      throw error;
    }
  }

  /**
   * Get prompt by name and type
   * @param name Prompt name
   * @param type Prompt type
   * @returns Prompt data
   */
  async getPromptByNameAndType(name: string, type: PromptType): Promise<PromptData> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('system_prompts')
        .select('*')
        .eq('name', name)
        .eq('prompt_type', type)
        .single();

      if (error) {
        throw new Error(`Failed to get prompt: ${error.message}`);
      }

      if (!data) {
        throw new Error(`Prompt with name ${name} and type ${type} not found`);
      }

      return this.mapPromptFromDb(data);
    } catch (error) {
      logger.error(`Failed to get prompt by name and type: ${error}`);
      throw error;
    }
  }

  /**
   * Create a new prompt
   * @param prompt Prompt data
   * @returns Created prompt ID
   */
  async createPrompt(prompt: Omit<PromptData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // Validate prompt
      this.validatePrompt(prompt);

      // Create prompt in database
      const { data, error } = await supabaseClient.getClient()
        .from('system_prompts')
        .insert([{
          name: prompt.name,
          description: prompt.description || '',
          prompt_type: prompt.promptType,
          content: prompt.content,
          variables: prompt.variables || [],
          is_active: prompt.isActive,
          location: prompt.location,
          created_by: prompt.createdBy
        }])
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create prompt: ${error.message}`);
      }

      return data.id;
    } catch (error) {
      logger.error(`Failed to create prompt: ${error}`);
      throw error;
    }
  }

  /**
   * Update an existing prompt
   * @param id Prompt ID
   * @param prompt Prompt data
   * @param createVersion Whether to create a new version
   * @returns Success indicator
   */
  async updatePrompt(
    id: string,
    prompt: Partial<Omit<PromptData, 'id' | 'createdAt' | 'updatedAt'>>,
    createVersion: boolean = true
  ): Promise<boolean> {
    try {
      // Get the current prompt to check if content has changed
      const currentPrompt = await this.getPromptById(id);
      const contentChanged = prompt.content && prompt.content !== currentPrompt.content;

      // Start a transaction
      const client = supabaseClient.getClient();

      // If content has changed and createVersion is true, create a new version
      if (contentChanged && createVersion) {
        // Get the current version number
        const { data: versionData, error: versionError } = await client
          .from('system_prompt_versions')
          .select('version_number')
          .eq('prompt_id', id)
          .order('version_number', { ascending: false })
          .limit(1);

        if (versionError) {
          throw new Error(`Failed to get current version: ${versionError.message}`);
        }

        // Calculate the next version number
        const nextVersionNumber = versionData && versionData.length > 0
          ? versionData[0].version_number + 1
          : 1;

        // Create a new version with the current content
        const { error: createVersionError } = await client
          .from('system_prompt_versions')
          .insert([{
            prompt_id: id,
            version_number: nextVersionNumber,
            content: prompt.content,
            variables: prompt.variables || currentPrompt.variables,
            is_active: true,
            created_by: prompt.createdBy
          }]);

        if (createVersionError) {
          throw new Error(`Failed to create version: ${createVersionError.message}`);
        }

        // Deactivate previous versions
        const { error: deactivateError } = await client
          .from('system_prompt_versions')
          .update({ is_active: false })
          .eq('prompt_id', id)
          .lt('version_number', nextVersionNumber);

        if (deactivateError) {
          throw new Error(`Failed to deactivate previous versions: ${deactivateError.message}`);
        }

        // Update the prompt with the new version number
        const { error } = await client
          .from('system_prompts')
          .update({
            name: prompt.name,
            description: prompt.description,
            prompt_type: prompt.promptType,
            content: prompt.content,
            variables: prompt.variables,
            is_active: prompt.isActive,
            location: prompt.location,
            updated_at: new Date(),
            current_version: nextVersionNumber
          })
          .eq('id', id);

        if (error) {
          throw new Error(`Failed to update prompt: ${error.message}`);
        }
      } else {
        // Just update the prompt without creating a new version
        const { error } = await client
          .from('system_prompts')
          .update({
            name: prompt.name,
            description: prompt.description,
            prompt_type: prompt.promptType,
            content: prompt.content,
            variables: prompt.variables,
            is_active: prompt.isActive,
            location: prompt.location,
            updated_at: new Date()
          })
          .eq('id', id);

        if (error) {
          throw new Error(`Failed to update prompt: ${error.message}`);
        }
      }

      // Clear cache for this prompt
      this.clearPromptCache(id);

      return true;
    } catch (error) {
      logger.error(`Failed to update prompt: ${error}`);
      throw error;
    }
  }

  /**
   * Delete a prompt
   * @param id Prompt ID
   * @returns Success indicator
   */
  async deletePrompt(id: string): Promise<boolean> {
    try {
      const { error } = await supabaseClient.getClient()
        .from('system_prompts')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete prompt: ${error.message}`);
      }

      // Clear cache for this prompt
      this.clearPromptCache(id);

      return true;
    } catch (error) {
      logger.error(`Failed to delete prompt: ${error}`);
      throw error;
    }
  }

  /**
   * Render a prompt with variables
   * @param options Prompt render options
   * @returns Rendered content and variant info
   */
  async renderPrompt(options: PromptRenderOptions): Promise<{ content: string; variantId?: string; experimentId?: string }> {
    try {
      let promptContent: string;
      let promptId: string | undefined;
      let promptVersionId: string | undefined;
      let variantId: string | undefined;
      let experimentId: string | undefined;
      let segmentId: string | undefined = options.segmentId;

      // Check if user belongs to any segments if not already specified
      if (!segmentId && (options.userId || options.sessionId)) {
        segmentId = await this.getUserSegment(options.userId, options.sessionId);
      }

      // Check if A/B testing is enabled
      if (options.abTestingEnabled !== false) {
        // If promptId is provided, check if it's part of an active experiment
        if (options.promptId) {
          const assignment = await this.getOrCreateABAssignment(
            options.promptId,
            options.userId,
            options.sessionId,
            options.experimentId
          );

          if (assignment) {
            // Use the assigned variant
            promptId = assignment.promptId;
            variantId = assignment.variantId;
            experimentId = assignment.experimentId;

            // Get the prompt content for this variant
            const prompt = await this.getPromptById(promptId);
            promptContent = prompt.content;

            // If the prompt has an active version, use that instead
            if (prompt.currentVersion) {
              const version = await this.getPromptVersion(promptId, prompt.currentVersion);
              if (version) {
                promptContent = version.content;
                promptVersionId = version.id;
              }
            }
          } else {
            // No active experiment or not assigned, use the original prompt
            promptId = options.promptId;
            const prompt = await this.getPromptById(promptId);
            promptContent = prompt.content;

            // If the prompt has an active version, use that instead
            if (prompt.currentVersion) {
              const version = await this.getPromptVersion(promptId, prompt.currentVersion);
              if (version) {
                promptContent = version.content;
                promptVersionId = version.id;
              }
            }
          }
        } else if (options.promptContent) {
          // Use provided content directly
          promptContent = options.promptContent;
        } else if (options.promptName) {
          // Get prompt by name from database
          // This is a simplified version, in reality you'd need the type too
          throw new Error('Getting prompt by name requires prompt type');
        } else {
          throw new Error('Prompt content or ID must be provided');
        }
      } else {
        // A/B testing disabled, use the original prompt
        if (options.promptContent) {
          // Use provided content directly
          promptContent = options.promptContent;
        } else if (options.promptId) {
          // Get prompt by ID from database
          promptId = options.promptId;
          const prompt = await this.getPromptById(promptId);
          promptContent = prompt.content;

          // If the prompt has an active version, use that instead
          if (prompt.currentVersion) {
            const version = await this.getPromptVersion(promptId, prompt.currentVersion);
            if (version) {
              promptContent = version.content;
              promptVersionId = version.id;
            }
          }
        } else if (options.promptName) {
          // Get prompt by name from database
          // This is a simplified version, in reality you'd need the type too
          throw new Error('Getting prompt by name requires prompt type');
        } else {
          throw new Error('Prompt content or ID must be provided');
        }
      }

      // Replace variables in the prompt
      const renderedContent = this.replaceVariables(promptContent, options.data);

      // If tracking ID is provided, create a tracking record
      if (options.trackingId && promptId) {
        // Create a tracking record with pending status
        await this.createPromptTrackingRecord({
          id: options.trackingId,
          promptId,
          promptVersionId,
          isSuccessful: false, // Will be updated later
          context: options.data,
          userId: options.userId,
          userSessionId: options.sessionId,
          segmentId,
          experimentId,
          variantId
        });
      }

      return {
        content: renderedContent,
        variantId,
        experimentId
      };
    } catch (error) {
      logger.error(`Failed to render prompt: ${error}`);
      throw error;
    }
  }

  /**
   * Get all versions of a prompt
   * @param promptId Prompt ID
   * @returns Array of prompt versions
   */
  async getPromptVersions(promptId: string): Promise<PromptVersionData[]> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('system_prompt_versions')
        .select('*')
        .eq('prompt_id', promptId)
        .order('version_number', { ascending: false });

      if (error) {
        throw new Error(`Failed to get prompt versions: ${error.message}`);
      }

      return (data || []).map(this.mapVersionFromDb);
    } catch (error) {
      logger.error(`Failed to get prompt versions: ${error}`);
      throw error;
    }
  }

  /**
   * Get a specific version of a prompt
   * @param promptId Prompt ID
   * @param versionNumber Version number
   * @returns Prompt version data
   */
  async getPromptVersion(promptId: string, versionNumber: number): Promise<PromptVersionData | null> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('system_prompt_versions')
        .select('*')
        .eq('prompt_id', promptId)
        .eq('version_number', versionNumber)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        throw new Error(`Failed to get prompt version: ${error.message}`);
      }

      return this.mapVersionFromDb(data);
    } catch (error) {
      logger.error(`Failed to get prompt version: ${error}`);
      throw error;
    }
  }

  /**
   * Revert to a previous version of a prompt
   * @param promptId Prompt ID
   * @param versionNumber Version number to revert to
   * @returns Success indicator
   */
  async revertToVersion(promptId: string, versionNumber: number): Promise<boolean> {
    try {
      // Get the version to revert to
      const version = await this.getPromptVersion(promptId, versionNumber);

      if (!version) {
        throw new Error(`Version ${versionNumber} not found for prompt ${promptId}`);
      }

      // Get the current prompt
      const prompt = await this.getPromptById(promptId);

      // Update the prompt with the version content
      return this.updatePrompt(promptId, {
        content: version.content,
        variables: version.variables,
        // Keep other fields the same
        name: prompt.name,
        description: prompt.description,
        promptType: prompt.promptType,
        isActive: prompt.isActive,
        location: prompt.location
      }, true); // Create a new version
    } catch (error) {
      logger.error(`Failed to revert to version: ${error}`);
      throw error;
    }
  }

  /**
   * Create a prompt tracking record
   * @param data Tracking data
   * @returns Created tracking ID
   */
  async createPromptTrackingRecord(data: Omit<PromptSuccessData, 'createdAt'>): Promise<string> {
    try {
      const { data: result, error } = await supabaseClient.getClient()
        .from('system_prompt_success_tracking')
        .insert([{
          id: data.id,
          prompt_id: data.promptId,
          prompt_version_id: data.promptVersionId,
          is_successful: data.isSuccessful,
          feedback: data.feedback,
          feedback_rating: data.feedbackRating,
          feedback_category: data.feedbackCategory,
          feedback_tags: data.feedbackTags,
          response_time_ms: data.responseTimeMs,
          user_session_id: data.userSessionId,
          auto_detected: data.autoDetected,
          detection_method: data.detectionMethod,
          user_id: data.userId,
          context: data.context || {}
        }])
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create tracking record: ${error.message}`);
      }

      return result.id;
    } catch (error) {
      logger.error(`Failed to create tracking record: ${error}`);
      throw error;
    }
  }

  /**
   * Update a prompt tracking record with success/failure
   * @param trackingId Tracking ID
   * @param data Update data
   * @returns Success indicator
   */
  async updatePromptTrackingRecord(
    trackingId: string,
    data: {
      isSuccessful?: boolean;
      feedback?: string;
      feedbackRating?: number;
      feedbackCategory?: string;
      feedbackTags?: string[];
      responseTimeMs?: number;
      autoDetected?: boolean;
      detectionMethod?: string;
      // Add new fields from autoDetectPromptSuccess
      interactionCount?: number;
      interactionDurationMs?: number;
      interactionPattern?: string[];
      followUpSentiment?: string;
      sentimentScore?: number;
    }
  ): Promise<boolean> {
    try {
      // Prepare the payload with camelCase keys matching PromptSuccessData
      const updatePayload: Partial<PromptSuccessData> = {
        isSuccessful: data.isSuccessful,
        feedback: data.feedback,
        feedbackRating: data.feedbackRating,
        feedbackCategory: data.feedbackCategory,
        feedbackTags: data.feedbackTags,
        responseTimeMs: data.responseTimeMs,
        autoDetected: data.autoDetected,
        detectionMethod: data.detectionMethod,
        interactionCount: data.interactionCount,
        interactionDurationMs: data.interactionDurationMs,
        interactionPattern: data.interactionPattern,
        followUpSentiment: data.followUpSentiment,
        sentimentScore: data.sentimentScore
      };
      
      // Remove undefined fields from payload to avoid overwriting with null
      // And ensure we only pass fields that are part of the DB update schema
      const dbUpdatePayload: Record<string, any> = {};
      for (const key in updatePayload) {
        if (updatePayload[key as keyof typeof updatePayload] !== undefined) {
          // Assume Supabase client handles camelCase to snake_case conversion for column names
          dbUpdatePayload[key] = updatePayload[key as keyof typeof updatePayload];
        }
      }

      const { error } = await supabaseClient.getClient()
        .from('system_prompt_success_tracking')
        .update(dbUpdatePayload)
        .eq('id', trackingId);

      if (error) {
        throw new Error(`Failed to update tracking record: ${error.message}`);
      }

      return true;
    } catch (error) {
      logger.error(`Failed to update tracking record: ${error}`);
      throw error;
    }
  }

  /**
   * Auto-detect prompt success based on user behavior
   * @param trackingId Tracking ID
   * @param responseTimeMs Response time in milliseconds
   * @param userActions Enhanced user actions after prompt response
   * @returns Success indicator
   */
  async autoDetectPromptSuccess(
    trackingId: string,
    responseTimeMs: number,
    userActions: EnhancedUserActions
  ): Promise<boolean> {
    try {
      // Implement enhanced auto-detection logic
      let isSuccessful = false;
      let detectionMethod = 'enhanced_behavior_analysis';
      let sentimentScore = 0;
      let followUpSentiment = 'neutral';

      // Calculate base score using basic metrics
      let baseScore = (
        (userActions.timeSpentOnPage && userActions.timeSpentOnPage > 10000 ? 1 : 0) +
        (userActions.scrollDepth && userActions.scrollDepth > 0.5 ? 1 : 0) +
        (userActions.clickedLinks && userActions.clickedLinks > 0 ? 1 : 0) +
        (userActions.copiedText ? 1 : 0) +
        (userActions.followupQuestions && userActions.followupQuestions > 0 ? 1 : 0)
      );

      // Enhanced scoring based on additional metrics

      // 1. Interaction patterns
      if (userActions.interactionPattern && userActions.interactionPattern.length > 0) {
        // Check for positive interaction patterns
        const positivePatterns = ['highlight_text', 'save_response', 'share_response', 'expand_details'];
        const negativePatterns = ['close_immediately', 'retry_query', 'report_issue', 'request_alternative'];

        const positiveCount = userActions.interactionPattern.filter(p => positivePatterns.includes(p)).length;
        const negativeCount = userActions.interactionPattern.filter(p => negativePatterns.includes(p)).length;

        baseScore += positiveCount * 0.5;
        baseScore -= negativeCount * 0.5;
      }

      // 2. Interaction duration and count
      if (userActions.interactionDurationMs && userActions.interactionCount) {
        // If user interacted a lot with the response, it's likely useful
        if (userActions.interactionCount > 3 && userActions.interactionDurationMs > 30000) {
          baseScore += 1;
        }

        // If user barely interacted with the response, it might not be useful
        if (userActions.interactionCount === 1 && userActions.interactionDurationMs < 5000) {
          baseScore -= 1;
        }
      }

      // 3. Follow-up sentiment analysis
      if (userActions.sentimentScore !== undefined) {
        sentimentScore = userActions.sentimentScore;

        // Adjust score based on sentiment
        if (sentimentScore > 0.5) {
          followUpSentiment = 'positive';
          baseScore += 1;
        } else if (sentimentScore < -0.5) {
          followUpSentiment = 'negative';
          baseScore -= 1;
        }
      }

      // 4. Time-based success indicators
      if (userActions.timeSpentOnPage) {
        // More granular time-based scoring
        if (userActions.timeSpentOnPage > 60000) { // More than 1 minute
          baseScore += 1;
        } else if (userActions.timeSpentOnPage < 3000) { // Less than 3 seconds
          baseScore -= 1;
        }
      }

      // If score is 3 or higher, consider it successful
      isSuccessful = baseScore >= 3;

      // Prepare interaction pattern array
      const interactionPattern = userActions.interactionPattern || [];

      // Update the tracking record with enhanced data
      const updateData = {
        isSuccessful,
        responseTimeMs,
        autoDetected: true,
        detectionMethod,
        interactionCount: userActions.interactionCount,
        interactionDurationMs: userActions.interactionDurationMs,
        interactionPattern,
        followUpSentiment,
        sentimentScore
      };
      return this.updatePromptTrackingRecord(trackingId, updateData);
    } catch (error) {
      logger.error(`Failed to auto-detect prompt success: ${error}`);
      throw error;
    }
  }

  /**
   * Get or create an A/B test assignment
   * @param promptId Prompt ID
   * @param userId User ID
   * @param sessionId Session ID
   * @param experimentId Optional experiment ID
   * @returns Assignment data or null if no active experiment
   */
  async getOrCreateABAssignment(
    promptId: string,
    userId?: string,
    sessionId?: string,
    experimentId?: string
  ): Promise<{ promptId: string; variantId: string; experimentId: string } | null> {
    try {
      if (!userId && !sessionId) {
        return null; // Need either user ID or session ID
      }

      // Check if user already has an assignment for this experiment
      if (experimentId) {
        // Check for existing assignment
        const { data: assignmentData, error: assignmentError } = await supabaseClient.getClient()
          .from('prompt_ab_assignments')
          .select('id, variant_id')
          .eq('experiment_id', experimentId)
          .eq(userId ? 'user_id' : 'session_id', userId || sessionId)
          .maybeSingle();

        if (!assignmentError && assignmentData) {
          // Get variant info
          const { data: variantData, error: variantError } = await supabaseClient.getClient()
            .from('prompt_ab_variants')
            .select('prompt_id')
            .eq('id', assignmentData.variant_id)
            .single();

          if (!variantError && variantData) {
            return {
              promptId: variantData.prompt_id,
              variantId: assignmentData.variant_id,
              experimentId
            };
          }
        }
      }

      // Find active experiments for this prompt
      const { data: experimentsData, error: experimentsError } = await supabaseClient.getClient()
        .from('prompt_ab_experiments')
        .select(`
          id,
          name,
          traffic_allocation,
          prompt_ab_variants!inner (
            id,
            prompt_id,
            variant_name,
            is_control,
            weight
          )
        `)
        .eq('is_active', true)
        .eq('prompt_ab_variants.prompt_id', promptId)
        .is('end_date', null)
        .order('created_at', { ascending: false });

      if (experimentsError || !experimentsData || experimentsData.length === 0) {
        return null; // No active experiments
      }

      // Use the most recent experiment
      const experiment = experimentsData[0];

      // Check if user should be included in the experiment based on traffic allocation
      const randomValue = Math.random() * 100;
      if (randomValue > experiment.traffic_allocation) {
        return null; // User not included in experiment
      }

      // Select a variant based on weights
      const variants: ABVariantData[] = experiment.prompt_ab_variants || [];
      if (variants.length === 0) {
        logger.warn(`Experiment ${experiment.id} has no variants.`);
        return null; // Or handle as an error
      }
      const totalWeight = variants.reduce((sum: number, variant: ABVariantData) => sum + (variant.weight || 0), 0);
      let randomWeight = Math.random() * totalWeight;
      let selectedVariant: ABVariantData = variants[0]!; // Default to first variant, non-null assertion as we check length

      for (const variant of variants) {
        randomWeight -= (variant.weight || 0);
        if (randomWeight <= 0) {
          selectedVariant = variant;
          break;
        }
      }

      // Create assignment
      const { data: assignmentData, error: createError } = await supabaseClient.getClient()
        .from('prompt_ab_assignments')
        .insert({
          experiment_id: experiment.id,
          variant_id: selectedVariant.id,
          user_id: userId,
          session_id: sessionId
        })
        .select('id')
        .single();

      if (createError) {
        logger.error(`Failed to create A/B assignment: ${createError.message}`);
        return null;
      }

      return {
        promptId: selectedVariant.promptId, // Use camelCase from ABVariantData
        variantId: selectedVariant.id,
        experimentId: experiment.id
      };
    } catch (error) {
      logger.error(`Failed to get or create A/B assignment: ${error}`);
      return null;
    }
  }

  /**
   * Get user segment
   * @param userId User ID
   * @param sessionId Session ID
   * @returns Segment ID or undefined
   */
  async getUserSegment(userId?: string, sessionId?: string): Promise<string | undefined> {
    try {
      if (!userId && !sessionId) {
        return undefined; // Need either user ID or session ID
      }

      // Check for existing segment assignment
      const { data: assignmentData, error: assignmentError } = await supabaseClient.getClient()
        .from('user_segment_assignments')
        .select('segment_id')
        .eq(userId ? 'user_id' : 'session_id', userId || sessionId)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!assignmentError && assignmentData) {
        return assignmentData.segment_id;
      }

      // No existing assignment, check if user matches any segment criteria
      const { data: segmentsData, error: segmentsError } = await supabaseClient.getClient()
        .from('user_segments')
        .select('id, segment_type, segment_criteria')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (segmentsError || !segmentsData || segmentsData.length === 0) {
        return undefined; // No active segments
      }

      // Check each segment
      for (const segment of segmentsData) {
        // Simple implementation - in a real system, this would be more sophisticated
        // and would check the user's properties against the segment criteria
        if (segment.segment_type === 'random') {
          // Random assignment based on probability
          const probability = segment.segment_criteria.probability || 0.5;
          if (Math.random() < probability) {
            // Create assignment
            const { data: assignmentData, error: createError } = await supabaseClient.getClient()
              .from('user_segment_assignments')
              .insert({
                segment_id: segment.id,
                user_id: userId,
                session_id: sessionId
              })
              .select('id')
              .single();

            if (createError) {
              logger.error(`Failed to create segment assignment: ${createError.message}`);
              continue;
            }

            return segment.id;
          }
        }
      }

      return undefined;
    } catch (error) {
      logger.error(`Failed to get user segment: ${error}`);
      return undefined;
    }
  }

  /**
   * Get prompt usage analytics
   * @param promptId Prompt ID
   * @param startDate Start date
   * @param endDate End date
   * @param segmentId Optional segment ID
   * @param experimentId Optional experiment ID
   * @param variantId Optional variant ID
   * @returns Prompt usage analytics
   */
  async getPromptUsageAnalytics(
    promptId: string,
    startDate: Date,
    endDate: Date,
    segmentId?: string,
    experimentId?: string,
    variantId?: string
  ): Promise<PromptUsageAnalytics[]> {
    try {
      let query = supabaseClient.getClient()
        .from('prompt_usage_analytics')
        .select('*')
        .eq('prompt_id', promptId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      // Add filters for segmentation and A/B testing
      if (segmentId) {
        query = query.eq('segment_id', segmentId);
      }

      if (experimentId) {
        query = query.eq('experiment_id', experimentId);
      }

      if (variantId) {
        query = query.eq('variant_id', variantId);
      }

      const { data, error } = await query.order('date', { ascending: true });

      if (error) {
        throw new Error(`Failed to get prompt usage analytics: ${error.message}`);
      }

      return (data || []).map(this.mapAnalyticsFromDb);
    } catch (error) {
      logger.error(`Failed to get prompt usage analytics: ${error}`);
      throw error;
    }
  }

  /**
   * Get A/B test experiments
   * @param isActive Filter by active status
   * @returns Array of A/B test experiments
   */
  async getABExperiments(isActive?: boolean): Promise<ABExperimentData[]> {
    try {
      let query = supabaseClient.getClient()
        .from('prompt_ab_experiments')
        .select(`
          *,
          prompt_ab_variants (
            id,
            prompt_id,
            variant_name,
            is_control,
            weight,
            created_at,
            updated_at
          )
        `);

      if (isActive !== undefined) {
        query = query.eq('is_active', isActive);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get A/B experiments: ${error.message}`);
      }

      return (data || []).map(this.mapExperimentFromDb);
    } catch (error) {
      logger.error(`Failed to get A/B experiments: ${error}`);
      throw error;
    }
  }

  /**
   * Get A/B test experiment by ID
   * @param experimentId Experiment ID
   * @returns A/B test experiment data
   */
  async getABExperimentById(experimentId: string): Promise<ABExperimentData> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('prompt_ab_experiments')
        .select(`
          *,
          prompt_ab_variants (
            id,
            prompt_id,
            variant_name,
            is_control,
            weight,
            created_at,
            updated_at
          )
        `)
        .eq('id', experimentId)
        .single();

      if (error) {
        throw new Error(`Failed to get A/B experiment: ${error.message}`);
      }

      return this.mapExperimentFromDb(data);
    } catch (error) {
      logger.error(`Failed to get A/B experiment by ID: ${error}`);
      throw error;
    }
  }

  /**
   * Create A/B test experiment
   * @param experiment Experiment data
   * @returns Created experiment ID
   */
  async createABExperiment(
    experiment: Omit<ABExperimentData, 'id' | 'createdAt' | 'updatedAt'> & { variants: Omit<ABVariantData, 'id' | 'experimentId' | 'createdAt' | 'updatedAt'>[] }
  ): Promise<string> {
    try {
      // Start a transaction
      const client = supabaseClient.getClient();

      // Create the experiment
      const { data: experimentData, error: experimentError } = await client
        .from('prompt_ab_experiments')
        .insert({
          name: experiment.name,
          description: experiment.description,
          start_date: experiment.startDate,
          end_date: experiment.endDate,
          is_active: experiment.isActive,
          traffic_allocation: experiment.trafficAllocation,
          created_by: experiment.createdBy
        })
        .select('id')
        .single();

      if (experimentError) {
        throw new Error(`Failed to create A/B experiment: ${experimentError.message}`);
      }

      const experimentId = experimentData.id;

      // Create the variants
      for (const variant of experiment.variants) {
        const { error: variantError } = await client
          .from('prompt_ab_variants')
          .insert({
            experiment_id: experimentId,
            prompt_id: variant.promptId,
            variant_name: variant.variantName,
            is_control: variant.isControl,
            weight: variant.weight
          });

        if (variantError) {
          throw new Error(`Failed to create A/B variant: ${variantError.message}`);
        }
      }

      return experimentId;
    } catch (error) {
      logger.error(`Failed to create A/B experiment: ${error}`);
      throw error;
    }
  }

  /**
   * Update A/B test experiment
   * @param experimentId Experiment ID
   * @param experiment Experiment data
   * @returns Success indicator
   */
  async updateABExperiment(
    experimentId: string,
    experiment: Partial<Omit<ABExperimentData, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<boolean> {
    try {
      const { error } = await supabaseClient.getClient()
        .from('prompt_ab_experiments')
        .update({
          name: experiment.name,
          description: experiment.description,
          end_date: experiment.endDate,
          is_active: experiment.isActive,
          traffic_allocation: experiment.trafficAllocation,
          updated_at: new Date()
        })
        .eq('id', experimentId);

      if (error) {
        throw new Error(`Failed to update A/B experiment: ${error.message}`);
      }

      return true;
    } catch (error) {
      logger.error(`Failed to update A/B experiment: ${error}`);
      throw error;
    }
  }

  /**
   * Get user segments
   * @param isActive Filter by active status
   * @returns Array of user segments
   */
  async getUserSegments(isActive?: boolean): Promise<UserSegmentData[]> {
    try {
      let query = supabaseClient.getClient()
        .from('user_segments')
        .select('*');

      if (isActive !== undefined) {
        query = query.eq('is_active', isActive);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get user segments: ${error.message}`);
      }

      return (data || []).map(this.mapSegmentFromDb);
    } catch (error) {
      logger.error(`Failed to get user segments: ${error}`);
      throw error;
    }
  }

  /**
   * Create user segment
   * @param segment Segment data
   * @returns Created segment ID
   */
  async createUserSegment(
    segment: Omit<UserSegmentData, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('user_segments')
        .insert({
          name: segment.name,
          description: segment.description,
          segment_type: segment.segmentType,
          segment_criteria: segment.segmentCriteria,
          is_active: segment.isActive,
          created_by: segment.createdBy
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create user segment: ${error.message}`);
      }

      return data.id;
    } catch (error) {
      logger.error(`Failed to create user segment: ${error}`);
      throw error;
    }
  }

  /**
   * Get active monitoring alerts
   * @param promptId Optional prompt ID to filter by
   * @returns Active monitoring alerts
   */
  async getActiveMonitoringAlerts(promptId?: string): Promise<PromptMonitoringAlert[]> {
    try {
      let query = supabaseClient.getClient()
        .from('prompt_monitoring_alerts')
        .select('*')
        .eq('is_active', true);

      if (promptId) {
        query = query.eq('prompt_id', promptId);
      }

      const { data, error } = await query.order('triggered_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get active monitoring alerts: ${error.message}`);
      }

      return (data || []).map(this.mapAlertFromDb);
    } catch (error) {
      logger.error(`Failed to get active monitoring alerts: ${error}`);
      throw error;
    }
  }

  /**
   * Resolve a monitoring alert
   * @param alertId Alert ID
   * @returns Success indicator
   */
  async resolveMonitoringAlert(alertId: string): Promise<boolean> {
    try {
      const { error } = await supabaseClient.getClient()
        .from('prompt_monitoring_alerts')
        .update({
          is_active: false,
          resolved_at: new Date(),
          updated_at: new Date()
        })
        .eq('id', alertId);

      if (error) {
        throw new Error(`Failed to resolve monitoring alert: ${error.message}`);
      }

      return true;
    } catch (error) {
      logger.error(`Failed to resolve monitoring alert: ${error}`);
      throw error;
    }
  }

  /**
   * Create or update a monitoring setting
   * @param setting Monitoring setting
   * @returns Setting ID
   */
  async saveMonitoringSetting(
    setting: Omit<PromptMonitoringSetting, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      // Check if setting already exists
      const { data: existingData, error: existingError } = await supabaseClient.getClient()
        .from('prompt_monitoring_settings')
        .select('id')
        .eq('prompt_id', setting.promptId)
        .eq('setting_type', setting.settingType)
        .maybeSingle();

      if (existingError) {
        throw new Error(`Failed to check existing setting: ${existingError.message}`);
      }

      if (existingData) {
        // Update existing setting
        const { error } = await supabaseClient.getClient()
          .from('prompt_monitoring_settings')
          .update({
            threshold: setting.threshold,
            is_active: setting.isActive,
            notification_email: setting.notificationEmail,
            updated_at: new Date()
          })
          .eq('id', existingData.id);

        if (error) {
          throw new Error(`Failed to update monitoring setting: ${error.message}`);
        }

        return existingData.id;
      } else {
        // Create new setting
        const { data, error } = await supabaseClient.getClient()
          .from('prompt_monitoring_settings')
          .insert([{
            prompt_id: setting.promptId,
            setting_type: setting.settingType,
            threshold: setting.threshold,
            is_active: setting.isActive,
            notification_email: setting.notificationEmail
          }])
          .select('id')
          .single();

        if (error) {
          throw new Error(`Failed to create monitoring setting: ${error.message}`);
        }

        return data.id;
      }
    } catch (error) {
      logger.error(`Failed to save monitoring setting: ${error}`);
      throw error;
    }
  }

  /**
   * Get success rate for a prompt
   * @param promptId Prompt ID
   * @returns Success rate (0-100)
   */
  async getPromptSuccessRate(promptId: string): Promise<number> {
    try {
      // Get total count
      const { count: totalCount, error: totalError } = await supabaseClient.getClient()
        .from('system_prompt_success_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('prompt_id', promptId);

      if (totalError) {
        throw new Error(`Failed to get total count: ${totalError.message}`);
      }

      if (totalCount === 0) {
        return 0;
      }

      // Get success count
      const { count: successCount, error: successError } = await supabaseClient.getClient()
        .from('system_prompt_success_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('prompt_id', promptId)
        .eq('is_successful', true);

      if (successError) {
        throw new Error(`Failed to get success count: ${successError.message}`);
      }

      // Calculate success rate
      return Math.round((successCount / totalCount) * 100);
    } catch (error) {
      logger.error(`Failed to get prompt success rate: ${error}`);
      throw error;
    }
  }

  /**
   * Get success rate for a specific version of a prompt
   * @param promptId Prompt ID
   * @param versionNumber Version number
   * @returns Success rate (0-100)
   */
  async getPromptVersionSuccessRate(promptId: string, versionNumber: number): Promise<number> {
    try {
      // Get the version ID
      const version = await this.getPromptVersion(promptId, versionNumber);

      if (!version) {
        throw new Error(`Version ${versionNumber} not found for prompt ${promptId}`);
      }

      // Get total count
      const { count: totalCount, error: totalError } = await supabaseClient.getClient()
        .from('system_prompt_success_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('prompt_version_id', version.id);

      if (totalError) {
        throw new Error(`Failed to get total count: ${totalError.message}`);
      }

      if (totalCount === 0) {
        return 0;
      }

      // Get success count
      const { count: successCount, error: successError } = await supabaseClient.getClient()
        .from('system_prompt_success_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('prompt_version_id', version.id)
        .eq('is_successful', true);

      if (successError) {
        throw new Error(`Failed to get success count: ${successError.message}`);
      }

      // Calculate success rate
      return Math.round((successCount / totalCount) * 100);
    } catch (error) {
      logger.error(`Failed to get prompt version success rate: ${error}`);
      throw error;
    }
  }

  /**
   * Clear prompt cache
   * @param id Prompt ID
   */
  private clearPromptCache(id: string): void {
    this.promptCache.delete(id);
  }

  /**
   * Replace variables in a prompt
   * @param content Prompt content
   * @param data Variable data
   * @returns Rendered content
   */
  private replaceVariables(content: string, data: Record<string, any>): string {
    let result = content;

    // Replace variables in the format {variable_name}
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{${key}}`, 'g');
      result = result.replace(regex, String(value));
    }

    return result;
  }

  /**
   * Map database prompt to PromptData
   * @param dbPrompt Database prompt
   * @returns Mapped prompt data
   */
  private mapPromptFromDb(dbPrompt: any): PromptData {
    return {
      id: dbPrompt.id,
      name: dbPrompt.name,
      description: dbPrompt.description,
      promptType: dbPrompt.prompt_type as PromptType,
      content: dbPrompt.content,
      variables: dbPrompt.variables,
      isActive: dbPrompt.is_active,
      location: dbPrompt.location,
      createdAt: new Date(dbPrompt.created_at),
      updatedAt: new Date(dbPrompt.updated_at),
      createdBy: dbPrompt.created_by,
      currentVersion: dbPrompt.current_version,
      successRate: dbPrompt.success_rate
    };
  }

  /**
   * Map database version to PromptVersionData
   * @param dbVersion Database version
   * @returns Mapped version data
   */
  private mapVersionFromDb(dbVersion: any): PromptVersionData {
    return {
      id: dbVersion.id,
      promptId: dbVersion.prompt_id,
      versionNumber: dbVersion.version_number,
      content: dbVersion.content,
      variables: dbVersion.variables,
      isActive: dbVersion.is_active,
      createdAt: new Date(dbVersion.created_at),
      createdBy: dbVersion.created_by
    };
  }

  /**
   * Map database tracking record to PromptSuccessData
   * @param dbTracking Database tracking record
   * @returns Mapped tracking data
   */
  private mapTrackingFromDb(dbTracking: any): PromptSuccessData {
    return {
      id: dbTracking.id,
      promptId: dbTracking.prompt_id,
      promptVersionId: dbTracking.prompt_version_id,
      isSuccessful: dbTracking.is_successful,
      feedback: dbTracking.feedback,
      feedbackRating: dbTracking.feedback_rating,
      feedbackCategory: dbTracking.feedback_category,
      feedbackTags: dbTracking.feedback_tags,
      responseTimeMs: dbTracking.response_time_ms,
      userSessionId: dbTracking.user_session_id,
      autoDetected: dbTracking.auto_detected,
      detectionMethod: dbTracking.detection_method,
      userId: dbTracking.user_id,
      createdAt: new Date(dbTracking.created_at),
      context: dbTracking.context
    };
  }

  /**
   * Map database analytics to PromptUsageAnalytics
   * @param dbAnalytics Database analytics
   * @returns Mapped analytics data
   */
  private mapAnalyticsFromDb(dbAnalytics: any): PromptUsageAnalytics {
    return {
      id: dbAnalytics.id,
      promptId: dbAnalytics.prompt_id,
      date: new Date(dbAnalytics.date),
      totalUses: dbAnalytics.total_uses,
      successfulUses: dbAnalytics.successful_uses,
      failedUses: dbAnalytics.failed_uses,
      averageRating: dbAnalytics.average_rating,
      averageResponseTimeMs: dbAnalytics.average_response_time_ms,
      createdAt: new Date(dbAnalytics.created_at),
      updatedAt: new Date(dbAnalytics.updated_at)
    };
  }

  /**
   * Map database alert to PromptMonitoringAlert
   * @param dbAlert Database alert
   * @returns Mapped alert data
   */
  private mapAlertFromDb(dbAlert: any): PromptMonitoringAlert {
    return {
      id: dbAlert.id,
      promptId: dbAlert.prompt_id,
      alertType: dbAlert.alert_type,
      threshold: dbAlert.threshold,
      currentValue: dbAlert.current_value,
      isActive: dbAlert.is_active,
      triggeredAt: new Date(dbAlert.triggered_at),
      resolvedAt: dbAlert.resolved_at ? new Date(dbAlert.resolved_at) : undefined,
      createdAt: new Date(dbAlert.created_at),
      updatedAt: new Date(dbAlert.updated_at)
    };
  }

  /**
   * Map database setting to PromptMonitoringSetting
   * @param dbSetting Database setting
   * @returns Mapped setting data
   */
  private mapSettingFromDb(dbSetting: any): PromptMonitoringSetting {
    return {
      id: dbSetting.id,
      promptId: dbSetting.prompt_id,
      settingType: dbSetting.setting_type,
      threshold: dbSetting.threshold,
      isActive: dbSetting.is_active,
      notificationEmail: dbSetting.notification_email,
      createdAt: new Date(dbSetting.created_at),
      updatedAt: new Date(dbSetting.updated_at)
    };
  }

  /**
   * Map database experiment to ABExperimentData
   * @param dbExperiment Database experiment
   * @returns Mapped experiment data
   */
  private mapExperimentFromDb(dbExperiment: any): ABExperimentData {
    return {
      id: dbExperiment.id,
      name: dbExperiment.name,
      description: dbExperiment.description,
      startDate: new Date(dbExperiment.start_date),
      endDate: dbExperiment.end_date ? new Date(dbExperiment.end_date) : undefined,
      isActive: dbExperiment.is_active,
      trafficAllocation: dbExperiment.traffic_allocation,
      createdBy: dbExperiment.created_by,
      createdAt: new Date(dbExperiment.created_at),
      updatedAt: new Date(dbExperiment.updated_at),
      variants: dbExperiment.prompt_ab_variants ?
        dbExperiment.prompt_ab_variants.map(this.mapVariantFromDb) :
        undefined
    };
  }

  /**
   * Map database variant to ABVariantData
   * @param dbVariant Database variant
   * @returns Mapped variant data
   */
  private mapVariantFromDb(dbVariant: any): ABVariantData {
    return {
      id: dbVariant.id,
      experimentId: dbVariant.experiment_id,
      promptId: dbVariant.prompt_id,
      variantName: dbVariant.variant_name,
      isControl: dbVariant.is_control,
      weight: dbVariant.weight,
      createdAt: new Date(dbVariant.created_at),
      updatedAt: new Date(dbVariant.updated_at),
      promptName: dbVariant.prompt_name,
      successRate: dbVariant.success_rate
    };
  }

  /**
   * Map database segment to UserSegmentData
   * @param dbSegment Database segment
   * @returns Mapped segment data
   */
  private mapSegmentFromDb(dbSegment: any): UserSegmentData {
    return {
      id: dbSegment.id,
      name: dbSegment.name,
      description: dbSegment.description,
      segmentType: dbSegment.segment_type,
      segmentCriteria: dbSegment.segment_criteria,
      isActive: dbSegment.is_active,
      createdBy: dbSegment.created_by,
      createdAt: new Date(dbSegment.created_at),
      updatedAt: new Date(dbSegment.updated_at)
    };
  }

  /**
   * Validate a prompt
   * @param prompt Prompt to validate
   */
  private validatePrompt(prompt: Partial<PromptData>): void {
    // Check required fields
    if (!prompt.name) {
      throw new Error('Prompt name is required');
    }

    if (!prompt.promptType) {
      throw new Error('Prompt type is required');
    }

    if (!prompt.content) {
      throw new Error('Prompt content is required');
    }

    if (!prompt.location) {
      throw new Error('Prompt location is required');
    }
  }
}

// Create and export the prompt service instance
export const promptService = new PromptService();

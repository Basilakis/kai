/**
 * Relationship-Aware Model Training Service
 * 
 * This service provides client-side functionality for relationship-aware model training.
 */

import { api } from '../utils/api';
import { RelationshipType } from '@kai/shared/src/types/property-relationships';

/**
 * Training options
 */
export interface RelationshipAwareTrainingOptions {
  materialType?: string;
  targetProperty?: string;
  includeRelationships?: boolean;
  relationshipTypes?: RelationshipType[];
  relationshipStrengthThreshold?: number;
  maxRelationshipDepth?: number;
  useTransferLearning?: boolean;
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  validationSplit?: number;
}

/**
 * Training result
 */
export interface RelationshipAwareTrainingResult {
  modelId: string;
  targetProperty: string;
  materialType: string;
  accuracy: number;
  validationAccuracy: number;
  baselineAccuracy?: number;
  improvementPercentage?: number;
  featureImportance?: Record<string, number>;
  relationshipMetrics?: {
    relationshipsUsed: number;
    relationshipContribution: number;
    mostInfluentialRelationships: Array<{
      sourceProperty: string;
      targetProperty: string;
      relationshipType: RelationshipType;
      importance: number;
    }>;
  };
}

/**
 * Job status
 */
export interface JobStatus {
  id: string;
  materialType: string;
  targetProperty: string;
  status: string;
  progress: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Relationship-Aware Model Training Service
 */
class RelationshipAwareTrainingService {
  /**
   * Train a relationship-aware model
   * 
   * @param materialType Material type
   * @param targetProperty Target property
   * @param options Training options
   * @returns Training result
   */
  public async trainModel(
    materialType: string,
    targetProperty: string,
    options: RelationshipAwareTrainingOptions = {}
  ): Promise<RelationshipAwareTrainingResult> {
    try {
      const response = await api.post('/api/ai/relationship-aware-training/train', {
        materialType,
        targetProperty,
        options
      });
      
      return response.data.result;
    } catch (error) {
      console.error('Error training relationship-aware model:', error);
      throw error;
    }
  }
  
  /**
   * Get job status
   * 
   * @param jobId Job ID
   * @returns Job status
   */
  public async getJobStatus(jobId: string): Promise<JobStatus | null> {
    try {
      const response = await api.get(`/api/ai/relationship-aware-training/job/${jobId}`);
      
      if (!response.data.success) {
        return null;
      }
      
      return response.data.status;
    } catch (error) {
      console.error('Error getting job status:', error);
      return null;
    }
  }
}

// Create a singleton instance
export const relationshipAwareTrainingService = new RelationshipAwareTrainingService();

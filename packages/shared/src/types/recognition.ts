/**
 * Type definitions for image recognition-related entities
 */

import { Tile, TileMatch } from './tile';

/**
 * Represents an image recognition request
 */
export interface RecognitionRequest {
  id: string;
  imageUrl: string;
  originalFileName?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  
  // Processing options
  options?: {
    confidenceThreshold?: number;
    maxResults?: number;
    includeFeatureMatching?: boolean;
    includeVectorSearch?: boolean;
    includeSimilarTiles?: boolean;
  };
  
  // Status
  status: RecognitionStatus;
  submittedAt: Date;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  processingTimeMs?: number;
  error?: string;
  
  // User information
  userId?: string;
  userEmail?: string;
  
  // Results
  results?: RecognitionResult;
}

/**
 * Represents the status of an image recognition request
 */
export type RecognitionStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

/**
 * Represents the result of an image recognition request
 */
export interface RecognitionResult {
  matches: TileMatch[];
  similarTiles?: Tile[];
  processingDetails?: {
    featureMatchingTimeMs?: number;
    vectorSearchTimeMs?: number;
    postProcessingTimeMs?: number;
    totalTimeMs: number;
    modelVersion?: string;
    confidenceThreshold: number;
  };
}

/**
 * Represents a feature extracted from an image
 */
export interface ImageFeature {
  id: string;
  imageId: string;
  type: 'SIFT' | 'ORB' | 'SURF' | 'CNN' | 'other';
  vector: number[];
  keypoint?: {
    x: number;
    y: number;
    size: number;
    angle: number;
    response: number;
    octave: number;
    classId: number;
  };
}

/**
 * Represents a model used for image recognition
 */
export interface RecognitionModel {
  id: string;
  name: string;
  version: string;
  type: 'feature-based' | 'neural-network' | 'hybrid';
  framework?: 'opencv' | 'tensorflow' | 'pytorch' | 'other';
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  trainingDataset?: string;
  trainedAt?: Date;
  parameters?: Record<string, any>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents statistics about the recognition system
 */
export interface RecognitionStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageProcessingTimeMs: number;
  averageConfidenceScore: number;
  requestsPerDay: Record<string, number>;
  topMatchedTiles: Array<{
    tileId: string;
    tileName: string;
    matchCount: number;
  }>;
  modelPerformance: Record<string, {
    accuracy: number;
    averageProcessingTimeMs: number;
    usageCount: number;
  }>;
}
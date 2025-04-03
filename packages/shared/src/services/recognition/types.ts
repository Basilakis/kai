/**
 * Recognition service base types
 */

export interface UploadResult {
  path?: string;
  error?: Error;
}

export interface RecognitionOptions {
  modelType?: 'hybrid' | 'feature-based' | 'ml-based';
  confidenceThreshold?: number;
  maxResults?: number;
  metadata?: Record<string, any>;
}

export interface BaseMetadata {
  source?: string;
  timestamp?: Date;
  [key: string]: any;
}

export interface RecognitionMatch {
  id: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface MaterialRecognitionOptions extends RecognitionOptions {
  materialType?: string;
  includeMetadata?: boolean;
  similarityThreshold?: number;
}

export interface ExtractedColor {
  color: string; // HEX or HSL color code
  percentage: number;
  name?: string;
}

export interface MaterialRecognitionMatch extends RecognitionMatch {
  materialId: string;
  name: string;
  type: string;
  metadata?: Record<string, any>;
  imageUrl?: string;
  extractedColors?: ExtractedColor[];
}

export interface ServiceError extends Error {
  code?: string;
  status?: number;
  metadata?: Record<string, any>;
}

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof Error && 
         'code' in error && 
         (error as ServiceError).code !== undefined;
}

export interface RecognitionResult {
  matches: RecognitionMatch[];
  totalMatches: number;
  processingTime?: number;
  metadata?: Record<string, any>;
}

export interface RecognitionStats {
  totalRequests: number;
  averageProcessingTime: number;
  successRate: number;
  lastUpdated: Date;
}

export class RecognitionError extends Error implements ServiceError {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'RecognitionError';
  }
}

export type RecognitionStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface RecognitionRequest {
  id: string;
  status: RecognitionStatus;
  options: RecognitionOptions;
  result?: RecognitionResult;
  error?: string;
  startTime: Date;
  endTime?: Date;
  metadata?: Record<string, any>;
}
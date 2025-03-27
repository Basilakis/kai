/**
 * ML Service Connector
 * 
 * Provides methods for interacting with the KAI machine learning services.
 * Used by agents to perform image analysis, material recognition, and other ML tasks.
 */

import { BaseService, ServiceConfig, ApiError } from './baseService';
import { createLogger } from '../utils/logger';

const logger = createLogger('MLService');

/**
 * Image analysis parameters
 */
export interface ImageAnalysisParams {
  imageUrl: string;
  detectMaterials?: boolean;
  assessQuality?: boolean;
  extractColors?: boolean;
  extractPatterns?: boolean;
}

/**
 * Quality assessment result
 */
export interface QualityAssessment {
  score: number;
  issues: string[];
  recommendations: string[];
}

/**
 * Material detection result
 */
export interface MaterialDetection {
  type: string;
  confidence: number;
  properties: {
    finish: string;
    color: string;
    pattern: string;
    texture: string;
    [key: string]: string;
  };
}

/**
 * Color analysis result
 */
export interface ColorAnalysis {
  dominant: {
    color: string;
    hex: string;
    percentage: number;
  };
  palette: {
    color: string;
    hex: string;
    percentage: number;
  }[];
}

/**
 * Pattern analysis result
 */
export interface PatternAnalysis {
  type: string;
  direction: string;
  complexity: string;
  repetition: string;
}

/**
 * Image analysis result
 */
export interface AnalysisResult {
  imageUrl: string;
  timestamp: string;
  quality: QualityAssessment;
  detectedMaterials?: MaterialDetection[];
  colorAnalysis?: ColorAnalysis;
  patternAnalysis?: PatternAnalysis;
}

/**
 * Visual feature extraction result
 */
export interface VisualFeatures {
  colors: { name: string; hex: string; percentage: number }[];
  patterns: PatternAnalysis;
  texture: {
    roughness: string;
    reflectivity: string;
    uniformity: string;
    [key: string]: string;
  };
  geometry: {
    shape: string;
    dimensions: {
      estimated: boolean;
      aspectRatio: number;
      [key: string]: any;
    };
    [key: string]: any;
  };
}

/**
 * ML service for image analysis and recognition
 */
export class MLService extends BaseService {
  /**
   * Create a new MLService instance
   */
  constructor(config: ServiceConfig) {
    super(config);
    logger.info(`MLService initialized with base URL: ${this.baseURL}`);
  }

  /**
   * Analyze an image to detect materials and extract features
   */
  async analyzeImage(params: ImageAnalysisParams): Promise<AnalysisResult> {
    logger.info(`Analyzing image: ${params.imageUrl}`);
    
    try {
      const response = await this.post<AnalysisResult>('/analyze', {
        imageUrl: params.imageUrl,
        options: {
          detectMaterials: params.detectMaterials !== false,
          assessQuality: params.assessQuality !== false,
          extractColors: params.extractColors !== false,
          extractPatterns: params.extractPatterns !== false,
        }
      });
      
      logger.debug(`Image analysis completed successfully`);
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error(`Error analyzing image: ${error.message} (${error.statusCode})`);
      } else {
        logger.error(`Error analyzing image: ${error}`);
      }
      throw error;
    }
  }

  /**
   * Assess the quality of an image
   */
  async assessImageQuality(imageUrl: string): Promise<QualityAssessment> {
    logger.info(`Assessing image quality: ${imageUrl}`);
    
    try {
      const response = await this.post<QualityAssessment>('/assess-quality', {
        imageUrl
      });
      
      logger.debug(`Image quality assessment completed`);
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error(`Error assessing image quality: ${error.message} (${error.statusCode})`);
      } else {
        logger.error(`Error assessing image quality: ${error}`);
      }
      throw error;
    }
  }

  /**
   * Extract visual features from an image
   */
  async extractVisualFeatures(imageUrl: string): Promise<VisualFeatures> {
    logger.info(`Extracting visual features: ${imageUrl}`);
    
    try {
      const response = await this.post<VisualFeatures>('/extract-features', {
        imageUrl
      });
      
      logger.debug(`Feature extraction completed`);
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error(`Error extracting visual features: ${error.message} (${error.statusCode})`);
      } else {
        logger.error(`Error extracting visual features: ${error}`);
      }
      throw error;
    }
  }

  /**
   * Recognize material from image
   */
  async recognizeMaterial(imageUrl: string, options: { limit?: number } = {}): Promise<MaterialDetection[]> {
    logger.info(`Recognizing material from image: ${imageUrl}`);
    
    try {
      const response = await this.post<MaterialDetection[]>('/recognize-material', {
        imageUrl,
        limit: options.limit || 5
      });
      
      logger.debug(`Material recognition completed, found ${response.length} materials`);
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error(`Error recognizing material: ${error.message} (${error.statusCode})`);
      } else {
        logger.error(`Error recognizing material: ${error}`);
      }
      throw error;
    }
  }
}
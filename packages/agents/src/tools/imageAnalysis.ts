/**
 * Image Analysis Tool
 * 
 * A specialized tool for analyzing images to detect materials, assess image quality,
 * and extract properties that are relevant for material recognition.
 */

import { Tool } from 'crewai';
import { createLogger } from '../utils/logger';
import { getMLService } from '../services/serviceFactory';
import { ApiError } from '../services/baseService';
import { 
  ImageAnalysisParams, 
  AnalysisResult,
  QualityAssessment,
  VisualFeatures
} from '../services/mlService';

// Logger instance
const logger = createLogger('ImageAnalysisTool');

/**
 * Create an image analysis tool for material recognition
 */
export async function createImageAnalysisTool(): Promise<Tool> {
  logger.info('Creating image analysis tool');

  // Get the ML service instance
  const mlService = getMLService();

  /**
   * Analyze an image to detect materials and properties
   * 
   * @param imageUrl The URL of the image to analyze
   * @param options Additional options for the image analysis
   * @returns Detailed analysis results with detected materials and properties
   */
  const analyzeImage = async (
    imageUrl: string, 
    options: { 
      detectMaterials?: boolean;
      assessQuality?: boolean;
      extractColors?: boolean;
      extractPatterns?: boolean;
    } = {}
  ): Promise<AnalysisResult> => {
    logger.info(`Analyzing image: ${imageUrl}`);
    
    try {
      // Create analysis parameters
      const params: ImageAnalysisParams = {
        imageUrl,
        detectMaterials: options.detectMaterials !== false,
        assessQuality: options.assessQuality !== false,
        extractColors: options.extractColors !== false,
        extractPatterns: options.extractPatterns !== false
      };
      
      // Use the MLService to analyze the image
      const result = await mlService.analyzeImage(params);
      logger.debug(`Image analysis completed successfully`);
      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error(`API error in image analysis: ${error.message} (${error.statusCode})`);
        // If service is unavailable, fallback to mock implementation
        if (error.statusCode === 503 || error.statusCode === 404) {
          logger.warn('ML Service unavailable, using fallback mock implementation');
          return createMockAnalysisResult(imageUrl, options);
        }
      }
      throw error;
    }
  };

  /**
   * Check image quality and provide improvement suggestions
   * 
   * @param imageUrl The URL of the image to check
   * @returns Quality assessment and suggestions for improvement
   */
  const assessImageQuality = async (imageUrl: string): Promise<QualityAssessment> => {
    logger.info(`Assessing image quality: ${imageUrl}`);
    
    try {
      // Use the MLService to assess image quality
      const result = await mlService.assessImageQuality(imageUrl);
      logger.debug(`Image quality assessment completed successfully`);
      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error(`API error in quality assessment: ${error.message} (${error.statusCode})`);
        // If service is unavailable, fallback to mock implementation
        if (error.statusCode === 503 || error.statusCode === 404) {
          logger.warn('ML Service unavailable, using fallback mock implementation');
          return createMockQualityAssessment();
        }
      }
      throw error;
    }
  };

  /**
   * Extract visual features from an image 
   * 
   * @param imageUrl The URL of the image to analyze
   * @returns Extracted features like colors, patterns, and textures
   */
  const extractVisualFeatures = async (imageUrl: string): Promise<VisualFeatures> => {
    logger.info(`Extracting visual features: ${imageUrl}`);
    
    try {
      // Use the MLService to extract visual features
      const result = await mlService.extractVisualFeatures(imageUrl);
      logger.debug(`Visual feature extraction completed successfully`);
      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error(`API error in feature extraction: ${error.message} (${error.statusCode})`);
        // If service is unavailable, fallback to mock implementation
        if (error.statusCode === 503 || error.statusCode === 404) {
          logger.warn('ML Service unavailable, using fallback mock implementation');
          return createMockVisualFeatures();
        }
      }
      throw error;
    }
  };
  
  // Create and return the crewAI tool
  return new Tool({
    name: 'image_analysis',
    description: 'Analyze an image to detect materials, assess quality, and extract visual features',
    func: async (args: string) => {
      try {
        const { imageUrl, operation, options } = JSON.parse(args);
        
        switch (operation) {
          case 'analyze':
            return JSON.stringify(await analyzeImage(imageUrl, options));
          case 'assess_quality':
            return JSON.stringify(await assessImageQuality(imageUrl));
          case 'extract_features':
            return JSON.stringify(await extractVisualFeatures(imageUrl));
          default:
            return JSON.stringify({ error: `Unknown operation: ${operation}` });
        }
      } catch (error) {
        logger.error(`Error in image analysis tool: ${error}`);
        return JSON.stringify({ 
          error: 'Error processing image', 
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });
}

/**
 * Create a mock analysis result (used as fallback when service is unavailable)
 */
function createMockAnalysisResult(
  imageUrl: string, 
  options: { 
    detectMaterials?: boolean;
    assessQuality?: boolean;
    extractColors?: boolean;
    extractPatterns?: boolean;
  } = {}
): AnalysisResult {
  // Default options
  const opts = {
    detectMaterials: true,
    assessQuality: true,
    extractColors: true,
    extractPatterns: true,
    ...options
  };
  
  // Create mock result
  const results: AnalysisResult = {
    imageUrl,
    timestamp: new Date().toISOString(),
    quality: {
      score: 0.85,
      issues: [],
      recommendations: []
    },
    detectedMaterials: opts.detectMaterials ? [
      {
        type: 'Ceramic',
        confidence: 0.92,
        properties: {
          finish: 'Glossy',
          color: 'White',
          pattern: 'Subway',
          texture: 'Smooth'
        }
      },
      {
        type: 'Porcelain',
        confidence: 0.78,
        properties: {
          finish: 'Matte',
          color: 'Beige',
          pattern: 'Marble-look',
          texture: 'Smooth'
        }
      }
    ] : undefined,
    colorAnalysis: opts.extractColors ? {
      dominant: {
        color: 'White',
        hex: '#F5F5F5',
        percentage: 72
      },
      palette: [
        { color: 'White', hex: '#F5F5F5', percentage: 72 },
        { color: 'Light Gray', hex: '#D3D3D3', percentage: 18 },
        { color: 'Beige', hex: '#F5F5DC', percentage: 10 }
      ]
    } : undefined,
    patternAnalysis: opts.extractPatterns ? {
      type: 'Regular',
      direction: 'Horizontal',
      complexity: 'Low',
      repetition: 'High'
    } : undefined
  };
  
  // Add random quality issues if enabled
  if (opts.assessQuality && Math.random() > 0.7) {
    results.quality.score = 0.65;
    results.quality.issues = ['Poor lighting', 'Blurry edges'];
    results.quality.recommendations = [
      'Take the photo in better lighting conditions',
      'Hold the camera steady or use a tripod',
      'Ensure the entire material is in focus'
    ];
  }
  
  return results;
}

/**
 * Create a mock quality assessment (used as fallback when service is unavailable)
 */
function createMockQualityAssessment(): QualityAssessment {
  const score = Math.random() * 0.4 + 0.6; // Random score between 0.6 and 1.0
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Add random issues based on the score
  if (score < 0.8) {
    const possibleIssues = [
      'Poor lighting',
      'Blurry image',
      'Reflections on surface',
      'Inconsistent angle',
      'Shadow interference',
      'Limited sample visible',
      'Low resolution'
    ];
    
    // Select 1-3 random issues
    const issueCount = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < issueCount; i++) {
      if (possibleIssues.length === 0) break;
      
      const index = Math.floor(Math.random() * possibleIssues.length);
      const issue = possibleIssues.splice(index, 1)[0];
      issues.push(issue);
    }
    
    // Add recommendations based on issues
    issues.forEach(issue => {
      switch (issue) {
        case 'Poor lighting':
          recommendations.push('Take the photo in natural daylight or with uniform lighting');
          break;
        case 'Blurry image':
          recommendations.push('Hold the camera steady or use a tripod');
          break;
        case 'Reflections on surface':
          recommendations.push('Adjust the angle to avoid direct reflections');
          break;
        case 'Inconsistent angle':
          recommendations.push('Take the photo directly above the material at a 90° angle');
          break;
        case 'Shadow interference':
          recommendations.push('Use diffused lighting to minimize shadows');
          break;
        case 'Limited sample visible':
          recommendations.push('Ensure more of the material pattern is visible in the image');
          break;
        case 'Low resolution':
          recommendations.push('Use a higher resolution camera or move closer to the material');
          break;
      }
    });
  }
  
  return { score, issues, recommendations };
}

/**
 * Create mock visual features (used as fallback when service is unavailable)
 */
function createMockVisualFeatures(): VisualFeatures {
  return {
    colors: [
      { name: 'White', hex: '#F5F5F5', percentage: 72 },
      { name: 'Light Gray', hex: '#D3D3D3', percentage: 18 },
      { name: 'Beige', hex: '#F5F5DC', percentage: 10 }
    ],
    patterns: {
      type: 'Regular',
      direction: 'Horizontal',
      complexity: 'Low',
      repetition: 'High'
    },
    texture: {
      roughness: 'Low',
      reflectivity: 'Medium',
      uniformity: 'High'
    },
    geometry: {
      shape: 'Rectangle',
      dimensions: {
        estimated: true,
        aspectRatio: 3.0
      }
    }
  };
}

export default {
  createImageAnalysisTool
};
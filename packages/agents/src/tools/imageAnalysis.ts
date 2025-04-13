/**
 * Image Analysis Tool
 * 
 * A specialized tool for analyzing images to detect materials, assess image quality,
 * and extract properties that are relevant for material recognition.
 */

import { Tool } from 'crewai';
import { createLogger } from '../utils/logger';
import { ApiError } from '../services/baseService';
// Import adapter functions and types
import * as imageAdapter from '../services/adapters/imageAnalysisMcpAdapter';
// Use types defined/exported by the adapter
import { AnalysisResult, AnalysisOptions } from '../services/adapters/imageAnalysisMcpAdapter'; 

// Logger instance
const logger = createLogger('ImageAnalysisTool');

// Define types expected by the tool's internal logic if they differ from adapter's AnalysisResult
// For now, assume adapter's AnalysisResult structure is sufficient or mapping happens later.
// Let's define QualityAssessment and VisualFeatures based on adapter's AnalysisResult structure
type QualityAssessment = AnalysisResult['quality']; 
type VisualFeatures = AnalysisResult['features'];

/**
 * Create an image analysis tool for material recognition
 */
export async function createImageAnalysisTool(): Promise<Tool> {
  logger.info('Creating image analysis tool using imageAnalysisMcpAdapter');

  // No need to get mlService instance here, adapter handles it

  /**
   * Analyze an image to detect materials and properties using the adapter
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
  ): Promise<AnalysisResult> => { // Return type from adapter
    logger.info(`Analyzing image via adapter: ${imageUrl}`);
    
    // Create adapter options
    const adapterOptions: AnalysisOptions = {
      detectMaterials: options.detectMaterials !== false,
      assessQuality: options.assessQuality !== false,
      extractFeatures: (options.extractColors !== false) || (options.extractPatterns !== false), // Adapter uses extractFeatures
      // Map other options if needed, e.g., confidenceThreshold
    };

    // Use the adapter function (handles MCP/fallback internally)
    // No need for try/catch with mock fallback here
    const result = await imageAdapter.analyzeImage(imageUrl, adapterOptions);
    logger.debug(`Image analysis via adapter completed successfully`);
    return result;
    // Errors will be handled by the adapter's withMCPFallback or bubble up
  };

  /**
   * Check image quality and provide improvement suggestions
   * 
   * @param imageUrl The URL of the image to check
   * @returns Quality assessment and suggestions for improvement
   */
  const assessImageQuality = async (imageUrl: string): Promise<QualityAssessment> => { // Use adapter's quality type
    logger.info(`Assessing image quality via adapter: ${imageUrl}`);
    
    // Use the adapter function
    // No need for try/catch with mock fallback here
    const result = await imageAdapter.assessImageQuality(imageUrl);
    logger.debug(`Image quality assessment via adapter completed successfully`);
    return result;
    // Errors handled by adapter or bubble up
  };

  /**
   * Extract visual features from an image 
   * 
   * @param imageUrl The URL of the image to analyze
   * @returns Extracted features (structure might differ from original VisualFeatures)
   */
  const extractVisualFeatures = async (imageUrl: string): Promise<VisualFeatures> => { // Use adapter's features type
    logger.info(`Extracting visual features via adapter: ${imageUrl}`);

    // Use the adapter's analyzeImage function with extractFeatures option
    // No need for try/catch with mock fallback here
    const result = await imageAdapter.analyzeImage(imageUrl, { extractFeatures: true });
    logger.debug(`Visual feature extraction via adapter completed successfully`);
    // Return the features part of the result
    return result.features; 
    // Errors handled by adapter or bubble up
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
        // Catch errors bubbled up from the adapter/service
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Error in image analysis tool: ${message}`);
        // Include status code if it's an API error
        const statusCode = error instanceof ApiError ? error.statusCode : undefined;
        return JSON.stringify({ 
          error: 'Error processing image', 
          message: message,
          statusCode: statusCode
        });
      }
    }
  });
}

// Mock functions are no longer needed here as fallback is handled by the adapter

export default {
  createImageAnalysisTool
};
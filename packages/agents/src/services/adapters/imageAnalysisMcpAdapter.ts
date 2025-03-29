/**
 * Image Analysis MCP Adapter
 * 
 * This adapter provides integration between agent components and the MCP server
 * for image analysis operations. It handles material recognition, quality assessment,
 * feature extraction, and other image-related ML tasks.
 * 
 * When MCP is enabled, it proxies operations to the MCP server.
 * When MCP is disabled, it falls back to the local implementation.
 */

import { createLogger } from '../../utils/logger';
import { 
  isMCPEnabledForComponent, 
  withMCPFallback, 
  callMCPEndpoint 
} from '../../utils/mcpIntegration';
import { addToBatch, isBatchingEnabled } from '../../utils/mcpBatchProcessor';

// Local service for fallback (would be imported from the appropriate package)
// import { ImageAnalysisService } from '../../services/imageAnalysisService';

// Create a logger for the adapter
const logger = createLogger('ImageAnalysisMCPAdapter');

// Type definitions
export interface AnalysisOptions {
  modelVersion?: string;
  confidenceThreshold?: number;
  enhanceImage?: boolean;
  detectMaterials?: boolean;
  extractFeatures?: boolean;
  assessQuality?: boolean;
}

export interface AnalysisResult {
  materials: Array<{
    name: string;
    confidence: number;
    boundingBox?: { x: number; y: number; width: number; height: number };
  }>;
  quality: {
    overall: number;
    lighting: number;
    sharpness: number;
    noise: number;
  };
  features: Record<string, number[]>;
  metadata: {
    processingTime: number;
    modelVersion: string;
    pixelCount: number;
  };
}

/**
 * Analyze an image using the MCP server
 * 
 * @param imageBase64 Base64-encoded image data
 * @param options Analysis options
 * @returns Analysis result
 */
async function analyzeImageWithMCP(
  imageBase64: string, 
  options: AnalysisOptions = {}
): Promise<AnalysisResult> {
  try {
    // Check if batching is enabled and use it if possible
    if (isBatchingEnabled('imageAnalysis')) {
      return await addToBatch<{imageBase64: string, options: AnalysisOptions}, AnalysisResult>(
        'imageAnalysis',
        { imageBase64, options }
      );
    }
    
    // Otherwise use direct MCP call
    const result = await callMCPEndpoint<AnalysisResult>(
      'imageAnalysis',
      'image/analyze',
      { imageBase64, options }
    );
    
    logger.debug(`Analyzed image with MCP: ${result.materials.length} materials detected`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`MCP image analysis failed: ${errorMessage}`);
    throw error;
  }
}

/**
 * Analyze an image using the local implementation
 * 
 * @param imageBase64 Base64-encoded image data
 * @param options Analysis options
 * @returns Analysis result
 */
async function analyzeImageLocally(
  imageBase64: string, 
  options: AnalysisOptions = {}
): Promise<AnalysisResult> {
  try {
    logger.debug('Using local image analysis implementation');
    
    // In a real implementation, this would use a local service
    // const imageAnalysisService = new ImageAnalysisService();
    // return await imageAnalysisService.analyzeImage(imageBase64, options);
    
    // For now, return a mock implementation
    return {
      materials: [
        { name: 'Local implementation - ceramic', confidence: 0.95 }
      ],
      quality: {
        overall: 0.8,
        lighting: 0.85,
        sharpness: 0.75,
        noise: 0.9
      },
      features: {
        colorHistogram: [0.1, 0.2, 0.3, 0.2, 0.1]
      },
      metadata: {
        processingTime: 200,
        modelVersion: 'local-v1.0',
        pixelCount: 1024 * 768
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Local image analysis failed: ${errorMessage}`);
    throw error;
  }
}

/**
 * Analyze an image for material recognition, quality assessment, and feature extraction
 * 
 * This is the main exported function that clients should use. It automatically
 * routes to MCP or local implementation based on configuration.
 * 
 * @param imageBase64 Base64-encoded image data
 * @param options Analysis options
 * @returns Analysis result
 */
export async function analyzeImage(
  imageBase64: string, 
  options: AnalysisOptions = {}
): Promise<AnalysisResult> {
  return withMCPFallback<AnalysisResult, [string, AnalysisOptions]>(
    'imageAnalysis',
    analyzeImageWithMCP,
    analyzeImageLocally,
    imageBase64,
    options
  );
}

/**
 * Extract features from an image for similarity comparison
 * 
 * @param imageBase64 Base64-encoded image data
 * @returns Feature vector
 */
export async function extractImageFeatures(
  imageBase64: string
): Promise<number[]> {
  const result = await analyzeImage(imageBase64, { extractFeatures: true });
  return result.features.embedding || [];
}

/**
 * Assess the quality of an image
 * 
 * @param imageBase64 Base64-encoded image data
 * @returns Quality assessment
 */
export async function assessImageQuality(
  imageBase64: string
): Promise<{ overall: number; lighting: number; sharpness: number; noise: number }> {
  const result = await analyzeImage(imageBase64, { assessQuality: true });
  return result.quality;
}

/**
 * Recognize materials in an image
 * 
 * @param imageBase64 Base64-encoded image data
 * @param confidenceThreshold Minimum confidence threshold
 * @returns Array of detected materials
 */
export async function recognizeMaterials(
  imageBase64: string,
  confidenceThreshold: number = 0.7
): Promise<Array<{ name: string; confidence: number; boundingBox?: { x: number; y: number; width: number; height: number } }>> {
  const result = await analyzeImage(imageBase64, { 
    detectMaterials: true,
    confidenceThreshold
  });
  return result.materials;
}

// Export the adapter functions
export default {
  analyzeImage,
  extractImageFeatures,
  assessImageQuality,
  recognizeMaterials
};
/**
 * Image Analysis MCP Adapter
 * 
 * This adapter provides integration between agent components and the MCP server
 * for image analysis operations. It handles material recognition, quality assessment,
 * feature extraction, and other image-related ML tasks.
 * 
 * When MCP is enabled, it proxies operations to the MCP server.
 * When MCP is disabled, it falls back to the local implementation.
 * 
 * Extends BaseMcpAdapter to reduce duplication across adapter implementations.
 */

import { createLogger } from '../../utils/logger';
import { BaseMcpAdapter } from './base/BaseMcpAdapter';
import { addToBatch, isBatchingEnabled } from '../../utils/mcpBatchProcessor';
import { ServiceFactory } from '../serviceFactory';

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

// Define the MLService type for correct generics
type MLService = ReturnType<typeof ServiceFactory.getMLService>;

/**
 * Image Analysis MCP Adapter class
 * Extends BaseMcpAdapter to leverage common MCP functionality
 */
class ImageAnalysisMcpAdapter extends BaseMcpAdapter<MLService> {
  private static instance: ImageAnalysisMcpAdapter;

  constructor() {
    // Initialize BaseMcpAdapter with 'imageAnalysis' component name
    super('imageAnalysis');
  }

  /**
   * Get the singleton instance of ImageAnalysisMcpAdapter
   */
  public static getInstance(): ImageAnalysisMcpAdapter {
    if (!ImageAnalysisMcpAdapter.instance) {
      ImageAnalysisMcpAdapter.instance = new ImageAnalysisMcpAdapter();
    }
    return ImageAnalysisMcpAdapter.instance;
  }

  /**
   * Implement the abstract method from BaseMcpAdapter
   * Get the ML service for local image analysis operations
   */
  protected getLocalService(): MLService {
    return ServiceFactory.getMLService();
  }

  /**
   * Analyze an image using the MCP server
   * 
   * @param imageBase64 Base64-encoded image data
   * @param options Analysis options
   * @returns Analysis result
   */
  private async analyzeImageWithMCP(
    imageBase64: string, 
    options: AnalysisOptions = {}
  ): Promise<AnalysisResult> {
    try {
      // Check if batching is enabled and use it if possible
      if (this.isBatchingEnabled()) {
        return await this.addToBatch<{imageBase64: string, options: AnalysisOptions}, AnalysisResult>(
          'analyzeImage',
          { imageBase64, options }
        );
      }
      
      // Otherwise use direct MCP call from the base adapter
      const result = await this.callMCPEndpoint<AnalysisResult>(
        'image/analyze',
        { imageBase64, options }
      );
      
      this.logger.debug(`Analyzed image with MCP: ${result.materials.length} materials detected`);
      return result;
    } catch (error) {
      return this.handleError(error, 'analyzeImageWithMCP');
    }
  }

  /**
   * Analyze an image using the local implementation
   * 
   * @param imageBase64 Base64-encoded image data
   * @param options Analysis options
   * @returns Analysis result
   */
  private async analyzeImageLocally(
    imageBase64: string, 
    options: AnalysisOptions = {}
  ): Promise<AnalysisResult> {
    try {
      this.logger.debug('Using local image analysis implementation');
      
      // Get the ML service for image analysis
      const mlService = this.getLocalService();
      
      // Call the appropriate analyzeImage method from MLService
      const result = await mlService.analyzeImage({
        imageUrl: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
        detectMaterials: options.detectMaterials !== false,
        assessQuality: options.assessQuality !== false,
        extractColors: options.extractFeatures !== false,
        extractPatterns: options.extractFeatures !== false
      });
      
      // Convert from MLService format to adapter format
      return {
        materials: result.detectedMaterials?.map(m => ({
          name: m.type,
          confidence: m.confidence,
          // Adapter expects boundingBox but service doesn't provide it
          boundingBox: undefined
        })) || [],
        quality: {
          overall: result.quality?.score || 0,
          lighting: result.quality?.issues.includes('lighting') ? 0.5 : 0.9,
          sharpness: result.quality?.issues.includes('blurry') ? 0.5 : 0.9,
          noise: result.quality?.issues.includes('noise') ? 0.5 : 0.9
        },
        features: result.colorAnalysis ? {
          colorHistogram: result.colorAnalysis.palette.map(c => c.percentage / 100),
          embedding: [] // Real implementation would have embedding data
        } : {},
        metadata: {
          processingTime: Date.now(), // MLService doesn't provide this
          modelVersion: 'local-v1.0',
          pixelCount: 0 // MLService doesn't provide this
        }
      };
    } catch (error) {
      return this.handleError(error, 'analyzeImageLocally');
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
  public async analyzeImage(
    imageBase64: string, 
    options: AnalysisOptions = {}
  ): Promise<AnalysisResult> {
    // Use withMCPFallback from BaseMcpAdapter
    return this.withMCPFallback<AnalysisResult, [string, AnalysisOptions]>(
      'analyzeImage',
      this.analyzeImageWithMCP.bind(this),
      this.analyzeImageLocally.bind(this),
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
  public async extractImageFeatures(
    imageBase64: string
  ): Promise<number[]> {
    const result = await this.analyzeImage(imageBase64, { extractFeatures: true });
    return result.features.embedding || [];
  }

  /**
   * Assess the quality of an image
   * 
   * @param imageBase64 Base64-encoded image data
   * @returns Quality assessment
   */
  public async assessImageQuality(
    imageBase64: string
  ): Promise<{ overall: number; lighting: number; sharpness: number; noise: number }> {
    const result = await this.analyzeImage(imageBase64, { assessQuality: true });
    return result.quality;
  }

  /**
   * Recognize materials in an image
   * 
   * @param imageBase64 Base64-encoded image data
   * @param confidenceThreshold Minimum confidence threshold
   * @returns Array of detected materials
   */
  public async recognizeMaterials(
    imageBase64: string,
    confidenceThreshold: number = 0.7
  ): Promise<Array<{ name: string; confidence: number; boundingBox?: { x: number; y: number; width: number; height: number } }>> {
    const result = await this.analyzeImage(imageBase64, { 
      detectMaterials: true,
      confidenceThreshold
    });
    return result.materials;
  }
}

// Create singleton instance
const imageAnalysisAdapter = ImageAnalysisMcpAdapter.getInstance();

// Export the adapter functions with proper binding to maintain 'this' context
export const {
  analyzeImage,
  extractImageFeatures,
  assessImageQuality,
  recognizeMaterials
} = {
  analyzeImage: imageAnalysisAdapter.analyzeImage.bind(imageAnalysisAdapter),
  extractImageFeatures: imageAnalysisAdapter.extractImageFeatures.bind(imageAnalysisAdapter),
  assessImageQuality: imageAnalysisAdapter.assessImageQuality.bind(imageAnalysisAdapter),
  recognizeMaterials: imageAnalysisAdapter.recognizeMaterials.bind(imageAnalysisAdapter)
};

// Default export for backward compatibility
export default {
  analyzeImage,
  extractImageFeatures,
  assessImageQuality,
  recognizeMaterials
};
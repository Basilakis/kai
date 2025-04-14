import { BaseThreeDProvider } from './baseProvider';
import { 
  ModelEndpoints, 
  ProcessingResult, 
  PointCloudProcessingOptions
} from './types';
import { logger } from '../../utils/logger';

/**
 * Provider for point cloud processing and optimization using Point-E
 */
export class PointCloudProvider extends BaseThreeDProvider {
  private processingCache: Map<string, ProcessingResult>;
  
  constructor(modelEndpoints: ModelEndpoints) {
    super(modelEndpoints);
    this.processingCache = new Map<string, ProcessingResult>();
    logger.info('PointCloudProvider initialized');
  }
  
  /**
   * Process a point cloud for noise reduction and optimization
   * 
   * @param pointCloudData - Array of 3D points [[x,y,z], ...]
   * @param options - Processing options
   * @returns Promise with processing results
   */
  async processPointCloud(
    pointCloudData: number[][], 
    options?: PointCloudProcessingOptions
  ): Promise<ProcessingResult> {
    try {
      // Generate a cache key based on data and options
      const cacheKey = this.generateCacheKey(pointCloudData, options);
      
      // Check if we have a cached result
      if (options?.useCache !== false && this.processingCache.has(cacheKey)) {
        logger.info('Using cached point cloud processing result');
        return this.processingCache.get(cacheKey) as ProcessingResult;
      }
      
      // Prepare the request
      const response = await fetch(`${this.modelEndpoints.pointE}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          point_cloud_data: pointCloudData,
          options: options || {}
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to process point cloud: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(`Service error: ${result.error}`);
      }
      
      // Create the processing result
      const processingResult: ProcessingResult = {
        success: true,
        data: result.result
      };
      
      // Cache the result if caching is enabled
      if (options?.useCache !== false) {
        this.processingCache.set(cacheKey, processingResult);
      }
      
      return processingResult;
    } catch (error) {
      logger.error('Error processing point cloud:', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Generate a point cloud from a text prompt
   * 
   * @param prompt - Text description of the object
   * @param options - Generation options
   * @returns Promise with generation results
   */
  async generatePointCloud(
    prompt: string,
    options?: {
      guidanceScale?: number;
      numSteps?: number;
      seed?: number;
      postProcess?: boolean;
      generateMesh?: boolean;
      useCache?: boolean;
    }
  ): Promise<ProcessingResult> {
    try {
      // Generate a cache key based on prompt and options
      const cacheKey = `generate_${prompt}_${JSON.stringify(options || {})}`;
      
      // Check if we have a cached result
      if (options?.useCache !== false && this.processingCache.has(cacheKey)) {
        logger.info('Using cached point cloud generation result');
        return this.processingCache.get(cacheKey) as ProcessingResult;
      }
      
      // Prepare the request
      const response = await fetch(`${this.modelEndpoints.pointE}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          options: {
            guidance_scale: options?.guidanceScale || 3.0,
            num_steps: options?.numSteps || 100,
            seed: options?.seed,
            post_process: options?.postProcess !== false,
            generate_mesh: options?.generateMesh !== false
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate point cloud: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(`Service error: ${result.error}`);
      }
      
      // Create the processing result
      const processingResult: ProcessingResult = {
        success: true,
        data: result.result
      };
      
      // Cache the result if caching is enabled
      if (options?.useCache !== false) {
        this.processingCache.set(cacheKey, processingResult);
      }
      
      return processingResult;
    } catch (error) {
      logger.error('Error generating point cloud:', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Complete a partial point cloud
   * 
   * @param partialPointCloud - Partial point cloud data
   * @param options - Completion options
   * @returns Promise with completion results
   */
  async completePointCloud(
    partialPointCloud: number[][],
    options?: {
      postProcess?: boolean;
      generateMesh?: boolean;
      useCache?: boolean;
    }
  ): Promise<ProcessingResult> {
    try {
      // Generate a cache key based on data and options
      const cacheKey = this.generateCacheKey(partialPointCloud, options, 'complete');
      
      // Check if we have a cached result
      if (options?.useCache !== false && this.processingCache.has(cacheKey)) {
        logger.info('Using cached point cloud completion result');
        return this.processingCache.get(cacheKey) as ProcessingResult;
      }
      
      // Prepare the request
      const response = await fetch(`${this.modelEndpoints.pointE}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partial_data: partialPointCloud,
          options: {
            post_process: options?.postProcess !== false,
            generate_mesh: options?.generateMesh !== false
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to complete point cloud: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(`Service error: ${result.error}`);
      }
      
      // Create the processing result
      const processingResult: ProcessingResult = {
        success: true,
        data: result.result
      };
      
      // Cache the result if caching is enabled
      if (options?.useCache !== false) {
        this.processingCache.set(cacheKey, processingResult);
      }
      
      return processingResult;
    } catch (error) {
      logger.error('Error completing point cloud:', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Improve mesh geometry using point cloud processing techniques
   * 
   * @param vertices - Array of vertex positions [[x,y,z], ...]
   * @param faces - Array of face indices [[v1,v2,v3], ...]
   * @param options - Processing options
   * @returns Promise with improvement results
   */
  async improveMeshGeometry(
    vertices: number[][],
    faces: number[][],
    options?: {
      smoothing?: boolean;
      smoothingIterations?: number;
      holeFilling?: boolean;
      remesh?: boolean;
      optimizeFor3DPrinting?: boolean;
      useCache?: boolean;
    }
  ): Promise<ProcessingResult> {
    try {
      // Generate a cache key based on data and options
      const cacheKey = `improve_mesh_${JSON.stringify(vertices.length)}_${JSON.stringify(faces.length)}_${JSON.stringify(options || {})}`;
      
      // Check if we have a cached result
      if (options?.useCache !== false && this.processingCache.has(cacheKey)) {
        logger.info('Using cached mesh improvement result');
        return this.processingCache.get(cacheKey) as ProcessingResult;
      }
      
      // Prepare the request
      const response = await fetch(`${this.modelEndpoints.pointE}/improve-mesh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vertices,
          faces,
          options: {
            smoothing: options?.smoothing !== false,
            smoothing_iterations: options?.smoothingIterations || 3,
            hole_filling: options?.holeFilling !== false,
            remesh: options?.remesh === true,
            optimize_for_3d_printing: options?.optimizeFor3DPrinting === true
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to improve mesh geometry: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(`Service error: ${result.error}`);
      }
      
      // Create the processing result
      const processingResult: ProcessingResult = {
        success: true,
        data: result.result
      };
      
      // Cache the result if caching is enabled
      if (options?.useCache !== false) {
        this.processingCache.set(cacheKey, processingResult);
      }
      
      return processingResult;
    } catch (error) {
      logger.error('Error improving mesh geometry:', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Process an image to extract a point cloud
   * 
   * @param imageBuffer - Image buffer
   * @param options - Processing options
   * @returns Promise with processing results
   */
  async processImage(
    imageBuffer: Buffer,
    options?: {
      generateMesh?: boolean;
      quality?: 'low' | 'medium' | 'high';
      estimateDepth?: boolean;
      extractFeatures?: boolean;
      useCache?: boolean;
      optimizeResult?: boolean;
    }
  ): Promise<ProcessingResult> {
    try {
      // Create a FormData object to send the image
      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: 'application/octet-stream' });
      formData.append('image', blob);
      formData.append('options', JSON.stringify({
        generate_mesh: options?.generateMesh !== false,
        quality: options?.quality || 'medium',
        estimate_depth: options?.estimateDepth !== false,
        extract_features: options?.extractFeatures !== false,
        optimize_result: options?.optimizeResult !== false
      }));
      
      // Send the request
      const response = await fetch(`${this.modelEndpoints.pointE}/process-image`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Failed to process image: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(`Service error: ${result.error}`);
      }
      
      return {
        success: true,
        data: result.result
      };
    } catch (error) {
      logger.error('Error processing image:', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Process text description to generate a point cloud
   * 
   * @param text - Text description
   * @param options - Processing options
   * @returns Promise with processing results
   */
  async processText(
    text: string,
    options: {
      style?: string;
      constraints?: any;
    }
  ): Promise<ProcessingResult> {
    // Map the ThreeDProvider options format to Point-E specific options
    // Style can influence quality and constraints can include specific generation parameters
    const quality = options.style === 'high-quality' ? 'high' : 
                    options.style === 'low-quality' ? 'low' : 'medium';
    
    // Extract specific point cloud options from constraints if available
    const generateMesh = options.constraints?.generateMesh !== false;
    const useCache = options.constraints?.useCache !== false;
    const guidanceScale = options.constraints?.guidanceScale || 3.0;
    const numSteps = quality === 'high' ? 150 : (quality === 'low' ? 50 : 100);
    
    // For text processing, pass to the generatePointCloud method with mapped options
    return this.generatePointCloud(text, {
      guidanceScale,
      numSteps,
      postProcess: true,
      generateMesh,
      useCache,
      // Include any additional constraints as seed if provided
      seed: options.constraints?.seed
    });
  }
  
  /**
   * Generate a cache key for point cloud data and options
   * 
   * @param pointCloudData - Point cloud data
   * @param options - Processing options
   * @param prefix - Optional prefix for the key
   * @returns Cache key string
   */
  private generateCacheKey(
    pointCloudData: number[][],
    options?: any,
    prefix: string = 'process'
  ): string {
    // For performance reasons, we don't include the full point cloud in the cache key
    // Instead, we use a hash of the data based on point count and some sample points
    const pointCount = pointCloudData.length;
    const sampleRate = Math.max(1, Math.floor(pointCount / 10));
    const samplePoints = [];
    
    for (let i = 0; i < pointCount; i += sampleRate) {
      samplePoints.push(pointCloudData[i]);
    }
    
    return `${prefix}_${pointCount}_${JSON.stringify(samplePoints)}_${JSON.stringify(options || {})}`;
  }
  
  /**
   * Clear the processing cache
   */
  clearCache(): void {
    this.processingCache.clear();
    logger.info('Point cloud processing cache cleared');
  }
}
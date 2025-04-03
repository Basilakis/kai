import { logger } from '../../utils/logger';
import { BaseThreeDProvider } from './baseProvider';
import { ProcessingResult, Scene3D, ModelEndpoints, Material, ServiceError, isServiceError } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Provider for NeRF-based 3D reconstruction
 */
export class NeRFProvider extends BaseThreeDProvider {
  constructor(modelEndpoints: ModelEndpoints) {
    super(modelEndpoints);
  }

  /**
   * Process image through NeRF reconstruction pipeline
   */
  private readonly requestTimeout = 60000; // 60 second timeout for ML operations

  async processImage(imageBuffer: Buffer, options: {
    detectObjects?: boolean;
    estimateDepth?: boolean;
    segmentScene?: boolean;
  }): Promise<ProcessingResult> {
    try {
      // 1. NeRF-based reconstruction (with fallback)
      const nerfResults = await Promise.allSettled([
        this.runNerfStudio(imageBuffer),
        this.runInstantNGP(imageBuffer)
      ]);

      const nerfStudioResult = nerfResults[0].status === 'fulfilled' ? nerfResults[0].value : null;
      const instantNgpResult = nerfResults[1].status === 'fulfilled' ? nerfResults[1].value : null;

      if (!nerfStudioResult && !instantNgpResult) {
        throw new Error('Both NeRF reconstruction methods failed');
      }

      // 2. Scene understanding tasks (with fallback)
      const sceneUnderstandingTasks = [];
      if (options.detectObjects) sceneUnderstandingTasks.push(this.detectObjects(imageBuffer));
      if (options.estimateDepth) sceneUnderstandingTasks.push(this.estimateDepth(imageBuffer));
      if (options.segmentScene) sceneUnderstandingTasks.push(this.segmentScene(imageBuffer));

      const sceneResults = await Promise.allSettled(sceneUnderstandingTasks);
      const validResults = sceneResults.map(result => 
        result.status === 'fulfilled' ? result.value : null
      );

      // 3. Merge available NeRF results
      const merged3D = await this.mergeNerfResults(nerfStudioResult, instantNgpResult);
      if (!merged3D) {
        throw new Error('Failed to merge NeRF results');
      }

      // 4. Clean up with BlenderProc (with retry)
      const cleaned3D = await this.cleanupWithBlenderProc(merged3D);
      if (!cleaned3D) {
        logger.warn('BlenderProc cleanup failed, using unprocessed result');
      }

      return {
        success: true,
        data: {
          scene: cleaned3D || merged3D,
          objects: validResults[0],
          depthMap: validResults[1],
          segments: validResults[2]
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        const errorDetails = isServiceError(error)
          ? { name: error.name, message: error.message, code: error.code }
          : { name: error.name, message: error.message };
        logger.error('Error in image processing pipeline:', errorDetails);
      } else {
        logger.error('Unknown error in image processing pipeline');
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in processing pipeline'
      };
    }
  }

  /**
   * Process text input (not supported for NeRF)
   */
  async processText(text: string, options: {
    style?: string;
    constraints?: any;
  }): Promise<ProcessingResult> {
    return {
      success: false,
      error: 'Text input not supported for NeRF reconstruction'
    };
  }

  private async runNerfStudio(imageBuffer: Buffer): Promise<any> {
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

        const response = await fetch(
          this.modelEndpoints.nerfStudio,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: imageBuffer,
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Failed to run NeRF Studio: ${response.statusText}`);
        }

        const result = await response.json();
        if (!this.validateNerfResult(result)) {
          throw new Error('Invalid NeRF Studio response format');
        }

        return result;
      } catch (error) {
        attempt++;
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            logger.warn(`NeRF Studio request timeout (attempt ${attempt}/${this.maxRetries})`);
          } else {
            const errorDetails = isServiceError(error)
              ? { name: error.name, message: error.message, code: error.code }
              : { name: error.name, message: error.message };
            logger.error(`Error running NeRF Studio (attempt ${attempt}/${this.maxRetries}):`, errorDetails);
          }
        }

        if (attempt === this.maxRetries) {
          logger.error('NeRF Studio failed after all retry attempts');
          return null;
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    return null;
  }

  private validateNerfResult(result: any): boolean {
    return result && 
           (result.mesh || result.materials) &&
           (!result.materials || Array.isArray(result.materials));
  }

  private async runInstantNGP(imageBuffer: Buffer): Promise<any> {
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

        const response = await fetch(
          this.modelEndpoints.instantNgp,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: imageBuffer,
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Failed to run Instant-NGP: ${response.statusText}`);
        }

        const result = await response.json();
        if (!this.validateNerfResult(result)) {
          throw new Error('Invalid Instant-NGP response format');
        }

        return result;
      } catch (error) {
        attempt++;
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            logger.warn(`Instant-NGP request timeout (attempt ${attempt}/${this.maxRetries})`);
          } else {
            const errorDetails = isServiceError(error)
              ? { name: error.name, message: error.message, code: error.code }
              : { name: error.name, message: error.message };
            logger.error(`Error running Instant-NGP (attempt ${attempt}/${this.maxRetries}):`, errorDetails);
          }
        }

        if (attempt === this.maxRetries) {
          logger.error('Instant-NGP failed after all retry attempts');
          return null;
        }

        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    return null;
  }

  private async detectObjects(imageBuffer: Buffer): Promise<any> {
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

        const response = await fetch(
          this.modelEndpoints.yolo,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: imageBuffer,
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Failed to detect objects: ${response.statusText}`);
        }

        const result = await response.json();
        if (!Array.isArray(result)) {
          throw new Error('Invalid object detection response format');
        }

        return result;
      } catch (error) {
        attempt++;
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            logger.warn(`Object detection request timeout (attempt ${attempt}/${this.maxRetries})`);
          } else {
            const errorDetails = isServiceError(error)
              ? { name: error.name, message: error.message, code: error.code }
              : { name: error.name, message: error.message };
            logger.error(`Error detecting objects (attempt ${attempt}/${this.maxRetries}):`, errorDetails);
          }
        }

        if (attempt === this.maxRetries) {
          logger.error('Object detection failed after all retry attempts');
          return null;
        }

        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    return null;
  }

  private async estimateDepth(imageBuffer: Buffer): Promise<any> {
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

        const response = await fetch(
          this.modelEndpoints.midas,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: imageBuffer,
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Failed to estimate depth: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result || !result.depthMap) {
          throw new Error('Invalid depth estimation response format');
        }

        return result;
      } catch (error) {
        attempt++;
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            logger.warn(`Depth estimation request timeout (attempt ${attempt}/${this.maxRetries})`);
          } else {
            const errorDetails = isServiceError(error)
              ? { name: error.name, message: error.message, code: error.code }
              : { name: error.name, message: error.message };
            logger.error(`Error estimating depth (attempt ${attempt}/${this.maxRetries}):`, errorDetails);
          }
        }

        if (attempt === this.maxRetries) {
          logger.error('Depth estimation failed after all retry attempts');
          return null;
        }

        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    return null;
  }

  private async segmentScene(imageBuffer: Buffer): Promise<any> {
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

        const response = await fetch(
          this.modelEndpoints.sam,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: imageBuffer,
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Failed to segment scene: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result || !Array.isArray(result.segments)) {
          throw new Error('Invalid scene segmentation response format');
        }

        return result;
      } catch (error) {
        attempt++;
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            logger.warn(`Scene segmentation request timeout (attempt ${attempt}/${this.maxRetries})`);
          } else {
            const errorDetails = isServiceError(error)
              ? { name: error.name, message: error.message, code: error.code }
              : { name: error.name, message: error.message };
            logger.error(`Error segmenting scene (attempt ${attempt}/${this.maxRetries}):`, errorDetails);
          }
        }

        if (attempt === this.maxRetries) {
          logger.error('Scene segmentation failed after all retry attempts');
          return null;
        }

        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    return null;
  }

  private async mergeNerfResults(nerfStudioResult: any, instantNgpResult: any): Promise<Scene3D> {
    // Implement merging logic here
    // This could involve:
    // 1. Taking the best parts from each reconstruction
    // 2. Using confidence scores to decide which elements to keep
    // 3. Combining complementary elements from both results
    return {
      id: `merged-${Date.now()}`,
      name: 'Merged NeRF Scene',
      elements: [
        // Add mesh element
        {
          id: uuidv4(),
          type: 'mesh',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          dimensions: { width: 1, height: 1, depth: 1 },
          mesh: nerfStudioResult?.mesh || instantNgpResult?.mesh
        },
        // Add material elements
        ...(nerfStudioResult?.materials || []).map((material: Material) => ({
          id: uuidv4(),
          type: 'material',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          dimensions: { width: 1, height: 1, depth: 1 },
          material: {
            type: 'nerf',
            properties: material.properties,
            textures: material.textures || nerfStudioResult?.textures || {}
          }
        })),
        ...(instantNgpResult?.materials || []).map((material: Material) => ({
          id: uuidv4(),
          type: 'material',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          dimensions: { width: 1, height: 1, depth: 1 },
          material: {
            type: 'ngp',
            properties: material.properties,
            textures: material.textures || instantNgpResult?.textures || {}
          }
        }))
      ]
    };
  }
}
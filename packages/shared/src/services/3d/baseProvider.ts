import { logger } from '../../utils/logger';
import {
  Scene3D,
  ProcessingResult,
  ModelEndpoints,
  ThreeDProvider,
  GPUTier,
  ServiceError,
  isServiceError
} from './types';

/**
 * Base class for 3D providers
 * Implements common functionality and utilities
 */
export abstract class BaseThreeDProvider implements ThreeDProvider {
  protected readonly modelEndpoints: ModelEndpoints;
  protected readonly apiBase: string;
  protected readonly timeoutMs: number = 30000; // 30 second timeout
  protected readonly maxRetries: number = 3;
  private healthCheckInterval: ReturnType<typeof setTimeout> | null = null;

  constructor(modelEndpoints: ModelEndpoints) {
    this.validateEndpoints(modelEndpoints);
    this.modelEndpoints = modelEndpoints;
    this.apiBase = this.validateApiBase(process.env.ML_SERVICE_URL);
    this.startHealthChecks();
  }

  private validateEndpoints(endpoints: ModelEndpoints): void {
    if (!endpoints || typeof endpoints !== 'object') {
      throw new Error('Invalid model endpoints configuration');
    }
    
    const requiredEndpoints = ['get3d', 'blenderProc'];
    for (const endpoint of requiredEndpoints) {
      if (!endpoints[endpoint]) {
        throw new Error(`Missing required endpoint: ${endpoint}`);
      }
    }
  }

  private validateApiBase(url?: string): string {
    if (!url) {
      logger.warn('ML_SERVICE_URL not set, using fallback');
      return 'http://localhost:5000';
    }
    try {
      new URL(url);
      return url;
    } catch {
      logger.error('Invalid ML_SERVICE_URL, using fallback');
      return 'http://localhost:5000';
    }
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.checkEndpointsHealth();
        if (!health.healthy) {
          logger.error('Unhealthy endpoints detected:', health.details);
        }
      } catch (error) {
        if (error instanceof Error) {
          const errorDetails = isServiceError(error)
            ? { name: error.name, message: error.message, code: error.code }
            : { name: error.name, message: error.message };
          logger.error('Health check failed:', errorDetails);
        } else {
          logger.error('Health check failed:', { message: 'Unknown error occurred' });
        }
      }
    }, 300000); // 5 minute interval
  }

  abstract processImage(imageBuffer: Buffer, options: {
    detectObjects?: boolean;
    estimateDepth?: boolean;
    segmentScene?: boolean;
  }): Promise<ProcessingResult>;

  abstract processText(text: string, options: {
    style?: string;
    constraints?: any;
  }): Promise<ProcessingResult>;

  /**
   * Generate variations of a scene
   */
  async generateVariations(scene: Scene3D, options: {
    count?: number;
    constraints?: {
      style?: string;
      budget?: number;
      materials?: string[];
    };
  } = {}): Promise<Scene3D[]> {
    try {
      const count = options.count || 3;
      const constraints = options.constraints || {};
      const variations: Scene3D[] = [];

      for (let i = 0; i < count; i++) {
        // Generate variation using GET3D
        const variation = await this.generateVariation(scene, {
          style: constraints.style,
          index: i,
          materials: constraints.materials
        });

        if (variation) {
          variations.push(variation);
        }
      }

      return variations;
    } catch (error) {
      if (error instanceof Error) {
        const errorDetails = isServiceError(error)
          ? { name: error.name, message: error.message, code: error.code }
          : { name: error.name, message: error.message };
        logger.error('Error generating variations:', errorDetails);
      } else {
        logger.error('Error generating variations:', { message: 'Unknown error occurred' });
      }
      return [];
    }
  }

  /**
   * Export scene to various formats
   */
  async exportScene(scene: Scene3D, format: 'gltf' | 'obj' | 'fbx' = 'gltf'): Promise<any> {
    try {
      const formatters = {
        gltf: this.exportToGLTF,
        obj: this.exportToOBJ,
        fbx: this.exportToFBX
      };

      const formatter = formatters[format];
      if (!formatter) {
        throw new Error(`Unsupported format: ${format}`);
      }

      return formatter(scene);
    } catch (error) {
      if (error instanceof Error) {
        const errorDetails = isServiceError(error)
          ? { name: error.name, message: error.message, code: error.code }
          : { name: error.name, message: error.message };
        logger.error(`Error exporting scene to ${format}:`, errorDetails);
      } else {
        logger.error(`Error exporting scene to ${format}:`, { message: 'Unknown error occurred' });
      }
      return null;
    }
  }

  protected async generateVariation(scene: Scene3D, options: {
    style?: string;
    index: number;
    materials?: string[];
  }): Promise<Scene3D | null> {
    try {
      const response = await fetch(`${this.modelEndpoints.get3d}/variation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene,
          style: options.style || 'default',
          materials: options.materials
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate variation: ${response.statusText}`);
      }

      const variation = await response.json();
      return {
        ...variation,
        id: `${scene.id}-variation-${options.index}`
      };
    } catch (error) {
      if (error instanceof Error) {
        const errorDetails = isServiceError(error)
          ? { name: error.name, message: error.message, code: error.code }
          : { name: error.name, message: error.message };
        logger.error('Error generating variation:', errorDetails);
      } else {
        logger.error('Error generating variation:', { message: 'Unknown error occurred' });
      }
      return null;
    }
  }

  protected exportToGLTF = (scene: Scene3D): any => {
    return {
      asset: { version: '2.0' },
      scenes: [{
        nodes: scene.elements?.map((_, index: number) => index) || []
      }],
      nodes: scene.elements?.map(element => ({
        mesh: element.id,
        position: element.position,
        rotation: element.rotation,
        scale: element.dimensions
      })) || [],
      meshes: scene.elements?.filter(element => element.type === 'mesh').map(element => element.mesh) || [],
      materials: scene.elements?.filter(element => element.type === 'material').map(element => element.material) || []
    };
  };

  protected exportToOBJ = (scene: Scene3D): string => {
    let content = '# Exported from KAI 3D Designer\n';
    
    const meshElements = scene.elements?.filter(element => element.type === 'mesh') || [];
    
    meshElements.forEach(element => {
      if (element.mesh) {
        const { vertices, normals, uvs } = element.mesh;
        vertices?.forEach((v: number[]) => content += `v ${v.join(' ')}\n`);
        normals?.forEach((n: number[]) => content += `vn ${n.join(' ')}\n`);
        uvs?.forEach((uv: number[]) => content += `vt ${uv.join(' ')}\n`);
      }
    });

    return content;
  };

  protected exportToFBX = (scene: Scene3D): any => {
    return {
      header: {
        version: '7.4',
        creator: 'KAI 3D Designer'
      },
      objects: scene.elements?.map(element => ({
        id: element.id,
        type: element.type,
        position: element.position,
        rotation: element.rotation,
        scale: element.dimensions,
        material: element.metadata?.material
      })) || [],
      materials: scene.elements?.filter(element => element.type === 'material').map(element => element.material) || []
    };
  };

  protected detectGPUTier(): GPUTier {
    // Implement GPU detection logic
    // This is a placeholder - actual implementation would check GPU capabilities
    return 'medium';
  }

  protected async cleanupWithBlenderProc(scene: any): Promise<any> {
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(`${this.modelEndpoints.blenderProc}/cleanup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scene }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Failed to cleanup scene: ${response.statusText}`);
        }

        return response.json();
      } catch (error) {
        attempt++;
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            logger.warn(`Cleanup request timeout (attempt ${attempt}/${this.maxRetries})`);
          } else {
            const errorDetails = isServiceError(error)
              ? { name: error.name, message: error.message, code: error.code }
              : { name: error.name, message: error.message };
            logger.error(`Error cleaning up scene (attempt ${attempt}/${this.maxRetries}):`, errorDetails);
          }
        } else {
          logger.error(`Unknown error cleaning up scene (attempt ${attempt}/${this.maxRetries})`);
        }
        
        if (attempt === this.maxRetries) {
          throw new Error('Failed to cleanup scene after multiple attempts');
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  protected async checkEndpointsHealth(): Promise<{ healthy: boolean; details: Record<string, boolean> }> {
    const results: Record<string, boolean> = {};
    
    for (const [key, url] of Object.entries(this.modelEndpoints)) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${url}/health`, {
          method: 'GET',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        results[key] = response.ok;
      } catch {
        results[key] = false;
      }
    }
    
    return {
      healthy: Object.values(results).every(Boolean),
      details: results
    };
  }

  public dispose(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}
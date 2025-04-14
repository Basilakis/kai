import { ModelEndpoints, ServiceError } from './types';
import { logger } from '../../utils/logger';

export interface EnvironmentMapOptions {
  quality: 'low' | 'medium' | 'high';
  intensity?: number;
  rotation?: number;
  toneMapping?: 'linear' | 'reinhard' | 'aces' | 'cineon';
  userOverride?: string; // If user provides their own environment map
}

export interface HDREnvironmentMap {
  url: string;
  intensity: number;
  rotation: number;
  source: 'generated' | 'custom' | 'default';
  quality: 'low' | 'medium' | 'high';
  toneMapping: 'linear' | 'reinhard' | 'aces' | 'cineon';
  metadata?: {
    timestamp: number;
    sourceImage?: string;
    lightEstimation?: {
      dominant: { color: [number, number, number], intensity: number }[];
      ambient: { color: [number, number, number], intensity: number };
    };
  };
}

class ServiceErrorImpl extends Error implements ServiceError {
  code?: string;
  status?: number;
  cause?: Error;

  constructor(
    message: string,
    options?: { cause?: Error; code?: string; status?: number }
  ) {
    super(message);
    this.name = 'ServiceError';
    this.cause = options?.cause;
    this.code = options?.code;
    this.status = options?.status;
  }
}

/**
 * Service for lighting estimation and environment map generation using HDRNet
 */
export class LightingEstimationService {
  private modelEndpoints: ModelEndpoints;
  private envMapCache: Map<string, HDREnvironmentMap> = new Map();
  private readonly defaultMaps: Record<string, string> = {
    neutral: '/assets/env/neutral_studio.hdr',
    indoor: '/assets/env/interior_dim.hdr',
    outdoor: '/assets/env/outdoor_sunny.hdr',
    studio: '/assets/env/photo_studio.hdr',
  };

  constructor(modelEndpoints: ModelEndpoints) {
    this.modelEndpoints = modelEndpoints;
  }

  /**
   * Generate an HDR environment map from a source image
   */
  public async generateEnvironmentMap(
    sourceImageUrl: string,
    options: EnvironmentMapOptions
  ): Promise<HDREnvironmentMap> {
    // Check cache first
    const cacheKey = `${sourceImageUrl}-${options.quality}`;
    if (this.envMapCache.has(cacheKey)) {
      return this.envMapCache.get(cacheKey)!;
    }

    try {
      // Call ML service to generate the HDR map
      const formData = new FormData();
      formData.append('image_url', sourceImageUrl);
      formData.append('quality', options.quality);
      
      if (options.intensity) {
        formData.append('intensity', options.intensity.toString());
      }
      
      if (options.rotation) {
        formData.append('rotation', options.rotation.toString());
      }
      
      if (options.toneMapping) {
        formData.append('tone_mapping', options.toneMapping);
      }

      const response = await fetch(`${this.modelEndpoints.hdrnet}/generate`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(15000) // 15 second timeout
      });

      if (!response.ok) {
        throw new Error(`Failed to generate environment map: ${response.statusText}`);
      }

      const result = await response.json();
      
      const envMap: HDREnvironmentMap = {
        url: result.env_map_url,
        intensity: options.intensity || 1.0,
        rotation: options.rotation || 0,
        source: 'generated',
        quality: options.quality,
        toneMapping: options.toneMapping || 'aces',
        metadata: {
          timestamp: Date.now(),
          sourceImage: sourceImageUrl,
          lightEstimation: result.light_estimation
        }
      };

      // Cache the result
      this.envMapCache.set(cacheKey, envMap);
      return envMap;
    } catch (error) {
      logger.error('Error generating environment map:', { error: error instanceof Error ? error : String(error) });
      
      // Fallback to a default environment map based on the quality
      const fallbackMap = this.getDefaultEnvironmentMap(options.quality);
      return fallbackMap;
    }
  }

  /**
   * Get a default environment map if generation fails
   */
  public getDefaultEnvironmentMap(quality: 'low' | 'medium' | 'high', type: string = 'neutral'): HDREnvironmentMap {
    // Ensure we have a default if the requested type doesn't exist
    const mapUrl = this.defaultMaps[type] || this.defaultMaps.neutral;
    
    // This should never happen, but we provide a fallback just in case
    const safeUrl = mapUrl || '/assets/env/neutral_studio.hdr';
    
    return {
      url: safeUrl,
      intensity: 1.0,
      rotation: 0,
      source: 'default',
      quality,
      toneMapping: 'aces'
    };
  }

  /**
   * Get or create an environment map, with user override option
   */
  public async getEnvironmentMap(
    sourceImageUrl: string | undefined,
    options: EnvironmentMapOptions
  ): Promise<HDREnvironmentMap> {
    // If user provided an override, use that
    if (options.userOverride) {
      return {
        url: options.userOverride,
        intensity: options.intensity || 1.0,
        rotation: options.rotation || 0,
        source: 'custom',
        quality: options.quality,
        toneMapping: options.toneMapping || 'aces'
      };
    }

    // If no source image, use default
    if (!sourceImageUrl) {
      return this.getDefaultEnvironmentMap(options.quality);
    }

    // Generate from source image
    return this.generateEnvironmentMap(sourceImageUrl, options);
  }

  /**
   * Extract lighting information from an image
   */
  public async extractLightingInformation(
    imageUrl: string
  ): Promise<{ 
    dominantLights: Array<{ color: [number, number, number], intensity: number, direction?: [number, number, number] }>,
    ambientLight: { color: [number, number, number], intensity: number }
  }> {
    try {
      const response = await fetch(`${this.modelEndpoints.hdrnet}/extract_lighting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl }),
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`Failed to extract lighting information: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Error extracting lighting information:', { error: error instanceof Error ? error : String(error) });
      
      // Return default lighting information
      return {
        dominantLights: [
          { color: [1, 1, 1], intensity: 0.8 }
        ],
        ambientLight: { color: [0.5, 0.5, 0.6], intensity: 0.2 }
      };
    }
  }

  /**
   * Clear the environment map cache
   */
  public clearCache(): void {
    this.envMapCache.clear();
  }

  /**
   * Remove a specific entry from the environment map cache
   */
  public removeCacheEntry(sourceImageUrl: string, quality: 'low' | 'medium' | 'high'): void {
    const cacheKey = `${sourceImageUrl}-${quality}`;
    this.envMapCache.delete(cacheKey);
  }
}
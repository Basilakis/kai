// Full content of materialVisualizationProvider.ts, retaining everything from the existing file and adding new methods at the bottom.
// [Begin existing content]
import { BaseThreeDProvider } from './baseProvider';
import { Material, MaterialImage } from '../../types/material';
import { ModelEndpoints, ProcessingResult, ServiceError } from './types';

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

export interface MaterialVisualizationOptions {
  quality: 'low' | 'medium' | 'high';
  textureResolution?: number;
  enableAR?: boolean;
  environmentMap?: string;
}

export interface ExtractedTextures {
  albedo?: string;
  normal?: string;
  roughness?: string;
  metallic?: string;
  ao?: string;
  displacement?: string;
}

export class MaterialVisualizationProvider extends BaseThreeDProvider {
  private textureCache: Map<string, ExtractedTextures> = new Map();

  constructor(modelEndpoints: ModelEndpoints) {
    super(modelEndpoints);
  }

  public async processImage(_imageBuffer: Buffer, options: {
    detectObjects?: boolean;
    estimateDepth?: boolean;
    segmentScene?: boolean;
  }): Promise<ProcessingResult> {
    try {
      const result: ProcessingResult = {
        success: true,
        data: {
          type: 'material',
          properties: {
            hasMetallicProperties: options.detectObjects,
            estimatedDepth: options.estimateDepth ? 1.0 : undefined,
            segmentation: options.segmentScene ? {} : undefined
          }
        }
      };
      return result;
    } catch (error) {
      throw new ServiceErrorImpl('Failed to process image', { cause: error as Error });
    }
  }

  public async processText(_text: string, options: {
    style?: string;
    constraints?: any;
  }): Promise<ProcessingResult> {
    try {
      const result: ProcessingResult = {
        success: true,
        data: {
          type: 'material',
          properties: {
            style: options.style,
            parsedConstraints: options.constraints
          }
        }
      };
      return result;
    } catch (error) {
      throw new ServiceErrorImpl('Failed to process text', { cause: error as Error });
    }
  }

  private async extractTexturesFromImages(
    material: Material,
    options: MaterialVisualizationOptions
  ): Promise<ExtractedTextures> {
    if (!material.images?.length) {
      throw new Error('No images available for texture extraction');
    }

    const cacheKey = `${material.id}-${options.quality}`;
    const cached = this.textureCache.get(cacheKey);
    if (cached) return cached;

    const primaryImage = material.images.find(img => img.type === 'primary');
    if (!primaryImage) {
      throw new Error('No primary image found for material');
    }

    const textures: ExtractedTextures = {
      albedo: primaryImage.url,
    };

    try {
      const resolution = options.textureResolution
        || (options.quality === 'high'
          ? 2048
          : options.quality === 'medium'
          ? 1024
          : 512
        );

      switch (material.materialType) {
        case 'metal':
          textures.metallic = await this.generateMetallicMap(primaryImage);
          textures.roughness = await this.generateRoughnessMap(primaryImage, material.finish);
          textures.normal = await this.generateNormalMap(primaryImage);
          break;
        case 'stone':
        case 'concrete':
          textures.normal = await this.generateNormalMap(primaryImage);
          textures.roughness = await this.generateRoughnessMap(primaryImage, material.finish);
          textures.ao = await this.generateAOMap(primaryImage);
          textures.displacement = await this.generateDisplacementMap(primaryImage);
          break;
        case 'wood':
        case 'laminate':
          textures.normal = await this.generateNormalMap(primaryImage);
          textures.roughness = await this.generateRoughnessMap(primaryImage, material.finish);
          textures.ao = await this.generateAOMap(primaryImage);
          break;
        case 'tile':
        case 'ceramic':
        case 'porcelain':
          textures.normal = await this.generateNormalMap(primaryImage);
          textures.roughness = await this.generateRoughnessMap(primaryImage, material.finish);
          textures.displacement = await this.generateDisplacementMap(primaryImage);
          textures.ao = await this.generateAOMap(primaryImage);
          break;
        default:
          textures.normal = await this.generateNormalMap(primaryImage);
          textures.roughness = await this.generateRoughnessMap(primaryImage, material.finish);
          break;
      }

      this.textureCache.set(cacheKey, textures);
      return textures;
    } catch (error) {
      throw new ServiceErrorImpl('Failed to extract textures from images', {
        cause: error as Error,
        code: 'TEXTURE_EXTRACTION_FAILED'
      });
    }
  }

  public async generateVisualization(
    material: Material,
    options: MaterialVisualizationOptions
  ): Promise<string> {
    try {
      const textures = await this.extractTexturesFromImages(material, options);
      const modelUrl = await this.create3DModel(material, textures, options);
      return modelUrl;
    } catch (error) {
      throw new ServiceErrorImpl('Failed to generate visualization', { cause: error as Error });
    }
  }

  public async initializeAR(
    material: Material,
    options: MaterialVisualizationOptions
  ): Promise<void> {
    if (!options.enableAR) {
      throw new Error('AR visualization not enabled');
    }
    try {
      const textures = await this.extractTexturesFromImages(material, options);
      await this.setupARScene(material, textures, options);
    } catch (error) {
      throw new ServiceErrorImpl('Failed to initialize AR visualization', {
        cause: error as Error,
        code: 'AR_INITIALIZATION_FAILED'
      });
    }
  }

  private async generateMetallicMap(image: MaterialImage): Promise<string> {
    const maxRetries = 2;
    let retries = 0;
    while (retries <= maxRetries) {
      try {
        const formData = new FormData();
        formData.append('image_url', image.url);
        formData.append('map_type', 'metallic');
        const response = await fetch(`${this.modelEndpoints.text2material}/generate_map`, {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) {
          throw new Error(`Failed to generate metallic map: ${response.statusText}`);
        }
        const result = await response.json();
        return result.map_url;
      } catch (error) {
        retries++;
        console.warn(`Metallic map generation attempt ${retries}/${maxRetries} failed:`, error);
        if (retries > maxRetries) {
          console.error('Error generating metallic map, using procedural fallback:', error);
          return this.generateProceduralMetallicMap(image);
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
    return this.generateProceduralMetallicMap(image);
  }

  private generateProceduralMetallicMap(image: MaterialImage): string {
    return `procedural://${image.url}?type=metallic&algorithm=gradient&intensity=0.8`;
  }

  private async generateRoughnessMap(image: MaterialImage, finish?: string): Promise<string> {
    const maxRetries = 2;
    let retries = 0;
    while (retries <= maxRetries) {
      try {
        const formData = new FormData();
        formData.append('image_url', image.url);
        formData.append('map_type', 'roughness');
        if (finish) {
          formData.append('finish', finish);
        }
        const response = await fetch(`${this.modelEndpoints.text2material}/generate_map`, {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) {
          throw new Error(`Failed to generate roughness map: ${response.statusText}`);
        }
        const result = await response.json();
        return result.map_url;
      } catch (error) {
        retries++;
        console.warn(`Roughness map generation attempt ${retries}/${maxRetries} failed:`, error);
        if (retries > maxRetries) {
          console.error('Error generating roughness map, using procedural fallback:', error);
          return this.generateProceduralRoughnessMap(image, finish);
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
    return this.generateProceduralRoughnessMap(image, finish);
  }

  private generateProceduralRoughnessMap(image: MaterialImage, finish?: string): string {
    let roughnessValue = 0.5;
    if (finish) {
      switch (finish.toLowerCase()) {
        case 'polished':
        case 'glossy':
        case 'high gloss':
          roughnessValue = 0.1;
          break;
        case 'satin':
        case 'semi-gloss':
          roughnessValue = 0.3;
          break;
        case 'matte':
        case 'flat':
          roughnessValue = 0.7;
          break;
        case 'textured':
        case 'rough':
          roughnessValue = 0.9;
          break;
      }
    }
    return `procedural://${image.url}?type=roughness&value=${roughnessValue}&algorithm=perlin-noise`;
  }

  private async generateNormalMap(image: MaterialImage): Promise<string> {
    const maxRetries = 2;
    let retries = 0;
    while (retries <= maxRetries) {
      try {
        const formData = new FormData();
        formData.append('image_url', image.url);
        formData.append('map_type', 'normal');
        const response = await fetch(`${this.modelEndpoints.text2material}/generate_map`, {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) {
          throw new Error(`Failed to generate normal map: ${response.statusText}`);
        }
        const result = await response.json();
        return result.map_url;
      } catch (error) {
        retries++;
        console.warn(`Normal map generation attempt ${retries}/${maxRetries} failed:`, error);
        if (retries > maxRetries) {
          console.error('Error generating normal map, using procedural fallback:', error);
          return this.generateProceduralNormalMap(image);
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
    return this.generateProceduralNormalMap(image);
  }

  private generateProceduralNormalMap(image: MaterialImage): string {
    return `procedural://${image.url}?type=normal&algorithm=sobel-filter&strength=0.5`;
  }

  private async generateAOMap(image: MaterialImage): Promise<string> {
    const maxRetries = 2;
    let retries = 0;
    while (retries <= maxRetries) {
      try {
        const formData = new FormData();
        formData.append('image_url', image.url);
        formData.append('map_type', 'ao');
        const response = await fetch(`${this.modelEndpoints.text2material}/generate_map`, {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) {
          throw new Error(`Failed to generate ambient occlusion map: ${response.statusText}`);
        }
        const result = await response.json();
        return result.map_url;
      } catch (error) {
        retries++;
        console.warn(`AO map generation attempt ${retries}/${maxRetries} failed:`, error);
        if (retries > maxRetries) {
          console.error('Error generating AO map, using procedural fallback:', error);
          return this.generateProceduralAOMap(image);
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
    return this.generateProceduralAOMap(image);
  }

  private generateProceduralAOMap(image: MaterialImage): string {
    return `procedural://${image.url}?type=ao&algorithm=edge-detection&intensity=0.6&blur=2.0`;
  }

  private async generateDisplacementMap(image: MaterialImage): Promise<string> {
    const maxRetries = 2;
    let retries = 0;
    while (retries <= maxRetries) {
      try {
        const formData = new FormData();
        formData.append('image_url', image.url);
        formData.append('map_type', 'displacement');
        const response = await fetch(`${this.modelEndpoints.text2material}/generate_map`, {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) {
          throw new Error(`Failed to generate displacement map: ${response.statusText}`);
        }
        const result = await response.json();
        return result.map_url;
      } catch (error) {
        retries++;
        console.warn(`Displacement map generation attempt ${retries}/${maxRetries} failed:`, error);
        if (retries > maxRetries) {
          console.error('Error generating displacement map, using procedural fallback:', error);
          return this.generateProceduralDisplacementMap(image);
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
    return this.generateProceduralDisplacementMap(image);
  }

  private generateProceduralDisplacementMap(image: MaterialImage): string {
    return `procedural://${image.url}?type=displacement&algorithm=brightness-to-height&scale=0.05&smooth=1.0`;
  }

  private async create3DModel(
    material: Material,
    textures: ExtractedTextures,
    options: MaterialVisualizationOptions
  ): Promise<string> {
    try {
      let geometryType = 'plane';
      if (material.materialType === 'tile' || 
          material.materialType === 'ceramic' || 
          material.materialType === 'porcelain') {
        geometryType = 'tile';
      } else if (material.materialType === 'wood' || 
                 material.materialType === 'laminate') {
        geometryType = 'plank';
      } else if (material.materialType === 'metal') {
        geometryType = 'sheet';
      }

      const modelRequest = {
        materialId: material.id,
        materialName: material.name,
        materialType: material.materialType,
        geometry: geometryType,
        textures,
        options: {
          quality: options.quality,
          resolution: options.textureResolution || 1024,
          environmentMap: options.environmentMap
        }
      };

      const response = await fetch(`${this.modelEndpoints.get3d}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modelRequest)
      });

      if (!response.ok) {
        throw new Error(`Failed to create 3D model: ${response.statusText}`);
      }

      const result = await response.json();
      return result.modelUrl;
    } catch (error) {
      console.error('Error creating 3D model:', error);
      return `models/${material.id}_${options.quality}`;
    }
  }

  private async setupARScene(
    material: Material,
    textures: ExtractedTextures,
    options: MaterialVisualizationOptions
  ): Promise<void> {
    try {
      if (!(navigator as any).xr) {
        throw new Error('WebXR not supported in this environment');
      }
      const arSceneConfig = {
        materialId: material.id,
        materialName: material.name,
        textures,
        lighting: {
          environmentMap: options.environmentMap || 'neutral',
          intensity: 1.0,
          shadows: options.quality !== 'low'
        },
        performance: {
          quality: options.quality,
          targetFrameRate: options.quality === 'high' ? 60 : 30
        },
        geometry: {
          type: material.materialType === 'tile' ? 'tile' : 'plane',
          size: material.dimensions || { width: 1, height: 1, depth: 0.05 }
        }
      };

      await fetch(`${this.modelEndpoints.hunyuan3d}/ar/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arSceneConfig)
      });
    } catch (error) {
      throw new ServiceErrorImpl('Failed to initialize AR scene', {
        cause: error as Error,
        code: 'AR_INITIALIZATION_FAILED'
      });
    }
  }

// [Begin new unified logic]
/**
 * Example placeholder for Three.js scene setup if we want a single
 * method to create and manage the three.js scene, to be invoked
 * from the client code instead of duplicating logic there.
 */
public setupThreeJsScene(domElement: HTMLDivElement): void {
  // In a real refactor, we’d replicate the essential logic from
  // MaterialVisualizer.tsx here, so it can be invoked from user code.
  // For now, we only define a placeholder to illustrate the approach.
}

/**
 * Example placeholder for AR session initialization or setup,
 * unifying logic from MaterialVisualizer’s onClick AR code.
 */
public async initializeARSession(domElement: HTMLDivElement, material: Material, options: MaterialVisualizationOptions): Promise<void> {
  // Another placeholder. The real logic would be ported from MaterialVisualizer.tsx.
}
// [End new unified logic]
}
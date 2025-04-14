import { BaseThreeDProvider } from './baseProvider';
// Correctly import Material type from the right location
import { Material } from '../../types/material'; 
import { 
  ModelEndpoints, 
  ProcessingResult, 
  ServiceError, 
  MaterialVisualizationOptions,
  ExtractedTextures,
  HDREnvironmentMap,
  EnvironmentMapOptions,
  TextureEnhancementOptions,
  TextToTextureOptions,
  TextureResult 
} from './types';
import { LightingEstimationService } from './lightingEstimationService';
import { materialNetProvider, MaterialProperties } from '../recognition/materialNetProvider';
import { TextureEnhancementProvider } from './textureEnhancementProvider'; 
import { logger } from '../../utils/logger';
import fs from 'fs'; 
import path from 'path'; 
import os from 'os'; // Import os
import { v4 as uuidv4 } from 'uuid'; 

// Define MaterialImage locally if not exported/imported correctly
interface MaterialImage {
    url: string;
    type: 'primary' | 'swatch' | 'context';
}

// Placeholder for withTempDir - needs proper implementation or import
async function withTempDirPlaceholder<T>(callback: (tempDirPath: string) => Promise<T>): Promise<T> {
    logger.warn('Using placeholder withTempDir. Refactor needed.');
    // Using relative path as os.tmpdir() caused issues
    const tempBase = './temp_shared_downloads'; 
    fs.mkdirSync(tempBase, { recursive: true }); // Ensure base temp dir exists
    const tempDirPath = path.join(tempBase, `kai-shared-temp-${uuidv4()}`);
    fs.mkdirSync(tempDirPath, { recursive: true });
    try {
        const result = await callback(tempDirPath);
        return result;
    } finally {
        try {
            if (fs.existsSync(tempDirPath)) {
                // Use async rmdir with callback for cleanup
                fs.rmdir(tempDirPath, { recursive: true }, (err: Error | null) => { // Added type
                   if (err) logger.error(`Failed to cleanup placeholder temp dir ${tempDirPath}`, { error: err });
                });
            }
        } catch (e) {
            logger.error(`Error during placeholder temp dir cleanup check ${tempDirPath}`, { error: e });
        }
    }
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

export class MaterialVisualizationProvider extends BaseThreeDProvider {
  private textureCache: Map<string, ExtractedTextures> = new Map();
  private envMapCache: Map<string, HDREnvironmentMap> = new Map();
  private materialNetCache: Map<string, MaterialProperties> = new Map();
  private lightingService: LightingEstimationService;
  private textureEnhancementProvider: TextureEnhancementProvider; 

  constructor(modelEndpoints: ModelEndpoints) {
    super(modelEndpoints);
    this.lightingService = new LightingEstimationService(modelEndpoints);
    this.textureEnhancementProvider = new TextureEnhancementProvider(modelEndpoints); 
  }

  // Correct implementation of abstract methods from BaseThreeDProvider
  public async processImage(imageBuffer: Buffer, options: {
    detectObjects?: boolean;
    estimateDepth?: boolean;
    segmentScene?: boolean;
  }): Promise<ProcessingResult> {
    logger.info('MaterialVisualizationProvider.processImage called', { options, bufferSize: imageBuffer.length });
    // Minimal implementation matching signature
    return { success: true, data: { message: 'Processing options noted.', options } };
  }

  public async processText(text: string, options: {
    style?: string;
    constraints?: any;
  }): Promise<ProcessingResult> {
     logger.info('MaterialVisualizationProvider.processText called', { text, options });
     // Minimal implementation matching signature
     if (options?.style === 'texture') { 
         // Delegate to texture provider if style matches
         return this.textureEnhancementProvider.generateTextureFromText(text, options);
     }
     return { success: false, error: 'Generic text processing not supported by MaterialVisualizationProvider unless style=texture' };
  }
  // --- End of Abstract Method Implementations ---


  private async extractTexturesFromImages(
    material: Material,
    options: MaterialVisualizationOptions
  ): Promise<ExtractedTextures> {
    // Use the actual Material type which includes 'images'
    const images = material.images as MaterialImage[] | undefined; 

    if (!images?.length && !options.textToTexture?.enabled) {
      throw new Error('No images available and text-to-texture not enabled');
    }

     const baseCacheKey = `${material.id}-${options.quality}`;
     const enhancementKeyPart = options.textureEnhancement?.enabled 
         ? `_enhance-${options.textureEnhancement.quality || 'medium'}-${options.textureEnhancement.scale || 4}` 
         : '';
     const textGenKeyPart = options.textToTexture?.enabled && options.textToTexture.prompt
         ? `_text-${options.textToTexture.prompt.substring(0, 20)}-${options.textToTexture.style || 'default'}-${options.textToTexture.size || 1024}`
         : '';
     const materialNetKeyPart = options.useMaterialNet ? '_matnet' : '';
     const cacheKey = `${baseCacheKey}${enhancementKeyPart}${textGenKeyPart}${materialNetKeyPart}`;


    const cached = this.textureCache.get(cacheKey);
    if (cached) {
        logger.debug(`Using cached textures for key: ${cacheKey}`);
        return cached;
    }

    const textures: ExtractedTextures = {};
    let primaryImage: MaterialImage | undefined = images?.find(img => img.type === 'primary');
    let primaryImageUrl: string | undefined = primaryImage?.url;
    let generatedOrEnhancedAlbedoPath: string | undefined;
    let tempFilesToDelete: string[] = []; 

    try {
        // 1. Text-to-Texture Generation
        if (options.textToTexture?.enabled && options.textToTexture.prompt) {
            logger.info('Generating texture from text', { materialId: material.id, prompt: options.textToTexture.prompt });
            const textOptions: TextToTextureOptions = {
                style: options.textToTexture.style,
                size: options.textToTexture.size,
            };
            const textResult = await this.textureEnhancementProvider.generateTextureFromText(options.textToTexture.prompt, textOptions);
            if (textResult.success && textResult.outputPath) {
                generatedOrEnhancedAlbedoPath = textResult.outputPath;
                textures.albedo = generatedOrEnhancedAlbedoPath; 
                primaryImageUrl = generatedOrEnhancedAlbedoPath; 
                primaryImage = { url: primaryImageUrl, type: 'primary' }; 
                logger.info(`Generated texture saved to: ${generatedOrEnhancedAlbedoPath}`);
            } else {
                logger.warn('Text-to-texture generation failed', { materialId: material.id, error: textResult.error });
                if (!primaryImageUrl) throw new Error('Text-to-texture failed and no primary image available.');
            }
        }

        // 2. Texture Enhancement
        else if (options.textureEnhancement?.enabled && primaryImageUrl) {
            logger.info('Enhancing primary texture', { materialId: material.id, url: primaryImageUrl });
            const enhanceOptions: TextureEnhancementOptions = {
                quality: options.textureEnhancement.quality,
                scale: options.textureEnhancement.scale,
            };
            
            const imagePathForEnhancement = await this.ensureFilePath(primaryImageUrl);
            if (imagePathForEnhancement) {
                 if (imagePathForEnhancement !== primaryImageUrl) tempFilesToDelete.push(imagePathForEnhancement); 

                 const enhanceResult = await this.textureEnhancementProvider.enhanceTexture(imagePathForEnhancement, enhanceOptions);
                 if (enhanceResult.success && enhanceResult.outputPath) {
                     generatedOrEnhancedAlbedoPath = enhanceResult.outputPath;
                     textures.albedo = generatedOrEnhancedAlbedoPath; 
                     primaryImageUrl = generatedOrEnhancedAlbedoPath; 
                     primaryImage = { url: primaryImageUrl, type: 'primary' }; 
                     logger.info(`Enhanced texture saved to: ${generatedOrEnhancedAlbedoPath}`);
                 } else {
                     logger.warn('Texture enhancement failed, using original', { materialId: material.id, error: enhanceResult.error });
                     textures.albedo = primaryImageUrl; 
                 }
            } else {
                 logger.warn('Could not get file path for enhancement, using original texture.', { materialId: material.id });
                 textures.albedo = primaryImageUrl;
            }
        } else {
            if (!primaryImageUrl) throw new Error('No primary image available for texture extraction.');
            textures.albedo = primaryImageUrl;
        }

        // 3. PBR Property Extraction
        if (options.useMaterialNet && primaryImageUrl) { 
            logger.info('Using MaterialNet for PBR property extraction', { materialId: material.id });
            try {
                const imagePathForMaterialNet = await this.ensureFilePath(primaryImageUrl);
                if (imagePathForMaterialNet) {
                    if (imagePathForMaterialNet !== primaryImageUrl) tempFilesToDelete.push(imagePathForMaterialNet); 

                    const materialProperties = await this.getMaterialNetProperties(imagePathForMaterialNet, options.quality); 
                    if (materialProperties) {
                        textures.albedo = materialProperties.albedo || textures.albedo; 
                        textures.normal = materialProperties.normal;
                        textures.roughness = materialProperties.roughness;
                        textures.metallic = materialProperties.metalness;
                        textures.ao = materialProperties.ao;
                        textures.displacement = materialProperties.height;
                        
                        this.textureCache.set(cacheKey, textures);
                        logger.debug(`Cached textures for key: ${cacheKey}`);
                        return textures; // Return early
                    }
                } else {
                     logger.warn('Could not get file path for MaterialNet, falling back.', { materialId: material.id });
                }
            } catch (materialNetError) {
                logger.warn('MaterialNet extraction failed, falling back to conventional methods', {
                    materialId: material.id,
                    error: materialNetError instanceof Error ? materialNetError.message : String(materialNetError)
                });
            }
        }

        // Conventional extraction (fallback or if MaterialNet not used/failed)
        if (primaryImage) { 
             // Use material.finish directly
             const finish = material.finish; 
             switch (material.materialType) {
                case 'metal':
                    textures.metallic = textures.metallic ?? await this.generateMetallicMap(primaryImage);
                    textures.roughness = textures.roughness ?? await this.generateRoughnessMap(primaryImage, finish); // Use material.finish
                    textures.normal = textures.normal ?? await this.generateNormalMap(primaryImage);
                    break;
                 case 'stone':
                 case 'concrete':
                   textures.normal = textures.normal ?? await this.generateNormalMap(primaryImage);
                   textures.roughness = textures.roughness ?? await this.generateRoughnessMap(primaryImage, finish); // Use material.finish
                   textures.ao = textures.ao ?? await this.generateAOMap(primaryImage);
                   textures.displacement = textures.displacement ?? await this.generateDisplacementMap(primaryImage);
                   break;
                 case 'wood':
                 case 'laminate':
                   textures.normal = textures.normal ?? await this.generateNormalMap(primaryImage);
                   textures.roughness = textures.roughness ?? await this.generateRoughnessMap(primaryImage, finish); // Use material.finish
                   textures.ao = textures.ao ?? await this.generateAOMap(primaryImage);
                   break;
                 case 'tile':
                 case 'ceramic':
                 case 'porcelain':
                   textures.normal = textures.normal ?? await this.generateNormalMap(primaryImage);
                   textures.roughness = textures.roughness ?? await this.generateRoughnessMap(primaryImage, finish); // Use material.finish
                   textures.displacement = textures.displacement ?? await this.generateDisplacementMap(primaryImage);
                   textures.ao = textures.ao ?? await this.generateAOMap(primaryImage);
                   break;
                 default:
                   textures.normal = textures.normal ?? await this.generateNormalMap(primaryImage);
                   textures.roughness = textures.roughness ?? await this.generateRoughnessMap(primaryImage, finish); // Use material.finish
                   break;
             }
        } else {
             throw new Error("Cannot perform conventional texture extraction without a primary image.");
        }

        this.textureCache.set(cacheKey, textures);
        logger.debug(`Cached textures for key: ${cacheKey}`);
        return textures;
    } catch (error) {
        throw new ServiceErrorImpl('Failed to extract textures', {
            cause: error as Error,
            code: 'TEXTURE_EXTRACTION_FAILED'
        });
    } finally {
        tempFilesToDelete.forEach(filePath => {
            if (fs.existsSync(filePath)) {
                fs.unlink(filePath, (err: Error | null) => { // Use async unlink
                    if (err) logger.warn(`Failed cleanup in finally block`, { path: filePath, error: err });
                });
            }
        });
    }
  }

  private async ensureFilePath(urlOrPath: string): Promise<string | undefined> {
      if (!urlOrPath.startsWith('http://') && !urlOrPath.startsWith('https://')) {
          return fs.existsSync(urlOrPath) ? urlOrPath : undefined;
      }
      try {
          const response = await fetch(urlOrPath);
          if (!response.ok) {
              logger.warn(`Failed to download image from URL: ${urlOrPath}`, { status: response.status });
              return undefined;
          }
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // Use placeholder temp dir logic
          return await withTempDirPlaceholder(async (tempDirPath) => {
              const tempFileName = `${uuidv4()}${path.extname(new URL(urlOrPath).pathname) || '.tmp'}`;
              const tempFilePath = path.join(tempDirPath, tempFileName);
              fs.writeFileSync(tempFilePath, buffer);
              logger.debug(`Downloaded ${urlOrPath} to ${tempFilePath}`);
              return tempFilePath; 
          });
      } catch (error) {
          logger.error(`Error downloading image from URL: ${urlOrPath}`, { error });
          return undefined;
      }
  }

   private async getMaterialNetProperties(
    imagePath: string, 
    quality: 'low' | 'medium' | 'high'
  ): Promise<MaterialProperties | undefined> {
    try {
      const cacheKey = `${imagePath}-${quality}`; 
      if (this.materialNetCache.has(cacheKey)) {
        return this.materialNetCache.get(cacheKey);
      }
      const properties = await materialNetProvider.extractProperties(imagePath, { 
        quality: quality,
        outputFormat: 'png'
      });
      if (properties) {
        this.materialNetCache.set(cacheKey, properties);
      }
      return properties;
    } catch (error) {
      logger.warn('Failed to extract MaterialNet properties', {
        error: error instanceof Error ? error.message : String(error),
        imagePath 
      });
      return undefined;
    }
  }

  private async getEnvironmentMap(
    material: Material,
    options: MaterialVisualizationOptions
  ): Promise<HDREnvironmentMap> {
    const images = material.images as MaterialImage[] | undefined;
    const legacyEnvMap = options.environmentMap;
    const lightingOptions = options.lighting || {};
    
    if (lightingOptions.environmentMap || legacyEnvMap) {
      return {
        url: lightingOptions.environmentMap || legacyEnvMap!,
        intensity: lightingOptions.intensity || 1.0,
        rotation: lightingOptions.rotation || 0,
        source: 'custom',
        quality: options.quality,
        toneMapping: lightingOptions.toneMapping || 'aces'
      };
    }

    const cacheKey = `${material.id}-${options.quality}-${lightingOptions.defaultType || 'neutral'}`;
    if (this.envMapCache.has(cacheKey)) {
      return this.envMapCache.get(cacheKey)!;
    }

    if (lightingOptions.autoGenerate && images?.length) {
      const primaryImage = images.find(img => img.type === 'primary');
      if (primaryImage) {
        const envMapOptions: EnvironmentMapOptions = {
          // Provide default quality if undefined
          quality: options.quality || 'medium', 
          intensity: lightingOptions.intensity,
          rotation: lightingOptions.rotation,
          toneMapping: lightingOptions.toneMapping
        };
        try {
          const envMap = await this.lightingService.generateEnvironmentMap(
            primaryImage.url,
            envMapOptions
          );
          this.envMapCache.set(cacheKey, envMap);
          return envMap;
        } catch (error) {
          logger.warn('Failed to generate environment map from material image, using default', {
            materialId: material.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    const defaultType = lightingOptions.defaultType || 'neutral';
    // Provide default quality if undefined
    const defaultMap = this.lightingService.getDefaultEnvironmentMap(options.quality || 'medium', defaultType); 
    this.envMapCache.set(cacheKey, defaultMap);
    return defaultMap;
  }

  // --- Restored Helper Methods ---
  private async generateMetallicMap(image: MaterialImage): Promise<string> {
    logger.info(`Generating metallic map for ${image.url}`);
    // Placeholder - replace with actual logic (e.g., call ML service)
    return `procedural://${image.url}?type=metallic&value=0.9`; // Example procedural
  }

  private async generateRoughnessMap(image: MaterialImage, finish?: string): Promise<string> {
    logger.info(`Generating roughness map for ${image.url} with finish ${finish}`);
    let roughnessValue = 0.5;
     if (finish) {
       switch (finish.toLowerCase()) {
         case 'polished': case 'glossy': roughnessValue = 0.1; break;
         case 'satin': case 'semi-gloss': roughnessValue = 0.3; break;
         case 'matte': case 'flat': roughnessValue = 0.7; break;
         case 'textured': case 'rough': roughnessValue = 0.9; break;
       }
     }
    return `procedural://${image.url}?type=roughness&value=${roughnessValue}`; // Example procedural
  }

  private async generateNormalMap(image: MaterialImage): Promise<string> {
    logger.info(`Generating normal map for ${image.url}`);
    return `procedural://${image.url}?type=normal&strength=0.5`; // Example procedural
  }

  private async generateAOMap(image: MaterialImage): Promise<string> {
    logger.info(`Generating AO map for ${image.url}`);
    return `procedural://${image.url}?type=ao&intensity=0.7`; // Example procedural
  }

  private async generateDisplacementMap(image: MaterialImage): Promise<string> {
    logger.info(`Generating displacement map for ${image.url}`);
     return `procedural://${image.url}?type=displacement&scale=0.01`; // Example procedural
  }

  private async create3DModel(
    material: Material,
    textures: ExtractedTextures,
    options: MaterialVisualizationOptions,
    envMap?: HDREnvironmentMap
  ): Promise<string> {
     logger.info(`Creating 3D model for material ${material.id}`, { textures, options, envMap });
     // Placeholder - replace with actual model generation logic
     return `placeholder_model_${material.id}_${options.quality}.glb`;
  }

   private async setupARScene(
    material: Material,
    textures: ExtractedTextures,
    options: MaterialVisualizationOptions
  ): Promise<void> {
     logger.info(`Setting up AR scene for material ${material.id}`, { textures, options });
     if (!(globalThis.navigator as any)?.xr) { 
        logger.warn('WebXR not supported, skipping AR setup.');
        return;
     }
     // Placeholder for AR setup logic
     return Promise.resolve();
  }
  // --- End of Restored Helper Methods ---


  public async generateVisualization(
    material: Material,
    options: MaterialVisualizationOptions
  ): Promise<string> {
    try {
      const textures = await this.extractTexturesFromImages(material, options);
      const envMap = await this.getEnvironmentMap(material, options);
      const modelUrl = await this.create3DModel(material, textures, options, envMap);
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
      const envMap = await this.getEnvironmentMap(material, options);
      const enhancedOptions = {
        ...options,
        lighting: {
          ...options.lighting,
          environmentMap: envMap.url
        }
      };
      await this.setupARScene(material, textures, enhancedOptions);
    } catch (error) {
      throw new ServiceErrorImpl('Failed to initialize AR visualization', {
        cause: error as Error,
        code: 'AR_INITIALIZATION_FAILED'
      });
    }
  }

  public setupThreeJsScene(
    domElement: HTMLDivElement,
    material: Material,
    options: MaterialVisualizationOptions
  ): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        const textures = await this.extractTexturesFromImages(material, options);
        const envMap = await this.getEnvironmentMap(material, options);
        const sceneConfig = {
          textures,
          environmentMap: envMap,
          quality: options.quality,
          physicallyBasedRendering: true,
          container: domElement, 
          material: {
            id: material.id,
            name: material.name,
            type: material.materialType
          }
        };
        resolve(sceneConfig); 
      } catch (error) {
        reject(new ServiceErrorImpl('Failed to set up Three.js scene config', { 
          cause: error instanceof Error ? error : new Error(String(error)) 
        }));
      }
    });
  }

  public async initializeARSession(
    _domElement: HTMLDivElement, 
    material: Material, 
    options: MaterialVisualizationOptions
  ): Promise<void> {
    try {
      const textures = await this.extractTexturesFromImages(material, options);
      const envMap = await this.getEnvironmentMap(material, options);
      await this.setupARScene(material, textures, {
        ...options,
        lighting: {
          ...options.lighting,
          environmentMap: envMap.url
        }
      });
    } catch (error) {
      throw new ServiceErrorImpl('Failed to initialize AR session', { 
        cause: error instanceof Error ? error : new Error(String(error)) 
      });
    }
  }
  
  public clearEnvironmentMapCache(): void {
    this.envMapCache.clear();
    this.lightingService.clearCache();
  }
}
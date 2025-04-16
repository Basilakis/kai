/**
 * TileDataSynthesizer - Generates synthetic tile pattern data for training and validation
 * 
 * Refactored to use ExternalLibraryIntegration for image processing tasks.
 * Fixed linting errors related to missing interface properties and type mismatches.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
// Import types and manager from the integration layer
import { 
    ExternalLibraryManager, 
    libraryManager, 
    TF_Tensor,              // Use TF_Tensor type from integration
    TF_LayersModel          // Use TF_LayersModel type from integration
} from './external-library-integration'; 

// --- Interfaces ---

// Ensure all used properties are defined
export interface DegradationParams {
  compression: number;       
  noise: number;             
  blur: number;              
  downscale: number;         
  colorShift: number;        
  artifacts: 'none' | 'jpeg' | 'scan' | 'mixed'; 
}

export interface GeometricTransformParams {
  rotation: number;          
  perspective: number;       
  scale: number;             
  flip: 'none' | 'horizontal' | 'vertical' | 'both';
}

export interface PatternVariationParams {
  colorVariation: number;    
  patternStretch: number;    
  patternOffset: number;     
  lighting: 'uniform' | 'directional' | 'gradient' | 'shadow';
  lightingIntensity: number; 
}

export interface SynthesisConfig {
  outputDir: string;         
  samplesPerPattern: number; 
  batchSize: number;         
  degradationSeries: boolean; 
  includeLabels: boolean;    
  fileFormat: 'png' | 'jpg'; 
  resolution: number;        
}

// Interface for generateDataset parameters
interface GenerateDatasetParams {
    templateDir: string;
    degradationParams: DegradationParams;
    geometricParams: GeometricTransformParams;
    variationParams: PatternVariationParams;
    metadataFile?: string;
    generateNew?: number;
    baseStyles?: string[];
}

// Interface for generateSyntheticTileDataset options
interface GenerateSyntheticOptions {
  templateDir: string;
  outputDir: string;
  samplesPerPattern: number;
  includeNewPatterns?: number;
  degradationSeriesEnabled?: boolean;
}

// Interface for the return type of generateDataset
interface GenerateDatasetResult {
    totalGenerated: number;
    patternCount: number;
    syntheticCount: number;
    outputDirectory: string;
}

// --- Mock Interfaces (Keep for internal structure, actual calls go via manager) ---
// Mock canvas interfaces (less relevant now, but keep for loadImage simulation)
interface Image {
  width: number;
  height: number;
}
// Mock canvas implementation (only loadImage simulation is used)
const loadImage = async (src: string | Buffer): Promise<Image> => {
  console.log('[Simulated LoadImage] Getting image dimensions...');
  return { width: 512, height: 512 };
};

/**
 * TileDataSynthesizer generates synthetic training data for tile pattern recognition
 */
export class TileDataSynthesizer {
  private config: SynthesisConfig;
  private model: TF_LayersModel | null = null; // Use TF_LayersModel type
  private patternTemplates: Map<string, { image: Buffer, metadata: any }> = new Map();
  private libraryManager: ExternalLibraryManager; 

  constructor(config: SynthesisConfig) {
    this.config = config;
    this.libraryManager = libraryManager; 
  }

  public async initialize(): Promise<void> {
    await fs.mkdir(this.config.outputDir, { recursive: true });
    await this.libraryManager.initializeAll(); 

    try {
      this.model = await this.libraryManager.getTensorFlow().loadModel('tile_pattern_generator');
      console.log('Pattern generation model loaded successfully via Library Manager');
    } catch (error) {
      console.warn('Failed to load pattern generation model via Library Manager:', error);
      console.log('Falling back to pattern transformation mode only');
    }
  }

  public async loadPatternTemplates(templateDir: string, metadataFile?: string): Promise<void> {
    const files = await fs.readdir(templateDir);
    const imageFiles = files.filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
    
    let metadata: Record<string, any> = {};
    if (metadataFile) {
      try {
        const metadataContent = await fs.readFile(metadataFile, 'utf-8');
        if (typeof metadataContent === 'string') {
          metadata = JSON.parse(metadataContent);
        }
      } catch (error) {
        console.warn('Failed to load metadata file:', error);
      }
    }
    
    for (const file of imageFiles) {
      const filePath = path.join(templateDir, file);
      const patternId = path.parse(file).name;
      
      try {
        const imageBuffer = await fs.readFile(filePath);
        this.patternTemplates.set(patternId, {
          image: Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer),
          metadata: metadata[patternId] || { patternId }
        });
      } catch (error) {
        console.warn(`Failed to load pattern template ${file}:`, error);
      }
    }
    
    console.log(`Loaded ${this.patternTemplates.size} pattern templates`);
  }

  public async generatePatternVariations(
    patternId: string,
    degradationParams: DegradationParams,
    geometricParams: GeometricTransformParams,
    variationParams: PatternVariationParams
  ): Promise<string[]> {
    const patternData = this.patternTemplates.get(patternId);
    if (!patternData) throw new Error(`Pattern ${patternId} not found in templates`);

    const outputFiles: string[] = [];
    for (let i = 0; i < this.config.samplesPerPattern; i++) {
      const varDegradation = this.randomizeParams(degradationParams);
      const varGeometric = this.randomizeParams(geometricParams);
      const varPattern = this.randomizeParams(variationParams);

      try {
        const processedImageBuffer = await this.applyTransformations(
          patternData.image, 
          varDegradation,
          varGeometric,
          varPattern
        );

        const outputPath = path.join(this.config.outputDir, `${patternId}_var${i + 1}.${this.config.fileFormat}`);
        await fs.writeFile(outputPath, processedImageBuffer);
        outputFiles.push(outputPath);

        if (this.config.includeLabels) {
          const labelPath = path.join(this.config.outputDir, `${patternId}_var${i+1}.json`);
          const labelData = { 
            patternId,
            originalMetadata: patternData.metadata,
            transformations: {
              degradation: varDegradation,
              geometric: varGeometric,
              pattern: varPattern
            }
           };
          await fs.writeFile(labelPath, JSON.stringify(labelData, null, 2));
        }
      } catch (error) {
        console.error(`Failed to generate variation ${i + 1} for pattern ${patternId}:`, error);
      }
    }
    return outputFiles;
  }

  public async generateDegradationSeries(
    patternId: string,
    steps: number = 5,
    baseParams: { degradation: DegradationParams, geometric: GeometricTransformParams, pattern: PatternVariationParams }
  ): Promise<string[]> {
      const patternData = this.patternTemplates.get(patternId);
      if (!patternData) throw new Error(`Pattern ${patternId} not found in templates`);
  
      const outputFiles: string[] = [];
      for (let step = 0; step < steps; step++) {
          const degradationLevel = step / (steps - 1);
          const stepDegradation: DegradationParams = {
              compression: Math.max(5, 100 - degradationLevel * 95),
              noise: baseParams.degradation.noise * degradationLevel,
              blur: baseParams.degradation.blur * degradationLevel,
              downscale: 1 + (baseParams.degradation.downscale - 1) * degradationLevel,
              colorShift: baseParams.degradation.colorShift * degradationLevel,
              artifacts: degradationLevel < 0.2 ? 'none' : 
                        degradationLevel < 0.5 ? 'jpeg' : 
                        degradationLevel < 0.8 ? 'scan' : 'mixed'
          };
  
          try {
              const processedImageBuffer = await this.applyTransformations(
                  patternData.image, 
                  stepDegradation,
                  baseParams.geometric,
                  baseParams.pattern
              );
  
              const outputPath = path.join(this.config.outputDir, `${patternId}_degradation${step + 1}.${this.config.fileFormat}`);
              await fs.writeFile(outputPath, processedImageBuffer);
              outputFiles.push(outputPath);
  
              if (this.config.includeLabels) {
                  const labelPath = path.join(this.config.outputDir, `${patternId}_degradation${step+1}.json`);
                  const labelData = { 
                    patternId,
                    originalMetadata: patternData.metadata,
                    degradationLevel,
                    transformations: {
                      degradation: stepDegradation,
                      geometric: baseParams.geometric,
                      pattern: baseParams.pattern
                    }
                   };
                  await fs.writeFile(labelPath, JSON.stringify(labelData, null, 2));
              }
          } catch (error) {
              console.error(`Failed to generate degradation step ${step + 1} for pattern ${patternId}:`, error);
          }
      }
      return outputFiles;
  }

  public async synthesizeNewPatterns(
    count: number,
    baseStyle: string,
    degradationParams: DegradationParams
  ): Promise<string[]> {
    if (!this.model) throw new Error('Pattern generation model not loaded');

    const outputFiles: string[] = [];
    const tf = this.libraryManager.getTensorFlow(); 

    for (let i = 0; i < count; i++) {
      let noise: TF_Tensor | null = null; // Use TF_Tensor
      let styleEncoding: TF_Tensor | null = null; // Use TF_Tensor
      let generated: TF_Tensor | null = null; // Use TF_Tensor
      try {
        noise = tf.createTensor(Array.from({ length: 512 }, Math.random), [1, 512]);
        styleEncoding = this.encodeStyle(baseStyle); 
        const input = { noise, style: styleEncoding };

        // Ensure this.model is TF_LayersModel before calling runInference
        if (this.model) {
            generated = await tf.runInference(this.model, input); 
        } else {
            throw new Error("Model not loaded correctly");
        }

        // Ensure generated is TF_Tensor before encoding
        if (!generated) {
            throw new Error("Pattern generation failed");
        }
        let imageBuffer = await tf.encodePng(generated); 
        
        const finalBuffer = degradationParams.compression < 100 || degradationParams.noise > 0 || degradationParams.blur > 0
          ? await this.applyDegradation(imageBuffer, degradationParams)
          : imageBuffer;

        const outputPath = path.join(this.config.outputDir, `synthetic_${baseStyle}_${i + 1}.${this.config.fileFormat}`);
        await fs.writeFile(outputPath, finalBuffer);
        outputFiles.push(outputPath);

        if (this.config.includeLabels) {
           const labelPath = path.join(this.config.outputDir, `synthetic_${baseStyle}_${i+1}.json`);
           const labelData = { 
                synthetic: true,
                baseStyle,
                degradationParams,
                generationParams: {
                  timestamp: new Date().toISOString(),
                  modelVersion: 'generator-v1' // Example version
                }
            };
           await fs.writeFile(labelPath, JSON.stringify(labelData, null, 2));
        }
      } catch (error) {
        console.error(`Failed to generate synthetic pattern ${i + 1}:`, error);
      } finally {
        noise?.dispose();
        styleEncoding?.dispose();
        generated?.dispose();
      }
    }
    return outputFiles;
  }

  // Use the specific interface for params
  public async generateDataset(params: GenerateDatasetParams): Promise<GenerateDatasetResult> { 
      await this.initialize();
      await this.loadPatternTemplates(params.templateDir, params.metadataFile);
      
      let totalGenerated = 0;
      let syntheticCount = 0;
      
      for (const patternId of this.patternTemplates.keys()) {
        const variations = await this.generatePatternVariations(
          patternId,
          params.degradationParams,
          params.geometricParams,
          params.variationParams
        );
        totalGenerated += variations.length;
        
        if (this.config.degradationSeries) {
          const seriesFiles = await this.generateDegradationSeries(
            patternId, 5, 
            { degradation: params.degradationParams, geometric: params.geometricParams, pattern: params.variationParams }
          );
          totalGenerated += seriesFiles.length;
        }
      }
      
      if (params.generateNew && params.generateNew > 0 && this.model) {
        const baseStyles = params.baseStyles || ['marble', 'ceramic', 'granite', 'mosaic'];
        for (const style of baseStyles) {
          const newPatterns = await this.synthesizeNewPatterns(
            Math.ceil(params.generateNew / baseStyles.length), style, params.degradationParams
          );
          syntheticCount += newPatterns.length;
          totalGenerated += newPatterns.length;
        }
      }
      
      return {
        totalGenerated,
        patternCount: this.patternTemplates.size,
        syntheticCount,
        outputDirectory: this.config.outputDir
      };
  }

  public async exportDatasetManifest(manifestPath: string): Promise<void> {
     const files = await fs.readdir(this.config.outputDir);
    const imageFiles = files.filter(f => f.endsWith(`.${this.config.fileFormat}`));
    
    const manifest: { datasetInfo: any, images: any[] } = { // Add type annotation
        datasetInfo: {
            generatedAt: new Date().toISOString(),
            totalImages: imageFiles.length,
            synthesisConfig: this.config
        },
        images: [] 
    };
    
    for (const file of imageFiles) {
      const imagePath = path.join(this.config.outputDir, file);
      const jsonFile = file.replace(`.${this.config.fileFormat}`, '.json');
      const jsonPath = path.join(this.config.outputDir, jsonFile);
      
      let metadata = {};
      try {
        if (await fileExists(jsonPath)) { // Use helper function
          const content = await fs.readFile(jsonPath, 'utf-8');
          if (typeof content === 'string') {
            metadata = JSON.parse(content);
          }
        }
      } catch (error) {
        console.warn(`Failed to read metadata for ${file}:`, error);
      }
      
      manifest.images.push({ 
        filename: file,
        path: imagePath,
        metadata 
      });
    }
    
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`Dataset manifest exported to ${manifestPath}`);
  }

  // ---- Private Refactored Helper Methods ----

  private async applyTransformations(
    imageBuffer: Buffer, 
    degradation: DegradationParams,
    geometric: GeometricTransformParams,
    pattern: PatternVariationParams
  ): Promise<Buffer> {
    let currentBuffer = imageBuffer;

    currentBuffer = await this.applyGeometricTransformations(currentBuffer, geometric);
    currentBuffer = await this.applyPatternVariations(currentBuffer, pattern);

    if (degradation.compression < 100 || degradation.noise > 0 || degradation.blur > 0 || degradation.downscale > 1 || degradation.colorShift > 0 || degradation.artifacts !== 'none') {
      currentBuffer = await this.applyDegradation(currentBuffer, degradation);
    }

    // Final encoding simulation might be needed here if format/quality needs strict control
    
    return currentBuffer;
  }

  private async applyGeometricTransformations(
    imageBuffer: Buffer,
    params: GeometricTransformParams
  ): Promise<Buffer> {
    console.log('[Synthesizer] Applying Geometric Transformations (Simulated OpenCV)...');
    const opencv = this.libraryManager.getOpenCV();
    let currentBuffer = imageBuffer;
    
    if (params.rotation !== 0 || params.scale !== 1 || params.flip !== 'none') {
        console.log(` -> Simulating Affine Transform (Rot: ${params.rotation}, Scale: ${params.scale}, Flip: ${params.flip})`);
        // Simulate: currentBuffer = await opencv.warpAffine(currentBuffer, ...); 
    }
    if (params.perspective > 0) {
        console.log(` -> Simulating Perspective Transform (Strength: ${params.perspective})`);
        // Simulate: currentBuffer = await opencv.warpPerspective(currentBuffer, ...);
    }
    return currentBuffer; 
  }

  private async applyPatternVariations(
    imageBuffer: Buffer,
    params: PatternVariationParams
  ): Promise<Buffer> {
    console.log('[Synthesizer] Applying Pattern Variations (Simulated OpenCV)...');
    const opencv = this.libraryManager.getOpenCV();
    let currentBuffer = imageBuffer;

    if (params.colorVariation > 0) {
      const rShift = (Math.random() * 2 - 1) * params.colorVariation * 30;
      const gShift = (Math.random() * 2 - 1) * params.colorVariation * 30;
      const bShift = (Math.random() * 2 - 1) * params.colorVariation * 30;
      console.log(` -> Simulating Color Variation (R:${rShift.toFixed(1)}, G:${gShift.toFixed(1)}, B:${bShift.toFixed(1)})`);
      // Simulate: currentBuffer = await opencv.adjustColor(currentBuffer, { rShift, gShift, bShift }); 
    }

    if (params.lightingIntensity > 0) {
      console.log(` -> Simulating Lighting Effect (${params.lighting}, Intensity: ${params.lightingIntensity})`);
      // Simulate: currentBuffer = await opencv.applyLighting(currentBuffer, params.lighting, params.lightingIntensity); 
    }
    
    if (params.patternStretch !== 1 || params.patternOffset > 0) {
        console.log(` -> Simulating Pattern Stretch/Offset (Stretch: ${params.patternStretch}, Offset: ${params.patternOffset}) - Complex`);
        // Simulate warp or remap
    }
    return currentBuffer;
  }

  private async applyDegradation(
    imageBuffer: Buffer,
    params: DegradationParams
  ): Promise<Buffer> {
    console.log('[Synthesizer] Applying Degradation (Simulated OpenCV/TF)...');
    const opencv = this.libraryManager.getOpenCV();
    const imageProc = this.libraryManager.getImageProcessing();
    let currentBuffer = imageBuffer;
    const initialSize = await loadImage(imageBuffer); 

    if (params.downscale > 1) {
        console.log(` -> Simulating Downscale/Upscale (Factor: ${params.downscale})`);
        // Simulate: currentBuffer = await opencv.resize(...); currentBuffer = await opencv.resize(...);
    }
    if (params.blur > 0) {
      console.log(` -> Simulating Blur (Sigma: ${params.blur})`);
      // Simulate: currentBuffer = await opencv.applyFilter(currentBuffer, 'gaussian', { sigma: params.blur * 2 }); 
    }
    if (params.noise > 0) {
      console.log(` -> Simulating Noise (Amount: ${params.noise})`);
      // Simulate: currentBuffer = await opencv.addNoise(currentBuffer, 'gaussian', { amount: params.noise * 50 });
    }
    if (params.artifacts === 'scan' || params.artifacts === 'mixed') {
      console.log(` -> Simulating Scan Artifacts`);
      // Simulate: currentBuffer = await opencv.applyScanArtifacts(currentBuffer, ...);
    }
    if (params.colorShift > 0) {
        const rShift = Math.random() * params.colorShift * 30 - 15;
        const gShift = Math.random() * params.colorShift * 30 - 15;
        const bShift = Math.random() * params.colorShift * 30 - 15;
        console.log(` -> Simulating Color Shift (R:${rShift.toFixed(1)}, G:${gShift.toFixed(1)}, B:${bShift.toFixed(1)})`);
        // Simulate: currentBuffer = await opencv.adjustColor(currentBuffer, { rShift, gShift, bShift });
    }
    if (params.artifacts === 'jpeg' || params.artifacts === 'mixed') {
      const jpegQuality = Math.max(0.1, Math.min(1.0, params.compression / 100)); 
      console.log(` -> Simulating JPEG Compression (Quality: ${jpegQuality.toFixed(2)})`);
      // Simulate: const tempMat = await opencv.imdecode(currentBuffer);
      // Simulate: currentBuffer = await opencv.imencode('.jpg', tempMat, { quality: jpegQuality });
      // Simulate re-encoding to PNG if needed
    } else if (this.config.fileFormat === 'png') {
        // Simulate ensuring PNG format
        // const tempMat = await opencv.imdecode(currentBuffer);
        // currentBuffer = await opencv.imencode('.png', tempMat);
    }
    return currentBuffer;
  }

  private randomizeParams<T>(params: T): T {
    const result: any = { ...params };
    for (const key in result) {
      if (typeof result[key] === 'number') {
        const variation = (Math.random() * 0.4 - 0.2);
        result[key] = result[key] * (1 + variation);
        if (key === 'compression') result[key] = Math.max(5, Math.min(100, result[key]));
        else if (key.includes('scale')) result[key] = Math.max(0.5, Math.min(2.0, result[key]));
        else if (key.includes('noise') || key.includes('blur') || key.includes('colorShift') || key.includes('Intensity')) result[key] = Math.max(0, Math.min(1, result[key]));
      }
    }
    return result;
  }

  // Use TF_Tensor type from integration
  private encodeStyle(styleName: string): TF_Tensor { 
    const tf = this.libraryManager.getTensorFlow();
    const styles = ['marble', 'ceramic', 'granite', 'mosaic', 'porcelain', 'slate', 'travertine', 'limestone'];
    const styleIndex = styles.indexOf(styleName.toLowerCase());
    const oneHot = Array(styles.length).fill(0);
    oneHot[styleIndex >= 0 ? styleIndex : 0] = 1;
    return tf.createTensor([oneHot]); 
  }
}

// Helper function - Add return statement
async function fileExists(filePath: string): Promise<boolean> { 
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Example usage function - Add return type and ensure it returns the result
export async function generateSyntheticTileDataset(options: GenerateSyntheticOptions): Promise<GenerateDatasetResult> { 
  const synthesizer = new TileDataSynthesizer({
    outputDir: options.outputDir,
    samplesPerPattern: options.samplesPerPattern,
    batchSize: 4, // Example batch size
    degradationSeries: options.degradationSeriesEnabled || false,
    includeLabels: true, // Assuming labels are always included for example
    fileFormat: 'png', // Example format
    resolution: 512 // Example resolution
  });
  
  // Define default params if needed, or ensure they are passed in options
  const defaultDegradation: DegradationParams = { compression: 85, noise: 0.1, blur: 0.2, downscale: 1, colorShift: 0.1, artifacts: 'mixed' };
  const defaultGeometric: GeometricTransformParams = { rotation: 0, perspective: 0.1, scale: 1.0, flip: 'none' };
  const defaultVariation: PatternVariationParams = { colorVariation: 0.2, patternStretch: 1.0, patternOffset: 0, lighting: 'directional', lightingIntensity: 0.3 };

  const result = await synthesizer.generateDataset({
    templateDir: options.templateDir,
    // Use default params or require them in options
    degradationParams: defaultDegradation, 
    geometricParams: defaultGeometric,
    variationParams: defaultVariation,
    generateNew: options.includeNewPatterns || 0,
    baseStyles: ['marble', 'ceramic'] // Example styles
  });
  
  await synthesizer.exportDatasetManifest(path.join(options.outputDir, 'dataset_manifest.json'));
  
  // Ensure the function returns the result
  return result; 
}
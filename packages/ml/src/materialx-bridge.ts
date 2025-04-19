import { spawn } from 'child_process';
import path from 'path';
import { mkdir, writeFile, rmdir } from 'fs/promises';
// Import THREE types through a type reference - avoids direct dependency
type Material = any;
type ShaderMaterial = any;
type Color = any;
type Vector2 = any;
type TextureLoader = any;
type Texture = any;

// Reference to adapter without direct import
const GaussianSplattingMaterialAdapter = {
  adaptMaterial: (material: any, options: any) => {
    // Implementation will be accessed through the client at runtime
    return {} as any;
  }
};

interface MaterialXDefinition {
  baseColor?: number[];
  metalness?: number;
  roughness?: number;
  emissive?: number[];
  normalScale?: number;
  opacity?: number;
  diffuseMap?: string;
  normalMap?: string;
  roughnessMap?: string;
  metalnessMap?: string;
  emissiveMap?: string;
  alphaMap?: string;
  procedural?: {
    type: string;
    parameters: Record<string, unknown>;
  };
}

interface MaterialXOutput {
  materialDefinition: MaterialXDefinition;
  threejsMaterial?: Material;
  gaussianMaterial?: ShaderMaterial;
}

/**
 * Bridge for MaterialX processing and conversion
 * Provides enhanced material generation with PBR properties
 * and adaptation for different rendering techniques including Gaussian Splatting
 */
export class MaterialXBridge {
  private pythonPath: string;
  private scriptPath: string;
  private pythonScriptPath: string;
  private workingDir: string;

  constructor() {
    this.pythonPath = process.env.PYTHON_PATH || 'python';
    this.scriptPath = path.join(process.cwd(), 'packages/ml/python/enhanced_material_processor.py');
    this.pythonScriptPath = path.resolve(__dirname, '../python/enhanced_material_processor.py');
    this.workingDir = process.cwd();
  }

  /**
   * Generate a material using the enhanced MaterialX system
   * Includes procedural generation capabilities and texture upscaling
   */
  async generateMaterial(
    type: string,
    parameters: Record<string, unknown>,
    options: { 
      outputFormats?: string[];
      resolution?: number;
      upscale?: boolean;
      gaussianCompatible?: boolean;
    } = {}
  ): Promise<MaterialXOutput> {
    const tempDir = path.join(process.cwd(), 'temp', `material_${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    const configPath = path.join(tempDir, 'config.json');
    const config = {
      type,
      parameters,
      outputFormats: options.outputFormats || ['threejs', 'gltf'],
      resolution: options.resolution || 1024,
      upscale: options.upscale !== undefined ? options.upscale : false,
      outputDir: tempDir
    };

    await writeFile(configPath, JSON.stringify(config));

    return new Promise((resolve, reject) => {
      const process = spawn(this.pythonPath, [
        this.scriptPath,
        '--config', configPath,
        '--mode', 'generate'
      ]);

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data: any) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data: any) => {
        stderr += data.toString();
      });

      process.on('close', async (code: any) => {
        if (code !== 0) {
          reject(new Error(`Material generation failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          const resultPath = path.join(tempDir, 'result.json');
          const resultData = await (await import('fs')).promises.readFile(resultPath, 'utf-8');
          const result = JSON.parse(resultData.toString());

          const output: MaterialXOutput = {
            materialDefinition: result.materialDefinition
          };

          // Create Three.js material if requested
          if (result.threejsDefinition) {
            output.threejsMaterial = this.createThreejsMaterial(result.threejsDefinition);
          }

          // Create Gaussian-compatible shader material if requested
          if (options.gaussianCompatible && result.materialDefinition) {
            output.gaussianMaterial = this.createGaussianMaterial(result.materialDefinition);
          }

          // Clean up temp directory
          await rmdir(tempDir, { recursive: true });

          resolve(output);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Convert a MaterialX definition to a Three.js compatible material
   */
  createThreejsMaterial(definition: any): Material {
    // This will be implemented at runtime using Three.js
    // Return empty placeholder for TypeScript 
    return {} as Material;
  }

  /**
   * Convert a MaterialX definition to a Gaussian Splatting compatible shader material
   */
  createGaussianMaterial(definition: MaterialXDefinition): ShaderMaterial {
    // Create a basic MeshStandardMaterial to adapt
    const standardMaterial = this.createThreejsMaterial(definition);
    
    // Adapt the standard material to Gaussian Splatting
    return GaussianSplattingMaterialAdapter.adaptMaterial(standardMaterial, {
      // Additional Gaussian-specific options
      pointScale: 1.0,
      pointSizeMin: 1.0,
      pointSizeMax: 20.0
    });
  }

  /**
   * Generate a procedural material based on object type and style
   */
  async generateProceduralMaterial(
    objectType: string,
    style: string,
    options: {
      complexity?: 'low' | 'medium' | 'high';
      resolution?: number;
      upscale?: boolean;
      gaussianCompatible?: boolean;
    } = {}
  ): Promise<MaterialXOutput> {
    return this.generateMaterial('procedural', {
      objectType,
      style,
      complexity: options.complexity || 'medium'
    }, {
      resolution: options.resolution,
      upscale: options.upscale,
      gaussianCompatible: options.gaussianCompatible
    });
  }

  /**
   * Upscale textures to higher resolution using super-resolution
   */
  async upscaleTextures(
    materialDefinition: MaterialXDefinition,
    targetResolution: number,
    options: {
      method?: 'esrgan' | 'swinir' | 'ai';
      quality?: 'fast' | 'balanced' | 'high';
    } = {}
  ): Promise<MaterialXDefinition> {
    const tempDir = path.join(process.cwd(), 'temp', `upscale_${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    const configPath = path.join(tempDir, 'config.json');
    const config = {
      materialDefinition,
      targetResolution,
      method: options.method || 'ai',
      quality: options.quality || 'balanced',
      outputDir: tempDir
    };

    await writeFile(configPath, JSON.stringify(config));

    return new Promise((resolve, reject) => {
      const process = spawn(this.pythonPath, [
        this.scriptPath,
        '--config', configPath,
        '--mode', 'upscale'
      ]);

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data: any) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data: any) => {
        stderr += data.toString();
      });

      process.on('close', async (code: any) => {
        if (code !== 0) {
          reject(new Error(`Texture upscaling failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          const resultPath = path.join(tempDir, 'result.json');
          const resultData = await (await import('fs')).promises.readFile(resultPath, 'utf-8');
          const result = JSON.parse(resultData.toString());

          // Clean up temp directory
          await rmdir(tempDir, { recursive: true });

          resolve(result.materialDefinition);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
  
  /**
   * Create a downscaled version of a material for different LOD levels
   */
  async createLODVariant(
    materialDefinition: MaterialXDefinition,
    level: number,
    options: {
      textureScale?: number;
      simplifyProcedural?: boolean;
    } = {}
  ): Promise<MaterialXDefinition> {
    const tempDir = path.join(process.cwd(), 'temp', `lod_${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    const configPath = path.join(tempDir, 'config.json');
    const config = {
      materialDefinition,
      level,
      textureScale: options.textureScale || 0.5 ** level,
      simplifyProcedural: options.simplifyProcedural !== undefined ? options.simplifyProcedural : true,
      outputDir: tempDir
    };

    await writeFile(configPath, JSON.stringify(config));

    return new Promise((resolve, reject) => {
      const process = spawn(this.pythonPath, [
        this.scriptPath,
        '--config', configPath,
        '--mode', 'lod'
      ]);

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data: any) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data: any) => {
        stderr += data.toString();
      });

      process.on('close', async (code: any) => {
        if (code !== 0) {
          reject(new Error(`LOD generation failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          const resultPath = path.join(tempDir, 'result.json');
          const resultData = await (await import('fs')).promises.readFile(resultPath, 'utf-8');
          const result = JSON.parse(resultData.toString());

          // Clean up temp directory
          await rmdir(tempDir, { recursive: true });

          resolve(result.materialDefinition);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Process SVBRDF textures to MaterialX format
   * @param texturePaths Paths to SVBRDF textures
   * @param outputDir Directory to save output files
   * @param materialType Type of material to generate
   * @returns Promise with MaterialX document
   */
  async processToMaterialX(
    texturePaths: {
      albedo: string;
      normal: string;
      roughness: string;
      metallic?: string;
      displacement?: string;
    },
    outputDir: string,
    materialType: string = 'standard'
  ): Promise<any> {
    const tempDir = path.join(this.workingDir, 'temp_materials', Date.now().toString());
    
    try {
      // Create temp directory
      await mkdir(tempDir, { recursive: true });
      
      // Create config file
      const configPath = path.join(tempDir, 'config.json');
      const config = {
        operation: 'process_svbrdf_to_materialx',
        texturePaths,
        outputDir,
        materialType
      };
      
      await writeFile(configPath, JSON.stringify(config));
      
      // Execute Python script
      const result = await this.executePythonScript(configPath);
      return JSON.parse(result);
    } finally {
      // Cleanup
      try {
        await rmdir(tempDir, { recursive: true });
      } catch (error) {
        console.error('Error cleaning up temp directory:', error);
      }
    }
  }

  /**
   * Execute Python script with configuration
   * @param configPath Path to configuration file
   * @returns Promise with script output
   */
  private executePythonScript(configPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Execute Python script as a child process
      const pythonProcess = spawn('python', [
        this.pythonScriptPath,
        '--config',
        configPath
      ]);
      
      let outputData = '';
      let errorData = '';
      
      // Collect output
      pythonProcess.stdout.on('data', (data: Buffer) => {
        outputData += data.toString();
      });
      
      // Collect errors
      pythonProcess.stderr.on('data', (data: Buffer) => {
        errorData += data.toString();
      });
      
      // Handle process completion
      pythonProcess.on('close', (code: number) => {
        if (code !== 0) {
          reject(new Error(`Python script execution failed with code ${code}: ${errorData}`));
        } else {
          resolve(outputData);
        }
      });
    });
  }
}
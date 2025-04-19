import { spawn } from 'child_process';
import path from 'path';
import { mkdir, writeFile, rmdir } from 'fs/promises';
import { existsSync } from 'fs';
import { env } from '../../shared/src/utils/environment';

export interface ImprovedTextTo3DConfig {
  preferredModel?: 'auto' | 'triposr' | 'wonder3d' | 'instant3d';
  outputDir?: string;
  meshResolution?: number;
  textureResolution?: number;
  usePbrMaterials?: boolean;
  physicsEnabled?: boolean;
  exportFormats?: string[];
  device?: string;
}

export interface GenerationResult {
  status: 'success' | 'error';
  message: string;
  model?: any;
  modelUsed?: string;
  physicsReport?: {
    valid: boolean;
    isWatertight?: boolean;
    isConvex?: boolean;
    hasVolume?: boolean;
    hasSelfIntersections?: boolean;
    volume?: number;
    centerMass?: number[];
    repaired?: boolean;
    message?: string;
  };
  exportPaths?: Record<string, string>;
  error?: string;
}

export class ImprovedTextTo3DBridge {
  private pythonPath: string;
  private scriptPath: string;

  constructor() {
    this.pythonPath = env.ml.pythonPath;
    this.scriptPath = path.join(__dirname, '../python/improved_text_to_3d.py');
  }

  /**
   * Initialize the improved text to 3D pipeline
   */
  async initialize(config?: ImprovedTextTo3DConfig): Promise<void> {
    try {
      // Check if the script exists
      if (!existsSync(this.scriptPath)) {
        throw new Error(`Script not found: ${this.scriptPath}`);
      }

      const pythonProcess = spawn(this.pythonPath, [
        this.scriptPath,
        '--initialize',
        JSON.stringify(config || {})
      ]);

      return new Promise<void>((resolve, reject) => {
        let errorData = '';

        pythonProcess.stderr.on('data', (data: Buffer) => {
          errorData += data.toString();
        });

        pythonProcess.on('close', (code: number) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Pipeline initialization failed with code ${code}: ${errorData}`));
          }
        });

        pythonProcess.on('error', (err: Error) => {
          reject(new Error(`Failed to start pipeline: ${err.message}`));
        });
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to initialize improved text-to-3D pipeline: ${error.message}`);
      }
      throw new Error('Failed to initialize improved text-to-3D pipeline: Unknown error');
    }
  }

  /**
   * Generate a 3D model from text description
   */
  async generateFromText(
    prompt: string,
    config?: ImprovedTextTo3DConfig
  ): Promise<GenerationResult> {
    try {
      // Create temporary output directory if not specified
      const outputDir = config?.outputDir || path.join(__dirname, '../temp', `text3d_${Date.now()}`);
      await mkdir(outputDir, { recursive: true });

      // Prepare command arguments
      const args = [
        this.scriptPath,
        '--generate-from-text',
        '--prompt', prompt,
        '--output-dir', outputDir
      ];

      // Add configuration options if provided
      if (config) {
        if (config.preferredModel) {
          args.push('--preferred-model', config.preferredModel);
        }
        if (config.meshResolution) {
          args.push('--mesh-resolution', config.meshResolution.toString());
        }
        if (config.textureResolution) {
          args.push('--texture-resolution', config.textureResolution.toString());
        }
        if (config.usePbrMaterials !== undefined) {
          args.push('--use-pbr', config.usePbrMaterials ? 'true' : 'false');
        }
        if (config.physicsEnabled !== undefined) {
          args.push('--physics-enabled', config.physicsEnabled ? 'true' : 'false');
        }
        if (config.exportFormats) {
          args.push('--export-formats', config.exportFormats.join(','));
        }
        if (config.device) {
          args.push('--device', config.device);
        }
      }

      // Run the Python process
      const result = await this.runPythonProcess(args);
      
      return result as GenerationResult;
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate a 3D model from an image
   */
  async generateFromImage(
    imagePath: string,
    prompt?: string,
    config?: ImprovedTextTo3DConfig
  ): Promise<GenerationResult> {
    try {
      // Create temporary output directory if not specified
      const outputDir = config?.outputDir || path.join(__dirname, '../temp', `img3d_${Date.now()}`);
      await mkdir(outputDir, { recursive: true });

      // Prepare command arguments
      const args = [
        this.scriptPath,
        '--generate-from-image',
        '--image-path', imagePath,
        '--output-dir', outputDir
      ];

      // Add prompt if provided
      if (prompt) {
        args.push('--prompt', prompt);
      }

      // Add configuration options if provided
      if (config) {
        if (config.preferredModel) {
          args.push('--preferred-model', config.preferredModel);
        }
        if (config.meshResolution) {
          args.push('--mesh-resolution', config.meshResolution.toString());
        }
        if (config.textureResolution) {
          args.push('--texture-resolution', config.textureResolution.toString());
        }
        if (config.usePbrMaterials !== undefined) {
          args.push('--use-pbr', config.usePbrMaterials ? 'true' : 'false');
        }
        if (config.physicsEnabled !== undefined) {
          args.push('--physics-enabled', config.physicsEnabled ? 'true' : 'false');
        }
        if (config.exportFormats) {
          args.push('--export-formats', config.exportFormats.join(','));
        }
        if (config.device) {
          args.push('--device', config.device);
        }
      }

      // Run the Python process
      const result = await this.runPythonProcess(args);
      
      return result as GenerationResult;
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get available models and their status
   */
  async getAvailableModels(): Promise<{
    triposr: boolean;
    wonder3d: boolean;
    instant3d: boolean;
  }> {
    try {
      const args = [
        this.scriptPath,
        '--get-available-models'
      ];

      const result = await this.runPythonProcess(args);
      
      return result as { triposr: boolean; wonder3d: boolean; instant3d: boolean; };
    } catch (error) {
      return {
        triposr: false,
        wonder3d: false,
        instant3d: false
      };
    }
  }

  /**
   * Export an existing 3D model to different formats
   */
  async exportModel(
    modelPath: string,
    exportFormats: string[],
    outputDir?: string
  ): Promise<{ status: string; exportPaths: Record<string, string>; }> {
    try {
      // Create temporary output directory if not specified
      const tempOutputDir = outputDir || path.join(__dirname, '../temp', `export_${Date.now()}`);
      await mkdir(tempOutputDir, { recursive: true });

      // Prepare command arguments
      const args = [
        this.scriptPath,
        '--export-model',
        '--model-path', modelPath,
        '--export-formats', exportFormats.join(','),
        '--output-dir', tempOutputDir
      ];

      // Run the Python process
      const result = await this.runPythonProcess(args);
      
      return result as { status: string; exportPaths: Record<string, string>; };
    } catch (error) {
      return {
        status: 'error',
        exportPaths: {}
      };
    }
  }

  /**
   * Run a Python process and return the parsed output
   */
  private async runPythonProcess(args: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(this.pythonPath, args);

      let resultData = '';
      let errorData = '';

      // Collect stdout data
      pythonProcess.stdout.on('data', (data: Buffer) => {
        resultData += data.toString();
      });

      // Collect stderr data
      pythonProcess.stderr.on('data', (data: Buffer) => {
        errorData += data.toString();
      });

      // Handle process completion
      pythonProcess.on('close', (code: number) => {
        if (code === 0) {
          try {
            // Try to parse the result data as JSON
            const result = JSON.parse(resultData);
            resolve(result);
          } catch (error) {
            // If parsing fails, return the raw output
            reject(new Error(`Failed to parse process output: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        } else {
          reject(new Error(`Process failed with code ${code}: ${errorData}`));
        }
      });

      // Handle process error
      pythonProcess.on('error', (err: Error) => {
        reject(new Error(`Failed to start process: ${err.message}`));
      });
    });
  }
}
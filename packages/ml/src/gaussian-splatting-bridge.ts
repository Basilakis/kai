import { spawn } from 'child_process';
import path from 'path';
import { mkdir, writeFile, rmdir } from 'fs/promises';
import { env } from '../../shared/src/utils/environment';

export interface GaussianSplattingConfig {
  qualityPreset?: 'low' | 'medium' | 'high' | 'ultra';
  outputDir?: string;
  device?: string;
  exportFormats?: string[];
  optimizeModel?: boolean;
  maxGaussians?: number;
}

export interface GaussianSplattingResult {
  status: 'success' | 'failed';
  outputDirectory?: string;
  gaussianPath?: string;
  meshPath?: string;
  previewPath?: string;
  processingTime?: number;
  metadata?: {
    numGaussians?: number;
    avgDensity?: number;
    numImages?: number;
    qualityPreset?: string;
    compressionRatio?: number;
    optimized?: boolean;
    nerfSource?: string;
  };
  error?: string;
}

export interface NovelViewParams {
  position: [number, number, number];
  rotation: [number, number, number];
  fov?: number;
}

export interface NovelViewResult {
  status: 'success' | 'failed';
  outputDirectory?: string;
  viewPaths?: string[];
  avgRenderTime?: number;
  metadata?: {
    width?: number;
    height?: number;
    numViews?: number;
    gaussianSource?: string;
  };
  error?: string;
}

export interface ExportResult {
  status: 'success' | 'failed';
  outputDirectory?: string;
  exportPaths?: {
    model?: string;
    pointCloud?: string;
    texture?: string;
    shader?: string;
  };
  metadata?: {
    simplified?: boolean;
    maxGaussians?: number;
    gaussianSource?: string;
  };
  error?: string;
}

export class GaussianSplattingBridge {
  private pythonPath: string;
  private scriptPath: string;

  constructor() {
    this.pythonPath = env.ml.pythonPath;
    this.scriptPath = path.join(__dirname, '../python/gaussian_splatting_service.py');
  }

  /**
   * Run health check to verify the service is working
   */
  async healthCheck(): Promise<{status: string, gsplatAvailable: boolean}> {
    try {
      const pythonProcess = spawn(this.pythonPath, [
        this.scriptPath,
        '--action',
        'health'
      ]);

      let outputData = '';
      let errorData = '';

      return new Promise((resolve, reject) => {
        pythonProcess.stdout.on('data', (data: Buffer) => {
          outputData += data.toString();
        });

        pythonProcess.stderr.on('data', (data: Buffer) => {
          errorData += data.toString();
        });

        pythonProcess.on('close', (code: number) => {
          if (code === 0) {
            try {
              const result = JSON.parse(outputData);
              resolve({
                status: result.status,
                gsplatAvailable: result.gsplat_available
              });
            } catch (error) {
              reject(new Error(`Failed to parse health check output: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
          } else {
            reject(new Error(`Health check failed with code ${code}: ${errorData}`));
          }
        });

        pythonProcess.on('error', (err: Error) => {
          reject(new Error(`Failed to start health check: ${err.message}`));
        });
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Health check failed: ${error.message}`);
      }
      throw new Error('Health check failed: Unknown error');
    }
  }

  /**
   * Reconstruct a 3D scene from input images using Gaussian Splatting
   */
  async reconstructFromImages(
    images: Buffer[],
    config?: GaussianSplattingConfig
  ): Promise<GaussianSplattingResult> {
    try {
      // Create temporary directory for processing
      const tempDir = path.join(__dirname, '../temp', `gsplat_${Date.now()}`);
      await mkdir(tempDir, { recursive: true });
      
      // Save images
      const imagePaths: string[] = [];
      const imagePromises = images.map((buffer, index) => {
        const imagePath = path.join(tempDir, `image_${index}.png`);
        imagePaths.push(imagePath);
        return writeFile(imagePath, buffer);
      });
      
      await Promise.all(imagePromises);

      // Set up output directory
      const outputDir = config?.outputDir || path.join(tempDir, 'output');
      await mkdir(outputDir, { recursive: true });

      // Prepare command arguments
      const args = [
        this.scriptPath,
        '--action',
        'reconstruct',
        '--images',
        ...imagePaths,
        '--output',
        outputDir
      ];

      // Add quality preset if specified
      if (config?.qualityPreset) {
        args.push('--quality', config.qualityPreset);
      }

      // Run reconstruction
      const result = await this.runPythonProcess(args);

      // Clean up temporary files but preserve output directory if specified in config
      if (!config?.outputDir) {
        await rmdir(tempDir, { recursive: true });
      }

      return result as GaussianSplattingResult;
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Convert an existing NeRF model to Gaussian representation
   */
  async convertNerfToGaussian(
    nerfModelPath: string,
    config?: GaussianSplattingConfig
  ): Promise<GaussianSplattingResult> {
    try {
      // Set up output directory
      const outputDir = config?.outputDir || path.join(__dirname, '../temp', `gsplat_conversion_${Date.now()}`);
      await mkdir(outputDir, { recursive: true });

      // Prepare command arguments
      const args = [
        this.scriptPath,
        '--action',
        'convert',
        '--nerf',
        nerfModelPath,
        '--output',
        outputDir
      ];

      // Add quality preset if specified
      if (config?.qualityPreset) {
        args.push('--quality', config.qualityPreset);
      }

      // Run conversion
      const result = await this.runPythonProcess(args);

      return result as GaussianSplattingResult;
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Render novel views from a Gaussian Splatting model
   */
  async renderNovelViews(
    gaussianModelPath: string,
    viewParams: NovelViewParams[],
    width: number = 800,
    height: number = 800,
    outputDir?: string
  ): Promise<NovelViewResult> {
    try {
      // Set up output directory
      const tempOutputDir = outputDir || path.join(__dirname, '../temp', `gsplat_views_${Date.now()}`);
      await mkdir(tempOutputDir, { recursive: true });

      // Save view parameters to a temporary file
      const viewParamsPath = path.join(tempOutputDir, 'view_params.json');
      await writeFile(viewParamsPath, JSON.stringify(viewParams));

      // Prepare command arguments
      const args = [
        this.scriptPath,
        '--action',
        'render',
        '--gaussian',
        gaussianModelPath,
        '--views',
        viewParamsPath,
        '--output',
        tempOutputDir,
        '--width',
        width.toString(),
        '--height',
        height.toString()
      ];

      // Run rendering
      const result = await this.runPythonProcess(args);

      return result as NovelViewResult;
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Export Gaussian Splatting model to a Three.js compatible format
   */
  async exportToThreeJs(
    gaussianModelPath: string,
    config?: {
      outputDir?: string;
      simplify?: boolean;
      maxGaussians?: number;
    }
  ): Promise<ExportResult> {
    try {
      // Set up output directory
      const outputDir = config?.outputDir || path.join(__dirname, '../temp', `gsplat_export_${Date.now()}`);
      await mkdir(outputDir, { recursive: true });

      // Prepare command arguments
      const args = [
        this.scriptPath,
        '--action',
        'export',
        '--gaussian',
        gaussianModelPath,
        '--output',
        outputDir
      ];

      // Add simplify flag if specified
      if (config?.simplify !== undefined) {
        args.push('--simplify', config.simplify ? 'true' : 'false');
      }

      // Add max gaussians if specified
      if (config?.maxGaussians !== undefined) {
        args.push('--max-gaussians', config.maxGaussians.toString());
      }

      // Run export
      const result = await this.runPythonProcess(args);

      return result as ExportResult;
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Run Python process and return parsed JSON output
   */
  private async runPythonProcess(args: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(this.pythonPath, args);

      let outputData = '';
      let errorData = '';

      pythonProcess.stdout.on('data', (data: Buffer) => {
        outputData += data.toString();
      });

      pythonProcess.stderr.on('data', (data: Buffer) => {
        errorData += data.toString();
      });

      pythonProcess.on('close', (code: number) => {
        if (code === 0) {
          try {
            const result = JSON.parse(outputData);
            resolve(result);
          } catch (error) {
            const parseError = error instanceof Error ? error.message : 'Unknown parsing error';
            reject(new Error(`Failed to parse process output: ${parseError}`));
          }
        } else {
          reject(new Error(`Process failed with code ${code}: ${errorData}`));
        }
      });

      pythonProcess.on('error', (err: Error) => {
        reject(new Error(`Failed to start process: ${err.message}`));
      });
    });
  }
}
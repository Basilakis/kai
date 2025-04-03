import { spawn } from 'child_process';
import path from 'path';
import { mkdir, writeFile, rmdir } from 'fs/promises';
import type { 
  ProcessingResult, 
  ReconstructionResult, 
  PipelineConfig,
  ProcessingError 
} from '@kai/shared/src/types/reconstruction';

declare const process: {
  env: {
    PYTHON_PATH?: string;
    [key: string]: string | undefined;
  };
};

export class ReconstructionBridge {
  private pythonPath: string;
  private scriptPath: string;

  constructor() {
    this.pythonPath = process.env.PYTHON_PATH || 'python';
    this.scriptPath = path.join(__dirname, '../python/room_reconstruction_pipeline.py');
  }

  /**
   * Initialize the reconstruction pipeline
   */
  async initialize(config?: PipelineConfig): Promise<void> {
    try {
      const pythonProcess = spawn(this.pythonPath, [
        this.scriptPath,
        '--initialize',
        JSON.stringify(config || {})
      ]);

      return new Promise<void>((resolve, reject) => {
        pythonProcess.on('close', (code: number) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Pipeline initialization failed with code ${code}`));
          }
        });

        pythonProcess.on('error', (err: Error) => {
          reject(new Error(`Failed to start pipeline: ${err.message}`));
        });
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to initialize reconstruction pipeline: ${error.message}`);
      }
      throw new Error('Failed to initialize reconstruction pipeline: Unknown error');
    }
  }

  /**
   * Process room images through the reconstruction pipeline
   */
  async processRoom(
    images: Buffer[],
    config?: PipelineConfig
  ): Promise<ProcessingResult> {
    try {
      // Create temporary directory for processing
      const tempDir = path.join(__dirname, '../temp', Date.now().toString());
      await mkdir(tempDir, { recursive: true });
      
      // Save images and prepare processing
      const imagePromises = images.map((buffer, index) => {
        const imagePath = path.join(tempDir, `image_${index}.png`);
        return writeFile(imagePath, buffer);
      });
      
      await Promise.all(imagePromises);

      // Run reconstruction pipeline
      const result = await this.runPipeline(tempDir, config);

      // Clean up temporary files
      await rmdir(tempDir, { recursive: true });

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Run the reconstruction pipeline on a directory of images
   */
  private async runPipeline(
    imageDir: string,
    config?: PipelineConfig
  ): Promise<ReconstructionResult> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(this.pythonPath, [
        this.scriptPath,
        '--process',
        imageDir,
        '--config',
        JSON.stringify(config || {})
      ]);

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
            const result = JSON.parse(outputData) as ReconstructionResult;
            resolve(result);
          } catch (error) {
            const parseError = error instanceof Error ? error.message : 'Unknown parsing error';
            reject(new Error(`Failed to parse pipeline output: ${parseError}`));
          }
        } else {
          reject(new Error(`Pipeline failed with code ${code}: ${errorData}`));
        }
      });

      pythonProcess.on('error', (err: Error) => {
        reject(new Error(`Failed to start pipeline: ${err.message}`));
      });
    });
  }

  /**
   * Clean up resources used by the pipeline
   */
  async cleanup(): Promise<void> {
    try {
      const pythonProcess = spawn(this.pythonPath, [
        this.scriptPath,
        '--cleanup'
      ]);

      return new Promise<void>((resolve, reject) => {
        pythonProcess.on('close', (code: number) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Pipeline cleanup failed with code ${code}`));
          }
        });
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to cleanup pipeline: ${error.message}`);
      }
      throw new Error('Failed to cleanup pipeline: Unknown error');
    }
  }
}
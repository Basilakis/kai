import { Logger } from 'winston';
import { createLogger } from '../../utils/logger';
import * as fs from 'fs/promises'; // Use async fs
import * as path from 'path';
import { spawn } from 'child_process'; // Import spawn

/**
 * LOD Level interface
 * Represents a level of detail configuration
 */
export interface LODLevel {
  /**
   * Target percentage of original mesh (0.0-1.0)
   */
  targetPercentage: number;

  /**
   * Quality settings (0.0-1.0) - Interpretation depends on the tool
   */
  quality?: number; // Make optional as not all tools use it directly

  /**
   * Maximum error threshold - Interpretation depends on the tool
   */
  maxError?: number; // Make optional
}

/**
 * LOD Generation Options
 */
export interface LODGenerationOptions {
  /**
   * Preserve feature edges
   */
  preserveFeatures?: boolean;

  /**
   * Preserve texture coordinates
   */
  preserveTexCoords?: boolean;

  /**
   * Preserve boundary topology
   */
  preserveBoundary?: boolean;

  /**
   * Preserve mesh volume
   */
  preserveVolume?: boolean;

  /**
   * Weight factors for vertex attributes (tool-dependent)
   */
  weightFactors?: {
    position?: number;
    normal?: number;
    texCoord?: number;
    color?: number;
  };

  /**
   * Temporary directory for processing
   */
  tempDir?: string;

  /**
   * Path to the mesh simplification executable
   */
  simplifierPath?: string; // Allow specifying tool path

  /**
   * Path to the mesh stats executable
   */
  statsToolPath?: string; // Allow specifying tool path
}

/**
 * LOD Generation Result
 */
export interface LODGenerationResult {
  /**
   * Original mesh file path
   */
  originalMesh: string;

  /**
   * Generated LOD mesh file paths
   */
  lodMeshes: {
    level: number;
    percentage: number;
    triangles: number;
    vertices: number;
    filePath: string;
    fileSize: number;
  }[];

  /**
   * Total processing time in milliseconds
   */
  processingTimeMs: number;
}

/**
 * LOD Generator Service
 *
 * Responsible for generating multiple Levels of Detail (LOD) for 3D meshes
 * using external command-line tools.
 */
export class LODGenerator {
  private logger: Logger;
  private tempDir: string;
  private simplifierTool: string;
  private statsTool: string;

  /**
   * Constructor
   * @param options Configuration options including temp directory and tool paths
   */
  constructor(
    options: {
      tempDir?: string;
      simplifierPath?: string;
      statsToolPath?: string;
    } = {}
  ) {
    this.tempDir = options.tempDir || '/tmp/lod-generator';
    this.simplifierTool = options.simplifierPath || 'mesh-simplifier-cli'; // Default tool name
    this.statsTool = options.statsToolPath || 'mesh-stats-cli'; // Default tool name
    this.logger = createLogger({ service: 'LODGenerator' });

    // Async initialization pattern might be better here, but for simplicity:
    this.ensureTempDir().catch(err => {
        this.logger.error("Failed to ensure temp directory on initialization", { error: err.message });
        // Decide if this is a fatal error
    });

    this.logger.info('LOD Generator service initialized', {
        tempDir: this.tempDir,
        simplifierTool: this.simplifierTool,
        statsTool: this.statsTool
    });
  }

  /**
   * Ensure temporary directory exists asynchronously.
   * @private
   */
  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        this.logger.error('Failed to create temp directory', { tempDir: this.tempDir, error: error.message });
        throw error; // Re-throw if it's not an EEXIST error
      }
    }
  }

  /**
   * Generate LOD levels for a mesh
   * @param inputMeshPath Path to input mesh file
   * @param outputDir Output directory
   * @param levels LOD levels to generate
   * @param options Generation options
   * @returns LOD generation result
   */
  public async generateLODs(
    inputMeshPath: string,
    outputDir: string,
    levels: LODLevel[] = [ // Default levels
      { targetPercentage: 0.75 },
      { targetPercentage: 0.50 },
      { targetPercentage: 0.25 },
      { targetPercentage: 0.10 }
    ],
    options: LODGenerationOptions = {}
  ): Promise<LODGenerationResult> {
    const startTime = Date.now();

    this.logger.info('Starting LOD generation', {
      inputMesh: inputMeshPath,
      outputDir,
      levelsCount: levels.length
    });

    // Ensure output directory exists
    try {
        await fs.mkdir(outputDir, { recursive: true });
    } catch (error: any) {
        if (error.code !== 'EEXIST') {
            this.logger.error('Failed to create output directory', { outputDir, error: error.message });
            throw error;
        }
    }

    // Get input mesh stats
    let inputStats: { triangles: number; vertices: number; };
    try {
        inputStats = await this.getMeshStats(inputMeshPath, options.statsToolPath);
    } catch (error) {
        this.logger.error('Failed to get stats for input mesh', { inputMeshPath, error: error instanceof Error ? error.message : String(error) });
        throw new Error(`Failed to get stats for input mesh ${inputMeshPath}`);
    }
    const inputTriangles = inputStats.triangles;

    // Sort levels by percentage (highest to lowest for potential sequential generation)
    const sortedLevels = [...levels].sort((a, b) =>
      b.targetPercentage - a.targetPercentage
    );

    const lodMeshes = [];
    const inputFileName = path.basename(inputMeshPath, path.extname(inputMeshPath));
    let currentInputPath = inputMeshPath; // For sequential simplification if needed

    // Process each LOD level
    for (let i = 0; i < sortedLevels.length; i++) {
      const level = sortedLevels[i];
      // Target can be percentage or absolute triangle count
      const targetTriangles = Math.max(10, Math.round(inputTriangles * level.targetPercentage)); // Ensure minimum triangles

      const outputFileName = `${inputFileName}_lod${i}_${Math.round(level.targetPercentage * 100)}pct${path.extname(inputMeshPath)}`;
      const outputPath = path.join(outputDir, outputFileName);

      this.logger.debug('Generating LOD level', {
        level: i,
        percentage: level.targetPercentage,
        targetTriangles,
        input: currentInputPath, // Log which mesh is being simplified
        output: outputPath
      });

      try {
        // Generate LOD level using the external tool
        await this.generateLODLevel(
          currentInputPath, // Use previous output as input for next level? Or always original? Depends on tool/strategy. Let's assume original for now.
          // inputMeshPath, // Use original mesh as input for each level
          outputPath,
          targetTriangles,
          level,
          options
        );

        // Get mesh stats for the generated LOD
        const stats = await this.getMeshStats(outputPath, options.statsToolPath);
        const fileStat = await fs.stat(outputPath);
        const fileSize = fileStat.size;

        lodMeshes.push({
          level: i,
          percentage: level.targetPercentage,
          triangles: stats.triangles,
          vertices: stats.vertices,
          filePath: outputPath,
          fileSize
        });

        this.logger.debug('Generated LOD level', {
          level: i,
          triangles: stats.triangles,
          vertices: stats.vertices,
          fileSize
        });

        // Optional: Use the generated LOD as input for the next, lower level
        // currentInputPath = outputPath;

      } catch (error) {
         this.logger.error(`Failed to generate LOD level ${i}`, {
            percentage: level.targetPercentage,
            output: outputPath,
            error: error instanceof Error ? error.message : String(error)
         });
         // Decide how to handle partial failure: continue, stop, return partial results?
         // For now, let's continue to generate other levels if possible.
      }
    }

    const processingTimeMs = Date.now() - startTime;

    this.logger.info('LOD generation completed', {
      inputMesh: inputMeshPath,
      levelsGenerated: lodMeshes.length,
      processingTimeMs
    });

    return {
      originalMesh: inputMeshPath,
      lodMeshes,
      processingTimeMs
    };
  }

  /**
   * Generate a single LOD level using an external tool.
   * @param inputMeshPath Input mesh path
   * @param outputMeshPath Output mesh path
   * @param targetTriangles Target triangle count
   * @param level LOD level configuration
   * @param options Generation options
   * @private
   */
  private async generateLODLevel(
    inputMeshPath: string,
    outputMeshPath: string,
    targetTriangles: number,
    level: LODLevel,
    options: LODGenerationOptions
  ): Promise<void> {
    const tool = options.simplifierPath || this.simplifierTool;

    // Construct arguments based on the hypothetical tool's interface
    const args = [
      '--input', inputMeshPath,
      '--output', outputMeshPath,
      '--target-triangles', targetTriangles.toString()
    ];

    // Add optional parameters based on LODLevel and LODGenerationOptions
    if (level.quality !== undefined) {
      args.push('--quality', level.quality.toString());
    }
    if (level.maxError !== undefined) {
      args.push('--max-error', level.maxError.toString());
    }
    if (options.preserveFeatures) args.push('--preserve-features');
    if (options.preserveTexCoords) args.push('--preserve-texcoords');
    if (options.preserveBoundary) args.push('--preserve-boundary');
    if (options.preserveVolume) args.push('--preserve-volume');

    // Add weight factors if provided
    if (options.weightFactors) {
        Object.entries(options.weightFactors).forEach(([key, value]) => {
            if (value !== undefined) {
                args.push(`--weight-${key}`, value.toString());
            }
        });
    }

    this.logger.debug(`Executing mesh simplifier: ${tool} ${args.join(' ')}`);

    try {
        const output = await this.executeProcess(tool, args);
        this.logger.debug(`Mesh simplifier output: ${output}`);
        // Check output for success indicators if necessary
    } catch (error) {
        this.logger.error(`Mesh simplification failed for ${outputMeshPath}`, { error: error instanceof Error ? error.message : String(error) });
        // Attempt to clean up potentially incomplete output file
        try { await fs.rm(outputMeshPath, { force: true }); } catch { /* ignore cleanup error */ }
        throw error; // Re-throw to indicate failure for this level
    }
  }

  /**
   * Get mesh statistics using an external tool.
   * @param meshPath Path to mesh file
   * @param statsToolPath Optional path to the stats tool executable
   * @returns Mesh statistics (triangles, vertices)
   * @private
   */
  private async getMeshStats(meshPath: string, statsToolPath?: string): Promise<{
    triangles: number;
    vertices: number;
  }> {
    const tool = statsToolPath || this.statsTool;
    const args = ['--input', meshPath, '--format', 'json']; // Assume tool outputs JSON

    this.logger.debug(`Executing mesh stats tool: ${tool} ${args.join(' ')}`);

    try {
      const output = await this.executeProcess(tool, args);
      this.logger.debug(`Mesh stats tool output: ${output}`);

      // Parse the JSON output
      const stats = JSON.parse(output);

      // Validate expected properties
      if (typeof stats.triangles !== 'number' || typeof stats.vertices !== 'number') {
        throw new Error('Invalid stats format received from tool');
      }

      return {
        triangles: stats.triangles,
        vertices: stats.vertices
      };
    } catch (error) {
      this.logger.error(`Failed to get mesh stats for ${meshPath}`, { error: error instanceof Error ? error.message : String(error) });
      throw new Error(`Failed to get mesh stats: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute an external process and return its stdout.
   * Rejects on non-zero exit code or process error.
   * @param command Command to execute
   * @param args Command arguments
   * @returns Promise resolving with stdout string
   * @private
   */
  private executeProcess(command: string, args: string[]): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      // @ts-ignore - Workaround for persistent spawn signature error
      const process = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        this.logger.debug(`[${command} stdout]: ${chunk.trim()}`);
      });

      process.stderr.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        this.logger.warn(`[${command} stderr]: ${chunk.trim()}`);
      });

      process.on('close', (code: number | null) => {
        if (code === 0) {
          this.logger.debug(`[${command}] exited successfully.`);
          resolve(stdout);
        } else {
          const errorMsg = `Process [${command}] exited with code ${code}. Stderr: ${stderr.trim() || '<empty>'}. Stdout: ${stdout.trim() || '<empty>'}`;
          this.logger.error(errorMsg);
          reject(new Error(errorMsg));
        }
      });

      process.on('error', (err: Error) => {
        this.logger.error(`Failed to start process [${command}]`, { error: err.message });
        reject(err); // e.g., command not found
      });
    });
  }

  /**
   * Clean up temporary files asynchronously.
   */
  public async cleanup(): Promise<void> {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
      this.logger.info('Cleaned up temporary files');
    } catch (error: any) {
      this.logger.error('Error cleaning up temporary files', {
        error: error.message
      });
      // Don't throw, cleanup failure is usually not critical
    }
  }
}
import { Logger } from 'winston';
import { createLogger } from '../../utils/logger';
import * as fs from 'fs/promises'; // Remove node: prefix
import { Dirent, readdir as readdirCb } from 'fs'; // Remove node: prefix
import * as path from 'path'; // Remove node: prefix
import { spawn } from 'child_process'; // Remove node: prefix
import * as util from 'util'; // Remove node: prefix

const readdirAsync = util.promisify(readdirCb); // Promisify readdir

/**
 * Compression options for Draco compression
 */
export interface DracoCompressionOptions {
  compressionLevel?: number;
  positionQuantizationBits?: number;
  texCoordQuantizationBits?: number;
  normalQuantizationBits?: number;
  colorQuantizationBits?: number;
  genericQuantizationBits?: number;
  preserveNormals?: boolean;
  tempDir?: string;
  encoderPath?: string;
  decoderPath?: string;
}

/**
 * Result of Draco compression
 */
export interface DracoCompressionResult {
  originalPath: string;
  compressedPath: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  processingTimeMs: number;
  options: DracoCompressionOptions;
}

/**
 * Draco Compression Service
 */
export class DracoCompressionService {
  private logger: Logger;
  private tempDir: string;
  private encoderTool: string;
  private decoderTool: string;

  private defaultOptions: DracoCompressionOptions = {
    compressionLevel: 7,
    positionQuantizationBits: 14,
    texCoordQuantizationBits: 12,
    normalQuantizationBits: 10,
  };

  constructor(options: Partial<DracoCompressionOptions> & { encoderPath?: string, decoderPath?: string } = {}) {
    this.tempDir = options.tempDir || '/tmp/draco-compression';
    this.encoderTool = options.encoderPath || 'draco_encoder';
    this.decoderTool = options.decoderPath || 'draco_decoder';
    this.logger = createLogger({ service: 'DracoCompressionService' });

    this.ensureTempDir().catch(err => {
        this.logger.error("Failed to ensure temp directory on initialization", { error: err.message });
    });

    this.logger.info('Draco Compression service initialized', {
        encoderTool: this.encoderTool,
        decoderTool: this.decoderTool,
        tempDir: this.tempDir
    });
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        this.logger.error('Failed to create temp directory', { tempDir: this.tempDir, error: error.message });
        throw error;
      }
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  public async compressModel(
    inputPath: string,
    outputPath?: string,
    options?: Partial<DracoCompressionOptions>
  ): Promise<DracoCompressionResult> {
    const startTime = Date.now();
    const mergedOptions = { ...this.defaultOptions, ...options };

    if (!outputPath) {
      const inputExt = path.extname(inputPath);
      const outputExt = (inputExt.toLowerCase() === '.gltf' || inputExt.toLowerCase() === '.glb') ? inputExt : '.drc';
      const baseName = path.basename(inputPath, inputExt);
      const dirName = path.dirname(inputPath);
      outputPath = path.join(dirName, `${baseName}_draco${outputExt}`);
    }

    this.logger.info('Starting Draco compression', { inputPath, outputPath, options: mergedOptions });

    try {
      await this.ensureDirectoryExists(path.dirname(outputPath));
      const originalStat = await fs.stat(inputPath);
      const originalSize = originalStat.size;

      await this.executeDracoCompression(inputPath, outputPath!, mergedOptions); // Add ! assertion

      const compressedStat = await fs.stat(outputPath!); // Add ! assertion
      const compressedSize = compressedStat.size;
      const compressionRatio = compressedSize > 0 ? originalSize / compressedSize : Infinity;
      const processingTimeMs = Date.now() - startTime;

      this.logger.info('Draco compression completed', { outputPath, originalSize, compressedSize, compressionRatio: compressionRatio.toFixed(2), processingTimeMs });

      return {
        originalPath: inputPath,
        compressedPath: outputPath!, // Add ! assertion
        originalSize,
        compressedSize,
        compressionRatio,
        processingTimeMs,
        options: mergedOptions
      };
    } catch (error) {
      this.logger.error('Draco compression failed', { inputPath, outputPath, error: error instanceof Error ? error.message : String(error) });
      try { await fs.rm(outputPath, { force: true }); } catch { /* ignore cleanup error */ }
      throw error;
    }
  }

  public async compressDirectory(
    inputDir: string,
    outputDir: string,
    filePattern: string = '.glb,.gltf,.obj,.ply',
    options?: Partial<DracoCompressionOptions>
  ): Promise<DracoCompressionResult[]> {
    this.logger.info('Compressing directory', { inputDir, outputDir, filePattern });
    await this.ensureDirectoryExists(outputDir);

    const files = await this.findFiles(inputDir, filePattern);
    this.logger.info(`Found ${files.length} files matching pattern to compress`);

    const results: DracoCompressionResult[] = [];
    for (const file of files) {
      const relativePath = path.relative(inputDir, file);
      const outputSubDir = path.dirname(path.join(outputDir, relativePath));
      const outputFileName = path.basename(file);
      const outputPath = path.join(outputSubDir, outputFileName);

      try {
        await this.ensureDirectoryExists(outputSubDir);
        const result = await this.compressModel(file, outputPath, options);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to compress ${file}`, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    this.logger.info(`Successfully compressed ${results.length} of ${files.length} files`);
    return results;
  }

  public async decompressModel(
    inputPath: string,
    outputPath: string
  ): Promise<string> {
    this.logger.info('Decompressing Draco model', { inputPath, outputPath });
    await this.ensureDirectoryExists(path.dirname(outputPath));

    try {
      await this.executeDracoDecompression(inputPath, outputPath);
      this.logger.info('Decompression completed', { outputPath });
      return outputPath;
    } catch (error) {
      this.logger.error('Decompression failed', { inputPath, outputPath, error: error instanceof Error ? error.message : String(error) });
      try { await fs.rm(outputPath, { force: true }); } catch { /* ignore cleanup error */ }
      throw error;
    }
  }

  private async findFiles(directory: string, pattern: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = pattern.toLowerCase().split(',').map(p => p.trim());
    const logger = this.logger || console; // Use instance logger or fallback

    async function scanDir(dir: string): Promise<void> {
      let entries: Dirent[] = [];
      try {
        // Use promisified readdir with options, cast result
        entries = await readdirAsync(dir, { withFileTypes: true }) as Dirent[];
      } catch (err: any) {
         logger.error(`Error reading directory ${dir}: ${err.message}`);
         return; // Skip directory if cannot read
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        try {
            if (entry.isDirectory()) {
              await scanDir(fullPath);
            } else if (entry.isFile()) {
              const ext = path.extname(entry.name).toLowerCase();
              if (extensions.includes(ext)) {
                files.push(fullPath);
              }
            }
        } catch (err: any) {
            logger.error(`Error processing path ${fullPath}: ${err.message}`);
        }
      }
    }

    await scanDir(directory);
    return files;
  }

  private async executeDracoCompression(
    inputPath: string,
    outputPath: string,
    options: DracoCompressionOptions
  ): Promise<void> {
    const tool = this.encoderTool;
    const args: string[] = ['-i', inputPath, '-o', outputPath];

    if (options.compressionLevel !== undefined) {
      args.push('-cl', options.compressionLevel.toString());
    }
    if (options.positionQuantizationBits !== undefined) {
      args.push('-qp', options.positionQuantizationBits.toString());
    }
    if (options.texCoordQuantizationBits !== undefined) {
      args.push('-qt', options.texCoordQuantizationBits.toString());
    }
    if (options.normalQuantizationBits !== undefined) {
      args.push('-qn', options.normalQuantizationBits.toString());
    }
     if (options.colorQuantizationBits !== undefined) {
       args.push('-qc', options.colorQuantizationBits.toString());
    }
     if (options.genericQuantizationBits !== undefined) {
       args.push('-qg', options.genericQuantizationBits.toString());
    }

    this.logger.debug(`Executing Draco encoder: ${tool} ${args.join(' ')}`);
    try {
        const output = await this.executeProcess(tool, args);
        this.logger.debug(`Draco encoder output: ${output}`);
    } catch (error) {
        this.logger.error(`Draco encoding failed for ${inputPath}`, { error: error instanceof Error ? error.message : String(error) });
        throw error;
    }
  }

  private async executeDracoDecompression(
    inputPath: string,
    outputPath: string
  ): Promise<void> {
    const tool = this.decoderTool;
    const args: string[] = ['-i', inputPath, '-o', outputPath];

    this.logger.debug(`Executing Draco decoder: ${tool} ${args.join(' ')}`);
    try {
        const output = await this.executeProcess(tool, args);
        this.logger.debug(`Draco decoder output: ${output}`);
    } catch (error) {
        this.logger.error(`Draco decoding failed for ${inputPath}`, { error: error instanceof Error ? error.message : String(error) });
        throw error;
    }
  }

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
        reject(err);
      });
    });
  }

  public async cleanup(): Promise<void> {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
      this.logger.info('Cleaned up temporary files');
    } catch (error: any) {
      this.logger.error('Error cleaning up temporary files', {
        error: error.message
      });
    }
  }
}
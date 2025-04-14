/// <reference path="../../types/node-types.d.ts" />

// Import Node.js built-in modules with type declarations
import { promises as fs } from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import { Buffer } from 'buffer'; // Explicitly import Buffer

// Import winston logger
import { Logger } from 'winston';
import { createLogger } from '../../utils/logger';

/**
 * WebAssembly module source type
 */
export enum WasmSourceType {
  /**
   * C/C++ source code
   */
  CPP = 'cpp',

  /**
   * Rust source code
   */
  RUST = 'rust',

  /**
   * AssemblyScript (TypeScript subset)
   */
  ASSEMBLYSCRIPT = 'assemblyscript',

  /**
   * WebAssembly binary format
   */
  WASM = 'wasm',

  /**
   * WebAssembly text format
   */
  WAT = 'wat'
}

/**
 * WebAssembly compilation options
 */
export interface WasmCompilationOptions {
  /**
   * Source type
   */
  sourceType: WasmSourceType;

  /**
   * Optimization level (0-3, higher is more optimized)
   */
  optimizationLevel?: number;

  /**
   * Enable SIMD instructions
   */
  enableSIMD?: boolean;

  /**
   * Enable threads (shared memory)
   */
  enableThreads?: boolean;

  /**
   * Enable bulk memory operations
   */
  enableBulkMemory?: boolean;

  /**
   * Enable reference types
   */
  enableReferenceTypes?: boolean;

  /**
   * Generate TypeScript or JavaScript bindings
   */
  generateBindings?: 'ts' | 'js' | 'none';

  /**
   * Include source maps
   */
  sourceMap?: boolean;

  /**
   * Debug build (includes names and debug info)
   */
  debug?: boolean;

  /**
   * Additional compiler flags
   */
  additionalFlags?: string[];

  /**
   * Temporary directory for processing
   */
  tempDir?: string;
}

/**
 * WebAssembly compilation result
 */
export interface WasmCompilationResult {
  /**
   * Original source path
   */
  sourcePath: string;

  /**
   * WebAssembly binary path (.wasm)
   */
  wasmPath: string;

  /**
   * JavaScript glue code path (if generated)
   */
  jsPath?: string;

  /**
   * TypeScript definition file path (if generated)
   */
  dtsPath?: string;

  /**
   * WebAssembly text format path (.wat, if generated)
   */
  watPath?: string;

  /**
   * Source map path (if generated)
   */
  sourceMapPath?: string;

  /**
   * Original source size in bytes
   */
  sourceSize: number;

  /**
   * WebAssembly binary size in bytes
   */
  wasmSize: number;

  /**
   * JavaScript glue code size in bytes (if generated)
   */
  jsSize?: number;

  /**
   * Compilation time in milliseconds
   */
  compilationTimeMs: number;

  /**
   * Compilation options used
   */
  options: WasmCompilationOptions;

  /**
   * Memory usage statistics
   */
  memoryStats?: {
    /**
     * Total memory usage (initial)
     */
    initialMemory: number;

    /**
     * Maximum memory usage
     */
    maximumMemory?: number;

    /**
     * Exported functions count
     */
    exportedFunctions: number;

    /**
     * Imported functions count
     */
    importedFunctions: number;
  };
}

/**
 * Critical client-side algorithm for WebAssembly optimization
 */
export interface CriticalClientAlgorithm {
  /**
   * Algorithm name
   */
  name: string;

  /**
   * Algorithm description
   */
  description: string;

  /**
   * Source file path
   */
  sourcePath: string;

  /**
   * Language source type
   */
  sourceType: WasmSourceType;

  /**
   * Estimated speedup factor compared to JavaScript
   */
  estimatedSpeedup: number;

  /**
   * Optimization priority (higher means more important)
   */
  priority: number;

  /**
   * Memory usage characteristic (lower is better)
   */
  memoryFootprint: 'tiny' | 'small' | 'medium' | 'large' | 'huge';

  /**
   * Is this algorithm compute-intensive?
   */
  computeIntensive: boolean;

  /**
   * Special WebAssembly features required
   */
  requiredFeatures?: string[];
}

/**
 * WebAssembly Processor Service
 *
 * Identifies critical client-side components and compiles them to WebAssembly
 * for browser execution, optimizing performance-critical operations.
 */
export class WasmProcessorService {
  private logger: Logger;
  private tempDir: string;

  /**
   * Default compilation options by source type
   */
  private defaultOptions: Record<WasmSourceType, WasmCompilationOptions> = {
    [WasmSourceType.CPP]: {
      sourceType: WasmSourceType.CPP,
      optimizationLevel: 3,
      enableSIMD: true,
      enableBulkMemory: true,
      generateBindings: 'ts',
      sourceMap: true,
      debug: false
    },
    [WasmSourceType.RUST]: {
      sourceType: WasmSourceType.RUST,
      optimizationLevel: 3,
      enableSIMD: true,
      enableBulkMemory: true,
      generateBindings: 'ts',
      sourceMap: true,
      debug: false
    },
    [WasmSourceType.ASSEMBLYSCRIPT]: {
      sourceType: WasmSourceType.ASSEMBLYSCRIPT,
      optimizationLevel: 3,
      enableSIMD: true,
      enableBulkMemory: true,
      generateBindings: 'ts',
      sourceMap: true,
      debug: false
    },
    [WasmSourceType.WASM]: {
      sourceType: WasmSourceType.WASM,
      optimizationLevel: 3,
      enableSIMD: true,
      enableBulkMemory: true,
      generateBindings: 'ts',
      sourceMap: false,
      debug: false
    },
    [WasmSourceType.WAT]: {
      sourceType: WasmSourceType.WAT,
      optimizationLevel: 3,
      enableSIMD: true,
      enableBulkMemory: true,
      generateBindings: 'ts',
      sourceMap: false,
      debug: false
    }
  };

  /**
   * Critical client-side algorithms that are candidates for WebAssembly optimization
   */
  private criticalAlgorithms: CriticalClientAlgorithm[] = [
    {
      name: 'meshOptimizer',
      description: 'Mesh optimization and simplification for 3D models',
      sourcePath: '/src/algorithms/mesh-optimizer.cpp',
      sourceType: WasmSourceType.CPP,
      estimatedSpeedup: 8.5,
      priority: 9,
      memoryFootprint: 'medium',
      computeIntensive: true,
      requiredFeatures: ['simd', 'bulk-memory']
    },
    {
      name: 'imageFilters',
      description: 'Real-time image processing filters',
      sourcePath: '/src/algorithms/image-filters.cpp',
      sourceType: WasmSourceType.CPP,
      estimatedSpeedup: 7.2,
      priority: 8,
      memoryFootprint: 'medium',
      computeIntensive: true,
      requiredFeatures: ['simd']
    },
    {
      name: 'svbrdfSolver',
      description: 'SVBRDF parameter solver for material visualization',
      sourcePath: '/src/algorithms/svbrdf-solver.cpp',
      sourceType: WasmSourceType.CPP,
      estimatedSpeedup: 12.4,
      priority: 10,
      memoryFootprint: 'large',
      computeIntensive: true,
      requiredFeatures: ['simd', 'threads']
    },
    {
      name: 'pathfinding',
      description: 'Pathfinding algorithms for scene navigation',
      sourcePath: '/src/algorithms/pathfinding.rs',
      sourceType: WasmSourceType.RUST,
      estimatedSpeedup: 6.8,
      priority: 7,
      memoryFootprint: 'small',
      computeIntensive: true
    },
    {
      name: 'physicsSimulation',
      description: 'Simple physics simulation for scene interaction',
      sourcePath: '/src/algorithms/physics-sim.rs',
      sourceType: WasmSourceType.RUST,
      estimatedSpeedup: 9.5,
      priority: 8,
      memoryFootprint: 'medium',
      computeIntensive: true,
      requiredFeatures: ['simd', 'threads']
    },
    {
      name: 'textureCompression',
      description: 'Client-side texture compression',
      sourcePath: '/src/algorithms/texture-compression.ts',
      sourceType: WasmSourceType.ASSEMBLYSCRIPT,
      estimatedSpeedup: 5.2,
      priority: 6,
      memoryFootprint: 'small',
      computeIntensive: true
    }
  ];

  /**
   * Constructor
   * @param options WebAssembly compilation options
   */
  constructor(
    options?: {
      tempDir?: string;
    }
  ) {
    this.tempDir = options?.tempDir || '/tmp/wasm-processor';
    this.logger = createLogger({ service: 'WasmProcessorService' });

    this.ensureTempDir();

    this.logger.info('WebAssembly Processor service initialized');
  }

  /**
   * Get critical client-side algorithms that are candidates for WebAssembly optimization
   * @returns List of critical algorithms
   */
  public getCriticalAlgorithms(): CriticalClientAlgorithm[] {
    return [...this.criticalAlgorithms];
  }

  /**
   * Analyze source code to identify critical algorithms for WebAssembly compilation
   * @param sourcePath Path to source code directory
   * @param language Language filter ('cpp', 'rust', 'assemblyscript', 'all')
   * @returns List of identified algorithms
   */
  public async analyzeCriticalAlgorithms(
    sourcePath: string,
    language: 'cpp' | 'rust' | 'assemblyscript' | 'all' = 'all'
  ): Promise<CriticalClientAlgorithm[]> {
    this.logger.info('Analyzing source code for critical algorithms', {
      sourcePath,
      language
    });

    // Initialize result array
    const result: CriticalClientAlgorithm[] = [];

    // Perform static analysis on the codebase
    // This implementation focuses on specific pre-identified critical algorithms
    for (const algorithm of this.criticalAlgorithms) {
      if (language === 'all' || algorithm.sourceType === language) {
        result.push({
          ...algorithm,
          sourcePath: path.join(sourcePath, algorithm.sourcePath)
        });
      }
    }

    this.logger.info(`Identified ${result.length} critical algorithms`, {
      language
    });

    return result;
  }

  /**
   * Compile a single source file to WebAssembly
   * @param sourcePath Path to source file
   * @param outputPath Optional path for output WebAssembly file
   * @param options Compilation options
   * @returns Compilation result
   */
  public async compileToWasm(
    sourcePath: string,
    outputPath?: string,
    options?: Partial<WasmCompilationOptions>
  ): Promise<WasmCompilationResult> {
    const startTime = Date.now();

    // Determine source type from file extension if not specified
    let sourceType = options?.sourceType;
    if (!sourceType) {
      const ext = path.extname(sourcePath).toLowerCase();
      switch (ext) {
        case '.cpp':
        case '.cc':
        case '.c':
        case '.h':
        case '.hpp':
          sourceType = WasmSourceType.CPP;
          break;
        case '.rs':
          sourceType = WasmSourceType.RUST;
          break;
        case '.ts':
          sourceType = WasmSourceType.ASSEMBLYSCRIPT;
          break;
        case '.wasm':
          sourceType = WasmSourceType.WASM;
          break;
        case '.wat':
          sourceType = WasmSourceType.WAT;
          break;
        default:
          throw new Error(`Unsupported file extension: ${ext}`);
      }
    }

    // Get default options for this source type
    const mergedOptions: WasmCompilationOptions = {
      ...this.defaultOptions[sourceType],
      ...options,
      sourceType
    };

    // If no output path provided, create one based on input
    if (!outputPath) {
      const inputExt = path.extname(sourcePath);
      const baseName = path.basename(sourcePath, inputExt);
      const dirName = path.dirname(sourcePath);

      outputPath = path.join(dirName, `${baseName}.wasm`);
    }

    this.logger.info('Starting WebAssembly compilation', {
      sourcePath,
      outputPath,
      sourceType: mergedOptions.sourceType,
      optimizationLevel: mergedOptions.optimizationLevel
    });

    try {
      await this.ensureDirectoryExists(path.dirname(outputPath));

      // Get source size
      const sourceStat = await fs.stat(sourcePath);
      const sourceSize = sourceStat.size;

      // Determine compiler and tools based on source type
      let compiler: string;
      let compilerArgs: string[] = [];

      switch (mergedOptions.sourceType) {
        case WasmSourceType.CPP:
          compiler = 'emcc';
          compilerArgs = this.buildEmscriptenArgs(sourcePath, outputPath as string, mergedOptions);
          break;
        case WasmSourceType.RUST:
          compiler = 'cargo'; // Assumes sourcePath points to a directory with Cargo.toml or is handled by buildRustArgs
          compilerArgs = this.buildRustArgs(sourcePath, outputPath as string, mergedOptions);
          break;
        case WasmSourceType.ASSEMBLYSCRIPT:
          compiler = 'asc';
          compilerArgs = this.buildAssemblyScriptArgs(sourcePath, outputPath as string, mergedOptions);
          break;
        case WasmSourceType.WASM: // If input is already WASM, we might just optimize it
          compiler = 'wasm-opt';
          compilerArgs = this.buildWasmOptArgs(sourcePath, outputPath as string, mergedOptions);
          break;
        case WasmSourceType.WAT:
          compiler = 'wat2wasm';
          compilerArgs = [sourcePath, '-o', outputPath as string];
          break;
        default:
          throw new Error(`Unsupported source type: ${mergedOptions.sourceType}`);
      }

      // Execute the compiler
      const compilerOutput = await this.executeCompiler(
        compiler,
        compilerArgs,
        sourcePath,
        outputPath as string,
        mergedOptions
      );

      // Generate output paths for additional files
      const jsPath = mergedOptions.generateBindings !== 'none'
        ? this.getOutputPath(outputPath as string, '.js')
        : undefined;

      const dtsPath = mergedOptions.generateBindings === 'ts'
        ? this.getOutputPath(outputPath as string, '.d.ts')
        : undefined;

      // WAT generation might happen during optimization or separately
      const watPath = this.getOutputPath(outputPath as string, '.wat'); // Assume we might generate it

      const sourceMapPath = mergedOptions.sourceMap
        ? this.getOutputPath(outputPath as string, '.wasm.map')
        : undefined;

      // Get WebAssembly binary size
      const wasmStat = await fs.stat(outputPath);
      const wasmSize = wasmStat.size;

      // Get JS glue code size if generated and exists
      let jsSize: number | undefined;
      if (jsPath) {
        try {
          const jsStat = await fs.stat(jsPath);
          jsSize = jsStat.size;
        } catch (error: any) {
          if (error.code !== 'ENOENT') { // Ignore if file simply doesn't exist
             this.logger.warn(`Could not stat JS file ${jsPath}`, { error: error.message });
          }
        }
      }

      // Extract memory usage statistics (example, needs real parsing)
      const memoryStats = this.extractMemoryStats(compilerOutput);

      const compilationTimeMs = Date.now() - startTime;

      this.logger.info('WebAssembly compilation completed', {
        sourcePath,
        outputPath,
        sourceSize,
        wasmSize,
        jsSize,
        compilationTimeMs
      });

      return {
        sourcePath,
        wasmPath: outputPath as string,
        jsPath,
        dtsPath,
        watPath, // Include WAT path if generated
        sourceMapPath,
        sourceSize,
        wasmSize,
        jsSize,
        compilationTimeMs,
        options: mergedOptions,
        memoryStats
      };
    } catch (error) {
      this.logger.error('WebAssembly compilation failed', {
        sourcePath,
        outputPath,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  /**
   * Compile multiple source files to WebAssembly in batch
   * @param sourcePaths List of source file paths
   * @param outputDir Output directory
   * @param options Compilation options
   * @returns List of compilation results
   */
  public async compileMultiple(
    sourcePaths: string[],
    outputDir: string,
    options?: Partial<WasmCompilationOptions>
  ): Promise<WasmCompilationResult[]> {
    this.logger.info('Compiling multiple files to WebAssembly', {
      count: sourcePaths.length,
      outputDir
    });

    await this.ensureDirectoryExists(outputDir);

    const results: WasmCompilationResult[] = [];

    // Consider parallel execution using Promise.all for better performance
    for (const sourcePath of sourcePaths) {
      const fileName = path.basename(sourcePath);
      // Ensure output path is unique if multiple files have the same base name
      const outputPath = path.join(outputDir, `${path.parse(fileName).name}.wasm`);

      try {
        const result = await this.compileToWasm(sourcePath, outputPath, options);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to compile ${sourcePath}`, {
          error: error instanceof Error ? error.message : String(error)
        });
        // Decide whether to continue or fail fast
      }
    }

    this.logger.info(`Compiled ${results.length} of ${sourcePaths.length} files`);

    return results;
  }

  /**
   * Build a client-side WebAssembly module bundle for browser usage
   * @param wasmFiles List of WebAssembly compilation results
   * @param outputPath Output bundle path (e.g., bundle.js)
   * @returns Path to the bundle
   */
  public async buildClientBundle(
    wasmFiles: WasmCompilationResult[],
    outputPath: string
  ): Promise<string> {
    this.logger.info('Building client-side WebAssembly bundle', {
      count: wasmFiles.length,
      outputPath
    });

    await this.ensureDirectoryExists(path.dirname(outputPath));

    // Create the JavaScript loader that will import all WASM modules
    const jsContent = this.generateBundleLoader(wasmFiles, outputPath);
    await fs.writeFile(outputPath, jsContent, 'utf8');

    // Create a minimal HTML example to demonstrate loading
    const htmlContent = this.generateHtmlExample(wasmFiles, path.basename(outputPath));
    const htmlPath = outputPath.replace(/\.js$/, '.html'); // Ensure correct replacement
    await fs.writeFile(htmlPath, htmlContent, 'utf8');

    this.logger.info('Built client-side WebAssembly bundle', {
      outputPath,
      htmlPath
    });

    return outputPath;
  }

  /**
   * Optimize a WebAssembly binary file using wasm-opt
   * @param wasmPath Path to WebAssembly binary
   * @param outputPath Optional path for optimized output
   * @param optimizationLevel Optimization level (0-4)
   * @returns Path to the optimized WebAssembly binary
   */
  public async optimizeWasm(
    wasmPath: string,
    outputPath?: string,
    optimizationLevel: number = 3
  ): Promise<string> {
    // If no output path provided, create one based on input
    if (!outputPath) {
      const dirName = path.dirname(wasmPath);
      const baseName = path.basename(wasmPath, '.wasm');
      outputPath = path.join(dirName, `${baseName}.opt.wasm`);
    }

    this.logger.info('Optimizing WebAssembly binary', {
      wasmPath,
      outputPath,
      optimizationLevel
    });

    await this.ensureDirectoryExists(path.dirname(outputPath));

    // Build wasm-opt command and arguments
    const args = [
      wasmPath,
      '-o', outputPath,
      `-O${optimizationLevel}`, // Use the provided level
      '--enable-simd', // Example feature flags, adjust as needed
      '--enable-bulk-memory'
      // Add more wasm-opt flags based on requirements
    ];

    // Execute wasm-opt
    await this.executeProcess('wasm-opt', args.filter((arg): arg is string => arg !== undefined));

    this.logger.info('Optimized WebAssembly binary', {
      outputPath
    });

    // Ensure outputPath is a string
    if (!outputPath) {
      throw new Error('Output path is undefined');
    }
    return outputPath;
  }

  /**
   * Generate WebAssembly text format (.wat) from binary using wasm2wat
   * @param wasmPath Path to WebAssembly binary
   * @param outputPath Optional path for WAT output
   * @returns Path to the WAT file
   */
  public async generateWat(
    wasmPath: string,
    outputPath?: string
  ): Promise<string> {
    // If no output path provided, create one based on input
    if (!outputPath) {
      const dirName = path.dirname(wasmPath);
      const baseName = path.basename(wasmPath, '.wasm');
      outputPath = path.join(dirName, `${baseName}.wat`);
    }

    this.logger.info('Generating WebAssembly text format', {
      wasmPath,
      outputPath
    });

    await this.ensureDirectoryExists(path.dirname(outputPath));

    // Execute wasm2wat
    if (!wasmPath || !outputPath) {
      throw new Error('wasmPath or outputPath is undefined');
    }
    await this.executeProcess('wasm2wat', [wasmPath, '-o', outputPath]);

    this.logger.info('Generated WebAssembly text format', {
      outputPath
    });

    // Ensure outputPath is a string
    if (!outputPath) {
      throw new Error('Output path is undefined');
    }
    return outputPath;
  }

  /**
   * Clean up temporary files
   */
  public async cleanup(): Promise<void> {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
      this.logger.info('Cleaned up temporary files');
    } catch (error: any) {
      // Log error but don't fail if cleanup has issues
      this.logger.error('Error cleaning up temporary files', {
        error: error.message
      });
    }
  }

  /**
   * Ensure temporary directory exists
   * @private
   */
  private async ensureTempDir(): Promise<void> {
    try {
      await this.ensureDirectoryExists(this.tempDir);
    } catch (error: any) {
      this.logger.error('Failed to create temp directory', {
        tempDir: this.tempDir,
        error: error.message
      });
      // Depending on severity, might want to throw here
    }
  }

  /**
   * Ensure directory exists, ignoring EEXIST errors.
   * @param dirPath Directory path
   * @private
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
      // Ignore if directory already exists
      if (error.code !== 'EEXIST') {
        throw error; // Re-throw other errors
      }
    }
  }

  /**
   * Execute compiler process by spawning the command.
   * @param compiler Compiler name (e.g., 'emcc', 'cargo')
   * @param args Compiler arguments
   * @param sourcePath Source file path (for context)
   * @param outputPath Output file path (for context)
   * @param options Compilation options (for context)
   * @returns Compiler output (stdout)
   * @private
   */
  private async executeCompiler(
    compiler: string,
    args: string[],
    _sourcePath: string, // Keep for logging context if needed
    _outputPath: string, // Keep for logging context if needed
    _options: WasmCompilationOptions // Keep for logging context if needed
  ): Promise<string> {
    this.logger.debug('Executing compiler', {
      compiler,
      args: args.join(' ') // Log joined args for readability
    });

    // Use the actual process execution helper
    return this.executeProcess(compiler, args);
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
      const options = { stdio: ['ignore', 'pipe', 'pipe'] }; // Let TS infer options type
      // @ts-ignore - Workaround for persistent spawn signature error
      const process = child_process.spawn(command, args, options); // Call spawn via module

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
        // Log stderr as warning or error depending on context/tool
        this.logger.warn(`[${command} stderr]: ${chunk.trim()}`);
      });

      process.on('close', (code: number | null) => {
        if (code === 0) {
          this.logger.debug(`[${command}] exited successfully.`);
          resolve(stdout);
        } else {
          // Construct a more informative error message
          const errorMsg = `Process [${command}] exited with code ${code}. Stderr: ${stderr.trim() || '<empty>'}. Stdout: ${stdout.trim() || '<empty>'}`;
          this.logger.error(errorMsg);
          reject(new Error(errorMsg));
        }
      });

      process.on('error', (err: Error) => {
        // Handle errors like command not found
        this.logger.error(`Failed to start process [${command}]`, { error: err.message });
        reject(err);
      });
    });
  }


  /**
   * Build Emscripten compiler arguments
   * @param sourcePath Source file path
   * @param outputPath Output file path
   * @param options Compilation options
   * @returns Compiler arguments
   * @private
   */
  private buildEmscriptenArgs(
    sourcePath: string,
    outputPath: string,
    options: WasmCompilationOptions
  ): string[] {
    const args = [
      sourcePath,
      '-o', outputPath,
      '-s', 'WASM=1', // Output WASM
      '-s', `ALLOW_MEMORY_GROWTH=1`, // Allow memory growth
      // '-s', `INITIAL_MEMORY=...`, // Consider setting initial memory
      '-s', `EXPORTED_RUNTIME_METHODS=['ccall','cwrap']` // Methods needed for JS interop
    ];

    // Optimization Level
    if (options.optimizationLevel !== undefined) {
      args.push(`-O${options.optimizationLevel}`); // O0, O1, O2, O3, Os, Oz
    } else {
      args.push('-O3'); // Default to high optimization
    }

    // Feature Flags
    const features: string[] = [];
    if (options.enableSIMD) features.push('simd');
    if (options.enableThreads) features.push('threads'); // Requires specific server headers (COOP/COEP)
    if (options.enableBulkMemory) features.push('bulk-memory');
    // Add other features as needed based on Emscripten capabilities

    if (features.length > 0) {
      args.push(`-s`, `WASM_FEATURES=[${features.map(f => `'${f}'`).join(',')}]`);
      // For some features, specific compiler flags might be needed too
      if (options.enableSIMD) args.push('-msimd128');
      if (options.enableThreads) {
         args.push('-s', 'USE_PTHREADS=1');
         // args.push('-s', 'PTHREAD_POOL_SIZE=navigator.hardwareConcurrency'); // Or a fixed number
      }
       if (options.enableBulkMemory) args.push('-mbulk-memory');
    }


    // Debugging and Source Maps
    if (options.debug) {
      args.push('-g4'); // Generate source maps with debug info
      args.push('--source-map-base', './'); // Base URL for source maps
    } else {
      // args.push('--strip-debug'); // Remove debug sections
    }

    if (options.sourceMap && !options.debug) { // Generate source map even if not debugging
       args.push('-g4'); // Emscripten often needs -g for source maps
       args.push('--source-map-base', './');
    }

    // Bindings Generation (Emscripten handles this via output format)
    if (options.generateBindings === 'js' || options.generateBindings === 'ts') {
       // Emscripten generates JS by default when outputting .js or .html
       // For TS, you might need separate tools like `wasm-bindgen` (for Rust) or manual definitions
       // If output is .wasm, JS is not generated by default.
       // Let's assume outputting .js if bindings are needed
       const jsOutputPath = outputPath.replace(/\.wasm$/, '.js');
       args[args.indexOf('-o') + 1] = jsOutputPath; // Change output target
    }


    // Add additional flags
    if (options.additionalFlags) {
      args.push(...options.additionalFlags);
    }

    return args;
  }

  /**
   * Build Rust compiler arguments (using wasm-pack)
   * @param sourcePath Path to the crate directory (containing Cargo.toml)
   * @param outputPath Output directory for wasm-pack
   * @param options Compilation options
   * @returns Compiler arguments for wasm-pack
   * @private
   */
  private buildRustArgs(
    sourcePath: string, // Should be the directory containing Cargo.toml
    outputPath: string, // wasm-pack uses an output directory
    options: WasmCompilationOptions
  ): string[] {
     // wasm-pack is generally preferred for Rust WASM compilation
     const args = [
        'build',
        sourcePath, // Path to the crate
        '--target', 'web', // Target environment (web, nodejs, bundler)
        '--out-dir', path.dirname(outputPath) // Specify output directory
        // '--out-name', path.basename(outputPath, '.wasm') // Specify base name for generated files
     ];

     if (options.debug) {
        args.push('--dev'); // Development build (includes debug info)
     } else {
        // Default is release build
     }

     // wasm-pack handles optimization levels via --dev/--release implicitly
     // It also handles bindings generation based on wasm-bindgen attributes in Rust code

     // Add additional flags if needed (passed after --)
     if (options.additionalFlags) {
        args.push('--', ...options.additionalFlags);
     }

     return args;
     // Note: This assumes wasm-pack is installed and in PATH.
     // The actual .wasm file path will be inside the output directory.
     // We might need to adjust the return logic in compileToWasm for Rust.
  }


  /**
   * Build AssemblyScript compiler arguments
   * @param sourcePath Source file path (entry file)
   * @param outputPath Output file path (.wasm)
   * @param options Compilation options
   * @returns Compiler arguments
   * @private
   */
  private buildAssemblyScriptArgs(
    sourcePath: string,
    outputPath: string,
    options: WasmCompilationOptions
  ): string[] {
    const args = [
      sourcePath, // Entry file
      '--outFile', outputPath, // Output .wasm file
      // '--optimize' // Enable default optimizations
    ];

    // Optimization Level
    if (options.optimizationLevel !== undefined) {
       // Map levels if needed, e.g., 0 -> --optimizeLevel 0, 1 -> 1, 2 -> 2, 3 -> 3
       // Also consider --shrinkLevel 0, 1, 2
       if (options.optimizationLevel > 0) {
          args.push('--optimize'); // Enable basic optimization
          args.push('--optimizeLevel', Math.min(options.optimizationLevel, 3).toString());
          args.push('--shrinkLevel', Math.min(options.optimizationLevel, 2).toString()); // Adjust shrink level
       }
    } else {
       args.push('--optimize'); // Default optimization
    }


    // Feature Flags
    const features: string[] = [];
    if (options.enableSIMD) features.push('simd');
    if (options.enableThreads) features.push('threads'); // Requires --sharedMemory flag
    if (options.enableBulkMemory) features.push('bulk-memory');
    if (options.enableReferenceTypes) features.push('reference-types');
    // Add other features supported by asc

    if (features.length > 0) {
       args.push('--enable', features.join(','));
       if (options.enableThreads) {
          args.push('--sharedMemory');
       }
    }

    // Debugging and Source Maps
    if (options.debug) {
      args.push('--debug'); // Add debug info
    }
    if (options.sourceMap) {
      args.push('--sourceMap'); // Generate source map
    }

    // Bindings Generation
    if (options.generateBindings === 'ts') {
       const dtsPath = outputPath.replace(/\.wasm$/, '.d.ts');
       args.push('--declarationFile', dtsPath);
    }
    if (options.generateBindings === 'js' || options.generateBindings === 'ts') {
       const jsPath = outputPath.replace(/\.wasm$/, '.js');
       args.push('--bindings', 'esm'); // Generate ES module bindings
       // Note: asc might generate the JS file alongside wasm automatically with some flags
       // Need to verify exact behavior based on asc version
    }


    // Add additional flags
    if (options.additionalFlags) {
      args.push(...options.additionalFlags);
    }

    return args;
  }

  /**
   * Build wasm-opt arguments (for optimizing existing WASM)
   * @param sourcePath Source file path (.wasm)
   * @param outputPath Output file path (.wasm)
   * @param options Compilation options (mainly optimizationLevel)
   * @returns Compiler arguments
   * @private
   */
  private buildWasmOptArgs(
    sourcePath: string,
    outputPath: string,
    options: WasmCompilationOptions
  ): string[] {
    const args = [
      sourcePath,
      '-o', outputPath
    ];

    // Optimization Level (wasm-opt uses -O, -O1, -O2, -O3, -O4, -Os, -Oz)
    if (options.optimizationLevel !== undefined) {
       if (options.optimizationLevel === 0) args.push('-O0');
       else if (options.optimizationLevel === 1) args.push('-O1');
       else if (options.optimizationLevel === 2) args.push('-O2');
       else if (options.optimizationLevel >= 3) args.push('-O3'); // Or -O4 for max
       // Could also map to -Os (size) or -Oz (more size)
    } else {
       args.push('-O3'); // Default to high optimization
    }

    // Feature Flags (wasm-opt mainly enables/disables passes based on features *present* in the module)
    // We might enable passes that depend on certain features if we know they are safe.
    if (options.enableSIMD) args.push('--enable-simd');
    if (options.enableBulkMemory) args.push('--enable-bulk-memory');
    // Add other relevant wasm-opt flags

    if (options.debug) {
      // wasm-opt can strip debug info, ensure it's kept if needed
      // args.push('--debuginfo'); // Keep debug info
    } else {
       // Default behavior might strip it depending on optimization level
    }

    // Add additional flags
    if (options.additionalFlags) {
      args.push(...options.additionalFlags);
    }

    return args;
  }


  /**
   * Extract memory usage statistics from compiler output (example)
   * @param compilerOutput Compiler output string
   * @returns Memory statistics object or undefined
   * @private
   */
  private extractMemoryStats(compilerOutput: string): WasmCompilationResult['memoryStats'] {
    // This is highly dependent on the specific compiler and its output format.
    // Provide a basic example assuming some patterns. Needs refinement.

    try {
      // Example patterns (adjust regex based on actual compiler output)
      const initialMemoryMatch = compilerOutput.match(/initial memory:\s*(\d+)/i);
      const maxMemoryMatch = compilerOutput.match(/maximum memory:\s*(\d+)/i);
      const exportedFunctionsMatch = compilerOutput.match(/exported functions:\s*(\d+)/i);
      const importedFunctionsMatch = compilerOutput.match(/imported functions:\s*(\d+)/i);

      // Basic validation
      if (!initialMemoryMatch || !exportedFunctionsMatch || !importedFunctionsMatch) {
         // If essential info is missing, maybe return undefined or default values
         // return undefined;
      }

      return {
        initialMemory: initialMemoryMatch ? parseInt(initialMemoryMatch[1], 10) : 65536, // Default 64k
        maximumMemory: maxMemoryMatch ? parseInt(maxMemoryMatch[1], 10) : undefined,
        exportedFunctions: exportedFunctionsMatch ? parseInt(exportedFunctionsMatch[1], 10) : 0,
        importedFunctions: importedFunctionsMatch ? parseInt(importedFunctionsMatch[1], 10) : 0
      };
    } catch (e) {
       this.logger.warn("Failed to parse memory stats from compiler output", { error: e instanceof Error ? e.message : String(e) });
       return undefined; // Return undefined if parsing fails
    }
  }


  /**
   * Get output path with a different extension, ensuring directory exists.
   * @param inputPath Original path (usually the .wasm path)
   * @param newExtension New extension (e.g., '.js', '.d.ts')
   * @returns Path with the new extension
   * @private
   */
  private getOutputPath(inputPath: string, newExtension: string): string {
    const dir = path.dirname(inputPath);
    const baseName = path.basename(inputPath, path.extname(inputPath)); // Get name without original ext
    return path.join(dir, `${baseName}${newExtension}`);
  }


  /**
   * Generate JavaScript bundle loader dynamically.
   * @param wasmFiles Array of compilation results
   * @param bundleOutputPath Path where the bundle JS will be saved
   * @returns JavaScript content string
   * @private
   */
  private generateBundleLoader(
    wasmFiles: WasmCompilationResult[],
    bundleOutputPath: string
  ): string {
    const bundleDir = path.dirname(bundleOutputPath);

    // Generate import statements for each module's JS glue code (if it exists)
    const imports = wasmFiles
      .filter(file => file.jsPath) // Only include files that generated JS bindings
      .map(file => {
        const moduleVarName = path.basename(file.sourcePath, path.extname(file.sourcePath))
          .replace(/[^a-zA-Z0-9_]/g, '_'); // Sanitize name
        // Calculate relative path from bundle output dir to the JS glue file
        const relativeJsPath = `./${path.relative(bundleDir, file.jsPath as string).replace(/\\/g, '/')}`;
        return `import * as ${moduleVarName}_module from '${relativeJsPath}';`;
      }).join('\n');

    // Generate the structure holding the instantiated modules
    const moduleInitializers = wasmFiles
       .filter(file => file.jsPath)
       .map(file => {
          const moduleVarName = path.basename(file.sourcePath, path.extname(file.sourcePath))
             .replace(/[^a-zA-Z0-9_]/g, '_');
          // Assuming the JS glue code exports an 'instantiate' function
          return `  try {
    // Pass necessary imports if required by the WASM module
    const importObject = { /* ... provide imports if needed ... */ };
    const { instance, module } = await ${moduleVarName}_module.instantiate(importObject);
    modules.${moduleVarName} = instance.exports; // Expose exports
    console.log('Loaded WebAssembly module: ${moduleVarName}');
  } catch (err) {
    console.error('Failed to load WebAssembly module: ${moduleVarName}', err);
    // Optionally re-throw or handle error
  }`;
       }).join('\n\n');

    // Generate exports for the instantiated modules
    const exports = wasmFiles
      .filter(file => file.jsPath)
      .map(file => {
        const moduleVarName = path.basename(file.sourcePath, path.extname(file.sourcePath))
          .replace(/[^a-zA-Z0-9_]/g, '_');
        return `  ${moduleVarName}: modules.${moduleVarName},`;
      }).join('\n');

    // Construct the final JS bundle content
    return `/**
 * WebAssembly Bundle Loader
 * Auto-generated by WasmProcessorService
 */
${imports}

let initializedModules = null;

/**
 * Initialize all WebAssembly modules asynchronously.
 * Ensures initialization happens only once.
 * @returns Promise resolving to an object containing all instantiated module exports.
 */
export async function initializeWasmModules() {
  if (initializedModules) {
    return initializedModules;
  }

  const modules = {};

${moduleInitializers}

  initializedModules = modules;
  return initializedModules;
}

/**
 * Access the initialized modules. Call initializeWasmModules() first.
 * @returns Object containing all instantiated module exports, or null if not initialized.
 */
export function getWasmModules() {
  return initializedModules;
}

// Example of exporting specific functions if needed, requires knowing the exports
// export const add = () => initializedModules?.math_module?.add;

// Alternatively, export the modules themselves for direct access
export const wasm = () => initializedModules;
`;
  }


  /**
   * Generate example HTML file to load and test the WASM bundle.
   * @param wasmFiles Array of compilation results
   * @param bundleJsFileName The filename of the generated JS bundle
   * @returns HTML content string
   * @private
   */
  private generateHtmlExample(
    wasmFiles: WasmCompilationResult[],
    bundleJsFileName: string
  ): string {
    // Generate table rows for module status
    const moduleDescriptions = wasmFiles.map((file) => {
      const name = path.basename(file.sourcePath, path.extname(file.sourcePath))
        .replace(/[^a-zA-Z0-9_]/g, '_'); // Sanitize name

      // Try to find description from criticalAlgorithms list
      let description = 'Custom WASM Module'; // Default description
      const matchingAlgo = this.criticalAlgorithms.find(algo =>
         // Use path.basename to match just the filename part if sourcePath is relative
         path.basename(file.sourcePath) === path.basename(algo.sourcePath)
      );
      if (matchingAlgo) {
        description = matchingAlgo.description;
      }

      return `      <tr>
        <td>${name}</td>
        <td>${description}</td>
        <td>${(file.wasmSize / 1024).toFixed(2)} KB</td>
        <td id="${name}-status" class="status-waiting">Waiting...</td>
      </tr>`;
    }).join('\n');

    // Generate script content to initialize and potentially test modules
    const testScript = `
    import { initializeWasmModules, getWasmModules } from './${bundleJsFileName}';

    async function run() {
      const resultsDiv = document.getElementById('results');
      resultsDiv.innerHTML = 'Initializing WebAssembly modules...';

      try {
        await initializeWasmModules();
        const modules = getWasmModules();

        resultsDiv.innerHTML = '<h2>Modules Initialized Successfully!</h2>';

        // Update status table
        Object.keys(modules).forEach(name => {
          const statusElement = document.getElementById(name + '-status');
          if (statusElement) {
            statusElement.textContent = 'Loaded';
            statusElement.className = 'status-success';
          }
        });

        // --- Add Example Usage/Tests Here ---
        resultsDiv.innerHTML += '<h3>Example Tests:</h3>';
        let testResultsHTML = '<ul>';

        // Example: Test a function if 'math_module' exists and has 'add'
        if (modules.math_module && typeof modules.math_module.add === 'function') {
           try {
              const sum = modules.math_module.add(5, 7);
              testResultsHTML += \`<li>math_module.add(5, 7) = \${sum} (Expected: 12)</li>\`;
           } catch(e) {
              testResultsHTML += \`<li class="status-error">Error testing math_module.add: \${e.message}</li>\`;
           }
        } else {
           // Add placeholders or checks for other modules if needed
           // testResultsHTML += '<li>No specific tests found for loaded modules.</li>';
        }
         // Add more tests for other modules as needed...

        testResultsHTML += '</ul>';
        resultsDiv.innerHTML += testResultsHTML;


      } catch (error) {
        resultsDiv.innerHTML = \`<div class="status-error"><h2>Error Initializing Modules</h2><pre>\${error.message}\n\${error.stack}</pre></div>\`;
        // Update status table to show errors
         wasmFiles.forEach(file => {
             const name = path.basename(file.sourcePath, path.extname(file.sourcePath)).replace(/[^a-zA-Z0-9_]/g, '_');
             const statusElement = document.getElementById(name + '-status');
             if (statusElement && statusElement.classList.contains('status-waiting')) {
                 statusElement.textContent = 'Failed';
                 statusElement.className = 'status-error';
             }
         });
      }
    }

    // Add wasmFiles data to the script scope for error reporting
    const wasmFiles = ${JSON.stringify(wasmFiles.map(f => ({ sourcePath: f.sourcePath })))};

    run();
    `;

    // Construct the final HTML content
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WebAssembly Modules Demo</title>
  <style>
    body { font-family: sans-serif; line-height: 1.5; margin: 20px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
    th, td { border: 1px solid #ccc; padding: 0.5em; text-align: left; }
    th { background-color: #eee; }
    .status-waiting { color: #888; }
    .status-success { color: green; font-weight: bold; }
    .status-error { color: red; font-weight: bold; }
    pre { background-color: #f0f0f0; padding: 1em; border-radius: 4px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>WebAssembly Modules Demo</h1>

  <h2>Module Status</h2>
  <table>
    <thead>
      <tr><th>Module Name</th><th>Description</th><th>Size</th><th>Status</th></tr>
    </thead>
    <tbody>
${moduleDescriptions}
    </tbody>
  </table>

  <div id="results">Loading...</div>

  <script type="module">
${testScript}
  </script>
</body>
</html>`;
  }

}
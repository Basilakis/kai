/**
 * External Library Integration Module
 * 
 * This module integrates external libraries for tile pattern recognition.
 * It provides adapters and configuration.
 * NOTE: This version uses the structure for calling REAL libraries via placeholder functions (getTensorFlow, etc.),
 * but the internal logic of the integration classes uses SIMULATED objects (tf_sim, cv_sim, pdfjs_sim) 
 * for demonstration purposes without requiring actual dependencies.
 */

import * as path from 'path';
import * as fs from 'fs'; // Changed import to include synchronous methods

// --- Real Library Imports (Requires installation) ---
// Use require for dynamic loading and error handling if not installed
let tf: any = null;
let cv: any = null;
let pdfjsLib: any = null;


// --- Interfaces (Representing Real Library Types - Exported) ---
export interface TF_Tensor { 
  dataSync: () => Float32Array | Int32Array | Uint8Array;
  arraySync: () => any[];
  shape: number[];
  dtype: string; // Added dtype
  toInt: () => TF_Tensor; // Added toInt method
  dispose: () => void;
}
export interface TF_LayersModel {
  predict: (inputs: TF_Tensor | { [key: string]: TF_Tensor }) => TF_Tensor | TF_Tensor[]; 
  dispose: () => void;
}
// Make CV types internal if not needed externally, or export if they are
interface CV_Mat { 
  readonly rows: number; readonly cols: number; readonly type: number; readonly channels?: number; 
  cvtColor: (code: number) => CV_Mat;
  filter2D: (ddepth: number, kernel: CV_Mat) => CV_Mat;
  meanStdDev: () => { mean: CV_Mat, stddev: CV_Mat };
  canny: (threshold1: number, threshold2: number) => CV_Mat;
  countNonZero: () => number;
  release: () => void;
  convertTo: (type: number) => CV_Mat;
  splitChannels: () => CV_Mat[];
  set: (row: number, col: number, value: number | number[]) => void; 
  copyTo: (dest: CV_Mat, mask?: CV_Mat) => void; 
  absdiff?: (otherMat: CV_Mat) => CV_Mat;
  gaussianBlur?: (ksize: CV_Size, sigmaX: number, sigmaY?: number) => CV_Mat;
  laplacian?: (ddepth: number) => CV_Mat;
  resize?: (dsize: CV_Size, fx?: number, fy?: number, interpolation?: number) => CV_Mat;
  warpAffine?: (M: CV_Mat, dsize: CV_Size, flags?: number, borderMode?: number, borderValue?: any) => CV_Mat;
  warpPerspective?: (M: CV_Mat, dsize: CV_Size, flags?: number, borderMode?: number, borderValue?: any) => CV_Mat;
  at?: (row: number, col: number) => number | number[];
  data?: Uint8Array; 
}
interface CV_Size { width: number; height: number; }
// Extend CLAHE interface if needed by applyCLAHE method
interface CV_CLAHE { apply: (src: CV_Mat) => CV_Mat; } 
interface CV_HOGDescriptor { compute: (img: CV_Mat) => Float32Array; }
interface PDF_PageViewport { width: number; height: number; }
interface PDF_PageRenderTask { promise: Promise<void>; }
interface PDF_TextItem { str: string; transform: number[]; width: number; height: number; dir: string; fontName: string; }
interface PDF_TextContent { items: PDF_TextItem[]; styles: any; }
interface PDF_OperatorList { fnArray: number[]; argsArray: any[]; }
interface PDF_PageProxy { 
  pageNumber: number; 
  getViewport: (options: { scale: number }) => PDF_PageViewport;
  render: (options: { canvasContext: any, viewport: PDF_PageViewport }) => PDF_PageRenderTask;
  getTextContent: () => Promise<PDF_TextContent>;
  getOperatorList: () => Promise<PDF_OperatorList>;
}
interface PDF_DocumentProxy { numPages: number; getPage: (pageNum: number) => Promise<PDF_PageProxy>; destroy: () => void; }

// --- Configuration ---
export interface ExternalLibraryConfig { 
  tensorflowModelPath: string;
  opencvDataPath: string; 
  pdfjsWorkerPath: string; 
  useGPU: boolean;
  maxMemoryMB: number;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}
export const defaultConfig: ExternalLibraryConfig = { 
  tensorflowModelPath: path.join(process.cwd(), 'models'),
  opencvDataPath: path.join(process.cwd(), 'data', 'opencv'), 
  pdfjsWorkerPath: path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.js'), 
  useGPU: true,
  maxMemoryMB: 4096,
  logLevel: 'info'
};


// --- Integration Classes ---

export class TensorFlowIntegration {
  private config: ExternalLibraryConfig;
  private tf: any = null; // Will hold the imported library
  private initialized: 'no' | 'initializing' | 'yes' | 'failed' = 'no';
  private modelCache: Map<string, TF_LayersModel> = new Map();

  constructor(config: Partial<ExternalLibraryConfig> = {}) { this.config = { ...defaultConfig, ...config }; }

  public async initialize(): Promise<void> {
    if (this.initialized === 'yes' || this.initialized === 'initializing') return;
    this.initialized = 'initializing';
    console.log(`Initializing TensorFlowIntegration...`);
    try {
      // Dynamically require the library
      this.tf = require('@tensorflow/tfjs-node'); // Or require('@tensorflow/tfjs-node-gpu') based on config.useGPU
      if (this.config.useGPU) {
        try {
          require('@tensorflow/tfjs-node-gpu'); // Attempt to load GPU bindings
          await this.tf.setBackend('tensorflow'); // Use tensorflow backend which utilizes GPU if available
          console.log('TensorFlow: Using GPU backend.');
        } catch (gpuError) {
          console.warn('TensorFlow: GPU backend failed to load, falling back to CPU.', gpuError);
          await this.tf.setBackend('cpu');
        }
      } else {
        await this.tf.setBackend('cpu');
        console.log('TensorFlow: Using CPU backend.');
      }
      // Set memory limits if needed (Note: TFJS Node memory management is complex)
      // this.tf.ENV.set('WEBGL_MAX_TEXTURE_SIZE', this.config.maxMemoryMB); // Example, might vary

      console.log('TensorFlowIntegration initialized successfully.');
      this.initialized = 'yes';
    } catch (error) {
      console.error('TensorFlowIntegration initialization failed:', error);
      this.initialized = 'failed';
      this.tf = null; // Ensure tf is null if failed
      // Optionally re-throw or handle the error based on application needs
      throw new Error(`TensorFlow (@tensorflow/tfjs-node or -gpu) failed to load. Please ensure it is installed. Error: ${error}`);
    }
  }

  private ensureInitialized(): void {
    if (this.initialized !== 'yes') {
      throw new Error('TensorFlowIntegration is not initialized or failed to initialize.');
    }
  }

  public async loadModel(modelName: string): Promise<TF_LayersModel> {
    this.ensureInitialized();
    const modelPath = `file://${path.join(this.config.tensorflowModelPath, modelName, 'model.json')}`;
    if (this.modelCache.has(modelPath)) {
      return this.modelCache.get(modelPath)!;
    }

    console.log(`Loading model: ${modelName} from ${modelPath}`);
    try {
      const model = await this.tf.loadGraphModel(modelPath);
      this.modelCache.set(modelPath, model);
      console.log(`Model ${modelName} loaded successfully.`);
      return model;
    } catch (error) {
      console.error(`Failed to load model ${modelName}:`, error);
      throw error;
    }
  }

  public async runInference(model: TF_LayersModel, input: TF_Tensor | { [key: string]: TF_Tensor }): Promise<TF_Tensor> {
    this.ensureInitialized();
    // console.log('Running inference...'); // Reduced logging verbosity
    try {
      const result = model.predict(input);
      if (Array.isArray(result)) {
        // Assuming the first output is the primary one if multiple outputs
        return result[0] || this.tf.tensor([]); 
      } else if (result) {
        return result;
      } else {
         // Handle cases where predict might return undefined or null
        console.warn('Inference returned no result, returning empty tensor.');
        return this.tf.tensor([]);
      }
    } catch (error) {
      console.error('Inference failed:', error);
      throw error;
    }
  }

  public createTensor(data: any, shape?: number[], dtype?: string): TF_Tensor {
    this.ensureInitialized();
    // console.log(`Creating tensor...`); // Reduced logging verbosity
    try {
      return this.tf.tensor(data, shape, dtype);
    } catch (error) {
      console.error('Failed to create tensor:', error);
      throw error;
    }
  }

  public decodeImage(buffer: Buffer, channels?: number): TF_Tensor {
    this.ensureInitialized();
    // console.log(`Decoding image buffer (channels: ${channels ?? 'auto'})...`); // Reduced logging verbosity
    try {
      return this.tf.node.decodeImage(buffer, channels);
    } catch (error) {
      console.error('Failed to decode image:', error);
      throw error;
    }
  }

  public async encodePng(tensor: TF_Tensor): Promise<Buffer> {
    this.ensureInitialized();
    // console.log(`Encoding tensor to PNG...`); // Reduced logging verbosity
    try {
      // Ensure tensor is int32 before encoding if necessary, TF.js node expects int32 for encode*
      const intTensor = tensor.dtype === 'int32' ? tensor : tensor.toInt();
      const buffer = await this.tf.node.encodePng(intTensor);
      // Dispose intermediate tensor if created
      if (intTensor !== tensor) {
        intTensor.dispose();
      }
      return buffer;
    } catch (error) {
      console.error('Failed to encode PNG:', error);
      throw error;
    }
  }

  public dispose(): void {
    console.log('Disposing TensorFlowIntegration resources...');
    this.modelCache.forEach(model => model.dispose());
    this.modelCache.clear();
    this.initialized = 'no'; // Reset state on dispose
    this.tf = null; // Clear library reference
  }
}

export class OpenCVIntegration {
  private config: ExternalLibraryConfig;
  private cv: any = null; // Will hold the imported library
  private initialized: 'no' | 'initializing' | 'yes' | 'failed' = 'no';

  constructor(config: Partial<ExternalLibraryConfig> = {}) { this.config = { ...defaultConfig, ...config }; }

  public async initialize(): Promise<void> {
    if (this.initialized === 'yes' || this.initialized === 'initializing') return;
    this.initialized = 'initializing';
    console.log(`Initializing OpenCVIntegration...`);
    try {
      // Dynamically require the library
      this.cv = require('opencv4nodejs');
      console.log('OpenCVIntegration initialized successfully.');
      this.initialized = 'yes';
    } catch (error) {
      console.error('OpenCVIntegration initialization failed:', error);
      this.initialized = 'failed';
      this.cv = null;
      throw new Error(`OpenCV (opencv4nodejs) failed to load. Please ensure it is installed and configured correctly. Error: ${error}`);
    }
  }

  private ensureInitialized(): void {
    if (this.initialized !== 'yes') {
      throw new Error('OpenCVIntegration is not initialized or failed to initialize.');
    }
  }

  // --- Public Accessors for Constants ---
  public get CV_8UC1(): number { this.ensureInitialized(); return this.cv.CV_8UC1; }
  public get CV_8UC3(): number { this.ensureInitialized(); return this.cv.CV_8UC3; } // Added CV_8UC3
  public get CV_32F(): number { this.ensureInitialized(); return this.cv.CV_32F; }
  public get COLOR_BGR2GRAY(): number { this.ensureInitialized(); return this.cv.COLOR_BGR2GRAY; }
  public get COLOR_BGR2Lab(): number { this.ensureInitialized(); return this.cv.COLOR_BGR2Lab; }
  public get COLOR_Lab2BGR(): number { this.ensureInitialized(); return this.cv.COLOR_Lab2BGR; }
  // Add other constants as needed

  // --- Public Accessors for Object Creation ---
  public createMat(rows: number, cols: number, type: number, data?: any): CV_Mat {
      this.ensureInitialized();
      if (data) {
          // Note: Creating Mat from JS array/buffer might need specific format in opencv4nodejs
          // Ensure data is in a compatible format (e.g., Buffer or typed array)
          return new this.cv.Mat(data, rows, cols, type);
      } else {
          return new this.cv.Mat(rows, cols, type);
      }
  }
  // Added createMatFromData for clarity when data source is known
  public createMatFromData(data: Buffer | ArrayLike<number> | CV_Mat[], rows: number, cols: number, type: number): CV_Mat {
      this.ensureInitialized();
      // opencv4nodejs Mat constructor can often handle an array of Mats for merging
      return new this.cv.Mat(data, rows, cols, type); 
  }
  public createSize(width: number, height: number): CV_Size {
      this.ensureInitialized();
      return new this.cv.Size(width, height);
  }
  public createCLAHE(clipLimit: number, tileGridSize: CV_Size): CV_CLAHE {
      this.ensureInitialized();
      return new this.cv.CLAHE(clipLimit, tileGridSize);
  }
  public createHOGDescriptor(): CV_HOGDescriptor {
      this.ensureInitialized();
      return new this.cv.HOGDescriptor();
  }
  // --- End Accessors ---


  // Public methods using the initialized cv object
  public async decodeImage(image: Buffer): Promise<CV_Mat> {
    this.ensureInitialized();
    try {
      return this.cv.imdecode(image);
    } catch (error) {
      console.error('OpenCV image decoding failed:', error);
      throw error;
    }
  }

  public async encodeImage(format: string, mat: CV_Mat): Promise<Buffer> {
    this.ensureInitialized();
    try {
      const ext = format.startsWith('.') ? format : `.${format}`;
      // Ensure mat is a real cv.Mat object before encoding
      if (!(mat instanceof this.cv.Mat)) {
          // Attempt to handle simulated Mat for encoding (e.g., encode a blank image)
          if (mat && mat.rows && mat.cols && typeof mat.type === 'number') { // Check type is number for real type
              console.warn("Attempting to encode a simulated Mat object. Result may be incorrect.");
              const blankMat = this.createMat(mat.rows, mat.cols, mat.type); // Create a real blank mat
              const buffer = this.cv.imencode(ext, blankMat);
              blankMat.release();
              return buffer;
          }
          throw new Error("Invalid object passed to encodeImage. Expected OpenCV Mat.");
      }
      return this.cv.imencode(ext, mat);
    } catch (error) {
      console.error(`OpenCV image encoding to ${format} failed:`, error);
      throw error;
    }
  }

  /**
   * Apply Local Binary Pattern (LBP) transform to an image
   * @param image Input image buffer
   * @param options Optional parameters for LBP calculation
   * @returns CV_Mat with LBP result
   */
  public async applyLBP(
    image: Buffer, 
    options: { 
      radius?: number, 
      neighbors?: number, 
      method?: 'basic' | 'uniform' | 'rotation-invariant' | 'uniform-rotation-invariant' 
    } = {}
  ): Promise<CV_Mat> {
    this.ensureInitialized();
    console.log('Applying LBP...');
    
    const radius = options.radius || 1;
    const neighbors = options.neighbors || 8;
    const method = options.method || 'basic'; 
    
    let mat: CV_Mat | null = null;
    let gray: CV_Mat | null = null;
    let lbpMat: CV_Mat | null = null;

    try {
      mat = await this.decodeImage(image);
      if (!mat) throw new Error('Failed to decode image');
      
      gray = mat.cvtColor(this.COLOR_BGR2GRAY);
      if (!gray) throw new Error('Failed to convert to grayscale');

      // --- Attempt Native OpenCV LBP (Optimization) ---
      try {
        if (typeof this.cv.computeLBP === 'function') { 
          console.log('Attempting native OpenCV LBP computation...');
          // lbpMat = this.cv.computeLBP(gray, radius, neighbors); 
          console.warn('Native OpenCV LBP function (e.g., computeLBP) not confirmed/used. Falling back to JS implementation.');
          lbpMat = null; 
        } else {
           console.log('Native OpenCV LBP function not found. Using JS implementation.');
           lbpMat = null;
        }
      } catch (nativeError) {
        console.warn('Native OpenCV LBP failed, falling back to JS implementation:', nativeError);
        lbpMat = null; 
      }
      // --- End Native Attempt ---

      // --- JS Implementation (Fallback) ---
      if (!lbpMat) {
        console.log('Executing JS LBP implementation...');
        lbpMat = this.createMat(gray.rows, gray.cols, this.CV_8UC1); // Use accessor
        if (!lbpMat) throw new Error('Failed to create LBP matrix');
        
        const rows = gray.rows;
        const cols = gray.cols;
        
        let uniformPatternTable: number[] | null = null;
        if (method === 'uniform' || method === 'uniform-rotation-invariant') {
          uniformPatternTable = this.generateUniformPatternTable(neighbors);
        }
        
        const lbpData = new Uint8Array(rows * cols);
        const border = Math.ceil(radius);

        for (let y = border; y < rows - border; y++) {
          for (let x = border; x < cols - border; x++) {
            if (!gray.at) throw new Error('Gray matrix missing .at() method');
            const centerPixel = gray.at(y, x) as number;
            let lbpCode = 0;

            if (method === 'basic') {
              lbpCode = this.computeBasicLBP(gray, centerPixel, x, y, radius, neighbors);
            } else if (method === 'uniform') {
              const basicCode = this.computeBasicLBP(gray, centerPixel, x, y, radius, neighbors);
              if (uniformPatternTable && typeof basicCode === 'number') {
                const patternValue = uniformPatternTable[basicCode];
                lbpCode = typeof patternValue === 'number' ? patternValue : 0;
              }
            } else if (method === 'rotation-invariant') {
              const basicCode = this.computeBasicLBP(gray, centerPixel, x, y, radius, neighbors);
              lbpCode = this.computeRotationInvariantLBP(basicCode, neighbors);
            } else if (method === 'uniform-rotation-invariant') {
              const basicCode = this.computeBasicLBP(gray, centerPixel, x, y, radius, neighbors);
              if (uniformPatternTable && typeof basicCode === 'number') {
                const uniformCode = uniformPatternTable[basicCode];
                lbpCode = this.computeRotationInvariantLBP(typeof uniformCode === 'number' ? uniformCode : 0, neighbors);
              }
            }
            lbpData[y * cols + x] = lbpCode;
          }
        }
        
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const isBorderPixel = (y < border || x < border || y >= rows - border || x >= cols - border);
            const pixelValue = isBorderPixel ? 0 : lbpData[y * cols + x];
            if (lbpMat && typeof lbpMat.set === 'function') {
              const safePixelValue = typeof pixelValue === 'number' ? pixelValue : 0;
              lbpMat.set(y, x, safePixelValue);
            }
          }
        }
        
        if (!lbpMat) throw new Error('LBP matrix is null after JS implementation');
      }
      // --- End JS Implementation ---
      
      return lbpMat; 

    } catch (error) {
      console.error('LBP feature extraction failed:', error);
      lbpMat?.release(); 
      throw error;
    } finally {
      gray?.release();
      mat?.release();
    }
  }
  
  /** Compute basic LBP code (Helper) */
  private computeBasicLBP(gray: CV_Mat, centerPixel: number, x: number, y: number, radius: number, neighbors: number): number { /* ... same as before ... */ 
    let lbpCode = 0;
    if (!gray.at) throw new Error('Gray matrix missing .at() method');
    for (let n = 0; n < neighbors; n++) {
      const angle = 2 * Math.PI * n / neighbors;
      const samplingX = Math.round(x + radius * Math.cos(angle));
      const samplingY = Math.round(y - radius * Math.sin(angle));
      let neighborValue = 0;
      try {
        if (samplingY >= 0 && samplingY < gray.rows && samplingX >= 0 && samplingX < gray.cols) {
          neighborValue = gray.at(samplingY, samplingX) as number;
        }
      } catch (e) { neighborValue = 0; }
      if (neighborValue >= centerPixel) { lbpCode |= (1 << n); }
    }
    return lbpCode;
  }
  /** Compute rotation-invariant LBP (Helper) */
  private computeRotationInvariantLBP(lbpCode: number, neighbors: number): number { /* ... same as before ... */ 
    let minCode = lbpCode;
    for (let i = 1; i < neighbors; i++) {
      const rotatedCode = ((lbpCode >> i) | (lbpCode << (neighbors - i))) & ((1 << neighbors) - 1);
      minCode = Math.min(minCode, rotatedCode);
    }
    return minCode;
  }
  /** Generate uniform pattern table (Helper) */
  private generateUniformPatternTable(neighbors: number): number[] { /* ... same as before ... */ 
    const numPatterns = 1 << neighbors;
    const lookupTable = new Array(numPatterns).fill(0);
    let uniformPatternCount = 1; 
    for (let i = 0; i < numPatterns; i++) {
      const transitions = this.countBitTransitions(i, neighbors);
      if (transitions <= 2) { lookupTable[i] = uniformPatternCount++; } 
      else { lookupTable[i] = 0; }
    }
    return lookupTable;
  }
  /** Count bit transitions (Helper) */
  private countBitTransitions(pattern: number, bits: number): number { /* ... same as before ... */ 
    let count = 0;
    let previousBit = pattern & 1;
    const firstBit = pattern & 1;
    const lastBit = (pattern >> (bits - 1)) & 1;
    if (lastBit !== firstBit) count++;
    for (let i = 1; i < bits; i++) {
      const currentBit = (pattern >> i) & 1;
      if (currentBit !== previousBit) count++;
      previousBit = currentBit;
    }
    return count;
  }

  public async applyGaborFilter(image: Buffer, params: { ksize: number, sigma: number, theta: number, lambda: number, gamma: number, psi: number }): Promise<CV_Mat> {
    this.ensureInitialized();
    let mat: CV_Mat | null = null, gray: CV_Mat | null = null, kernel: CV_Mat | null = null, filtered: CV_Mat | null = null;
    try {
      mat = await this.decodeImage(image);
      gray = mat.cvtColor(this.COLOR_BGR2GRAY); // Use accessor
      const ksize = this.createSize(params.ksize, params.ksize); // Use accessor
      kernel = this.cv.getGaborKernel(ksize, params.sigma, params.theta, params.lambda, params.gamma, params.psi); 

      if (!kernel) throw new Error('Failed to generate Gabor kernel');

      let kernel32f = kernel;
      if (kernel.type !== this.CV_32F) { // Use accessor
         kernel32f = kernel.convertTo(this.CV_32F); // Use accessor
      }
      filtered = gray.filter2D(-1, kernel32f); 

      if (kernel32f !== kernel) kernel32f.release();

      return filtered; 
    } catch (error) {
      console.error('Gabor filter application failed:', error);
      kernel?.release(); gray?.release(); mat?.release(); filtered?.release(); 
      throw error;
    } finally {
      kernel?.release(); gray?.release(); mat?.release();
    }
  }

  /** Calculate GLCM features */
  public async calculateGLCM( /* ... parameters same as before ... */ 
    image: Buffer, 
    options: { 
      grayLevels?: number, 
      distances?: number[], 
      angles?: number[],
      includeAdvancedFeatures?: boolean
    } = {}
  ): Promise<any> { // Return type simplified to 'any' for now
    this.ensureInitialized();
    console.log('Calculating GLCM features...');
    
    const grayLevels = options.grayLevels || 8;
    const distances = options.distances || [1];
    const angles = options.angles || [0, 45, 90, 135]; 
    const includeAdvancedFeatures = options.includeAdvancedFeatures || false;
    
    let mat: CV_Mat | null = null;
    let gray: CV_Mat | null = null;
    let nativeFeatures: any = null; 
    
    try {
      mat = await this.decodeImage(image);
      if (!mat) throw new Error('Failed to decode image');
      
      gray = mat.cvtColor(this.COLOR_BGR2GRAY); // Use accessor
      if (!gray) throw new Error('Failed to convert to grayscale');

      // --- Attempt Native OpenCV GLCM (Optimization) ---
      try {
        if (typeof this.cv.computeGLCMFeatures === 'function') { 
          console.log('Attempting native OpenCV GLCM computation...');
          // nativeFeatures = this.cv.computeGLCMFeatures(gray, distances, angles, grayLevels, includeAdvancedFeatures);
          console.warn('Native OpenCV GLCM function not confirmed/used. Falling back to JS implementation.');
        } else {
           console.log('Native OpenCV GLCM function not found. Using JS implementation.');
        }
      } catch (nativeError) {
         console.warn('Native OpenCV GLCM failed, falling back to JS implementation:', nativeError);
      }
      // --- End Native Attempt ---

      // --- JS Implementation (Fallback) ---
      if (!nativeFeatures) {
        console.log('Executing JS GLCM implementation...');
        const rows = gray.rows;
        const cols = gray.cols;
        
        const offsetsMap: {[key: string]: [number, number][]} = {};
        for (const angle of angles) {
          for (const distance of distances) {
            const angleKey = `${angle}_${distance}`;
            const radians = angle * (Math.PI / 180); 
            offsetsMap[angleKey] = [[-Math.round(distance * Math.sin(radians)), Math.round(distance * Math.cos(radians))]];
          }
        }
        
        if (!gray.at) throw new Error('Gray matrix missing .at() method');
        
        const quantizedImage = new Uint8Array(rows * cols);
        const binSize = 256 / grayLevels;
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const value = gray.at(y, x) as number;
            const scaledValue = typeof value === 'number' ? value : 0;
            quantizedImage[y * cols + x] = Math.min(grayLevels - 1, Math.floor(scaledValue / binSize));
          }
        }
        
        let totalContrast = 0, totalDissimilarity = 0, totalHomogeneity = 0, totalEnergy = 0, totalCorrelation = 0;
        let totalEntropy = 0, totalClusterShade = 0, totalClusterProminence = 0, totalMaxProb = 0, totalIDM = 0, totalAutoCorrelation = 0;
        let combinationCount = 0;
        
        for (const angle of angles) {
          for (const distance of distances) {
            const angleKey = `${angle}_${distance}`;
            const offsets = offsetsMap[angleKey];
            if (!offsets || offsets.length === 0) continue;
            
            const glcm = this.createGLCMMatrix(quantizedImage, rows, cols, grayLevels, offsets);
            const features = this.calculateGLCMFeatures(glcm, grayLevels, includeAdvancedFeatures);
            
            totalContrast += features.contrast;
            totalDissimilarity += features.dissimilarity;
            totalHomogeneity += features.homogeneity;
            totalEnergy += features.energy;
            totalCorrelation += features.correlation;
            if (includeAdvancedFeatures) {
              totalEntropy += features.entropy || 0;
              totalClusterShade += features.clusterShade || 0;
              totalClusterProminence += features.clusterProminence || 0;
              totalMaxProb += features.maximumProbability || 0;
              totalIDM += features.inverseDifferenceMoment || 0;
              totalAutoCorrelation += features.autoCorrelation || 0;
            }
            combinationCount++;
          }
        }
        
        const result: any = {
          contrast: totalContrast / combinationCount,
          dissimilarity: totalDissimilarity / combinationCount,
          homogeneity: totalHomogeneity / combinationCount,
          energy: totalEnergy / combinationCount,
          correlation: totalCorrelation / combinationCount
        };
        if (includeAdvancedFeatures) {
          result.entropy = totalEntropy / combinationCount;
          result.clusterShade = totalClusterShade / combinationCount;
          result.clusterProminence = totalClusterProminence / combinationCount;
          result.maximumProbability = totalMaxProb / combinationCount;
          result.inverseDifferenceMoment = totalIDM / combinationCount;
          result.autoCorrelation = totalAutoCorrelation / combinationCount;
        }
        nativeFeatures = result; 
      }
      // --- End JS Implementation ---

      return nativeFeatures; 

    } catch (error) {
      console.error('GLCM feature extraction failed:', error);
      throw error;
    } finally {
      gray?.release();
      mat?.release();
    }
  }
  
  /** Create GLCM matrix (Helper) */
  private createGLCMMatrix(quantizedImage: Uint8Array, rows: number, cols: number, grayLevels: number, offsets: [number, number][]): number[][] { /* ... same as before ... */ 
    const glcm = Array(grayLevels).fill(0).map(() => Array(grayLevels).fill(0));
    const maxOffset = Math.max(...offsets.map(o => Math.max(Math.abs(o[0]), Math.abs(o[1]))));
    for (let y = maxOffset; y < rows - maxOffset; y++) {
      for (let x = maxOffset; x < cols - maxOffset; x++) {
        const pixelValue = quantizedImage[y * cols + x];
        for (const [dy, dx] of offsets) {
          const ny = y + dy; const nx = x + dx;
          if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
            const neighborValue = quantizedImage[ny * cols + nx];
            const safePixelValue = typeof pixelValue === 'number' ? pixelValue : 0;
            const safeNeighborValue = typeof neighborValue === 'number' ? neighborValue : 0;
            if (safePixelValue >= 0 && safePixelValue < grayLevels && safeNeighborValue >= 0 && safeNeighborValue < grayLevels && Array.isArray(glcm) && Array.isArray(glcm[safePixelValue])) {
              glcm[safePixelValue][safeNeighborValue]++;
            }
          }
        }
      }
    }
    const sum = glcm.reduce((total, row) => total + row.reduce((rowSum, val) => rowSum + val, 0), 0);
    const safeGetGlcmValue = (i: number, j: number): number => { /* ... */ return (i >= 0 && i < grayLevels && j >= 0 && j < grayLevels && Array.isArray(glcm) && Array.isArray(glcm[i]) && typeof glcm[i][j] === 'number') ? glcm[i][j] : 0; };
    const safeSetGlcmValue = (matrix: number[][], i: number, j: number, value: number): void => { /* ... */ if (Array.isArray(matrix) && i >= 0 && i < matrix.length && Array.isArray(matrix[i]) && j >= 0 && j < matrix[i].length) { matrix[i][j] = value; } };
    if (sum > 0 && Array.isArray(glcm)) {
      for (let i = 0; i < grayLevels; i++) {
        for (let j = 0; j < grayLevels; j++) {
          const currentValue = safeGetGlcmValue(i, j);
          if (currentValue > 0) { safeSetGlcmValue(glcm, i, j, currentValue / sum); }
        }
      }
    }
    return glcm;
  }
  /** Calculate GLCM features (Helper) */
  private calculateGLCMFeatures(glcm: number[][], grayLevels: number, includeAdvancedFeatures: boolean): any { /* ... same as before ... */ 
    const safeGetGlcmValue = (i: number, j: number): number => { /* ... */ return (i >= 0 && i < grayLevels && j >= 0 && j < grayLevels && Array.isArray(glcm) && Array.isArray(glcm[i]) && typeof glcm[i][j] === 'number') ? glcm[i][j] : 0; };
    let meanI = 0, meanJ = 0;
    for (let i = 0; i < grayLevels; i++) { for (let j = 0; j < grayLevels; j++) { const pij = safeGetGlcmValue(i, j); meanI += i * pij; meanJ += j * pij; } }
    let stdI = 0, stdJ = 0;
    for (let i = 0; i < grayLevels; i++) { for (let j = 0; j < grayLevels; j++) { const pij = safeGetGlcmValue(i, j); stdI += (i - meanI) * (i - meanI) * pij; stdJ += (j - meanJ) * (j - meanJ) * pij; } }
    stdI = Math.sqrt(stdI); stdJ = Math.sqrt(stdJ);
    let contrast = 0, dissimilarity = 0, homogeneity = 0, energy = 0, correlation = 0;
    let entropy = 0, clusterShade = 0, clusterProminence = 0, maxProb = 0, idm = 0, autoCorrelation = 0;
    for (let i = 0; i < grayLevels; i++) {
      for (let j = 0; j < grayLevels; j++) {
        const pij = safeGetGlcmValue(i, j);
        contrast += pij * (i - j) * (i - j);
        dissimilarity += pij * Math.abs(i - j);
        homogeneity += pij / (1 + (i - j) * (i - j));
        energy += pij * pij;
        if (stdI > 0 && stdJ > 0) { correlation += ((i - meanI) * (j - meanJ) * pij) / (stdI * stdJ); }
        if (includeAdvancedFeatures) {
          if (pij > 0) entropy -= pij * Math.log(pij);
          clusterShade += Math.pow(i + j - meanI - meanJ, 3) * pij;
          clusterProminence += Math.pow(i + j - meanI - meanJ, 4) * pij;
          maxProb = Math.max(maxProb, pij);
          idm += pij / (1 + Math.abs(i - j));
          autoCorrelation += i * j * pij;
        }
      }
    }
    const result: any = { contrast, dissimilarity, homogeneity, energy, correlation };
    if (includeAdvancedFeatures) { Object.assign(result, { entropy, clusterShade, clusterProminence, maximumProbability: maxProb, inverseDifferenceMoment: idm, autoCorrelation }); }
    return result;
  }

  public async extractHOG(image: Buffer): Promise<Float32Array> {
    this.ensureInitialized();
    let mat: CV_Mat | null = null;
    try {
      mat = await this.decodeImage(image);
      const hog = this.createHOGDescriptor(); // Use public accessor
      const descriptors = hog.compute(mat);
      return descriptors;
    } catch (error) {
      console.error('HOG feature extraction failed:', error);
      throw error;
    } finally {
      mat?.release();
    }
  }

  public async applyCLAHE(image: Buffer, clipLimit = 2.0, tileGridSize?: CV_Size): Promise<Buffer> {
    this.ensureInitialized();
    let mat: CV_Mat | null = null, lab: CV_Mat | null = null, l_channel: CV_Mat | null | undefined = null; 
    let claheApplied: CV_Mat | null = null, mergedLab: CV_Mat | null = null, finalRgb: CV_Mat | null = null;
    const gridSize = tileGridSize || this.createSize(8, 8); // Use public accessor
    let labPlanes: CV_Mat[] | null = null; 
    try {
      mat = await this.decodeImage(image);
      lab = mat.cvtColor(this.COLOR_BGR2Lab); // Use accessor
      if (!lab) throw new Error('Failed to convert image to Lab color space');

      labPlanes = lab.splitChannels(); 
      if (!labPlanes || labPlanes.length < 3) throw new Error('Failed to split Lab channels');
      l_channel = labPlanes[0]; 
      if (!l_channel) throw new Error('L channel is undefined after splitting Lab image'); // Added check

      const clahe = this.createCLAHE(clipLimit, gridSize); // Use public accessor
      claheApplied = clahe.apply(l_channel); // Pass validated l_channel

      if (!claheApplied || !labPlanes[1] || !labPlanes[2]) {
          throw new Error('One or more Lab planes are invalid for merging');
      }
      // Use createMatFromData accessor for merging - Requires careful check of opencv4nodejs API for merging
      // Assuming the constructor can handle an array of Mats for merging
      // Also use public accessor for CV_8UC3
      mergedLab = this.createMatFromData([claheApplied, labPlanes[1], labPlanes[2]], claheApplied.rows, claheApplied.cols, this.CV_8UC3); 
      if (!mergedLab) throw new Error('Failed to merge Lab channels');

      finalRgb = mergedLab.cvtColor(this.COLOR_Lab2BGR); // Use accessor
      if (!finalRgb) throw new Error('Failed to convert merged Lab image back to BGR');

      const outputBuffer = await this.encodeImage('.png', finalRgb);
      return outputBuffer;
    } catch (error) {
      console.error('CLAHE application failed:', error);
      throw error;
    } finally {
      mat?.release();
      lab?.release();
      l_channel?.release(); 
      labPlanes?.[1]?.release(); 
      labPlanes?.[2]?.release();
      claheApplied?.release();
      mergedLab?.release();
      finalRgb?.release();
    }
  }


  public dispose(): void {
    console.log('Disposing OpenCVIntegration resources...');
    this.initialized = 'no';
    this.cv = null;
  }
}

export class PDFIntegration {
  private config: ExternalLibraryConfig;
  private pdf: any = null; // Will hold the imported library
  private initialized: 'no' | 'initializing' | 'yes' | 'failed' = 'no';

  constructor(config: Partial<ExternalLibraryConfig> = {}) { this.config = { ...defaultConfig, ...config }; }

  public async initialize(): Promise<void> {
    if (this.initialized === 'yes' || this.initialized === 'initializing') return;
    this.initialized = 'initializing';
    console.log(`Initializing PDFIntegration...`);
    try {
      // Dynamically require the library
      this.pdf = require('pdfjs-dist/legacy/build/pdf.js');
      // Set worker path for Node.js environment
      this.pdf.GlobalWorkerOptions.workerSrc = this.config.pdfjsWorkerPath;
      // Verify worker path exists
      if (!fs.existsSync(this.config.pdfjsWorkerPath)) {
         console.warn(`PDF.js worker not found at: ${this.config.pdfjsWorkerPath}. Extraction might fail.`);
      }
      console.log('PDFIntegration initialized successfully.');
      this.initialized = 'yes';
    } catch (error) {
      console.error('PDFIntegration initialization failed:', error);
      this.initialized = 'failed';
      this.pdf = null;
      throw new Error(`PDF.js (pdfjs-dist) failed to load. Please ensure it is installed. Error: ${error}`);
    }
  }

   private ensureInitialized(): void {
    if (this.initialized !== 'yes') {
      throw new Error('PDFIntegration is not initialized or failed to initialize.');
    }
  }

  // Public methods will be refactored in subsequent steps to use this.pdf
  // For now, keep the placeholder logic structure but remove simulation calls

  public async extractImages(pdfBuffer: Buffer, options: { dpi?: number, pageRange?: [number, number], extractText?: boolean } = {}): Promise<Array<{ image: Buffer, pageNum: number, width: number, height: number, text?: string }>> {
    this.ensureInitialized();
    console.log(`Extracting images from PDF...`);
    
    const results: Array<{ image: Buffer, pageNum: number, width: number, height: number, text?: string }> = [];
    const dpi = options.dpi || 150;
    const scale = dpi / 72; // PDF uses 72 DPI internally
    const pageRange = options.pageRange || [1, 0]; // Default: all pages
    
    try {
      // Load the PDF document
      const loadingTask = this.pdf.getDocument({ data: pdfBuffer });
      const pdfDoc = await loadingTask.promise;
      
      // Determine page range
      const startPage = pageRange[0];
      const endPage = pageRange[1] > 0 ? Math.min(pageRange[1], pdfDoc.numPages) : pdfDoc.numPages;
      
      // Process each page in the range
      for (let i = startPage; i <= endPage; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale });
        
        // Create a virtual canvas using node-canvas or similar
        // For now, we'll use a simplified approach with direct rendering
        // In a production environment, you'd use node-canvas or similar
        try {
          // In Node.js, we need to use node-canvas or similar
          const { createCanvas } = require('canvas');
          const canvas = createCanvas(viewport.width, viewport.height);
          const context = canvas.getContext('2d');
          
          // Render the page to the canvas
          await page.render({
            canvasContext: context,
            viewport
          }).promise;
          
          // Convert canvas to image buffer
          const imageBuffer = canvas.toBuffer('image/png');
          
          // Extract text if requested
          let pageText: string | undefined;
          if (options.extractText) {
            const textContent = await page.getTextContent();
            pageText = textContent.items.map((item: PDF_TextItem) => item.str).join(' ');
          }
          
          results.push({
            image: imageBuffer,
            pageNum: i,
            width: viewport.width,
            height: viewport.height,
            text: pageText
          });
        } catch (error: unknown) {
          const canvasError = error as Error;
          console.warn(`Failed to render page ${i} to canvas: ${canvasError.message}`);
          console.warn("The 'canvas' package may not be installed. This is required for PDF rendering in Node.js.");
        }
      }
      
      // Clean up
      pdfDoc.destroy();
    } catch (error) {
      console.error('PDF image extraction failed:', error);
      throw error;
    }
    
    return results;
  }

  public async extractText(pdfBuffer: Buffer, options: { pageRange?: [number, number] } = {}): Promise<Array<{ pageNum: number, text: string, structures: Array<{ type: string, text: string, rect: any }> }>> {
    this.ensureInitialized();
    console.log(`Extracting text from PDF...`);
    
    const results: Array<{ pageNum: number, text: string, structures: Array<{ type: string, text: string, rect: any }> }> = [];
    const pageRange = options.pageRange || [1, 0]; // Default: all pages
    
    try {
      // Load the PDF document
      const loadingTask = this.pdf.getDocument({ data: pdfBuffer });
      const pdfDoc = await loadingTask.promise;
      
      // Determine page range
      const startPage = pageRange[0];
      const endPage = pageRange[1] > 0 ? Math.min(pageRange[1], pdfDoc.numPages) : pdfDoc.numPages;
      
      // Process each page in the range
      for (let i = startPage; i <= endPage; i++) {
        const page = await pdfDoc.getPage(i);
        
        // Get text content
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item: PDF_TextItem) => item.str).join(' ');
        
        // Get operator list for structure analysis
        const operatorList = await page.getOperatorList();
        
        // Analyze structure
        const structures = this.analyzeStructure(textContent, operatorList);
        
        results.push({
          pageNum: i,
          text,
          structures
        });
      }
      
      // Clean up
      pdfDoc.destroy();
    } catch (error) {
      console.error('PDF text extraction failed:', error);
      throw error;
    }
    
    return results;
  }

  // analyzeStructure remains internal and doesn't directly use the library object
  private analyzeStructure(textContent: PDF_TextContent, operatorList: PDF_OperatorList): Array<{ type: string, text: string, rect: any }> {
      const structures: Array<{ type: string, text: string, rect: any }> = [];
      let currentParagraph = ''; let currentRect: any = null;
      for(const item of textContent.items) {
          const x = item.transform?.[4] ?? 0; const y = item.transform?.[5] ?? 0;
          const w = item.width || 0; const h = item.height || 0;
          const startY = currentRect ? currentRect.y + currentRect.height : 0;
          if (!currentRect || Math.abs(y - startY) > h * 1.5) {
              if (currentParagraph) { structures.push({ type: 'paragraph', text: currentParagraph.trim(), rect: currentRect }); }
              currentParagraph = item.str || '';
              currentRect = { x, y, width: w, height: h };
          } else {
              currentParagraph += ' ' + (item.str || '');
              currentRect.width = Math.max(currentRect.width, x + w - currentRect.x);
              currentRect.height = Math.max(currentRect.height, y + h - currentRect.y);
          }
      }
      if (currentParagraph) { structures.push({ type: 'paragraph', text: currentParagraph.trim(), rect: currentRect }); }
      const firstStructure = structures[0];
      if (firstStructure?.text && typeof firstStructure.text === 'string') {
          if (firstStructure.text.length < 50) { firstStructure.type = 'heading'; }
      }
      return structures;
  }

  public dispose(): void {
    console.log('Disposing PDFIntegration resources...');
    this.initialized = 'no';
    this.pdf = null;
  }
}

export class ImageProcessingIntegration {
  private config: ExternalLibraryConfig;
  private initialized = false;
  private tfIntegration: TensorFlowIntegration;
  private opencvIntegration: OpenCVIntegration;

  constructor(config: Partial<ExternalLibraryConfig> = {}, tfIntegration?: TensorFlowIntegration, opencvIntegration?: OpenCVIntegration) { 
    this.config = { ...defaultConfig, ...config };
    this.tfIntegration = tfIntegration || new TensorFlowIntegration(this.config);
    this.opencvIntegration = opencvIntegration || new OpenCVIntegration(this.config);
  }
  public async initialize(): Promise<void> { 
    if (this.initialized) return;
    console.log(`Initializing ImageProcessingIntegration...`);
    await this.tfIntegration.initialize();
    await this.opencvIntegration.initialize();
    console.log('ImageProcessingIntegration initialized successfully');
    this.initialized = true;
  }
  public async applySuperResolution(image: Buffer): Promise<Buffer> { 
    await this.initialize();
    console.log('Applying Super Resolution (Structure Ready - Requires Dependencies)...');
    try {
      const model = await this.tfIntegration.loadModel('esrgan'); 
      const tensor = this.tfIntegration.decodeImage(image);
      const resultTensor = await this.tfIntegration.runInference(model, tensor);
      const outputBuffer = await this.tfIntegration.encodePng(resultTensor);
      tensor.dispose(); resultTensor.dispose();
      return outputBuffer;
    } catch (error) { console.error("Super Resolution failed:", (error as Error).message); return image; }
  }
  public async applyAdaptiveContrastEnhancement(image: Buffer, clipLimit = 2.0): Promise<Buffer> { 
    await this.initialize();
    console.log(`Applying Adaptive Contrast Enhancement (CLAHE - Structure Ready)...`);
    try { 
        // Use the public accessor for Size
        const gridSize = this.opencvIntegration.createSize(8, 8); 
        return await this.opencvIntegration.applyCLAHE(image, clipLimit, gridSize); 
    } 
    catch (error) { console.error("CLAHE failed:", (error as Error).message); return image; }
  }
  public async isolatePattern(image: Buffer): Promise<Buffer> { 
    await this.initialize();
    console.log('Isolating Pattern using TF segmentation model...');
    let tensor: TF_Tensor | null = null;
    let maskTensor: TF_Tensor | null = null;
    let inputMat: CV_Mat | null = null;
    let outputMat: CV_Mat | null = null;
    let cvMask: CV_Mat | null = null; // Declare cvMask here
    
    try {
      // 1. Load Segmentation Model
      const model = await this.tfIntegration.loadModel('segmentation'); 
      
      // 2. Decode Image and Run Inference
      tensor = this.tfIntegration.decodeImage(image);
      // Assuming model expects specific input shape/dtype, preprocessing might be needed here
      // e.g., resizing, normalizing: const processedTensor = preprocess(tensor);
      maskTensor = await this.tfIntegration.runInference(model, tensor); 
      if (!maskTensor) throw new Error("Inference did not return a mask tensor.");

      // 3. Apply Mask using OpenCV (Simulated)
      console.log("Applying segmentation mask (Simulated OpenCV)...");
      
      // --- Simulated Mask Application ---
      // a. Get mask shape and validate
      const maskShape = maskTensor.shape; // e.g., [height, width, 1] or [height, width]
      if (!maskShape || maskShape.length < 2 || typeof maskShape[0] !== 'number' || typeof maskShape[1] !== 'number' || maskShape[0] <= 0 || maskShape[1] <= 0) {
          throw new Error(`Invalid mask tensor shape received: ${JSON.stringify(maskShape)}`);
      }
      const height = maskShape[0];
      const width = maskShape[1];

      // b. Simulate getting mask data (assuming H, W, 1 shape and uint8 dtype)
      // In a real scenario: const maskDataTyped = maskTensor.dataSync() as Uint8Array;
      const maskDataSimulated = new Uint8Array(height * width);
      const centerX = Math.floor(width / 2);
      const centerY = Math.floor(height / 2);
      const radiusSq = Math.pow(Math.min(width, height) / 4, 2);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2) < radiusSq) {
            maskDataSimulated[y * width + x] = 255; // White circle
          } else {
            maskDataSimulated[y * width + x] = 0; // Black background
          }
        }
      }
      
      // c. Decode original image to OpenCV Mat
      inputMat = await this.opencvIntegration.decodeImage(image);
      if (!inputMat) throw new Error("Failed to decode input image for masking");

      // d. Create OpenCV Mat from simulated mask data using public accessor
      // Using CV_8UC1 constant via accessor
      cvMask = this.opencvIntegration.createMat(height, width, this.opencvIntegration.CV_8UC1, maskDataSimulated); 
      if (!cvMask) throw new Error("Failed to create OpenCV mask Mat (Simulated)");

      // e. Apply mask (Simulated - requires real Mat objects)
      // Use public accessor to create Mat
      outputMat = this.opencvIntegration.createMat(inputMat.rows, inputMat.cols, inputMat.type); 
      if (!outputMat) throw new Error("Failed to create output Mat (Simulated)");
      
      // Simulate copyTo - In reality, this modifies outputMat
      console.log("SIMULATING: inputMat.copyTo(outputMat, cvMask)"); 
      // --- End Simulated Mask Application ---

      // 4. Encode Result (Encode the SIMULATED outputMat if available, else inputMat)
      const matToEncode = outputMat || inputMat; // Use outputMat if created, else fallback
      if (!matToEncode) throw new Error("No valid Mat available for encoding");
      
      const outputBuffer = await this.opencvIntegration.encodeImage('.png', matToEncode); 
      
      return outputBuffer;
      
    } catch (error) { 
      console.error("Pattern Isolation failed:", (error as Error).message); 
      // Return original image on failure
      return image; 
    } finally {
      // Dispose tensors and release mats
      tensor?.dispose(); 
      maskTensor?.dispose();
      // Explicitly check if mats exist before releasing
      if (inputMat) inputMat.release();
      if (outputMat) outputMat.release(); // Release simulated or real mat
      if (cvMask) cvMask.release(); // Release the mask too
    }
  }
  public async extractWaveletFeatures(image: Buffer): Promise<{ coefficients: any, level: number }> { 
    await this.initialize();
    console.log('Extracting Wavelet Features (Placeholder)...');
    // TODO: Implement wavelet feature extraction using a dedicated library.
    // Options include:
    // 1. Integrating a JavaScript library like 'wavelet-ts'.
    // 2. Creating a Python bridge to use libraries like PyWavelets.
    
    // Simulate output structure based on a common 2D DWT (Discrete Wavelet Transform)
    const level = 1; // Example decomposition level
    const approxSize = 128; // Example size of coefficients at level 1 for a 256x256 input
    
    // Placeholder coefficients (cA: Approximation, cH: Horizontal detail, cV: Vertical detail, cD: Diagonal detail)
    // In a real implementation, these would be populated by the wavelet library.
    const coefficients = {
      [`level${level}`]: {
        cA: new Float32Array(approxSize * approxSize).fill(0.5), // Approximation coefficients
        cH: new Float32Array(approxSize * approxSize).fill(0.1), // Horizontal detail
        cV: new Float32Array(approxSize * approxSize).fill(0.1), // Vertical detail
        cD: new Float32Array(approxSize * approxSize).fill(0.05) // Diagonal detail
      }
      // Add more levels if multi-level decomposition is performed
    };
    
    return {
      coefficients: coefficients, // Structure might vary based on library used
      level: level 
    };
  }
  public dispose(): void { 
    console.log('Disposing ImageProcessingIntegration resources...');
    this.initialized = false;
  }
}

export class ExternalLibraryManager {
  private static instance: ExternalLibraryManager;
  private config: ExternalLibraryConfig;
  public tensorflow: TensorFlowIntegration; 
  public opencv: OpenCVIntegration;       
  public pdf: PDFIntegration;             
  public imageProcessing: ImageProcessingIntegration; 

  public static getInstance(config?: Partial<ExternalLibraryConfig>): ExternalLibraryManager { 
    if (!ExternalLibraryManager.instance) { ExternalLibraryManager.instance = new ExternalLibraryManager(config); } 
    else if (config) { ExternalLibraryManager.instance.updateConfig(config); }
    return ExternalLibraryManager.instance;
  }
  private constructor(config: Partial<ExternalLibraryConfig> = {}) { 
    this.config = { ...defaultConfig, ...config };
    this.tensorflow = new TensorFlowIntegration(this.config);
    this.opencv = new OpenCVIntegration(this.config);
    this.pdf = new PDFIntegration(this.config);
    this.imageProcessing = new ImageProcessingIntegration(this.config, this.tensorflow, this.opencv);
  }
  public updateConfig(config: Partial<ExternalLibraryConfig>): void { 
    this.config = { ...this.config, ...config };
    console.log("ExternalLibraryManager config updated.");
  }
  public getTensorFlow(): TensorFlowIntegration { return this.tensorflow; }
  public getOpenCV(): OpenCVIntegration { return this.opencv; }
  public getPDF(): PDFIntegration { return this.pdf; }
  public getImageProcessing(): ImageProcessingIntegration { return this.imageProcessing; }
  public async initializeAll(): Promise<void> { 
    console.log("Initializing all external library integrations...");
    await this.tensorflow.initialize();
    await this.opencv.initialize();
    await this.pdf.initialize();
    await this.imageProcessing.initialize(); 
    console.log("All external library integrations initialized.");
  }
  public disposeAll(): void { 
    console.log("Disposing all external library integrations...");
    this.tensorflow.dispose();
    this.opencv.dispose();
    this.pdf.dispose(); 
    this.imageProcessing.dispose(); 
    console.log("All external library integrations disposed.");
  }
}

export const libraryManager = ExternalLibraryManager.getInstance();
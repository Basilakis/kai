/**
 * Main entry point for the ML package
 * This file exports the functions that will be used by the server package
 * to interact with the ML components
 * 
 * The ML package provides functionality for:
 * - PDF processing and image extraction
 * - Material recognition using feature-based and ML-based approaches
 * - Vector embedding generation for similarity search
 * - Model training and evaluation
 * - Image segmentation for multiple tile detection
 * - Feedback loop for improving recognition over time
 * - Performance optimization for faster recognition
 * - Crawler data integration for training
 * - 3D reconstruction and visualization with Gaussian Splatting
 * - Improved text-to-3D generation
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { GaussianSplattingBridge } from './gaussian-splatting-bridge';
import { ImprovedTextTo3DBridge } from './improved-text-to-3d-bridge';
import { MaterialXBridge } from './materialx-bridge';

// Define the path to the Python scripts
const PYTHON_SCRIPTS_DIR = path.join(__dirname, '../python');

/**
 * Interface for image segmentation results
 */
export interface ImageSegmentationResult {
  input_image: string;
  segments_count: number;
  segment_paths: string[];
  segments: {
    id: number;
    bbox: number[];
    area: number;
    aspect_ratio: number;
    center: number[];
    confidence: number;
    path: string;
  }[];
  visualization_path?: string;
}

/**
 * Interface for feedback storage results
 */
export interface FeedbackStorageResult {
  status: string;
  feedback_id: string;
}

/**
 * Interface for model retraining results
 */
export interface ModelRetrainingResult {
  status: string;
  model_path: string;
  training_time: number;
  dataset_size: number;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
  };
}

/**
 * Interface for performance metrics
 */
export interface PerformanceMetricsResult {
  time_period: string;
  total_recognitions: number;
  feedback_distribution: Record<string, number>;
  accuracy: number;
  timestamp: string;
}

/**
 * Interface for performance optimization results
 */
export interface PerformanceOptimizationResult extends RecognitionResult {
  performance: {
    cached: boolean;
    optimized_image: boolean;
    parallel_processing: boolean;
    total_time: number;
  };
}

/**
 * Interface for PDF extraction results
 */
export interface PDFExtractionResult {
  images: {
    id: string;
    path: string;
    page: number;
    coordinates: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }[];
  text: {
    page: number;
    content: string;
    coordinates: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }[];
  metadata: Record<string, any>;
}

/**
 * Interface for image recognition results
 */
export interface RecognitionResult {
  matches: {
    materialId: string;
    confidence: number;
    features: Record<string, any>;
  }[];
  extractedFeatures: Record<string, any>;
  processingTime: number;
}

/**
 * Interface for feature descriptor generation results
 */
export interface FeatureDescriptorResult {
  descriptors_file: string;
  metadata_file: string;
  material_count: number;
  total_descriptors: number;
}

/**
 * Interface for neural network training results
 */
export interface NeuralNetworkTrainingResult {
  model_path: string;
  metadata_path: string;
  class_mapping_path: string;
  num_classes: number;
  training_time: number;
  final_accuracy: number;
  final_val_accuracy: number;
  final_loss: number;
  final_val_loss: number;
}

/**
 * Interface for vector search results
 */
export interface VectorSearchResult {
  query: {
    imagePath: string;
    embeddingDimensions: number;
    embeddingTime: number;
  };
  results: {
    materialId: string;
    similarity: number;
    metadata: Record<string, any>;
  }[];
  searchTime: number;
  totalTime: number;
}

/**
 * Interface for confidence fusion results
 */
export interface ConfidenceFusionResult {
  matches: {
    materialId: string;
    confidence: number;
    features: Record<string, any>;
    sources: string[];
  }[];
  fusion: {
    method: string;
    alpha: number;
    feature_match_count: number;
    ml_match_count: number;
    fused_match_count: number;
    image_features?: Record<string, any>;
  };
  extractedFeatures: Record<string, any>;
}

/**
 * Interface for crawler data preparation options
 */
export interface CrawlerDataPreparationOptions {
  manifestPath: string;
  outputDir: string;
  minImagesPerClass?: number;
  targetWidth?: number;
  targetHeight?: number;
}

/**
 * Interface for crawler data preparation results
 */
export interface CrawlerDataPreparationResult {
  status: string;
  datasetPath?: string;
  classes?: string[];
  classesCount?: number;
  processedImages?: number;
  downloadErrors?: number;
  message?: string;
}

/**
 * Interface for crawler dataset validation results
 */
export interface CrawlerDatasetValidationResult {
  status: string;
  valid: boolean;
  classCount?: number;
  classDistribution?: Record<string, number>;
  totalImages?: number;
  minClassSize?: number;
  maxClassSize?: number;
  imageSampleValidRatio?: number;
  warnings?: string[];
  message?: string;
}

/**
 * Interface for crawler data training options
 */
export interface CrawlerTrainingOptions {
  datasetPath: string;
  outputDir: string;
  modelType?: 'hybrid' | 'feature-based' | 'ml-based';
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  validateOnly?: boolean;
  progressCallback?: (progress: number, message: string) => void;
}

/**
 * Interface for PDF extraction options
 */
export interface PDFExtractionOptions {
  outputDir: string;
  extractText?: boolean;
  extractImages?: boolean;
  imageFormat?: string;
  imageQuality?: number;
  ocrEnabled?: boolean;
  minImageSize?: number;
}

/**
 * Interface for PDF extracted image
 */
export interface PDFExtractedImage {
  id: string;
  path: string;
  page: number;
  width?: number;
  height?: number;
  format?: string;
  coordinates?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Extract images and text from a PDF file
 * @param pdfPath Path to the PDF file
 * @param options Extraction options
 * @returns Promise with extraction results
 */
export async function extractFromPDF(
  pdfPath: string,
  options: string | PDFExtractionOptions
): Promise<PDFExtractionResult> {
  return new Promise((resolve, reject) => {
    // Ensure the output directory exists
    const outputDir = typeof options === 'string' 
      ? options 
      : options.outputDir;
      
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Handle options
    const extractionOptions = typeof options === 'string' 
      ? { outputDir, extractText: true, extractImages: true } 
      : options;

    // Run the Python script for PDF extraction
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'pdf_extractor.py');
    const args = [
      scriptPath,
      pdfPath,
      extractionOptions.outputDir
    ];
    
    // Add optional arguments if provided
    if (typeof options !== 'string') {
      if (options.extractText !== undefined) {
        args.push('--extract-text', options.extractText ? 'true' : 'false');
      }
      if (options.extractImages !== undefined) {
        args.push('--extract-images', options.extractImages ? 'true' : 'false');
      }
      if (options.imageFormat) {
        args.push('--image-format', options.imageFormat);
      }
      if (options.imageQuality) {
        args.push('--image-quality', options.imageQuality.toString());
      }
      if (options.ocrEnabled !== undefined) {
        args.push('--ocr-enabled', options.ocrEnabled ? 'true' : 'false');
      }
      if (options.minImageSize) {
        args.push('--min-image-size', options.minImageSize.toString());
      }
    }
    
    const pythonProcess = spawn('python', args);

    let resultData = '';
    let errorData = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data: Buffer) => {
      resultData += data.toString();
    });

    // Collect error data from stderr
    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`PDF extraction failed with code ${code}: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(resultData) as PDFExtractionResult;
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse PDF extraction result: ${error}`));
      }
    });
  });
}

/**
 * Recognize materials in an image
 * @param imagePath Path to the image file
 * @param options Recognition options
 * @returns Promise with recognition results
 */
export async function recognizeMaterial(
  imagePath: string,
  options: {
    modelType?: 'hybrid' | 'feature-based' | 'ml-based';
    confidenceThreshold?: number;
    maxResults?: number;
  } = {}
): Promise<RecognitionResult> {
  return new Promise((resolve, reject) => {
    // Set default options
    const modelType = options.modelType || 'hybrid';
    const confidenceThreshold = options.confidenceThreshold || 0.6;
    const maxResults = options.maxResults || 5;

    // Run the Python script for material recognition
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'material_recognizer.py');
    const pythonProcess = spawn('python', [
      scriptPath,
      imagePath,
      '--model-type', modelType,
      '--confidence-threshold', confidenceThreshold.toString(),
      '--max-results', maxResults.toString()
    ]);

    let resultData = '';
    let errorData = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data: Buffer) => {
      resultData += data.toString();
    });

    // Collect error data from stderr
    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`Material recognition failed with code ${code}: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(resultData) as RecognitionResult;
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse material recognition result: ${error}`));
      }
    });
  });
}

/**
 * Train the material recognition model with new data
 * @param trainingDataDir Directory containing training data
 * @param modelOutputDir Directory to save the trained model
 * @param options Training options
 * @returns Promise with training results
 */
export async function trainModel(
  trainingDataDir: string,
  modelOutputDir: string,
  options: {
    modelType?: 'hybrid' | 'feature-based' | 'ml-based';
    epochs?: number;
    batchSize?: number;
    learningRate?: number;
  } = {}
): Promise<{ accuracy: number; loss: number; modelPath: string }> {
  return new Promise((resolve, reject) => {
    // Set default options
    const modelType = options.modelType || 'hybrid';
    const epochs = options.epochs || 10;
    const batchSize = options.batchSize || 32;
    const learningRate = options.learningRate || 0.001;

    // Ensure the output directory exists
    if (!fs.existsSync(modelOutputDir)) {
      fs.mkdirSync(modelOutputDir, { recursive: true });
    }

    // Run the Python script for model training
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'model_trainer.py');
    const pythonProcess = spawn('python', [
      scriptPath,
      trainingDataDir,
      modelOutputDir,
      '--model-type', modelType,
      '--epochs', epochs.toString(),
      '--batch-size', batchSize.toString(),
      '--learning-rate', learningRate.toString()
    ]);

    let resultData = '';
    let errorData = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data: Buffer) => {
      resultData += data.toString();
    });

    // Collect error data from stderr
    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`Model training failed with code ${code}: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(resultData) as { accuracy: number; loss: number; modelPath: string };
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse model training result: ${error}`));
      }
    });
  });
}

/**
 * Generate vector embeddings for an image
 * @param imagePath Path to the image file
 * @param options Options for embedding generation
 * @returns Promise with vector embedding
 */
export async function generateImageEmbedding(
  imagePath: string,
  options: {
    method?: 'hybrid' | 'feature-based' | 'ml-based';
    materialId?: string;
    adaptive?: boolean;
    qualityThreshold?: number;
  } = {}
): Promise<{ 
  vector: number[]; 
  dimensions: number; 
  method?: string;
  initial_method?: string;
  quality_scores?: Record<string, number>;
  method_switches?: number;
  adaptive?: boolean;
}> {
  return new Promise((resolve, reject) => {
    // Set default options
    const method = options.method || 'hybrid';
    const adaptive = options.adaptive !== false; // Default to true
    const qualityThreshold = options.qualityThreshold || 0.65;

    // Run the Python script for embedding generation using the bridge
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'embedding_bridge.py');
    const args = [
      scriptPath,
      imagePath,
      '--method', method
    ];

    // Add optional parameters if provided
    if (options.materialId) {
      args.push('--material-id', options.materialId);
    }
    
    // Add adaptive parameters
    args.push('--adaptive');
    
    // Add quality threshold if specified
    if (options.qualityThreshold) {
      args.push('--quality-threshold', options.qualityThreshold.toString());
    }
    
    // Add cache directory for performance history
    // Use __dirname instead of process.cwd() for TypeScript compatibility
    const cacheDir = path.join(__dirname, '..', '..', 'data', 'embedding-cache');
    args.push('--cache-dir', cacheDir);
    
    // Ensure cache directory exists
    fs.mkdirSync(cacheDir, { recursive: true });
    
    const pythonProcess = spawn('python', args);

    let resultData = '';
    let errorData = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data: Buffer) => {
      resultData += data.toString();
    });

    // Collect error data from stderr
    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`Embedding generation failed with code ${code}: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(resultData) as { vector: number[]; dimensions: number };
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse embedding generation result: ${error}`));
      }
    });
  });
}

/**
 * Generate feature descriptors from a dataset of material images
 * @param datasetDir Directory containing material images organized by material ID
 * @param outputFile Path to save the feature descriptors database
 * @returns Promise with feature descriptor generation results
 */
export async function generateFeatureDescriptors(
  datasetDir: string,
  outputFile: string
): Promise<FeatureDescriptorResult> {
  return new Promise((resolve, reject) => {
    // Ensure the output directory exists
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Run the Python script for feature descriptor generation
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'generate_feature_descriptors.py');
    const pythonProcess = spawn('python', [
      scriptPath,
      datasetDir,
      outputFile
    ]);

    let resultData = '';
    let errorData = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data: Buffer) => {
      resultData += data.toString();
    });

    // Collect error data from stderr
    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`Feature descriptor generation failed with code ${code}: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(resultData) as FeatureDescriptorResult;
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse feature descriptor generation result: ${error}`));
      }
    });
  });
}

/**
 * Train a neural network model for material recognition
 * @param datasetDir Directory containing material images organized by material ID
 * @param outputDir Directory to save the trained model
 * @param options Training options
 * @returns Promise with neural network training results
 */
export async function trainNeuralNetwork(
  datasetDir: string,
  outputDir: string,
  options: {
    framework?: 'tensorflow' | 'pytorch';
    model?: string;
    epochs?: number;
    batchSize?: number;
    imgSize?: number;
    learningRate?: number;
  } = {}
): Promise<NeuralNetworkTrainingResult> {
  return new Promise((resolve, reject) => {
    // Set default options
    const framework = options.framework || 'tensorflow';
    const model = options.model || 'mobilenetv2';
    const epochs = options.epochs || 10;
    const batchSize = options.batchSize || 32;
    const imgSize = options.imgSize || 224;
    const learningRate = options.learningRate || 0.001;

    // Ensure the output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Run the Python script for neural network training
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'train_neural_network.py');
    const pythonProcess = spawn('python', [
      scriptPath,
      datasetDir,
      outputDir,
      '--framework', framework,
      '--model', model,
      '--epochs', epochs.toString(),
      '--batch-size', batchSize.toString(),
      '--img-size', imgSize.toString(),
      '--lr', learningRate.toString()
    ]);

    let resultData = '';
    let errorData = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data: Buffer) => {
      resultData += data.toString();
    });

    // Collect error data from stderr
    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`Neural network training failed with code ${code}: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(resultData) as NeuralNetworkTrainingResult;
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse neural network training result: ${error}`));
      }
    });
  });
}

/**
 * Create a vector search index from embeddings
 * @param embeddingsDir Directory containing embedding files
 * @param indexPath Path to save the search index
 * @returns Promise with index creation results
 */
export async function createVectorSearchIndex(
  embeddingsDir: string,
  indexPath: string
): Promise<{ index_path: string; metadata_path: string; num_embeddings: number; dimension: number }> {
  return new Promise((resolve, reject) => {
    // Ensure the output directory exists
    const outputDir = path.dirname(indexPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Run the Python script for vector search index creation
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'vector_search.py');
    const pythonProcess = spawn('python', [
      scriptPath,
      'index',
      '--embeddings-dir', embeddingsDir,
      '--index-path', indexPath
    ]);

    let resultData = '';
    let errorData = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data: Buffer) => {
      resultData += data.toString();
    });

    // Collect error data from stderr
    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`Vector search index creation failed with code ${code}: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(resultData) as { index_path: string; metadata_path: string; num_embeddings: number; dimension: number };
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse vector search index creation result: ${error}`));
      }
    });
  });
}

/**
 * Search for similar materials using an image
 * @param indexPath Path to the search index
 * @param imagePath Path to the query image
 * @param options Search options
 * @returns Promise with search results
 */
export async function searchSimilarMaterials(
  indexPath: string,
  imagePath: string,
  options: {
    numResults?: number;
    threshold?: number;
  } = {}
): Promise<VectorSearchResult> {
  return new Promise((resolve, reject) => {
    // Set default options
    const numResults = options.numResults || 5;
    const threshold = options.threshold || 0.0;

    // Run the Python script for vector search
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'vector_search.py');
    const pythonProcess = spawn('python', [
      scriptPath,
      'search',
      '--index-path', indexPath,
      '--image-path', imagePath,
      '--num-results', numResults.toString(),
      '--threshold', threshold.toString()
    ]);

    let resultData = '';
    let errorData = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data: Buffer) => {
      resultData += data.toString();
    });

    // Collect error data from stderr
    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`Vector search failed with code ${code}: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(resultData) as VectorSearchResult;
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse vector search result: ${error}`));
      }
    });
  });
}

/**
 * Visualize vector search results
 * @param indexPath Path to the search index
 * @param imagePath Path to the query image
 * @param outputPath Path to save the visualization image
 * @param numResults Number of results to visualize
 * @returns Promise with the path to the visualization image
 */
export async function visualizeSearchResults(
  indexPath: string,
  imagePath: string,
  outputPath: string,
  numResults: number = 5
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Ensure the output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Run the Python script for vector search visualization
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'vector_search.py');
    const pythonProcess = spawn('python', [
      scriptPath,
      'visualize',
      '--index-path', indexPath,
      '--image-path', imagePath,
      '--num-results', numResults.toString(),
      '--output-path', outputPath
    ]);

    let resultData = '';
    let errorData = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data: Buffer) => {
      resultData += data.toString();
    });

    // Collect error data from stderr
    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`Vector search visualization failed with code ${code}: ${errorData}`));
        return;
      }

      resolve(outputPath);
    });
  });
}

/**
 * Options for image segmentation
 */
export interface ImageSegmentationOptions {
  outputDir: string;
  method?: 'edge' | 'color' | 'region' | 'grid';
  minTileSize?: number;
  maxTiles?: number;
  visualize?: boolean;
}

/**
 * Options for feedback storage
 */
export interface FeedbackOptions {
  recognitionId: string;
  feedbackType: 'correct' | 'incorrect' | 'partial';
  materialId?: string;
  userNotes?: string;
}

/**
 * Options for performance optimization
 */
export interface PerformanceOptimizationOptions {
  modelType?: 'hybrid' | 'feature-based' | 'ml-based';
  useCache?: boolean;
  useParallel?: boolean;
  optimizeImage?: boolean;
}

/**
 * Segment an image to detect multiple tiles
 * @param imagePath Path to the input image
 * @param options Segmentation options
 * @returns Promise with segmentation results
 */
export async function segmentImage(
  imagePath: string,
  options: ImageSegmentationOptions
): Promise<ImageSegmentationResult> {
  return new Promise((resolve, reject) => {
    // Ensure options has required fields
    const outputDir = options.outputDir;
    const method = options.method || 'edge';
    const minTileSize = options.minTileSize || 0.05;
    const maxTiles = options.maxTiles || 10;
    const visualize = options.visualize || false;
    
    // Run the Python script for image segmentation
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'image_segmentation.py');
    const args = [
      scriptPath,
      imagePath,
      '--output-dir', outputDir,
      '--method', method,
      '--min-tile-size', minTileSize.toString(),
      '--max-tiles', maxTiles.toString()
    ];
    
    if (visualize) {
      args.push('--visualize');
    }
    
    const pythonProcess = spawn('python', args);

    let resultData = '';
    let errorData = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data: Buffer) => {
      resultData += data.toString();
    });

    // Collect error data from stderr
    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`Image segmentation failed with code ${code}: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(resultData) as ImageSegmentationResult;
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse image segmentation result: ${error}`));
      }
    });
  });
}

/**
 * Store feedback for a recognition result
 * @param options Feedback options
 * @returns Promise with feedback storage result
 */
export async function storeFeedback(
  options: FeedbackOptions
): Promise<FeedbackStorageResult> {
  return new Promise((resolve, reject) => {
    // Run the Python script for feedback storage
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'feedback_loop.py');
    const args = [
      scriptPath,
      'store',
      '--recognition-id', options.recognitionId,
      '--feedback-type', options.feedbackType
    ];
    
    if (options.materialId) {
      args.push('--material-id', options.materialId);
    }
    
    if (options.userNotes) {
      args.push('--notes', options.userNotes);
    }
    
    const pythonProcess = spawn('python', args);

    let resultData = '';
    let errorData = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data: Buffer) => {
      resultData += data.toString();
    });

    // Collect error data from stderr
    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`Feedback storage failed with code ${code}: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(resultData) as FeedbackStorageResult;
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse feedback storage result: ${error}`));
      }
    });
  });
}

/**
 * Adjust recognition result based on feedback history
 * @param resultJson JSON string with recognition result
 * @returns Promise with adjusted recognition result
 */
export async function adjustRecognitionResult(
  resultJson: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create temporary file for the result
    const tempDir = os.tmpdir();
    const resultPath = path.join(tempDir, `result_${Date.now()}.json`);
    
    try {
      fs.writeFileSync(resultPath, resultJson);
    } catch (error) {
      reject(new Error(`Failed to write temporary result file: ${error}`));
      return;
    }
    
    // Run the Python script for result adjustment
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'feedback_loop.py');
    const pythonProcess = spawn('python', [
      scriptPath,
      'adjust',
      '--result-file', resultPath
    ]);

    let resultData = '';
    let errorData = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data: Buffer) => {
      resultData += data.toString();
    });

    // Collect error data from stderr
    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code: number | null) => {
      // Clean up temporary file
      try {
        fs.unlinkSync(resultPath);
      } catch (e) {
        // Ignore cleanup errors
      }
      
      if (code !== 0) {
        reject(new Error(`Result adjustment failed with code ${code}: ${errorData}`));
        return;
      }

      resolve(resultData);
    });
  });
}

/**
 * Get performance metrics for recognition system
 * @param timePeriod Time period for metrics (day, week, month, year, all)
 * @returns Promise with performance metrics
 */
export async function getPerformanceMetrics(
  timePeriod: string = 'all'
): Promise<PerformanceMetricsResult> {
  return new Promise((resolve, reject) => {
    // Run the Python script for metrics retrieval
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'feedback_loop.py');
    const pythonProcess = spawn('python', [
      scriptPath,
      'metrics',
      '--time-period', timePeriod
    ]);

    let resultData = '';
    let errorData = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data: Buffer) => {
      resultData += data.toString();
    });

    // Collect error data from stderr
    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`Metrics retrieval failed with code ${code}: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(resultData) as PerformanceMetricsResult;
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse metrics result: ${error}`));
      }
    });
  });
}

/**
 * Optimize recognition pipeline for performance
 * @param imagePath Path to the input image
 * @param options Performance optimization options
 * @returns Promise with optimized recognition result
 */
export async function optimizeRecognition(
  imagePath: string,
  options: PerformanceOptimizationOptions = {}
): Promise<PerformanceOptimizationResult> {
  return new Promise((resolve, reject) => {
    // Set default options
    const modelType = options.modelType || 'hybrid';
    const useCache = options.useCache !== false;
    const useParallel = options.useParallel !== false;
    const optimizeImage = options.optimizeImage !== false;
    
    // Run the Python script for optimized recognition
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'performance_optimizer.py');
    const args = [
      scriptPath,
      'optimize',
      '--image-path', imagePath,
      '--model-type', modelType
    ];
    
    if (!useCache) {
      args.push('--no-cache');
    }
    
    if (!useParallel) {
      args.push('--no-parallel');
    }
    
    if (!optimizeImage) {
      args.push('--no-image-opt');
    }
    
    const pythonProcess = spawn('python', args);

    let resultData = '';
    let errorData = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data: Buffer) => {
      resultData += data.toString();
    });

    // Collect error data from stderr
    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`Optimized recognition failed with code ${code}: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(resultData) as PerformanceOptimizationResult;
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse optimized recognition result: ${error}`));
      }
    });
  });
}

/**
 * Fuse confidence scores from different recognition approaches
 * @param featureResults Results from feature-based approach
 * @param mlResults Results from ML-based approach
 * @param options Fusion options
 * @returns Promise with fused results
 */
export async function fuseConfidenceScores(
  featureResults: RecognitionResult,
  mlResults: RecognitionResult,
  options: {
    method?: 'weighted' | 'adaptive' | 'max' | 'product';
    alpha?: number;
    imagePath?: string;
  } = {}
): Promise<ConfidenceFusionResult> {
  return new Promise((resolve, reject) => {
    // Set default options
    const method = options.method || 'adaptive';
    const alpha = options.alpha || 0.5;
    
    // Create temporary files for results
    const tempDir = path.join(os.tmpdir(), 'kai-ml-fusion');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const featureResultsPath = path.join(tempDir, 'feature_results.json');
    const mlResultsPath = path.join(tempDir, 'ml_results.json');
    const outputPath = path.join(tempDir, 'fused_results.json');
    
    // Write results to temporary files
    fs.writeFileSync(featureResultsPath, JSON.stringify(featureResults));
    fs.writeFileSync(mlResultsPath, JSON.stringify(mlResults));
    
    // Prepare command arguments
    const args = [
      path.join(PYTHON_SCRIPTS_DIR, 'confidence_fusion.py'),
      featureResultsPath,
      mlResultsPath,
      '--method', method,
      '--alpha', alpha.toString(),
      '--output', outputPath
    ];
    
    // Add image path if provided
    if (options.imagePath) {
      args.push('--image-path', options.imagePath);
    }
    
    // Run the Python script for confidence fusion
    const pythonProcess = spawn('python', args);
    
    let errorData = '';
    
    // Collect error data from stderr
    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorData += data.toString();
    });
    
    // Handle process completion
    pythonProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        // Clean up temporary files
        try {
          fs.unlinkSync(featureResultsPath);
          fs.unlinkSync(mlResultsPath);
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
        
        reject(new Error(`Confidence fusion failed with code ${code}: ${errorData}`));
        return;
      }
      
      try {
        // Read the output file
        const resultData = fs.readFileSync(outputPath, 'utf8');
        // Ensure we have a string for JSON.parse
        const result = JSON.parse(resultData.toString()) as ConfidenceFusionResult;
        
        // Clean up temporary files
        try {
          fs.unlinkSync(featureResultsPath);
          fs.unlinkSync(mlResultsPath);
          fs.unlinkSync(outputPath);
        } catch (e) {
          // Ignore cleanup errors
        }
        
        resolve(result);
      } catch (error) {
        // Clean up temporary files
        try {
          fs.unlinkSync(featureResultsPath);
          fs.unlinkSync(mlResultsPath);
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
        
        reject(new Error(`Failed to parse confidence fusion result: ${error}`));
      }
    });
  });
}

/**
 * Enhanced material recognition with optional confidence fusion
 * @param imagePath Path to the image file
 * @param options Recognition options
 * @returns Promise with recognition results
 */
export async function recognizeMaterialEnhanced(
  imagePath: string,
  options: {
    useFusion?: boolean;
    fusionMethod?: 'weighted' | 'adaptive' | 'max' | 'product';
    fusionAlpha?: number;
    modelType?: 'hybrid' | 'feature-based' | 'ml-based';
    confidenceThreshold?: number;
    maxResults?: number;
  } = {}
): Promise<RecognitionResult | ConfidenceFusionResult> {
  // If fusion is not requested, use the standard recognition
  if (!options.useFusion) {
    return recognizeMaterial(imagePath, {
      modelType: options.modelType,
      confidenceThreshold: options.confidenceThreshold,
      maxResults: options.maxResults
    });
  }
  
  // Run feature-based recognition
  const featureResults = await recognizeMaterial(imagePath, {
    modelType: 'feature-based',
    confidenceThreshold: options.confidenceThreshold || 0.6,
    maxResults: options.maxResults || 10 // Get more results for fusion
  });
  
  // Run ML-based recognition
  const mlResults = await recognizeMaterial(imagePath, {
    modelType: 'ml-based',
    confidenceThreshold: options.confidenceThreshold || 0.6,
    maxResults: options.maxResults || 10 // Get more results for fusion
  });
  
  // Fuse the results
  return fuseConfidenceScores(featureResults, mlResults, {
    method: options.fusionMethod || 'adaptive',
    alpha: options.fusionAlpha || 0.5,
    imagePath: imagePath
  });
}


// Export all functions
export default {
  // Original functions
  extractFromPDF,
  recognizeMaterial,
  trainModel,
  generateImageEmbedding,
  
  // New functions
  generateFeatureDescriptors,
  trainNeuralNetwork,
  createVectorSearchIndex,
  searchSimilarMaterials,
  visualizeSearchResults,
  fuseConfidenceScores,
  recognizeMaterialEnhanced,
  
  // Image segmentation functions
  segmentImage,
  
  // Feedback loop functions
  storeFeedback,
  adjustRecognitionResult,
  getPerformanceMetrics,
  
  // Performance optimization functions
  optimizeRecognition,
  
  // Crawler data integration functions
  prepareCrawlerDataForTraining,
  validateCrawlerDataset,
  trainModelWithCrawlerData,
  
  // 3D reconstruction and visualization
  GaussianSplattingBridge,
  ImprovedTextTo3DBridge
};

// Export bridges for direct import
export { GaussianSplattingBridge, ImprovedTextTo3DBridge };

/**
 * Prepare crawler data for training
 * @param options Options for crawler data preparation
 * @returns Promise with preparation results
 */
export async function prepareCrawlerDataForTraining(
  options: CrawlerDataPreparationOptions
): Promise<CrawlerDataPreparationResult> {
  return new Promise((resolve, reject) => {
    // Ensure output directory exists
    if (!fs.existsSync(options.outputDir)) {
      fs.mkdirSync(options.outputDir, { recursive: true });
    }
    
    // Run the Python script for crawler data preparation
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'crawler_adapter.py');
    const args = [
      scriptPath,
      'prepare',
      '--manifest-path', options.manifestPath,
      '--output-dir', options.outputDir
    ];
    
    if (options.minImagesPerClass) {
      args.push('--min-images', options.minImagesPerClass.toString());
    }
    
    if (options.targetWidth) {
      args.push('--target-width', options.targetWidth.toString());
    }
    
    if (options.targetHeight) {
      args.push('--target-height', options.targetHeight.toString());
    }
    
    const pythonProcess = spawn('python', args);

    let resultData = '';
    let errorData = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data: Buffer) => {
      resultData += data.toString();
    });

    // Collect error data from stderr
    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`Crawler data preparation failed with code ${code}: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(resultData) as CrawlerDataPreparationResult;
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse crawler data preparation result: ${error}`));
      }
    });
  });
}

/**
 * Validate a crawler dataset for training suitability
 * @param datasetPath Path to the crawler dataset
 * @returns Promise with validation results
 */
export async function validateCrawlerDataset(
  datasetPath: string
): Promise<CrawlerDatasetValidationResult> {
  return new Promise((resolve, reject) => {
    // Run the Python script for crawler dataset validation
    const scriptPath = path.join(PYTHON_SCRIPTS_DIR, 'crawler_adapter.py');
    const args = [
      scriptPath,
      'validate',
      '--dataset-path', datasetPath
    ];
    
    const pythonProcess = spawn('python', args);

    let resultData = '';
    let errorData = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data: Buffer) => {
      resultData += data.toString();
    });

    // Collect error data from stderr
    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`Crawler dataset validation failed with code ${code}: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(resultData) as CrawlerDatasetValidationResult;
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse crawler dataset validation result: ${error}`));
      }
    });
  });
}

/**
 * Train a model using crawler data
 * @param options Training options for crawler data
 * @returns Promise with training results
 */
export async function trainModelWithCrawlerData(
  options: CrawlerTrainingOptions
): Promise<NeuralNetworkTrainingResult> {
  return new Promise((resolve, reject) => {
    // First validate the dataset if requested
    if (options.validateOnly) {
      validateCrawlerDataset(options.datasetPath)
        .then(validation => {
          if (!validation.valid) {
            reject(new Error(`Invalid crawler dataset: ${validation.message || 'Validation failed'}`));
            return;
          }
          
          if (options.validateOnly) {
            // Resolve with a partial result since we're just validating
            resolve({
              model_path: '',
              metadata_path: '',
              class_mapping_path: '',
              num_classes: validation.classCount || 0,
              training_time: 0,
              final_accuracy: 0,
              final_val_accuracy: 0,
              final_loss: 0,
              final_val_loss: 0
            });
            return;
          }
        })
        .catch(error => {
          reject(error);
          return;
        });
    }
    
    // Ensure the output directory exists
    if (!fs.existsSync(options.outputDir)) {
      fs.mkdirSync(options.outputDir, { recursive: true });
    }
    
    // Train using the standard neural network training function
    // The crawler adapter already prepared the data in the right format
    return trainNeuralNetwork(
      options.datasetPath,
      options.outputDir,
      {
        framework: 'tensorflow', // Default to TensorFlow
        model: 'mobilenetv2',    // Default to MobileNetV2
        epochs: options.epochs,
        batchSize: options.batchSize,
        learningRate: options.learningRate,
        imgSize: 224            // Default image size
      }
    )
    .then(result => {
      // Add metadata about the data source
      const metadataPath = path.join(options.outputDir, 'crawler_training_metadata.json');
      const metadata = {
        data_source: 'crawler',
        dataset_path: options.datasetPath,
        training_time: result.training_time,
        accuracy: result.final_accuracy,
        model_type: options.modelType || 'hybrid',
        training_completed: true,
        timestamp: new Date().toISOString()
      };
      
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      
      // Return the training result
      resolve(result);
    })
    .catch(error => {
      reject(new Error(`Failed to train model with crawler data: ${error}`));
    });
  });
}
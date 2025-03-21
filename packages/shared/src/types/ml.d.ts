/**
 * Type declarations for the ML package
 */

declare module '@kai/ml' {
  /**
   * PDF Extraction
   */
  export interface PDFExtractedImage {
    id: string;
    path: string;
    page: number;
    width: number;
    height: number;
    format: string;
    coordinates: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }

  export interface PDFExtractionOptions {
    outputDir: string;
    extractText?: boolean;
    extractImages?: boolean;
    imageFormat?: 'jpg' | 'png' | 'webp';
    imageQuality?: number;
    ocrEnabled?: boolean;
    minImageSize?: number;
  }

  export interface PDFPageInfo {
    pageNumber: number;
    width: number;
    height: number;
    rotation: number;
  }

  export interface PDFExtractedText {
    id: string;
    page: number;
    content: string;
    confidence: number;
    coordinates: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }

  export interface PDFExtractionResult {
    pdfInfo: {
      filename: string;
      pages: PDFPageInfo[];
      title?: string;
      author?: string;
      subject?: string;
      keywords?: string[];
      creationDate?: string;
      modificationDate?: string;
    };
    images: PDFExtractedImage[];
    texts: PDFExtractedText[];
    processingTime: number;
  }

  export function extractFromPDF(
    pdfPath: string,
    options: PDFExtractionOptions
  ): Promise<PDFExtractionResult>;

  /**
   * Material Recognition
   */
  export interface RecognitionOptions {
    modelType?: 'hybrid' | 'feature-based' | 'ml-based';
    confidenceThreshold?: number;
    maxResults?: number;
    includeFeatures?: boolean;
  }

  export interface RecognitionMatch {
    materialId: string;
    confidence: number;
    matchType: 'hybrid' | 'feature-based' | 'ml-based';
    features?: any;
  }

  export interface RecognitionResult {
    matches: RecognitionMatch[];
    processingTime: number;
    modelUsed: string;
    extractedFeatures?: any;
  }

  export function recognizeMaterial(
    imagePath: string,
    options?: RecognitionOptions
  ): Promise<RecognitionResult>;

  /**
   * Embedding Generation
   */
  export interface EmbeddingGenerationOptions {
    embeddingSize?: number;
    modelType?: 'hybrid' | 'feature-based' | 'ml-based';
    normalize?: boolean;
  }

  export interface EmbeddingResult {
    vector: number[];
    dimension: number;
    modelUsed: string;
    processingTime: number;
  }

  export function generateImageEmbedding(
    imagePath: string,
    options?: EmbeddingGenerationOptions
  ): Promise<EmbeddingResult>;

  /**
   * Model Training
   */
  export interface TrainingOptions {
    modelType?: 'hybrid' | 'feature-based' | 'ml-based';
    outputDir?: string;
    epochs?: number;
    batchSize?: number;
    learningRate?: number;
    validationSplit?: number;
  }

  export interface TrainingResult {
    modelPath: string;
    trainingTime: number;
    epochs: number;
    accuracy: number;
    loss: number;
    validationAccuracy: number;
    validationLoss: number;
  }

  export function trainModel(
    datasetDir: string,
    options?: TrainingOptions
  ): Promise<TrainingResult>;
}
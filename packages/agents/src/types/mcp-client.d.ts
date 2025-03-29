/**
 * Type declarations for @kai/mcp-client module
 * 
 * This file provides TypeScript type definitions for the MCP client library
 * to enable proper type checking when using the MCP client.
 */

declare module '@kai/mcp-client' {
  /**
   * Main client for interacting with the MCP server
   */
  export class MCPClient {
    /**
     * Create a new MCP client
     * 
     * @param serverUrl The URL of the MCP server
     */
    constructor(serverUrl: string);
    
    /**
     * Check the health of the MCP server
     * 
     * @returns Promise that resolves to health status
     */
    checkHealth(): Promise<{ status: string }>;
    
    /**
     * Call an endpoint on the MCP server
     * 
     * @param endpoint The endpoint to call
     * @param data The data to send
     * @returns Promise that resolves to the response
     */
    callEndpoint<T>(endpoint: string, data: any): Promise<T>;
    
    /**
     * Recognize material from an image path
     * 
     * @param imagePath Path to the image file
     * @param options Recognition options
     * @returns Recognition result
     */
    recognizeMaterial(imagePath: string, options?: RecognitionOptions): Promise<RecognitionResult>;
    
    /**
     * Search for vectors by similarity
     * 
     * @param params Search parameters
     * @returns Search results
     */
    searchVectors(params: VectorSearchParams): Promise<VectorSearchResult[]>;
    
    /**
     * Process an image using OCR
     * 
     * @param params OCR parameters
     * @returns OCR result
     */
    processOCR(params: OCRParams): Promise<OCRResult>;
    
    /**
     * Analyze an image for materials and properties
     * 
     * @param params Analysis parameters
     * @returns Analysis result
     */
    analyzeImage(params: ImageAnalysisParams): Promise<ImageAnalysisResult>;
    
    /**
     * Train a model with the specified parameters
     * 
     * @param params Training parameters
     * @returns Training result
     */
    trainModel(params: TrainingParams): Promise<TrainingResult>;
    
    /**
     * Send a message to an agent
     * 
     * @param message The message to send
     * @returns Promise that resolves when message is sent
     */
    sendAgentMessage(message: AgentMessage): Promise<void>;
    
    /**
     * Get messages from an agent
     * 
     * @param maxWait Maximum time to wait for messages
     * @returns Agent messages
     */
    getAgentMessages(maxWait?: number): Promise<{ messages: AgentMessage[]; count: number }>;
  }
  
  /**
   * Recognition options for material recognition
   */
  export interface RecognitionOptions {
    modelType?: string;
    confidenceThreshold?: number;
    maxResults?: number;
  }
  
  /**
   * Result of material recognition
   */
  export interface RecognitionResult {
    materials: Material[];
    confidenceScores: number[];
    processingTime: number;
  }
  
  /**
   * Material information
   */
  export interface Material {
    id: string;
    name: string;
    type: string;
    metadata?: Record<string, any>;
  }
  
  /**
   * Parameters for vector search
   */
  export interface VectorSearchParams {
    query: string | number[];
    limit?: number;
    threshold?: number;
    filterBy?: Record<string, any>;
    includeMetadata?: boolean;
  }
  
  /**
   * Result of vector search
   */
  export interface VectorSearchResult {
    id: string;
    similarity: number;
    metadata?: Record<string, any>;
  }
  
  /**
   * Parameters for OCR processing
   */
  export interface OCRParams {
    documentPath: string;
    languages?: string[];
    enhancedMode?: boolean;
    detectHandwriting?: boolean;
    extractForms?: boolean;
  }
  
  /**
   * Result of OCR processing
   */
  export interface OCRResult {
    text: string;
    pages: OCRPage[];
    confidence: number;
    language: string;
  }
  
  /**
   * OCR page information
   */
  export interface OCRPage {
    pageNumber: number;
    text: string;
    tables: OCRTable[];
    formFields: OCRFormField[];
    handwrittenRegions: OCRHandwrittenRegion[];
  }
  
  /**
   * OCR table information
   */
  export interface OCRTable {
    rows: string[][];
    confidence: number;
  }
  
  /**
   * OCR form field information
   */
  export interface OCRFormField {
    name: string;
    value: string;
    confidence: number;
  }
  
  /**
   * OCR handwritten region information
   */
  export interface OCRHandwrittenRegion {
    text: string;
    confidence: number;
  }
  
  /**
   * Parameters for image analysis
   */
  export interface ImageAnalysisParams {
    imageUrl: string;
    detectMaterials?: boolean;
    assessQuality?: boolean;
    extractColors?: boolean;
    extractPatterns?: boolean;
  }
  
  /**
   * Result of image analysis
   */
  export interface ImageAnalysisResult {
    imageUrl: string;
    timestamp: string;
    quality?: ImageQuality;
    detectedMaterials?: DetectedMaterial[];
    colorAnalysis?: ColorAnalysis;
    patternAnalysis?: PatternAnalysis;
  }
  
  /**
   * Image quality information
   */
  export interface ImageQuality {
    score: number;
    issues: string[];
    recommendations: string[];
  }
  
  /**
   * Detected material information
   */
  export interface DetectedMaterial {
    type: string;
    confidence: number;
    properties: Record<string, any>;
  }
  
  /**
   * Color analysis information
   */
  export interface ColorAnalysis {
    dominant: ColorInfo;
    palette: ColorInfo[];
  }
  
  /**
   * Color information
   */
  export interface ColorInfo {
    color: string;
    hex: string;
    percentage: number;
  }
  
  /**
   * Pattern analysis information
   */
  export interface PatternAnalysis {
    type: string;
    direction: string;
    complexity: string;
    repetition: string;
  }
  
  /**
   * Parameters for model training
   */
  export interface TrainingParams {
    modelType: string;
    datasetPath: string;
    epochs?: number;
    batchSize?: number;
    learningRate?: number;
    useTransferLearning?: boolean;
    optimizeHyperparams?: boolean;
    distributed?: boolean;
    numWorkers?: number;
  }
  
  /**
   * Result of model training
   */
  export interface TrainingResult {
    modelId: string;
    accuracy: number;
    loss: number;
    trainingTime: number;
    epochs: number;
    parameters: Record<string, any>;
  }
  
  /**
   * Agent message
   */
  export interface AgentMessage {
    message_type: string;
    content: Record<string, any>;
    timestamp?: number;
  }
}
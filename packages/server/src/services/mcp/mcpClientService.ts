/**
 * MCP Client Service
 *
 * This service provides a unified interface for interacting with the MCP server.
 * It handles all MCP-related operations, including AI/ML services, 3D model generation,
 * and vector database operations.
 *
 * The service includes credit tracking integration for all MCP operations.
 */

import { MCPClient } from '@kai/mcp-client';
import { logger } from '../../utils/logger';
import { env } from '../../../shared/src/utils/environment';
import creditService from '../credit/creditService';
import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';

// MCP server configuration
const MCP_SERVER_URL = env.ml?.mcpServerUrl || process.env.MCP_SERVER_URL || 'http://localhost:8000';
const MCP_ENABLED = env.ml?.useMcpServer !== false;
const MCP_TIMEOUT = env.ml?.mcpTimeout || 30000;

// Credit service keys for different MCP operations
export enum MCPServiceKey {
  // AI/ML Services
  TEXT_GENERATION = 'openai.text-generation',
  TEXT_EMBEDDING = 'openai.text-embedding',
  IMAGE_GENERATION = 'openai.image-generation',
  IMAGE_ANALYSIS = 'openai.image-analysis',
  MODEL_TRAINING = 'openai.model-training',

  // 3D Model Generation
  MODEL_RECONSTRUCTION = '3d.model-reconstruction',
  TEXT_TO_3D = '3d.text-to-3d',
  ROOM_LAYOUT = '3d.room-layout',

  // Vector Database Operations
  VECTOR_SEARCH = 'vector.search',
  VECTOR_EMBEDDING = 'vector.embedding',
  VECTOR_INDEXING = 'vector.indexing',
  MULTI_MODAL_SEARCH = 'vector.multi-modal-search',
  CONVERSATIONAL_SEARCH = 'vector.conversational-search',
  DOMAIN_SEARCH = 'vector.domain-search',

  // Messaging Services
  EMAIL_NOTIFICATION = 'messaging.email',
  SMS_NOTIFICATION = 'messaging.sms',
  PUSH_NOTIFICATION = 'messaging.push',
  WEBHOOK_NOTIFICATION = 'messaging.webhook',

  // Content Processing
  PDF_PROCESSING = 'content.pdf-processing',
  OCR_PROCESSING = 'content.ocr-processing',
  DATA_EXTRACTION = 'content.data-extraction',

  // Analytics
  ANALYTICS_PROCESSING = 'analytics.processing',
  ANALYTICS_REPORTING = 'analytics.reporting',
  ANALYTICS_TRENDS = 'analytics.trends',
  ANALYTICS_STATS = 'analytics.stats',
  ANALYTICS_FORECAST = 'analytics.forecast',
  ANALYTICS_ANOMALY = 'analytics.anomaly',
  ANALYTICS_USER_BEHAVIOR = 'analytics.user-behavior'
}

// MCP client singleton instance
let mcpClientInstance: MCPClient | null = null;

// Flag to track if we've tried to connect to MCP server
let mcpServerAvailabilityChecked = false;
let mcpServerAvailable = false;

/**
 * MCP Client Service class
 */
class MCPClientService {
  /**
   * Get or create the MCP client instance
   * @returns MCP client instance
   */
  private getClient(): MCPClient {
    if (!mcpClientInstance) {
      logger.info(`Creating new MCP client for server: ${MCP_SERVER_URL}`);
      mcpClientInstance = new MCPClient(MCP_SERVER_URL);
    }
    return mcpClientInstance;
  }

  /**
   * Check if MCP server is available
   * @returns True if MCP server is available
   */
  public async checkServerAvailability(): Promise<boolean> {
    if (!MCP_ENABLED) {
      return false;
    }

    if (mcpServerAvailabilityChecked) {
      return mcpServerAvailable;
    }

    try {
      logger.info('Checking MCP server availability...');
      const client = this.getClient();
      await client.getServerInfo();

      mcpServerAvailable = true;
      logger.info('MCP server is available');
    } catch (error) {
      mcpServerAvailable = false;
      logger.error(`MCP server is not available: ${error}`);
    }

    mcpServerAvailabilityChecked = true;
    return mcpServerAvailable;
  }

  /**
   * Check if MCP is enabled and available
   * @returns True if MCP is enabled and available
   */
  public async isMCPAvailable(): Promise<boolean> {
    if (!MCP_ENABLED) {
      return false;
    }

    if (!mcpServerAvailabilityChecked) {
      await this.checkServerAvailability();
    }

    return mcpServerAvailable;
  }

  /**
   * Call an MCP endpoint with credit tracking
   * @param userId User ID
   * @param serviceKey Service key for credit tracking
   * @param endpoint MCP endpoint to call
   * @param data Data to send to the endpoint
   * @param estimatedUnits Estimated number of units to be used
   * @param options Additional options for the call
   * @returns Response from the MCP endpoint
   */
  public async callEndpoint<T>(
    userId: string,
    serviceKey: MCPServiceKey,
    endpoint: string,
    data: any,
    estimatedUnits: number = 1,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      timeout?: number;
    } = {}
  ): Promise<T> {
    // Set default options
    const maxRetries = options.maxRetries ?? 3;
    const retryDelay = options.retryDelay ?? 1000;
    const timeout = options.timeout ?? MCP_TIMEOUT;

    // Check if MCP is available
    const mcpAvailable = await this.isMCPAvailable();
    if (!mcpAvailable) {
      throw new Error('MCP server is not available');
    }

    // Check if user has enough credits
    const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
      userId,
      serviceKey,
      estimatedUnits
    );

    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits');
    }

    let lastError: Error | null = null;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        // Call MCP endpoint
        const client = this.getClient();
        const startTime = Date.now();

        // Set timeout for the request
        const result = await Promise.race([
          client.callEndpoint<T>(endpoint, data),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Request to ${endpoint} timed out after ${timeout}ms`)), timeout);
          })
        ]);

        const duration = Date.now() - startTime;

        // Calculate actual units used (this would be replaced with actual calculation)
        // For now, we'll use the estimated units
        const actualUnits = estimatedUnits;

        // Track credit usage
        await creditService.useServiceCredits(
          userId,
          serviceKey,
          actualUnits,
          `${serviceKey} API usage`,
          {
            endpoint,
            duration,
            estimatedUnits,
            actualUnits
          }
        );

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we should retry
        const isRetryable = this.isRetryableError(lastError);

        if (isRetryable && retryCount < maxRetries) {
          // Exponential backoff with jitter
          const delay = retryDelay * Math.pow(2, retryCount) + Math.random() * 100;
          logger.warn(`Retrying MCP endpoint ${endpoint} after ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);

          await new Promise(resolve => setTimeout(resolve, delay));
          retryCount++;
          continue;
        }

        // Log the error and throw
        const errorMessage = lastError.message;
        logger.error(`Error calling MCP endpoint ${endpoint}: ${errorMessage}`);
        throw lastError;
      }
    }

    // This should never happen, but TypeScript needs it
    throw lastError || new Error(`Failed to call MCP endpoint ${endpoint} after ${maxRetries} retries`);
  }

  /**
   * Determine if an error is retryable
   * @param error The error to check
   * @returns True if the error is retryable
   */
  private isRetryableError(error: Error): boolean {
    // Network errors are generally retryable
    if (error.message.includes('ECONNREFUSED') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('network error') ||
        error.message.includes('timeout')) {
      return true;
    }

    // Check for axios errors with status codes
    if (axios.isAxiosError(error)) {
      // 5xx errors are server errors and can be retried
      // 429 is too many requests, can be retried after backoff
      const status = error.response?.status;
      if (status && (status >= 500 || status === 429)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate text using MCP
   * @param userId User ID
   * @param prompt Text prompt
   * @param options Generation options
   * @returns Generated text
   */
  public async generateText(
    userId: string,
    prompt: string,
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
      stop?: string[];
    } = {}
  ): Promise<{ text: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
    // Estimate token usage (very rough estimate)
    const promptTokens = Math.ceil(prompt.length / 4);
    const maxTokens = options.maxTokens || 1000;
    const estimatedTotalTokens = promptTokens + maxTokens;

    // Convert options to MCP format
    const mcpData = {
      prompt,
      model: options.model || 'gpt-3.5-turbo',
      max_tokens: maxTokens,
      temperature: options.temperature || 0.7,
      top_p: options.topP || 1,
      frequency_penalty: options.frequencyPenalty || 0,
      presence_penalty: options.presencePenalty || 0,
      stop: options.stop || []
    };

    // Call MCP endpoint
    return await this.callEndpoint<{ text: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }>(
      userId,
      MCPServiceKey.TEXT_GENERATION,
      'llm/completion',
      mcpData,
      Math.ceil(estimatedTotalTokens / 1000) // Estimate 1 credit per 1000 tokens
    );
  }

  /**
   * Generate text embeddings using MCP
   * @param userId User ID
   * @param text Text to embed
   * @param options Embedding options
   * @returns Text embedding
   */
  public async generateTextEmbedding(
    userId: string,
    text: string,
    options: {
      model?: string;
    } = {}
  ): Promise<{ embedding: number[]; dimensions: number }> {
    // Estimate token usage (very rough estimate)
    const estimatedTokens = Math.ceil(text.length / 4);

    // Convert options to MCP format
    const mcpData = {
      text,
      model: options.model || 'text-embedding-ada-002'
    };

    // Call MCP endpoint
    return await this.callEndpoint<{ embedding: number[]; dimensions: number }>(
      userId,
      MCPServiceKey.TEXT_EMBEDDING,
      'llm/embedding',
      mcpData,
      Math.ceil(estimatedTokens / 1000) // Estimate 1 credit per 1000 tokens
    );
  }

  /**
   * Generate image using MCP
   * @param userId User ID
   * @param prompt Image prompt
   * @param options Generation options
   * @returns Generated image URL
   */
  public async generateImage(
    userId: string,
    prompt: string,
    options: {
      model?: string;
      size?: string;
      n?: number;
      responseFormat?: string;
    } = {}
  ): Promise<{ url: string }> {
    // Convert options to MCP format
    const mcpData = {
      prompt,
      model: options.model || 'dall-e-3',
      size: options.size || '1024x1024',
      n: options.n || 1,
      response_format: options.responseFormat || 'url'
    };

    // Call MCP endpoint
    return await this.callEndpoint<{ url: string }>(
      userId,
      MCPServiceKey.IMAGE_GENERATION,
      'image/generation',
      mcpData,
      options.n || 1 // 1 credit per image
    );
  }

  /**
   * Analyze image using MCP
   * @param userId User ID
   * @param imagePath Path to image file
   * @param options Analysis options
   * @returns Analysis results
   */
  public async analyzeImage(
    userId: string,
    imagePath: string,
    options: {
      modelType?: string;
      confidenceThreshold?: number;
      maxResults?: number;
      includeFeatures?: boolean;
    } = {}
  ): Promise<any> {
    // Check if MCP is available
    const mcpAvailable = await this.isMCPAvailable();
    if (!mcpAvailable) {
      throw new Error('MCP server is not available');
    }

    // Check if user has enough credits
    const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
      userId,
      MCPServiceKey.IMAGE_ANALYSIS,
      1
    );

    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits');
    }

    try {
      // Create form data with image
      const formData = new FormData();
      formData.append('image', fs.createReadStream(imagePath));

      // Convert options to server format
      const serverOptions = {
        model_type: options.modelType || 'hybrid',
        confidence_threshold: options.confidenceThreshold || 0.6,
        max_results: options.maxResults || 5,
        include_features: options.includeFeatures !== false
      };
      formData.append('options', JSON.stringify(serverOptions));

      // Send request to server
      const startTime = Date.now();
      const response = await axios.post(`${MCP_SERVER_URL}/api/v1/recognize`, formData, {
        headers: {
          ...formData.getHeaders()
        }
      });
      const duration = Date.now() - startTime;

      // Track credit usage
      await creditService.useServiceCredits(
        userId,
        MCPServiceKey.IMAGE_ANALYSIS,
        1,
        `${MCPServiceKey.IMAGE_ANALYSIS} API usage`,
        {
          endpoint: 'recognize',
          duration,
          options: serverOptions
        }
      );

      return response.data;
    } catch (error) {
      logger.error(`Error analyzing image: ${error}`);
      throw error;
    }
  }

  /**
   * Generate image embedding using MCP
   * @param userId User ID
   * @param imagePath Path to image file
   * @param options Embedding options
   * @returns Image embedding
   */
  public async generateImageEmbedding(
    userId: string,
    imagePath: string,
    options: {
      modelType?: string;
      includeFeatures?: boolean;
    } = {}
  ): Promise<{ vector: number[]; dimensions: number }> {
    // Check if MCP is available
    const mcpAvailable = await this.isMCPAvailable();
    if (!mcpAvailable) {
      throw new Error('MCP server is not available');
    }

    // Check if user has enough credits
    const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
      userId,
      MCPServiceKey.VECTOR_EMBEDDING,
      1
    );

    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits');
    }

    try {
      // Create form data with image
      const formData = new FormData();
      formData.append('image', fs.createReadStream(imagePath));

      // Set options for embedding generation
      const serverOptions = {
        model_type: options.modelType || 'clip',
        include_features: options.includeFeatures !== false
      };
      formData.append('options', JSON.stringify(serverOptions));

      // Send request to MCP server
      const startTime = Date.now();
      const response = await axios.post(`${MCP_SERVER_URL}/api/v1/embeddings`, formData, {
        headers: {
          ...formData.getHeaders()
        }
      });
      const duration = Date.now() - startTime;

      // Track credit usage
      await creditService.useServiceCredits(
        userId,
        MCPServiceKey.VECTOR_EMBEDDING,
        1,
        `${MCPServiceKey.VECTOR_EMBEDDING} API usage`,
        {
          endpoint: 'embeddings',
          duration,
          options: serverOptions
        }
      );

      return response.data;
    } catch (error) {
      logger.error(`Error generating image embedding: ${error}`);
      throw error;
    }
  }

  /**
   * Generate 3D model from text using MCP
   * @param userId User ID
   * @param prompt Text prompt
   * @param options Generation options
   * @returns 3D model URL
   */
  public async generateTextTo3D(
    userId: string,
    prompt: string,
    options: {
      model?: string;
      format?: string;
      quality?: string;
      maxRetries?: number;
      timeout?: number;
    } = {}
  ): Promise<{ modelUrl: string; thumbnailUrl: string }> {
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      throw new Error('A valid prompt is required for 3D model generation');
    }

    // Convert options to MCP format
    const mcpData = {
      prompt: prompt.trim(),
      model: options.model || 'shapE',
      format: options.format || 'glb',
      quality: options.quality || 'medium'
    };

    // 3D generation can take longer, so we use a longer timeout
    const callOptions = {
      maxRetries: options.maxRetries ?? 2,
      timeout: options.timeout ?? MCP_TIMEOUT * 2 // Double the default timeout
    };

    try {
      // Call MCP endpoint with extended timeout
      return await this.callEndpoint<{ modelUrl: string; thumbnailUrl: string }>(
        userId,
        MCPServiceKey.TEXT_TO_3D,
        '3d/text-to-3d',
        mcpData,
        5, // 5 credits per 3D model
        callOptions
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to generate 3D model from text: ${errorMessage}`, {
        userId,
        prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
        model: mcpData.model,
        error: errorMessage
      });
      throw new Error(`Failed to generate 3D model: ${errorMessage}`);
    }
  }

  /**
   * Generate room layout using MCP
   * @param userId User ID
   * @param prompt Text prompt
   * @param options Generation options
   * @returns Room layout data
   */
  public async generateRoomLayout(
    userId: string,
    prompt: string,
    options: {
      model?: string;
      format?: string;
      style?: string;
    } = {}
  ): Promise<{ layoutUrl: string; thumbnailUrl: string }> {
    // Convert options to MCP format
    const mcpData = {
      prompt,
      model: options.model || 'roomLayoutGenerator',
      format: options.format || 'glb',
      style: options.style || 'modern'
    };

    // Call MCP endpoint
    return await this.callEndpoint<{ layoutUrl: string; thumbnailUrl: string }>(
      userId,
      MCPServiceKey.ROOM_LAYOUT,
      '3d/room-layout',
      mcpData,
      3 // 3 credits per room layout
    );
  }

  /**
   * Reconstruct 3D model from image using MCP
   * @param userId User ID
   * @param imagePath Path to image file
   * @param options Reconstruction options
   * @returns 3D model URL
   */
  public async reconstructModelFromImage(
    userId: string,
    imagePath: string,
    options: {
      model?: string;
      format?: string;
      quality?: string;
      maxRetries?: number;
      timeout?: number;
    } = {}
  ): Promise<{ modelUrl: string; thumbnailUrl: string }> {
    // Validate input
    if (!imagePath || typeof imagePath !== 'string') {
      throw new Error('A valid image path is required for 3D model reconstruction');
    }

    // Check if the file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found at path: ${imagePath}`);
    }

    // Check if MCP is available
    const mcpAvailable = await this.isMCPAvailable();
    if (!mcpAvailable) {
      throw new Error('MCP server is not available');
    }

    // Check if user has enough credits
    const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
      userId,
      MCPServiceKey.MODEL_RECONSTRUCTION,
      10 // 10 credits per reconstruction
    );

    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits');
    }

    try {
      // 3D reconstruction can take longer, so we use a longer timeout
      const timeout = options.timeout ?? MCP_TIMEOUT * 3; // Triple the default timeout
      const maxRetries = options.maxRetries ?? 2;

      // Create form data with image
      const formData = new FormData();
      formData.append('image', fs.createReadStream(imagePath));

      // Convert options to server format
      const serverOptions = {
        model: options.model || 'nerfStudio',
        format: options.format || 'glb',
        quality: options.quality || 'medium'
      };
      formData.append('options', JSON.stringify(serverOptions));

      // Send request to server with retry logic
      let lastError: Error | null = null;
      let retryCount = 0;

      while (retryCount <= maxRetries) {
        try {
          // Need to recreate the form data and stream for each retry attempt
          const retryFormData = new FormData();
          retryFormData.append('image', fs.createReadStream(imagePath));
          retryFormData.append('options', JSON.stringify(serverOptions));

          const startTime = Date.now();
          const response = await axios.post(`${MCP_SERVER_URL}/api/v1/3d/reconstruct`, retryFormData, {
            headers: {
              ...retryFormData.getHeaders(),
              'X-User-ID': userId
            },
            timeout: timeout
          });
          const duration = Date.now() - startTime;

          // Track credit usage
          await creditService.useServiceCredits(
            userId,
            MCPServiceKey.MODEL_RECONSTRUCTION,
            10,
            `${MCPServiceKey.MODEL_RECONSTRUCTION} API usage`,
            {
              endpoint: '3d/reconstruct',
              duration,
              options: serverOptions
            }
          );

          return response.data;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          // Check if we should retry
          const isRetryable = this.isRetryableError(lastError);

          if (isRetryable && retryCount < maxRetries) {
            // Exponential backoff with jitter
            const retryDelay = 2000; // Base delay of 2 seconds
            const delay = retryDelay * Math.pow(2, retryCount) + Math.random() * 500;
            logger.warn(`Retrying 3D model reconstruction after ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);

            await new Promise(resolve => setTimeout(resolve, delay));
            retryCount++;
            continue;
          }

          // If not retryable or max retries reached, break the loop
          break;
        }
      }

      // If we get here, all retries failed
      const errorMessage = lastError?.message || 'Unknown error';
      logger.error(`Error reconstructing 3D model from image: ${errorMessage}`, {
        userId,
        imagePath,
        model: options.model || 'nerfStudio',
        retries: retryCount
      });
      throw new Error(`Failed to reconstruct 3D model: ${errorMessage}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error reconstructing 3D model: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Search vector database using MCP
   * @param userId User ID
   * @param query Search query
   * @param options Search options
   * @returns Search results
   */
  public async searchVectorDatabase(
    userId: string,
    query: string,
    options: {
      collection?: string;
      limit?: number;
      filter?: Record<string, any>;
    } = {}
  ): Promise<any[]> {
    // Convert options to MCP format
    const mcpData = {
      query,
      collection: options.collection || 'materials',
      limit: options.limit || 10,
      filter: options.filter || {}
    };

    // Call MCP endpoint
    return await this.callEndpoint<any[]>(
      userId,
      MCPServiceKey.VECTOR_SEARCH,
      'vector/search',
      mcpData,
      1 // 1 credit per search
    );
  }

  /**
   * Index document in vector database using MCP
   * @param userId User ID
   * @param document Document to index
   * @param options Indexing options
   * @returns Indexing result
   */
  public async indexVectorDocument(
    userId: string,
    document: Record<string, any>,
    options: {
      collection?: string;
      embedFields?: string[];
    } = {}
  ): Promise<{ id: string; status: string }> {
    // Convert options to MCP format
    const mcpData = {
      document,
      collection: options.collection || 'materials',
      embed_fields: options.embedFields || ['description', 'name']
    };

    // Call MCP endpoint
    return await this.callEndpoint<{ id: string; status: string }>(
      userId,
      MCPServiceKey.VECTOR_INDEXING,
      'vector/index',
      mcpData,
      1 // 1 credit per document
    );
  }

  /**
   * Process PDF document using MCP
   * @param userId User ID
   * @param pdfPath Path to PDF file
   * @param options Processing options
   * @returns Processing result
   */
  public async processPdf(
    userId: string,
    pdfPath: string,
    options: {
      extractImages?: boolean;
      extractText?: boolean;
      associateTextWithImages?: boolean;
      outputDir?: string;
    } = {}
  ): Promise<{
    totalPages: number;
    processedPages: Array<{
      pageNumber: number;
      images: Array<{
        id: string;
        pageNumber: number;
        fileName: string;
        filePath: string;
        width: number;
        height: number;
        coordinates: {
          x: number;
          y: number;
          width: number;
          height: number;
        };
        s3Key?: string;
        s3Url?: string;
      }>;
      texts: Array<{
        text: string;
        confidence: number;
        boundingBox?: {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      }>;
      associations: Array<{
        imageId: string;
        textIds: string[];
      }>;
    }>;
    materials?: any[];
    errors?: any[];
  }> {
    // Check if MCP is available
    const mcpAvailable = await this.isMCPAvailable();
    if (!mcpAvailable) {
      throw new Error('MCP server is not available');
    }

    // Check if user has enough credits
    const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
      userId,
      MCPServiceKey.PDF_PROCESSING,
      5 // 5 credits per PDF
    );

    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits');
    }

    try {
      // Create form data with PDF
      const formData = new FormData();
      formData.append('pdf', fs.createReadStream(pdfPath));

      // Convert options to server format
      const serverOptions = {
        extract_images: options.extractImages !== false,
        extract_text: options.extractText !== false,
        associate_text_with_images: options.associateTextWithImages !== false,
        output_dir: options.outputDir || ''
      };
      formData.append('options', JSON.stringify(serverOptions));

      // Send request to server
      const startTime = Date.now();
      const response = await axios.post(`${MCP_SERVER_URL}/api/v1/content/process-pdf`, formData, {
        headers: {
          ...formData.getHeaders()
        }
      });
      const duration = Date.now() - startTime;

      // Track credit usage
      await creditService.useServiceCredits(
        userId,
        MCPServiceKey.PDF_PROCESSING,
        5,
        `${MCPServiceKey.PDF_PROCESSING} API usage`,
        {
          endpoint: 'content/process-pdf',
          duration,
          options: serverOptions,
          pageCount: response.data.totalPages
        }
      );

      return response.data;
    } catch (error) {
      logger.error(`Error processing PDF: ${error}`);
      throw error;
    }
  }

  /**
   * Perform OCR on an image using MCP
   * @param userId User ID
   * @param imagePath Path to image file
   * @param options OCR options
   * @returns OCR result
   */
  public async performOcr(
    userId: string,
    imagePath: string,
    options: {
      language?: string;
      ocrEngine?: number;
      preprocess?: boolean;
    } = {}
  ): Promise<{
    text: string;
    confidence: number;
    regions: Array<{
      text: string;
      confidence: number;
      boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }>;
  }> {
    // Check if MCP is available
    const mcpAvailable = await this.isMCPAvailable();
    if (!mcpAvailable) {
      throw new Error('MCP server is not available');
    }

    // Check if user has enough credits
    const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
      userId,
      MCPServiceKey.OCR_PROCESSING,
      1 // 1 credit per image
    );

    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits');
    }

    try {
      // Create form data with image
      const formData = new FormData();
      formData.append('image', fs.createReadStream(imagePath));

      // Convert options to server format
      const serverOptions = {
        language: options.language || 'eng',
        ocr_engine: options.ocrEngine || 3,
        preprocess: options.preprocess !== false
      };
      formData.append('options', JSON.stringify(serverOptions));

      // Send request to server
      const startTime = Date.now();
      const response = await axios.post(`${MCP_SERVER_URL}/api/v1/content/ocr`, formData, {
        headers: {
          ...formData.getHeaders()
        }
      });
      const duration = Date.now() - startTime;

      // Track credit usage
      await creditService.useServiceCredits(
        userId,
        MCPServiceKey.OCR_PROCESSING,
        1,
        `${MCPServiceKey.OCR_PROCESSING} API usage`,
        {
          endpoint: 'content/ocr',
          duration,
          options: serverOptions
        }
      );

      return response.data;
    } catch (error) {
      logger.error(`Error performing OCR: ${error}`);
      throw error;
    }
  }

  /**
   * Process an analytics event using MCP
   * @param userId User ID
   * @param event Analytics event data
   * @returns Processed event with ID
   */
  public async processAnalyticsEvent(
    userId: string,
    event: {
      eventType: string;
      resourceType?: string;
      query?: string;
      parameters?: Record<string, any>;
      timestamp?: string;
      source?: string;
      sourceDetail?: string;
    }
  ): Promise<{ id: string }> {
    // Convert event to MCP format
    const mcpData = {
      event_type: event.eventType,
      resource_type: event.resourceType,
      query: event.query,
      parameters: event.parameters,
      timestamp: event.timestamp || new Date().toISOString(),
      source: event.source,
      source_detail: event.sourceDetail,
      user_id: userId
    };

    // Call MCP endpoint
    return await this.callEndpoint<{ id: string }>(
      userId,
      MCPServiceKey.ANALYTICS_PROCESSING,
      'analytics/event',
      mcpData,
      1 // 1 credit per event
    );
  }

  /**
   * Query analytics events using MCP
   * @param userId User ID
   * @param options Query options
   * @returns Analytics events matching the query
   */
  public async queryAnalyticsEvents(
    userId: string,
    options: {
      eventType?: string;
      resourceType?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      skip?: number;
      sort?: Record<string, 'asc' | 'desc'>;
    }
  ): Promise<any[]> {
    // Convert options to MCP format
    const mcpData = {
      event_type: options.eventType,
      resource_type: options.resourceType,
      user_id: options.userId,
      start_date: options.startDate,
      end_date: options.endDate,
      limit: options.limit || 100,
      skip: options.skip || 0,
      sort: options.sort
    };

    // Call MCP endpoint
    return await this.callEndpoint<any[]>(
      userId,
      MCPServiceKey.ANALYTICS_REPORTING,
      'analytics/query',
      mcpData,
      1 // 1 credit per query
    );
  }

  /**
   * Get analytics trends using MCP
   * @param userId User ID
   * @param options Trend options
   * @returns Analytics trends data
   */
  public async getAnalyticsTrends(
    userId: string,
    options: {
      timeframe: string;
      eventType?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<Record<string, number>> {
    // Convert options to MCP format
    const mcpData = {
      timeframe: options.timeframe,
      event_type: options.eventType,
      start_date: options.startDate,
      end_date: options.endDate
    };

    // Call MCP endpoint
    return await this.callEndpoint<Record<string, number>>(
      userId,
      MCPServiceKey.ANALYTICS_TRENDS,
      'analytics/trends',
      mcpData,
      2 // 2 credits per trends query
    );
  }

  /**
   * Get analytics statistics using MCP
   * @param userId User ID
   * @param options Stats options
   * @returns Analytics statistics
   */
  public async getAnalyticsStats(
    userId: string,
    options: {
      startDate?: string;
      endDate?: string;
    }
  ): Promise<any> {
    // Convert options to MCP format
    const mcpData = {
      start_date: options.startDate,
      end_date: options.endDate
    };

    // Call MCP endpoint
    return await this.callEndpoint<any>(
      userId,
      MCPServiceKey.ANALYTICS_STATS,
      'analytics/stats',
      mcpData,
      2 // 2 credits per stats query
    );
  }

  /**
   * Compare images using MCP
   * @param userId User ID
   * @param imagePath Path to the image being compared
   * @param referenceUrls URLs of reference images to compare with
   * @returns Comparison results with similarity scores
   */
  public async compareImages(
    userId: string,
    imagePath: string,
    referenceUrls: string[]
  ): Promise<{
    comparisons: Array<{
      referenceUrl: string;
      similarity: number;
    }>;
  }> {
    // Check if MCP is available
    const mcpAvailable = await this.isMCPAvailable();
    if (!mcpAvailable) {
      throw new Error('MCP server is not available');
    }

    // Check if user has enough credits
    const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
      userId,
      MCPServiceKey.IMAGE_ANALYSIS,
      1 // 1 credit per comparison batch
    );

    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits');
    }

    try {
      // Create form data with image
      const formData = new FormData();
      formData.append('image', fs.createReadStream(imagePath));
      formData.append('reference_urls', JSON.stringify(referenceUrls));

      // Send request to server
      const startTime = Date.now();
      const response = await axios.post(`${MCP_SERVER_URL}/api/v1/image/compare`, formData, {
        headers: {
          ...formData.getHeaders(),
          'X-User-ID': userId
        }
      });

      const duration = Date.now() - startTime;
      logger.debug(`MCP image comparison completed in ${duration}ms`);

      return {
        comparisons: response.data.comparisons || []
      };
    } catch (error) {
      logger.error('Error comparing images with MCP', { error });
      throw error;
    }
  }

  /**
   * Find similar visual references using MCP
   * @param userId User ID
   * @param imagePath Path to the image being processed
   * @param propertyName Property name to search for
   * @param materialType Material type to search for
   * @returns Similar visual references with similarity scores
   */
  public async findSimilarReferences(
    userId: string,
    imagePath: string,
    propertyName: string,
    materialType: string
  ): Promise<{
    similarReferences: Array<{
      propertyValue: string;
      referenceUrl: string;
      similarity: number;
    }>;
  }> {
    // Check if MCP is available
    const mcpAvailable = await this.isMCPAvailable();
    if (!mcpAvailable) {
      throw new Error('MCP server is not available');
    }

    // Check if user has enough credits
    const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
      userId,
      MCPServiceKey.IMAGE_ANALYSIS,
      2 // 2 credits for similarity search
    );

    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits');
    }

    try {
      // Create form data with image
      const formData = new FormData();
      formData.append('image', fs.createReadStream(imagePath));
      formData.append('property_name', propertyName);
      formData.append('material_type', materialType);

      // Send request to server
      const startTime = Date.now();
      const response = await axios.post(`${MCP_SERVER_URL}/api/v1/image/similar-references`, formData, {
        headers: {
          ...formData.getHeaders(),
          'X-User-ID': userId
        }
      });

      const duration = Date.now() - startTime;
      logger.debug(`MCP similar references search completed in ${duration}ms`);

      return {
        similarReferences: response.data.similar_references || []
      };
    } catch (error) {
      logger.error('Error finding similar references with MCP', { error });
      throw error;
    }
  }

  /**
   * Perform multi-modal search using MCP
   * @param userId User ID
   * @param options Search options
   * @returns Search results
   */
  public async performMultiModalSearch(
    userId: string,
    options: {
      textQuery?: string;
      imageData?: string;
      imageType?: 'base64' | 'file' | 'url';
      materialType?: string;
      limit?: number;
      skip?: number;
      threshold?: number;
      textWeight?: number;
      imageWeight?: number;
      includeKnowledge?: boolean;
      includeRelationships?: boolean;
      filters?: Record<string, any>;
      maxRetries?: number;
      timeout?: number;
    }
  ): Promise<{
    materials: any[];
    knowledgeEntries?: any[];
    relationships?: any[];
    enhancedTextQuery?: string;
  }> {
    // Validate input
    if (!options.textQuery && !options.imageData) {
      throw new Error('Either textQuery or imageData must be provided for multi-modal search');
    }

    // Check if MCP is available
    const mcpAvailable = await this.isMCPAvailable();
    if (!mcpAvailable) {
      throw new Error('MCP server is not available');
    }

    // Check if user has enough credits
    const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
      userId,
      MCPServiceKey.MULTI_MODAL_SEARCH,
      2 // 2 credits per multi-modal search
    );

    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits');
    }

    try {
      // Prepare request data
      const requestData: Record<string, any> = {
        text_query: options.textQuery,
        image_data: options.imageData,
        image_type: options.imageType || 'base64',
        material_type: options.materialType,
        limit: options.limit || 10,
        skip: options.skip || 0,
        threshold: options.threshold || 0.5,
        text_weight: options.textWeight || 0.5,
        image_weight: options.imageWeight || 0.5,
        include_knowledge: options.includeKnowledge !== false,
        include_relationships: options.includeRelationships !== false,
        filters: options.filters || {}
      };

      // Set up retry logic
      const maxRetries = options.maxRetries ?? 2;
      const timeout = options.timeout ?? MCP_TIMEOUT;
      let lastError: Error | null = null;
      let retryCount = 0;

      while (retryCount <= maxRetries) {
        try {
          // Call MCP endpoint
          const response = await axios.post(
            `${MCP_SERVER_URL}/api/v1/search/multi-modal`,
            requestData,
            {
              headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
              },
              timeout: timeout
            }
          );

          // Track credit usage
          await creditService.useServiceCredits(
            userId,
            MCPServiceKey.MULTI_MODAL_SEARCH,
            2,
            `${MCPServiceKey.MULTI_MODAL_SEARCH} API usage`,
            {
              hasText: !!options.textQuery,
              hasImage: !!options.imageData,
              materialType: options.materialType,
              retryCount
            }
          );

          return {
            materials: response.data.materials || [],
            knowledgeEntries: response.data.knowledge_entries || [],
            relationships: response.data.relationships || [],
            enhancedTextQuery: response.data.enhanced_text_query
          };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          // Check if we should retry
          const isRetryable = this.isRetryableError(lastError);

          if (isRetryable && retryCount < maxRetries) {
            // Exponential backoff with jitter
            const retryDelay = 1000; // Base delay of 1 second
            const delay = retryDelay * Math.pow(2, retryCount) + Math.random() * 300;
            logger.warn(`Retrying multi-modal search after ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);

            await new Promise(resolve => setTimeout(resolve, delay));
            retryCount++;
            continue;
          }

          // If not retryable or max retries reached, break the loop
          break;
        }
      }

      // If we get here, all retries failed
      const errorMessage = lastError?.message || 'Unknown error';
      logger.error(`Error performing multi-modal search: ${errorMessage}`, {
        userId,
        hasText: !!options.textQuery,
        hasImage: !!options.imageData,
        materialType: options.materialType,
        retries: retryCount
      });
      throw new Error(`Failed to perform multi-modal search: ${errorMessage}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error performing multi-modal search: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Perform conversational search using MCP
   * @param userId User ID
   * @param options Search options
   * @returns Search results
   */
  public async performConversationalSearch(
    userId: string,
    options: {
      query: string;
      sessionId: string;
      conversationHistory: Array<{
        id: string;
        role: string;
        content: string;
        timestamp: string;
        metadata?: Record<string, any>;
      }>;
      materialType?: string;
      limit?: number;
      skip?: number;
      includeKnowledge?: boolean;
      includeRelationships?: boolean;
      filters?: Record<string, any>;
      userPreferences?: Record<string, any>;
      maxRetries?: number;
      timeout?: number;
    }
  ): Promise<{
    materials: any[];
    knowledgeEntries?: any[];
    relationships?: any[];
    enhancedQuery: string;
    interpretedQuery: string;
    contextUsed: boolean;
    detectedEntities?: Record<string, any>;
    confidence: number;
  }> {
    // Check if MCP is available
    const mcpAvailable = await this.isMCPAvailable();
    if (!mcpAvailable) {
      throw new Error('MCP server is not available');
    }

    // Check if user has enough credits
    const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
      userId,
      MCPServiceKey.CONVERSATIONAL_SEARCH,
      2 // 2 credits per conversational search
    );

    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits');
    }

    try {
      // Validate input
      if (!options.query || typeof options.query !== 'string' || options.query.trim() === '') {
        throw new Error('A valid query is required for conversational search');
      }

      if (!options.sessionId) {
        throw new Error('A session ID is required for conversational search');
      }

      if (!Array.isArray(options.conversationHistory)) {
        throw new Error('Conversation history must be an array');
      }

      // Prepare request data
      const requestData: Record<string, any> = {
        query: options.query.trim(),
        session_id: options.sessionId,
        conversation_history: options.conversationHistory,
        material_type: options.materialType,
        limit: options.limit || 10,
        skip: options.skip || 0,
        include_knowledge: options.includeKnowledge !== false,
        include_relationships: options.includeRelationships !== false,
        filters: options.filters || {},
        user_preferences: options.userPreferences || {}
      };

      // Set up retry logic
      const maxRetries = options.maxRetries ?? 2;
      const timeout = options.timeout ?? MCP_TIMEOUT;
      let lastError: Error | null = null;
      let retryCount = 0;

      while (retryCount <= maxRetries) {
        try {
          // Call MCP endpoint
          const response = await axios.post(
            `${MCP_SERVER_URL}/api/v1/search/conversational`,
            requestData,
            {
              headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
              },
              timeout: timeout
            }
          );

          // Track credit usage
          await creditService.useServiceCredits(
            userId,
            MCPServiceKey.CONVERSATIONAL_SEARCH,
            2,
            `${MCPServiceKey.CONVERSATIONAL_SEARCH} API usage`,
            {
              sessionId: options.sessionId,
              historyLength: options.conversationHistory.length,
              retryCount
            }
          );

          return {
            materials: response.data.materials || [],
            knowledgeEntries: response.data.knowledge_entries || [],
            relationships: response.data.relationships || [],
            enhancedQuery: response.data.enhanced_query || options.query,
            interpretedQuery: response.data.interpreted_query || options.query,
            contextUsed: response.data.context_used || false,
            detectedEntities: response.data.detected_entities || {},
            confidence: response.data.confidence || 0.5
          };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          // Check if we should retry
          const isRetryable = this.isRetryableError(lastError);

          if (isRetryable && retryCount < maxRetries) {
            // Exponential backoff with jitter
            const retryDelay = 1000; // Base delay of 1 second
            const delay = retryDelay * Math.pow(2, retryCount) + Math.random() * 300;
            logger.warn(`Retrying conversational search after ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);

            await new Promise(resolve => setTimeout(resolve, delay));
            retryCount++;
            continue;
          }

          // If not retryable or max retries reached, break the loop
          break;
        }
      }

      // If we get here, all retries failed
      const errorMessage = lastError?.message || 'Unknown error';
      logger.error(`Error performing conversational search: ${errorMessage}`, {
        userId,
        sessionId: options.sessionId,
        historyLength: options.conversationHistory.length,
        retries: retryCount
      });
      throw new Error(`Failed to perform conversational search: ${errorMessage}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error performing conversational search: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Perform domain-specific search using MCP
   * @param userId User ID
   * @param options Search options
   * @returns Search results
   */
  public async performDomainSearch(
    userId: string,
    options: {
      query: string;
      domain: string;
      materialType?: string;
      limit?: number;
      skip?: number;
      includeKnowledge?: boolean;
      includeRelationships?: boolean;
      filters?: Record<string, any>;
      sortBy?: string;
      sortDirection?: 'asc' | 'desc';
      userPreferences?: Record<string, any>;
      maxRetries?: number;
      timeout?: number;
    }
  ): Promise<{
    materials: any[];
    knowledgeEntries?: any[];
    relationships?: any[];
    domainSpecificData?: Record<string, any>;
    enhancedQuery: string;
    metadata?: {
      appliedOntology: string;
      appliedRanking: string;
      confidence: number;
    };
  }> {
    // Check if MCP is available
    const mcpAvailable = await this.isMCPAvailable();
    if (!mcpAvailable) {
      throw new Error('MCP server is not available');
    }

    // Check if user has enough credits
    const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
      userId,
      MCPServiceKey.DOMAIN_SEARCH,
      2 // 2 credits per domain search
    );

    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits');
    }

    try {
      // Validate input
      if (!options.query || typeof options.query !== 'string' || options.query.trim() === '') {
        throw new Error('A valid query is required for domain search');
      }

      if (!options.domain || typeof options.domain !== 'string') {
        throw new Error('A valid domain is required for domain search');
      }

      // Prepare request data
      const requestData: Record<string, any> = {
        query: options.query.trim(),
        domain: options.domain,
        material_type: options.materialType,
        limit: options.limit || 10,
        skip: options.skip || 0,
        include_knowledge: options.includeKnowledge !== false,
        include_relationships: options.includeRelationships !== false,
        filters: options.filters || {},
        sort_by: options.sortBy,
        sort_direction: options.sortDirection,
        user_preferences: options.userPreferences || {}
      };

      // Set up retry logic
      const maxRetries = options.maxRetries ?? 2;
      const timeout = options.timeout ?? MCP_TIMEOUT;
      let lastError: Error | null = null;
      let retryCount = 0;

      while (retryCount <= maxRetries) {
        try {
          // Call MCP endpoint
          const response = await axios.post(
            `${MCP_SERVER_URL}/api/v1/search/domain`,
            requestData,
            {
              headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
              },
              timeout: timeout
            }
          );

          // Track credit usage
          await creditService.useServiceCredits(
            userId,
            MCPServiceKey.DOMAIN_SEARCH,
            2,
            `${MCPServiceKey.DOMAIN_SEARCH} API usage`,
            {
              domain: options.domain,
              query: options.query,
              retryCount
            }
          );

          return {
            materials: response.data.materials || [],
            knowledgeEntries: response.data.knowledge_entries || [],
            relationships: response.data.relationships || [],
            domainSpecificData: response.data.domain_specific_data || {},
            enhancedQuery: response.data.enhanced_query || options.query,
            metadata: {
              appliedOntology: response.data.metadata?.applied_ontology || options.domain,
              appliedRanking: response.data.metadata?.applied_ranking || 'domain-specific',
              confidence: response.data.metadata?.confidence || 0.5
            }
          };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          // Check if we should retry
          const isRetryable = this.isRetryableError(lastError);

          if (isRetryable && retryCount < maxRetries) {
            // Exponential backoff with jitter
            const retryDelay = 1000; // Base delay of 1 second
            const delay = retryDelay * Math.pow(2, retryCount) + Math.random() * 300;
            logger.warn(`Retrying domain search after ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);

            await new Promise(resolve => setTimeout(resolve, delay));
            retryCount++;
            continue;
          }

          // If not retryable or max retries reached, break the loop
          break;
        }
      }

      // If we get here, all retries failed
      const errorMessage = lastError?.message || 'Unknown error';
      logger.error(`Error performing domain search: ${errorMessage}`, {
        userId,
        domain: options.domain,
        query: options.query.substring(0, 100) + (options.query.length > 100 ? '...' : ''),
        retries: retryCount
      });
      throw new Error(`Failed to perform domain search: ${errorMessage}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error performing domain search: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Process real-time analytics events using MCP
   * @param userId User ID
   * @param options Processing options
   * @returns Processed events
   */
  public async processRealTimeAnalytics(
    userId: string,
    options: {
      events: Array<{
        id: string;
        event_type: string;
        resource_type?: string;
        resource_id?: string;
        user_id?: string;
        query?: string;
        parameters?: Record<string, any>;
        timestamp?: string;
        source?: string;
        source_detail?: string;
      }>;
    }
  ): Promise<{
    processedEvents: Array<{
      id: string;
      processed_at: string;
      insights: Record<string, any>;
    }>;
  }> {
    // Check if MCP is available
    const mcpAvailable = await this.isMCPAvailable();
    if (!mcpAvailable) {
      throw new Error('MCP server is not available');
    }

    // Check if user has enough credits
    const estimatedUnits = Math.ceil(options.events.length / 10); // 1 credit per 10 events

    const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
      userId,
      MCPServiceKey.ANALYTICS_PROCESSING,
      estimatedUnits
    );

    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits');
    }

    try {
      // Prepare request data
      const requestData = {
        events: options.events
      };

      // Call MCP endpoint
      const response = await axios.post(
        `${MCP_SERVER_URL}/api/v1/analytics/real-time`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': userId
          },
          timeout: MCP_TIMEOUT
        }
      );

      // Track credit usage
      await creditService.useServiceCredits(
        userId,
        MCPServiceKey.ANALYTICS_PROCESSING,
        estimatedUnits,
        `${MCPServiceKey.ANALYTICS_PROCESSING} API usage`,
        {
          eventCount: options.events.length,
          processingType: 'real-time'
        }
      );

      return {
        processedEvents: response.data.processed_events || []
      };
    } catch (error) {
      logger.error(`Error processing real-time analytics: ${error}`);
      throw error;
    }
  }

  /**
   * Generate time-series forecast using MCP
   * @param userId User ID
   * @param options Forecast options
   * @returns Forecast result
   */
  public async generateTimeSeriesForecast(
    userId: string,
    options: {
      eventType?: string;
      resourceType?: string;
      startDate: string;
      endDate: string;
      forecastPeriods: number;
      interval: string;
    }
  ): Promise<{
    historical: Array<{
      date: string;
      count: number;
    }>;
    forecast: Array<{
      date: string;
      count: number;
      is_forecast: boolean;
    }>;
    parameters: {
      eventType?: string;
      resourceType?: string;
      startDate: string;
      endDate: string;
      forecastPeriods: number;
      interval: string;
    };
    modelInfo: {
      name: string;
      version: string;
      accuracy?: number;
      confidence?: number;
    };
  }> {
    // Check if MCP is available
    const mcpAvailable = await this.isMCPAvailable();
    if (!mcpAvailable) {
      throw new Error('MCP server is not available');
    }

    // Check if user has enough credits
    const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
      userId,
      MCPServiceKey.ANALYTICS_FORECAST,
      3 // 3 credits per forecast
    );

    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits');
    }

    try {
      // Prepare request data
      const requestData = {
        event_type: options.eventType,
        resource_type: options.resourceType,
        start_date: options.startDate,
        end_date: options.endDate,
        forecast_periods: options.forecastPeriods,
        interval: options.interval
      };

      // Call MCP endpoint
      const response = await axios.post(
        `${MCP_SERVER_URL}/api/v1/analytics/forecast`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': userId
          },
          timeout: MCP_TIMEOUT
        }
      );

      // Track credit usage
      await creditService.useServiceCredits(
        userId,
        MCPServiceKey.ANALYTICS_FORECAST,
        3,
        `${MCPServiceKey.ANALYTICS_FORECAST} API usage`,
        {
          forecastType: 'time-series',
          interval: options.interval,
          periods: options.forecastPeriods
        }
      );

      return {
        historical: response.data.historical || [],
        forecast: response.data.forecast || [],
        parameters: {
          eventType: options.eventType,
          resourceType: options.resourceType,
          startDate: options.startDate,
          endDate: options.endDate,
          forecastPeriods: options.forecastPeriods,
          interval: options.interval
        },
        modelInfo: response.data.model_info || {
          name: 'DefaultModel',
          version: '1.0'
        }
      };
    } catch (error) {
      logger.error(`Error generating time-series forecast: ${error}`);
      throw error;
    }
  }

  /**
   * Detect analytics anomalies using MCP
   * @param userId User ID
   * @param options Anomaly detection options
   * @returns Anomaly detection result
   */
  public async detectAnalyticsAnomalies(
    userId: string,
    options: {
      eventType?: string;
      resourceType?: string;
      startDate: string;
      endDate: string;
      interval: string;
      threshold?: number;
    }
  ): Promise<{
    timeSeries: Array<{
      date: string;
      count: number;
    }>;
    anomalies: Array<{
      date: string;
      count: number;
      mean: number;
      stdDev: number;
      zScore: number;
      severity: 'low' | 'medium' | 'high';
    }>;
    statistics: {
      mean: number;
      stdDev: number;
      threshold: number;
      confidence: number;
    };
    parameters: {
      eventType?: string;
      resourceType?: string;
      startDate: string;
      endDate: string;
      interval: string;
    };
  }> {
    // Check if MCP is available
    const mcpAvailable = await this.isMCPAvailable();
    if (!mcpAvailable) {
      throw new Error('MCP server is not available');
    }

    // Check if user has enough credits
    const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
      userId,
      MCPServiceKey.ANALYTICS_ANOMALY,
      3 // 3 credits per anomaly detection
    );

    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits');
    }

    try {
      // Prepare request data
      const requestData = {
        event_type: options.eventType,
        resource_type: options.resourceType,
        start_date: options.startDate,
        end_date: options.endDate,
        interval: options.interval,
        threshold: options.threshold || 2.0
      };

      // Call MCP endpoint
      const response = await axios.post(
        `${MCP_SERVER_URL}/api/v1/analytics/anomalies`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': userId
          },
          timeout: MCP_TIMEOUT
        }
      );

      // Track credit usage
      await creditService.useServiceCredits(
        userId,
        MCPServiceKey.ANALYTICS_ANOMALY,
        3,
        `${MCPServiceKey.ANALYTICS_ANOMALY} API usage`,
        {
          analysisType: 'anomaly-detection',
          interval: options.interval
        }
      );

      return {
        timeSeries: response.data.time_series || [],
        anomalies: response.data.anomalies || [],
        statistics: {
          mean: response.data.statistics.mean || 0,
          stdDev: response.data.statistics.std_dev || 0,
          threshold: response.data.statistics.threshold || 2.0,
          confidence: response.data.statistics.confidence || 0.7
        },
        parameters: {
          eventType: options.eventType,
          resourceType: options.resourceType,
          startDate: options.startDate,
          endDate: options.endDate,
          interval: options.interval
        }
      };
    } catch (error) {
      logger.error(`Error detecting analytics anomalies: ${error}`);
      throw error;
    }
  }

  /**
   * Predict user behavior using MCP
   * @param userId User ID making the request
   * @param options User behavior prediction options
   * @returns User behavior prediction result
   */
  public async predictUserBehavior(
    userId: string,
    options: {
      userId: string;
      predictionType: string;
      lookbackDays: number;
      includeUserProfile?: boolean;
    }
  ): Promise<{
    userId: string;
    predictionType: string;
    predictions: Array<{
      action: string;
      probability: number;
      confidence: number;
      recommendedContent?: Array<{
        id: string;
        type: string;
        name: string;
        score: number;
      }>;
    }>;
    userInsights: {
      activityLevel: 'low' | 'medium' | 'high';
      interests: Array<{
        category: string;
        score: number;
      }>;
      patterns: Array<{
        pattern: string;
        description: string;
        strength: number;
      }>;
    };
    modelInfo: {
      name: string;
      version: string;
      accuracy?: number;
      confidence?: number;
    };
  }> {
    // Check if MCP is available
    const mcpAvailable = await this.isMCPAvailable();
    if (!mcpAvailable) {
      throw new Error('MCP server is not available');
    }

    // Check if user has enough credits
    const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
      userId,
      MCPServiceKey.ANALYTICS_USER_BEHAVIOR,
      4 // 4 credits per user behavior prediction
    );

    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits');
    }

    try {
      // Prepare request data
      const requestData = {
        target_user_id: options.userId,
        prediction_type: options.predictionType,
        lookback_days: options.lookbackDays,
        include_user_profile: options.includeUserProfile
      };

      // Call MCP endpoint
      const response = await axios.post(
        `${MCP_SERVER_URL}/api/v1/analytics/user-behavior`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': userId
          },
          timeout: MCP_TIMEOUT
        }
      );

      // Track credit usage
      await creditService.useServiceCredits(
        userId,
        MCPServiceKey.ANALYTICS_USER_BEHAVIOR,
        4,
        `${MCPServiceKey.ANALYTICS_USER_BEHAVIOR} API usage`,
        {
          predictionType: options.predictionType,
          targetUserId: options.userId
        }
      );

      return {
        userId: options.userId,
        predictionType: options.predictionType,
        predictions: response.data.predictions || [],
        userInsights: response.data.user_insights || {
          activityLevel: 'low',
          interests: [],
          patterns: []
        },
        modelInfo: response.data.model_info || {
          name: 'DefaultModel',
          version: '1.0'
        }
      };
    } catch (error) {
      logger.error(`Error predicting user behavior: ${error}`);
      throw error;
    }
  }

  /**
   * Send email notification via MCP
   * @param userId User ID
   * @param options Email options
   * @returns Email send result
   */
  public async sendEmail(
    userId: string,
    options: {
      to: string | string[];
      subject: string;
      text?: string;
      html?: string;
      cc?: string | string[];
      bcc?: string | string[];
      attachments?: Array<{
        filename: string;
        content: string | Buffer;
        contentType?: string;
      }>;
    }
  ): Promise<{ messageId: string }> {
    // Call MCP endpoint
    return await this.callEndpoint<{ messageId: string }>(
      userId,
      MCPServiceKey.EMAIL_NOTIFICATION,
      'messaging/email',
      options,
      1 // 1 credit per email
    );
  }

  /**
   * Send SMS notification via MCP
   * @param userId User ID
   * @param options SMS options
   * @returns SMS send result
   */
  public async sendSMS(
    userId: string,
    options: {
      to: string | string[];
      message: string;
    }
  ): Promise<{ messageId: string }> {
    // Call MCP endpoint
    return await this.callEndpoint<{ messageId: string }>(
      userId,
      MCPServiceKey.SMS_NOTIFICATION,
      'messaging/sms',
      options,
      1 // 1 credit per SMS
    );
  }

  /**
   * Send push notification via MCP
   * @param userId User ID
   * @param options Push notification options
   * @returns Push notification result
   */
  public async sendPushNotification(
    userId: string,
    options: {
      to: string | string[];
      title: string;
      body: string;
      data?: Record<string, any>;
      sound?: string;
      badge?: number;
      channelId?: string;
      priority?: 'default' | 'normal' | 'high';
    }
  ): Promise<{ id: string; status: string }[]> {
    // Call MCP endpoint
    return await this.callEndpoint<{ id: string; status: string }[]>(
      userId,
      MCPServiceKey.PUSH_NOTIFICATION,
      'messaging/push',
      options,
      1 // 1 credit per push notification
    );
  }

  /**
   * Send webhook notification via MCP
   * @param userId User ID
   * @param options Webhook options
   * @returns Webhook send result
   */
  public async sendWebhook(
    userId: string,
    options: {
      url: string;
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      headers?: Record<string, string>;
      payload: any;
    }
  ): Promise<{ status: number; data: any }> {
    // Call MCP endpoint
    return await this.callEndpoint<{ status: number; data: any }>(
      userId,
      MCPServiceKey.WEBHOOK_NOTIFICATION,
      'messaging/webhook',
      options,
      1 // 1 credit per webhook
    );
  }

  /**
   * Fine-tune a model based on feedback data
   * @param options Fine-tuning options
   * @returns Fine-tuning results
   */
  public async fineTuneModel(options: {
    modelId: string;
    datasetId: string;
    jobId: string;
    userId?: string; // Admin user ID for tracking purposes
  }): Promise<any> {
    // Check if MCP is available
    const mcpAvailable = await this.isMCPAvailable();
    if (!mcpAvailable) {
      throw new Error('MCP server is not available');
    }

    try {
      // Call MCP endpoint
      const startTime = Date.now();
      const response = await axios.post(
        `${MCP_SERVER_URL}/api/v1/model/fine-tune`,
        options,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(options.userId && { 'X-User-ID': options.userId })
          },
          timeout: MCP_TIMEOUT
        }
      );
      const duration = Date.now() - startTime;

      // Log the fine-tuning operation for tracking purposes
      logger.info(`Fine-tuning model completed`, {
        modelId: options.modelId,
        datasetId: options.datasetId,
        jobId: options.jobId,
        duration,
        adminUserId: options.userId
      });

      return response.data;
    } catch (error) {
      logger.error(`Error fine-tuning model: ${error}`);
      throw error;
    }
  }

  /**
   * Cancel a fine-tuning job
   * @param jobId Job ID
   * @param userId Admin user ID for tracking purposes
   * @returns Cancellation result
   */
  public async cancelFineTuningJob(jobId: string, userId?: string): Promise<any> {
    // Check if MCP is available
    const mcpAvailable = await this.isMCPAvailable();
    if (!mcpAvailable) {
      throw new Error('MCP server is not available');
    }

    try {
      // Call MCP endpoint
      const response = await axios.post(
        `${MCP_SERVER_URL}/api/v1/model/fine-tune/${jobId}/cancel`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            ...(userId && { 'X-User-ID': userId })
          },
          timeout: MCP_TIMEOUT
        }
      );

      // Log the cancellation for tracking purposes
      logger.info(`Fine-tuning job cancelled`, {
        jobId,
        adminUserId: userId
      });

      return response.data;
    } catch (error) {
      logger.error(`Error cancelling fine-tuning job: ${error}`);
      throw error;
    }
  }

  /**
   * Get fine-tuning job status
   * @param jobId Job ID
   * @param userId Admin user ID for tracking purposes
   * @returns Job status
   */
  public async getFineTuningJobStatus(jobId: string, userId?: string): Promise<any> {
    // Check if MCP is available
    const mcpAvailable = await this.isMCPAvailable();
    if (!mcpAvailable) {
      throw new Error('MCP server is not available');
    }

    try {
      // Call MCP endpoint
      const response = await axios.get(
        `${MCP_SERVER_URL}/api/v1/model/fine-tune/${jobId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(userId && { 'X-User-ID': userId })
          },
          timeout: MCP_TIMEOUT
        }
      );

      return response.data;
    } catch (error) {
      logger.error(`Error getting fine-tuning job status: ${error}`);
      throw error;
    }
  }
}

// Create singleton instance
const mcpClientService = new MCPClientService();

export default mcpClientService;

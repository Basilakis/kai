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
  
  // 3D Model Generation
  MODEL_RECONSTRUCTION = '3d.model-reconstruction',
  TEXT_TO_3D = '3d.text-to-3d',
  ROOM_LAYOUT = '3d.room-layout',
  
  // Vector Database Operations
  VECTOR_SEARCH = 'vector.search',
  VECTOR_EMBEDDING = 'vector.embedding',
  VECTOR_INDEXING = 'vector.indexing'
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
   * @returns Response from the MCP endpoint
   */
  public async callEndpoint<T>(
    userId: string,
    serviceKey: MCPServiceKey,
    endpoint: string,
    data: any,
    estimatedUnits: number = 1
  ): Promise<T> {
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
    
    try {
      // Call MCP endpoint
      const client = this.getClient();
      const startTime = Date.now();
      const result = await client.callEndpoint<T>(endpoint, data);
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
      logger.error(`Error calling MCP endpoint ${endpoint}: ${error}`);
      throw error;
    }
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
    } = {}
  ): Promise<{ modelUrl: string; thumbnailUrl: string }> {
    // Convert options to MCP format
    const mcpData = {
      prompt,
      model: options.model || 'shapE',
      format: options.format || 'glb',
      quality: options.quality || 'medium'
    };
    
    // Call MCP endpoint
    return await this.callEndpoint<{ modelUrl: string; thumbnailUrl: string }>(
      userId,
      MCPServiceKey.TEXT_TO_3D,
      '3d/text-to-3d',
      mcpData,
      5 // 5 credits per 3D model
    );
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
    } = {}
  ): Promise<{ modelUrl: string; thumbnailUrl: string }> {
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
      
      // Send request to server
      const startTime = Date.now();
      const response = await axios.post(`${MCP_SERVER_URL}/api/v1/3d/reconstruct`, formData, {
        headers: {
          ...formData.getHeaders()
        }
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
      logger.error(`Error reconstructing 3D model: ${error}`);
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
}

// Create singleton instance
const mcpClientService = new MCPClientService();

export default mcpClientService;

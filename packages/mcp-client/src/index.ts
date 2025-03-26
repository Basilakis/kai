/**
 * Model Context Protocol (MCP) Client SDK
 * 
 * This SDK provides a TypeScript client for communicating with the Model Context Protocol server.
 * It includes methods for model management, material recognition, and agent communication.
 * 
 * Features:
 * - Model listing and info retrieval
 * - Material recognition through image uploads
 * - Context management
 * - Agent-friendly communication methods
 * 
 * Usage example:
 * ```typescript
 * import { MCPClient } from '@kai/mcp-client';
 * 
 * const client = new MCPClient('http://localhost:8000');
 * 
 * // Recognize a material in an image
 * const result = await client.recognizeMaterial('/path/to/image.jpg', {
 *   modelType: 'hybrid',
 *   confidenceThreshold: 0.7
 * });
 * ```
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Supported model types for material recognition
 */
export enum ModelType {
  HYBRID = "hybrid",
  FEATURE_BASED = "feature-based",
  ML_BASED = "ml-based"
}

/**
 * Options for material recognition
 */
export interface RecognitionOptions {
  /**
   * Type of model to use for recognition
   */
  modelType?: ModelType;
  
  /**
   * Minimum confidence threshold for matches (0-1)
   */
  confidenceThreshold?: number;
  
  /**
   * Maximum number of results to return
   */
  maxResults?: number;
  
  /**
   * Whether to include detailed feature information in the response
   */
  includeFeatures?: boolean;
}

/**
 * Material match in recognition results
 */
export interface ModelMatch {
  /**
   * ID of the matched material
   */
  materialId: string;
  
  /**
   * Confidence score (0-1)
   */
  confidence: number;
  
  /**
   * Detailed feature information (if requested)
   */
  features?: Record<string, any>;
}

/**
 * Result of material recognition
 */
export interface RecognitionResult {
  /**
   * List of matched materials
   */
  matches: ModelMatch[];
  
  /**
   * Extracted features from the image
   */
  extractedFeatures?: Record<string, any>;
  
  /**
   * Processing time in seconds
   */
  processingTime: number;
  
  /**
   * ID of the model used for recognition
   */
  modelId: string;
  
  /**
   * Unique ID for this recognition request
   */
  requestId: string;
}

/**
 * Information about a model
 */
export interface ModelInfo {
  /**
   * Unique ID of the model
   */
  id: string;
  
  /**
   * Display name of the model
   */
  name: string;
  
  /**
   * Type of the model
   */
  type: string;
  
  /**
   * Version of the model
   */
  version: string;
  
  /**
   * Description of the model
   */
  description: string;
  
  /**
   * When the model was created
   */
  created_at: string;
  
  /**
   * When the model was last updated
   */
  updated_at: string;
  
  /**
   * Current status of the model
   */
  status: string;
  
  /**
   * List of model capabilities
   */
  capabilities: string[];
}

/**
 * Context information for a model
 */
export interface ModelContext {
  /**
   * ID of the model
   */
  model_id: string;
  
  /**
   * Version of the model
   */
  version: string;
  
  /**
   * Runtime parameters for the model
   */
  parameters?: Record<string, any>;
  
  /**
   * Additional metadata for the model
   */
  metadata?: Record<string, any>;
}

/**
 * Message to send to the agent
 */
export interface AgentMessage {
  /**
   * Type of message
   */
  message_type: string;
  
  /**
   * Message content
   */
  content: Record<string, any>;
  
  /**
   * Timestamp of the message
   */
  timestamp?: number;
}

/**
 * Client for the Model Context Protocol server
 */
export class MCPClient {
  private client: AxiosInstance;
  private baseUrl: string;
  
  /**
   * Create a new MCP client
   * 
   * @param baseUrl - Base URL of the MCP server
   */
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  
  /**
   * Get server information
   * 
   * @returns Server information
   */
  async getServerInfo(): Promise<Record<string, any>> {
    const response = await this.client.get('/');
    return response.data;
  }
  
  /**
   * Check server health
   * 
   * @returns Health check result
   */
  async checkHealth(): Promise<{ status: string; timestamp: number }> {
    const response = await this.client.get('/health');
    return response.data;
  }
  
  /**
   * List all available models
   * 
   * @returns List of model information
   */
  async listModels(): Promise<ModelInfo[]> {
    const response = await this.client.get('/api/v1/models');
    return response.data;
  }
  
  /**
   * Get information about a specific model
   * 
   * @param modelId - ID of the model
   * @returns Model information
   */
  async getModelInfo(modelId: string): Promise<ModelInfo> {
    const response = await this.client.get(`/api/v1/models/${modelId}`);
    return response.data;
  }
  
  /**
   * Get the context for a specific model
   * 
   * @param modelId - ID of the model
   * @returns Model context
   */
  async getModelContext(modelId: string): Promise<ModelContext> {
    const response = await this.client.get(`/api/v1/models/${modelId}/context`);
    return response.data;
  }
  
  /**
   * Update the context for a specific model
   * 
   * @param modelId - ID of the model
   * @param context - New model context
   * @returns Success response
   */
  async updateModelContext(modelId: string, context: ModelContext): Promise<{ status: string; message: string }> {
    const response = await this.client.put(`/api/v1/models/${modelId}/context`, context);
    return response.data;
  }
  
  /**
   * Recognize materials in an image
   * 
   * @param imagePath - Path to the image file
   * @param options - Recognition options
   * @returns Recognition result
   */
  async recognizeMaterial(
    imagePath: string,
    options?: RecognitionOptions
  ): Promise<RecognitionResult> {
    // Validate image path
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }
    
    // Create form data with image
    const formData = new FormData();
    formData.append('image', fs.createReadStream(imagePath));
    
    // Convert options to server format
    if (options) {
      const serverOptions = {
        model_type: options.modelType || ModelType.HYBRID,
        confidence_threshold: options.confidenceThreshold || 0.6,
        max_results: options.maxResults || 5,
        include_features: options.includeFeatures !== false,
      };
      formData.append('options', JSON.stringify(serverOptions));
    }
    
    // Send request to server
    const response = await this.client.post('/api/v1/recognize', formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });
    
    return response.data;
  }
  
  /**
   * Recognize materials in an image buffer
   * 
   * @param imageBuffer - Image buffer
   * @param imageType - MIME type of the image
   * @param options - Recognition options
   * @returns Recognition result
   */
  async recognizeMaterialFromBuffer(
    imageBuffer: Buffer,
    imageType: string = 'image/jpeg',
    options?: RecognitionOptions
  ): Promise<RecognitionResult> {
    // Create form data with image buffer
    const formData = new FormData();
    formData.append('image', imageBuffer, {
      filename: `image.${imageType.split('/')[1] || 'jpg'}`,
      contentType: imageType,
    });
    
    // Convert options to server format
    if (options) {
      const serverOptions = {
        model_type: options.modelType || ModelType.HYBRID,
        confidence_threshold: options.confidenceThreshold || 0.6,
        max_results: options.maxResults || 5,
        include_features: options.includeFeatures !== false,
      };
      formData.append('options', JSON.stringify(serverOptions));
    }
    
    // Send request to server
    const response = await this.client.post('/api/v1/recognize', formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });
    
    return response.data;
  }
  
  /**
   * Send a message to the agent
   * 
   * @param message - Agent message
   * @returns Success response
   */
  async sendAgentMessage(message: AgentMessage): Promise<{ status: string }> {
    const response = await this.client.post('/api/v1/agent/message', {
      message_type: message.message_type,
      content: message.content,
      timestamp: message.timestamp || Date.now() / 1000,
    });
    return response.data;
  }
  
  /**
   * Get messages from the agent queue
   * 
   * @param maxWait - Maximum time to wait for messages (seconds)
   * @returns Agent messages
   */
  async getAgentMessages(maxWait: number = 1.0): Promise<{ messages: any[]; count: number }> {
    const response = await this.client.get('/api/v1/agent/messages', {
      params: { max_wait: maxWait },
    });
    return response.data;
  }
}

// Export the main client class and interfaces
export default MCPClient;
/**
 * MCP (Model Context Protocol) Client
 * 
 * This module provides a client for interacting with the MCP server.
 * It consolidates duplicate MCP client implementations across packages.
 * 
 * Features:
 * - Material recognition
 * - Model management
 * - Agent communication
 * - Context management
 */

import { ApiClient, ApiClientConfig } from './apiClient';
import { createLogger } from '../../utils/unified-logger';
import { config } from '../../utils/unified-config';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';

const logger = createLogger('MCPClient');

/**
 * Recognition options
 */
export interface RecognitionOptions {
  modelType?: 'hybrid' | 'feature-based' | 'ml-based';
  confidenceThreshold?: number;
  maxResults?: number;
  includeFeatures?: boolean;
  materialType?: string;
  similarityThreshold?: number;
}

/**
 * Recognition result
 */
export interface RecognitionResult {
  materials: Array<{
    id: string;
    name: string;
    confidence: number;
    properties?: Record<string, any>;
    features?: Record<string, any>;
  }>;
  processingTime?: number;
  modelUsed?: string;
}

/**
 * Model information
 */
export interface ModelInfo {
  id: string;
  name: string;
  version: string;
  type: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'inactive' | 'training';
  metrics?: Record<string, any>;
}

/**
 * Agent message
 */
export interface AgentMessage {
  message_type: string;
  content: Record<string, any>;
  timestamp?: number;
}

/**
 * MCP Client
 */
export class MCPClient extends ApiClient {
  /**
   * Create a new MCP client
   */
  constructor(config: ApiClientConfig) {
    super(config);
    logger.info(`MCPClient initialized with baseURL: ${config.baseURL}`);
  }
  
  /**
   * Check server health
   */
  public async checkHealth(): Promise<{ status: string; version: string }> {
    return this.get<{ status: string; version: string }>('/health');
  }
  
  /**
   * List available models
   */
  public async listModels(): Promise<ModelInfo[]> {
    return this.get<ModelInfo[]>('/api/v1/models');
  }
  
  /**
   * Get model information
   */
  public async getModel(modelId: string): Promise<ModelInfo> {
    return this.get<ModelInfo>(`/api/v1/models/${modelId}`);
  }
  
  /**
   * Recognize material from a file path
   */
  public async recognizeMaterial(
    imagePath: string,
    options?: RecognitionOptions
  ): Promise<RecognitionResult> {
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`File not found: ${imagePath}`);
    }
    
    // Create form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(imagePath));
    
    // Add options
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
    }
    
    // Make request
    return this.post<RecognitionResult>('/api/v1/recognition', formData, {
      headers: {
        ...formData.getHeaders()
      }
    });
  }
  
  /**
   * Recognize material from a buffer
   */
  public async recognizeMaterialFromBuffer(
    buffer: Buffer,
    mimeType: string,
    options?: RecognitionOptions
  ): Promise<RecognitionResult> {
    // Create form data
    const formData = new FormData();
    formData.append('file', buffer, {
      filename: 'image.' + mimeType.split('/')[1],
      contentType: mimeType
    });
    
    // Add options
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
    }
    
    // Make request
    return this.post<RecognitionResult>('/api/v1/recognition', formData, {
      headers: {
        ...formData.getHeaders()
      }
    });
  }
  
  /**
   * Generate image embedding
   */
  public async generateImageEmbedding(
    imagePath: string
  ): Promise<{ embedding: number[] }> {
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`File not found: ${imagePath}`);
    }
    
    // Create form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(imagePath));
    
    // Make request
    return this.post<{ embedding: number[] }>('/api/v1/embeddings/image', formData, {
      headers: {
        ...formData.getHeaders()
      }
    });
  }
  
  /**
   * Generate image embedding from buffer
   */
  public async generateImageEmbeddingFromBuffer(
    buffer: Buffer,
    mimeType: string
  ): Promise<{ embedding: number[] }> {
    // Create form data
    const formData = new FormData();
    formData.append('file', buffer, {
      filename: 'image.' + mimeType.split('/')[1],
      contentType: mimeType
    });
    
    // Make request
    return this.post<{ embedding: number[] }>('/api/v1/embeddings/image', formData, {
      headers: {
        ...formData.getHeaders()
      }
    });
  }
  
  /**
   * Send a message to the agent
   */
  public async sendAgentMessage(message: AgentMessage): Promise<{ success: boolean }> {
    // Add timestamp if not provided
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }
    
    // Make request
    return this.post<{ success: boolean }>('/api/v1/agent/message', message);
  }
  
  /**
   * Get agent messages
   */
  public async getAgentMessages(
    limit: number = 10,
    offset: number = 0
  ): Promise<AgentMessage[]> {
    return this.get<AgentMessage[]>('/api/v1/agent/messages', {
      limit,
      offset
    });
  }
  
  /**
   * Call a generic MCP endpoint
   */
  public async callEndpoint<T>(
    endpoint: string,
    data: any
  ): Promise<T> {
    // Ensure endpoint starts with /api/v1/
    const apiEndpoint = endpoint.startsWith('/api/v1/')
      ? endpoint
      : `/api/v1/${endpoint}`;
    
    // Make request
    return this.post<T>(apiEndpoint, data);
  }
  
  /**
   * Perform multi-modal search
   */
  public async multiModalSearch(options: {
    textQuery?: string;
    imageData?: Buffer;
    materialType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    materials: Array<{
      id: string;
      name: string;
      score: number;
      properties?: Record<string, any>;
    }>;
    knowledgeEntries?: Array<{
      id: string;
      content: string;
      score: number;
      metadata?: Record<string, any>;
    }>;
    relationships?: Array<{
      source: string;
      target: string;
      type: string;
      score: number;
    }>;
    enhancedTextQuery?: string;
  }> {
    // Create form data
    const formData = new FormData();
    
    // Add text query if provided
    if (options.textQuery) {
      formData.append('text_query', options.textQuery);
    }
    
    // Add image if provided
    if (options.imageData) {
      formData.append('image', options.imageData, {
        filename: 'image.jpg',
        contentType: 'image/jpeg'
      });
    }
    
    // Add other options
    if (options.materialType) {
      formData.append('material_type', options.materialType);
    }
    
    if (options.limit) {
      formData.append('limit', String(options.limit));
    }
    
    if (options.offset) {
      formData.append('offset', String(options.offset));
    }
    
    // Make request
    return this.post<any>('/api/v1/search/multi-modal', formData, {
      headers: {
        ...formData.getHeaders()
      }
    });
  }
}

/**
 * Create an MCP client with default configuration
 */
export function createMCPClient(overrides?: Partial<ApiClientConfig>): MCPClient {
  const mlConfig = config.get('ml');
  
  const defaultConfig: ApiClientConfig = {
    baseURL: mlConfig?.mcpServerUrl || 'http://localhost:8000',
    timeout: 60000, // 1 minute
    useAuth: false
  };
  
  return new MCPClient({
    ...defaultConfig,
    ...overrides
  });
}

// Export default MCP client instance
export const mcpClient = createMCPClient();

// Export default for convenience
export default mcpClient;

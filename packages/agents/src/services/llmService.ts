/**
 * LLM Service Connector
 *
 * Provides methods for interacting with a local/dedicated LLM API endpoint.
 * Used as a fallback when MCP is not available for LLM inference.
 */

import { BaseService, ServiceConfig, ApiError } from './baseService';
import { createLogger } from '../utils/logger';

const logger = createLogger('LLMService');

// --- Copied types from llmInferenceMcpAdapter.ts ---

export interface LLMCompletionOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[]; // Note: Adapter uses 'stop' for chat, maybe align this?
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  logitBias?: Record<string, number>;
  streaming?: boolean; // May not be fully supported by local fallback
  modelVersion?: string;
}

export interface LLMChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
}

export interface LLMChatOptions extends Omit<LLMCompletionOptions, 'stopSequences'> {
  stop?: string[]; // Aligns with adapter's chat options
  functions?: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }>;
}

export interface LLMEmbeddingOptions {
  model: string;
  dimensions?: number;
  modelVersion?: string;
}

export interface LLMCompletionResult {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'content_filter' | null;
}

export interface LLMChatResult {
  message: LLMChatMessage;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'function_call' | 'content_filter' | null;
}

export interface LLMEmbeddingResult {
  embedding: number[];
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

// --- End of copied types ---


/**
 * Service for interacting with LLM endpoints
 */
export class LLMService extends BaseService {
  /**
   * Create a new LLMService instance
   */
  constructor(config: ServiceConfig) {
    super(config);
    logger.info(`LLMService initialized with base URL: ${this.baseURL}`);
  }

  /**
   * Generate a completion using the LLM API
   */
  async generateCompletion(
    prompt: string,
    options: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    logger.debug(`Generating completion locally for model: ${options.model}`);
    try {
      // Map adapter options to potential API payload structure
      const payload = {
        prompt,
        model: options.model,
        temperature: options.temperature,
        max_tokens: options.maxTokens, // Assuming API uses snake_case
        stop: options.stopSequences, // Assuming API uses 'stop'
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        logit_bias: options.logitBias,
        stream: options.streaming // Pass streaming flag if API supports it
       };
       // Remove undefined keys
       Object.keys(payload).forEach((key) => {
         if (payload[key as keyof typeof payload] === undefined) {
           delete payload[key as keyof typeof payload];
         }
       });

       const response = await this.post<LLMCompletionResult>('/llm/completion', payload);
       logger.debug(`Local completion generated successfully`);
      return response;
    } catch (error) {
      const errorMessage = error instanceof ApiError ? `${error.message} (${error.statusCode})` : `${error}`;
      logger.error(`Error generating local completion: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Generate a chat completion using the LLM API
   */
  async generateChatCompletion(
    messages: LLMChatMessage[],
    options: LLMChatOptions
  ): Promise<LLMChatResult> {
    logger.debug(`Generating chat completion locally for model: ${options.model}`);
    try {
       // Map adapter options to potential API payload structure
      const payload = {
        messages,
        model: options.model,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stop: options.stop,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        functions: options.functions,
        stream: options.streaming
       };
       // Remove undefined keys
       Object.keys(payload).forEach((key) => {
         if (payload[key as keyof typeof payload] === undefined) {
           delete payload[key as keyof typeof payload];
         }
       });

       const response = await this.post<LLMChatResult>('/llm/chat', payload);
       logger.debug(`Local chat completion generated successfully`);
      return response;
    } catch (error) {
      const errorMessage = error instanceof ApiError ? `${error.message} (${error.statusCode})` : `${error}`;
      logger.error(`Error generating local chat completion: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Generate embeddings using the LLM API
   */
  async generateEmbeddings(
    texts: string[],
    options: LLMEmbeddingOptions
  ): Promise<LLMEmbeddingResult[]> {
    logger.debug(`Generating embeddings locally for model: ${options.model}`);
    try {
      const payload = {
        texts, // Assuming API takes 'texts' directly
        model: options.model,
        dimensions: options.dimensions
       };
       // Remove undefined keys
       Object.keys(payload).forEach((key) => {
         if (payload[key as keyof typeof payload] === undefined) {
           delete payload[key as keyof typeof payload];
         }
       });

       // Assuming the API returns an array of results directly
       const response = await this.post<LLMEmbeddingResult[]>('/llm/embeddings', payload);
      logger.debug(`Local embeddings generated successfully for ${texts.length} texts`);
      return response;
    } catch (error) {
      const errorMessage = error instanceof ApiError ? `${error.message} (${error.statusCode})` : `${error}`;
      logger.error(`Error generating local embeddings: ${errorMessage}`);
      throw error;
    }
  }
}
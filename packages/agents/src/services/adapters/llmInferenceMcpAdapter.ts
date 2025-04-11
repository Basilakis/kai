/**
 * LLM Inference MCP Adapter
 * 
 * This adapter provides integration between agent components and the MCP server
 * for large language model inference operations. It handles various types of
 * LLM operations including completion, chat, and embedding generation.
 * 
 * When MCP is enabled, it proxies operations to the MCP server.
 * When MCP is disabled, it falls back to the local implementation.
 */

import { createLogger } from '../../utils/logger';
import { 
  isMCPEnabledForComponent, 
  withMCPFallback, 
  callMCPEndpoint 
} from '../../utils/mcpIntegration';
import { addToBatch, isBatchingEnabled } from '../../utils/mcpBatchProcessor';

// Create a logger for the adapter
const logger = createLogger('LLMInferenceMCPAdapter');

// Type definitions
export interface LLMCompletionOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  logitBias?: Record<string, number>;
  streaming?: boolean;
  modelVersion?: string;
}

export interface LLMChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
}

export interface LLMChatOptions extends Omit<LLMCompletionOptions, 'stopSequences'> {
  stop?: string[];
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

export type LLMStreamingCallback = (chunk: string, done: boolean) => void;

/**
 * Generate a completion using the MCP server
 * 
 * @param prompt The prompt for the completion
 * @param options Completion options
 * @param streamingCallback Optional callback for streaming responses
 * @returns Completion result
 */
async function generateCompletionWithMCP(
  prompt: string,
  options: LLMCompletionOptions,
  streamingCallback?: LLMStreamingCallback
): Promise<LLMCompletionResult> {
  try {
    // If streaming is requested, we can't use batching
    if (options.streaming && streamingCallback) {
      logger.debug('Streaming completion requested, using direct MCP call');
      
      // For streaming, we'd need a more complex implementation that uses
      // WebSockets or another streaming protocol. This is a placeholder.
      const result = await callMCPEndpoint<{
        streamingUrl: string;
        requestId: string;
      }>(
        'agentInference',
        'llm/completion/stream',
        { prompt, options }
      );
      
      // In a real implementation, we'd connect to the streaming URL and
      // forward chunks to the callback. For now, we'll simulate it.
      const simulatedResult: LLMCompletionResult = {
        text: 'This is a simulated streaming response.',
        usage: {
          promptTokens: prompt.length / 4,
          completionTokens: 10,
          totalTokens: prompt.length / 4 + 10
        },
        finishReason: 'stop'
      };
      
      // Simulate streaming with a non-blocking approach
      const chunks = ['This is a ', 'simulated ', 'streaming ', 'response.'];
      let currentIndex = 0;
      
      const streamNextChunk = () => {
        if (currentIndex >= chunks.length) return;
        
        const isLast = currentIndex === chunks.length - 1;
        streamingCallback(chunks[currentIndex], isLast);
        currentIndex++;
        
        if (!isLast) {
          setTimeout(streamNextChunk, 100);
        }
      };
      
      // Start streaming
      streamNextChunk();
      
      return simulatedResult;
    }
    
    // Check if batching is enabled and use it if possible
    if (isBatchingEnabled('agentInference')) {
      logger.debug('Using batched LLM completion via MCP');
      return await addToBatch<{prompt: string, options: LLMCompletionOptions}, LLMCompletionResult>(
        'agentInference',
        { prompt, options }
      );
    }
    
    // Otherwise use direct MCP call
    logger.debug('Using direct LLM completion via MCP');
    const result = await callMCPEndpoint<LLMCompletionResult>(
      'agentInference',
      'llm/completion',
      { prompt, options }
    );
    
    logger.debug(`Generated completion with MCP, ${result.usage.totalTokens} tokens used`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`MCP LLM completion failed: ${errorMessage}`);
    throw error;
  }
}

/**
 * Generate a completion using the local implementation
 * 
 * @param prompt The prompt for the completion
 * @param options Completion options
 * @param streamingCallback Optional callback for streaming responses
 * @returns Completion result
 */
async function generateCompletionLocally(
  prompt: string,
  options: LLMCompletionOptions,
  streamingCallback?: LLMStreamingCallback
): Promise<LLMCompletionResult> {
  try {
    logger.debug('Using local LLM completion implementation');
    
    // In a real implementation, this would use a local service
    // For example: return localLLMService.generateCompletion(prompt, options);
    
    // For now, return a mock implementation
    const mockResult: LLMCompletionResult = {
      text: `This is a mock response to: "${prompt.substring(0, 30)}..."`,
      usage: {
        promptTokens: Math.ceil(prompt.length / 4),
        completionTokens: 15,
        totalTokens: Math.ceil(prompt.length / 4) + 15
      },
      finishReason: 'stop'
    };
    
    // Simulate streaming if requested - using non-blocking approach
    if (options.streaming && streamingCallback) {
      const chunks = mockResult.text.split(' ');
      let currentIndex = 0;
      
      const streamNextChunk = () => {
        if (currentIndex >= chunks.length) return;
        
        const isLast = currentIndex === chunks.length - 1;
        streamingCallback(chunks[currentIndex] + (isLast ? '' : ' '), isLast);
        currentIndex++;
        
        if (!isLast) {
          setTimeout(streamNextChunk, 100);
        }
      };
      
      // Start streaming
      streamNextChunk();
    }
    
    return mockResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Local LLM completion failed: ${errorMessage}`);
    throw error;
  }
}

/**
 * Generate a chat completion using the MCP server
 * 
 * @param messages The chat messages
 * @param options Chat options
 * @param streamingCallback Optional callback for streaming responses
 * @returns Chat result
 */
async function generateChatCompletionWithMCP(
  messages: LLMChatMessage[],
  options: LLMChatOptions,
  streamingCallback?: LLMStreamingCallback
): Promise<LLMChatResult> {
  try {
    // If streaming is requested, we can't use batching
    if (options.streaming && streamingCallback) {
      logger.debug('Streaming chat completion requested, using direct MCP call');
      
      // Simplified for now - similar to the completion streaming scenario
      const result = await callMCPEndpoint<{
        streamingUrl: string;
        requestId: string;
      }>(
        'agentInference',
        'llm/chat/stream',
        { messages, options }
      );
      
      // Simulate streaming with a non-blocking approach
      const simulatedResponse = 'This is a simulated streaming chat response.';
      const words = simulatedResponse.split(' ');
      let currentIndex = 0;
      
      const streamNextWord = () => {
        if (currentIndex >= words.length) return;
        
        const isLast = currentIndex === words.length - 1;
        streamingCallback(words[currentIndex] + (isLast ? '' : ' '), isLast);
        currentIndex++;
        
        if (!isLast) {
          setTimeout(streamNextWord, 100);
        }
      };
      
      // Start streaming
      streamNextWord();
      
      return {
        message: {
          role: 'assistant',
          content: simulatedResponse
        },
        usage: {
          promptTokens: JSON.stringify(messages).length / 4,
          completionTokens: simulatedResponse.length / 4,
          totalTokens: JSON.stringify(messages).length / 4 + simulatedResponse.length / 4
        },
        finishReason: 'stop'
      };
    }
    
    // Check if batching is enabled and use it if possible
    if (isBatchingEnabled('agentInference')) {
      logger.debug('Using batched LLM chat completion via MCP');
      return await addToBatch<{messages: LLMChatMessage[], options: LLMChatOptions}, LLMChatResult>(
        'agentInference',
        { messages, options }
      );
    }
    
    // Otherwise use direct MCP call
    logger.debug('Using direct LLM chat completion via MCP');
    const result = await callMCPEndpoint<LLMChatResult>(
      'agentInference',
      'llm/chat',
      { messages, options }
    );
    
    logger.debug(`Generated chat completion with MCP, ${result.usage.totalTokens} tokens used`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`MCP LLM chat completion failed: ${errorMessage}`);
    throw error;
  }
}

/**
 * Generate a chat completion using the local implementation
 * 
 * @param messages The chat messages
 * @param options Chat options
 * @param streamingCallback Optional callback for streaming responses
 * @returns Chat result
 */
async function generateChatCompletionLocally(
  messages: LLMChatMessage[],
  options: LLMChatOptions,
  streamingCallback?: LLMStreamingCallback
): Promise<LLMChatResult> {
  try {
    logger.debug('Using local LLM chat completion implementation');
    
    // In a real implementation, this would use a local service
    // For example: return localLLMService.generateChatCompletion(messages, options);
    
    // Get the last user message for our mock
    const lastUserMessage = messages
      .filter(msg => msg.role === 'user')
      .pop()?.content || 'No user message found';
    
    // For now, return a mock implementation
    const mockResponse = `This is a mock chat response to: "${lastUserMessage.substring(0, 30)}..."`;
    
    // Simulate streaming if requested - using non-blocking approach
    if (options.streaming && streamingCallback) {
      const chunks = mockResponse.split(' ');
      let currentIndex = 0;
      
      const streamNextChunk = () => {
        if (currentIndex >= chunks.length) return;
        
        const isLast = currentIndex === chunks.length - 1;
        streamingCallback(chunks[currentIndex] + (isLast ? '' : ' '), isLast);
        currentIndex++;
        
        if (!isLast) {
          setTimeout(streamNextChunk, 100);
        }
      };
      
      // Start streaming
      streamNextChunk();
    }
    
    return {
      message: {
        role: 'assistant',
        content: mockResponse
      },
      usage: {
        promptTokens: JSON.stringify(messages).length / 4,
        completionTokens: mockResponse.length / 4,
        totalTokens: JSON.stringify(messages).length / 4 + mockResponse.length / 4
      },
      finishReason: 'stop'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Local LLM chat completion failed: ${errorMessage}`);
    throw error;
  }
}

/**
 * Generate embeddings using the MCP server
 * 
 * @param texts Array of texts to embed
 * @param options Embedding options
 * @returns Embedding results
 */
async function generateEmbeddingsWithMCP(
  texts: string[],
  options: LLMEmbeddingOptions
): Promise<LLMEmbeddingResult[]> {
  try {
    // Check if batching is enabled and use it if possible
    if (isBatchingEnabled('agentInference')) {
      logger.debug('Using batched LLM embeddings via MCP');
      return await addToBatch<{texts: string[], options: LLMEmbeddingOptions}, LLMEmbeddingResult[]>(
        'agentInference',
        { texts, options }
      );
    }
    
    // Otherwise use direct MCP call
    logger.debug('Using direct LLM embeddings via MCP');
    const results = await callMCPEndpoint<LLMEmbeddingResult[]>(
      'agentInference',
      'llm/embeddings',
      { texts, options }
    );
    
    logger.debug(`Generated embeddings with MCP for ${texts.length} texts`);
    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`MCP LLM embeddings failed: ${errorMessage}`);
    throw error;
  }
}

/**
 * Generate embeddings using the local implementation
 * 
 * @param texts Array of texts to embed
 * @param options Embedding options
 * @returns Embedding results
 */
async function generateEmbeddingsLocally(
  texts: string[],
  options: LLMEmbeddingOptions
): Promise<LLMEmbeddingResult[]> {
  try {
    logger.debug('Using local LLM embeddings implementation');
    
    // In a real implementation, this would use a local service
    // For example: return localLLMService.generateEmbeddings(texts, options);
    
    // For now, return a mock implementation
    const dimensions = options.dimensions || 1536; // Default for many embedding models
    
    return texts.map(text => ({
      embedding: Array(dimensions).fill(0).map(() => Math.random() * 2 - 1), // Random unit vector
      usage: {
        promptTokens: Math.ceil(text.length / 4),
        totalTokens: Math.ceil(text.length / 4)
      }
    }));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Local LLM embeddings failed: ${errorMessage}`);
    throw error;
  }
}

/**
 * Generate a completion with the specified model
 * 
 * @param prompt The prompt for the completion
 * @param options Completion options
 * @param streamingCallback Optional callback for streaming responses
 * @returns Completion result
 */
export async function generateCompletion(
  prompt: string,
  options: LLMCompletionOptions,
  streamingCallback?: LLMStreamingCallback
): Promise<LLMCompletionResult> {
  if (!options.model) {
    throw new Error('Model must be specified for LLM completion');
  }
  
  return withMCPFallback<LLMCompletionResult, [string, LLMCompletionOptions, LLMStreamingCallback | undefined]>(
    'agentInference',
    generateCompletionWithMCP,
    generateCompletionLocally,
    prompt,
    options,
    streamingCallback
  );
}

/**
 * Generate a chat completion with the specified model
 * 
 * @param messages The chat messages
 * @param options Chat options
 * @param streamingCallback Optional callback for streaming responses
 * @returns Chat result
 */
export async function generateChatCompletion(
  messages: LLMChatMessage[],
  options: LLMChatOptions,
  streamingCallback?: LLMStreamingCallback
): Promise<LLMChatResult> {
  if (!options.model) {
    throw new Error('Model must be specified for LLM chat completion');
  }
  
  if (!messages || messages.length === 0) {
    throw new Error('At least one message must be provided for chat completion');
  }
  
  return withMCPFallback<LLMChatResult, [LLMChatMessage[], LLMChatOptions, LLMStreamingCallback | undefined]>(
    'agentInference',
    generateChatCompletionWithMCP,
    generateChatCompletionLocally,
    messages,
    options,
    streamingCallback
  );
}

/**
 * Generate embeddings for the provided texts
 * 
 * @param texts Array of texts to embed
 * @param options Embedding options
 * @returns Embedding results
 */
export async function generateEmbeddings(
  texts: string[],
  options: LLMEmbeddingOptions
): Promise<LLMEmbeddingResult[]> {
  if (!options.model) {
    throw new Error('Model must be specified for LLM embeddings');
  }
  
  if (!texts || texts.length === 0) {
    throw new Error('At least one text must be provided for embeddings');
  }
  
  return withMCPFallback<LLMEmbeddingResult[], [string[], LLMEmbeddingOptions]>(
    'agentInference',
    generateEmbeddingsWithMCP,
    generateEmbeddingsLocally,
    texts,
    options
  );
}

// Export the adapter functions
export default {
  generateCompletion,
  generateChatCompletion,
  generateEmbeddings
};
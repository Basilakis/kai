/**
 * LLM Inference MCP Adapter
 *
 * This adapter provides integration between agent components and the MCP server
 * for large language model inference operations. It handles various types of
 * LLM operations including completion, chat, and embedding generation.
 *
 * When MCP is enabled, it proxies operations to the MCP server.
 * When MCP is disabled, it falls back to the local implementation using LLMService.
 */

import { createLogger } from '../../utils/logger';
import {
  isMCPEnabledForComponent,
  withMCPFallback,
  callMCPEndpoint
} from '../../utils/mcpIntegration';
import { addToBatch, isBatchingEnabled } from '../../utils/mcpBatchProcessor';
import { getLLMService } from '../serviceFactory'; // Import the factory function

// Create a logger for the adapter
const logger = createLogger('LLMInferenceMCPAdapter');

// Type definitions (Copied from original, ensure they match llmService.ts)
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

      // Call the streaming endpoint
      const result = await callMCPEndpoint<{
        streamingUrl: string;
        requestId: string;
      }>(
        'agentInference',
        'llm/completion/stream',
        { prompt, options }
      );

      // Connect to the streaming websocket
      const wsEndpoint = result.streamingUrl;
      const requestId = result.requestId;

      // Call the MCP streaming service, which will invoke the callback as chunks arrive
      await connectToMCPStream(wsEndpoint, requestId, streamingCallback);

      // Return a placeholder result - the real content is delivered via streaming
      const placeholderResult: LLMCompletionResult = {
        text: "[Content delivered via streaming]",
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        },
        finishReason: null
      };

      return placeholderResult;
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
 * Generate a completion using the local implementation (via LLMService)
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
     logger.debug('Using local LLM completion implementation via LLMService');
     const llmService = getLLMService();

     // If streaming is requested, handle it here
     if (options.streaming && streamingCallback) {
       // Local fallback via LLMService does not support streaming currently
       logger.warn('Streaming requested for local LLM completion, but it is not supported. Returning non-streamed result.');
       // Proceed with non-streaming call
     }
     // Ensure streaming option is false if not supported or warned
     const nonStreamingOptions = { ...options, streaming: false };

     // Call the LLMService method
     return await llmService.generateCompletion(prompt, nonStreamingOptions);
   } catch (error) {
     const errorMessage = error instanceof Error ? error.message : 'Unknown error';
     logger.error(`Local LLM completion failed: ${errorMessage}`);
     throw error;
   }
 }

// --- WebSocket Handling (Copied from original, ensure dependencies are met) ---
// WebSocket type definitions that work with both Node.js and browser environments
type WebSocketData = string | Buffer | ArrayBuffer | Buffer[] | Blob;

// Type guard to check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof window.WebSocket !== 'undefined';

// Define common interface that works for both browser and Node.js WebSockets
interface GenericWebSocket {
  onopen: null | ((this: any) => void);
  onmessage: null | ((this: any, event: any) => void);
  onerror: null | ((this: any, event: any) => void);
  onclose: null | ((this: any) => void);
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
  close(): void;
}

// Helper function to parse WebSocket message data to string
function parseMessageData(data: any): string {
  if (typeof data === 'string') {
    return data;
  } else if (typeof Buffer !== 'undefined' && data instanceof Buffer) { // Check if Buffer exists (Node.js)
    return new TextDecoder().decode(data);
  } else if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) {
     return new TextDecoder().decode(data);
  } else if (typeof Blob !== 'undefined' && data instanceof Blob) { // Check if Blob exists (Browser)
    // For browser Blob objects - requires async handling which complicates this sync function
    logger.warn('Parsing Blob data in WebSocket message is not fully supported synchronously.');
    return '[Blob data]';
  } else {
    return String(data);
  }
}

/**
 * Connect to MCP streaming endpoint
 *
 * Helper function to establish a WebSocket connection to the MCP streaming service
 *
 * @param endpoint WebSocket endpoint
 * @param requestId Request identifier
 * @param callback Streaming callback function
 */
async function connectToMCPStream(
  endpoint: string,
  requestId: string,
  callback: LLMStreamingCallback
): Promise<void> {
  try {
    // Get appropriate WebSocket implementation
    let WebSocketImpl: any;

    if (isBrowser) {
      // Use browser's WebSocket
      WebSocketImpl = window.WebSocket;
      logger.debug('Using browser WebSocket API');
    } else {
      try {
        // In Node.js, dynamically import ws
        // Use Function constructor to avoid TypeScript "require" errors
        const importModule = new Function('moduleName', 'return import(moduleName)');
        const wsModule = await importModule('ws');
        WebSocketImpl = wsModule.default || wsModule;
        logger.debug('Using ws package for WebSocket connection');
      } catch (error) {
        throw new Error('WebSocket implementation not available. Please install the "ws" package: npm install ws');
      }
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocketImpl(endpoint) as GenericWebSocket;

      ws.onopen = function() {
        logger.debug(`Connected to MCP streaming endpoint for request ${requestId}`);
        // Send initial message with request ID
        ws.send(JSON.stringify({ requestId }));
      };

      ws.onmessage = function(event: any) {
        try {
          // Parse the data safely
          const dataString = parseMessageData(event.data);
          const data = JSON.parse(dataString);

          if (data.error) {
            logger.error(`Streaming error: ${data.error}`);
            callback(`Error: ${data.error}`, true);
            ws.close();
            reject(new Error(data.error));
            return;
          }

          // Forward chunk to callback
          callback(data.chunk || '', data.done || false);

          // If stream is complete, close the connection
          if (data.done) {
            ws.close();
            resolve();
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          logger.error(`Error parsing streaming data: ${errorMessage}`);
          callback(`Error: Invalid streaming data`, true);
          ws.close();
          reject(err);
        }
      };

      ws.onerror = function(event: any) {
        // Handle error events from both browser and Node.js WebSockets
        const errorMessage = event.message || 'Unknown WebSocket error';
        logger.error(`WebSocket error: ${errorMessage}`);
        callback(`Error: WebSocket connection failed`, true);
        reject(new Error(errorMessage));
      };

      ws.onclose = function() {
        logger.debug(`WebSocket connection closed for request ${requestId}`);
      };
    });
  } catch (error) {
     const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to connect to MCP streaming service: ${errorMessage}`);
    throw error;
  }
}
// --- End WebSocket Handling ---

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

      // Call the streaming endpoint
      const result = await callMCPEndpoint<{
        streamingUrl: string;
        requestId: string;
      }>(
        'agentInference',
        'llm/chat/stream',
        { messages, options }
      );

      // Connect to the streaming websocket
      const wsEndpoint = result.streamingUrl;
      const requestId = result.requestId;

      // Call the MCP streaming service, which will invoke the callback as chunks arrive
      await connectToMCPStream(wsEndpoint, requestId, streamingCallback);

      // Return a placeholder result - the real content is delivered via streaming
      const placeholderResult: LLMChatResult = {
        message: {
          role: 'assistant',
          content: "[Content delivered via streaming]"
        },
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        },
        finishReason: null
      };

      return placeholderResult;
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
 * Generate a chat completion using the local implementation (via LLMService)
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
    logger.debug('Using local LLM chat completion implementation via LLMService');
    const llmService = getLLMService();

    // If streaming is requested, handle it here
    if (options.streaming && streamingCallback) {
      // Local fallback via LLMService does not support streaming currently
      logger.warn('Streaming requested for local LLM chat completion, but it is not supported. Returning non-streamed result.');
      // Proceed with non-streaming call
    }
    // Ensure streaming option is false if not supported or warned
    const nonStreamingOptions = { ...options, streaming: false };

    // Call the LLMService method
    return await llmService.generateChatCompletion(messages, nonStreamingOptions);
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
 * Generate embeddings using the local implementation (via LLMService)
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
    logger.debug('Using local LLM embeddings implementation via LLMService');
    const llmService = getLLMService();

    // Call the LLMService method
    return await llmService.generateEmbeddings(texts, options);
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
/**
 * LLM Inference Helper
 * 
 * This utility provides a simplified interface for agent components to use
 * LLM inference capabilities, with automatic integration with the MCP architecture
 * when available.
 */

import { createLogger } from './logger';
import llmInferenceAdapter, {
  LLMChatMessage,
  LLMChatOptions,
  LLMChatResult,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMEmbeddingOptions,
  LLMEmbeddingResult,
  LLMStreamingCallback
} from '../services/adapters/llmInferenceMcpAdapter';

// Create a logger for the helper
const logger = createLogger('LLMInferenceHelper');

// Re-export types for convenience
export type {
  LLMChatMessage,
  LLMChatOptions,
  LLMChatResult,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMEmbeddingOptions,
  LLMEmbeddingResult,
  LLMStreamingCallback
};

// Extended option types with streaming callback
export interface ExtendedLLMChatOptions extends Partial<LLMChatOptions> {
  streamingCallback?: LLMStreamingCallback;
}

export interface ExtendedLLMCompletionOptions extends Partial<LLMCompletionOptions> {
  streamingCallback?: LLMStreamingCallback;
}

/**
 * Standard system message for agents
 */
export const DEFAULT_SYSTEM_MESSAGE = 
  "You are an AI assistant that helps with material selection and design. " +
  "You provide accurate, helpful information about materials, their properties, " +
  "and appropriate applications.";

/**
 * Default model to use for chat completions
 */
export const DEFAULT_CHAT_MODEL = process.env.DEFAULT_CHAT_MODEL || 'gpt-4-turbo';

/**
 * Default model to use for embeddings
 */
export const DEFAULT_EMBEDDING_MODEL = process.env.DEFAULT_EMBEDDING_MODEL || 'text-embedding-3-small';

/**
 * Create a chat message
 * 
 * Helper function to create properly formatted chat messages
 * 
 * @param role The message role
 * @param content The message content
 * @param name Optional name for function messages
 * @returns Formatted chat message
 */
export function createChatMessage(
  role: 'system' | 'user' | 'assistant' | 'function',
  content: string,
  name?: string
): LLMChatMessage {
  return { role, content, name };
}

/**
 * Execute a chat completion with the LLM
 * 
 * @param messages The conversation messages
 * @param options Optional chat completion options with streaming callback
 * @returns Chat completion result
 */
export async function executeChat(
  messages: LLMChatMessage[],
  options: ExtendedLLMChatOptions = {}
): Promise<LLMChatResult> {
  try {
    // Validate input messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logger.warn('Invalid or empty messages array provided to executeChat');
      throw new Error('Invalid input: messages must be a non-empty array');
    }
    
    // Validate each message has required fields
    const validMessages = messages.every(msg => 
      msg && typeof msg === 'object' && 
      msg.role && typeof msg.role === 'string' &&
      msg.content && typeof msg.content === 'string'
    );
    
    if (!validMessages) {
      logger.warn('Invalid message format in executeChat');
      throw new Error('Invalid message format: each message must have role and content properties');
    }
    
    // Create a copy to avoid mutating the input
    let messagesCopy = [...messages];
    
    // Ensure system message is present
    if (!messagesCopy.some(msg => msg.role === 'system')) {
      messagesCopy = [
        createChatMessage('system', DEFAULT_SYSTEM_MESSAGE),
        ...messagesCopy
      ];
    }
    
    // Set default options
    const fullOptions: LLMChatOptions = {
      model: options.model || DEFAULT_CHAT_MODEL,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens,
      stop: options.stop,
      topP: options.topP ?? 1.0,
      frequencyPenalty: options.frequencyPenalty ?? 0.0,
      presencePenalty: options.presencePenalty ?? 0.0,
      functions: options.functions,
      streaming: options.streaming ?? false
    };
    
    logger.debug(`Executing chat with model: ${fullOptions.model}, messages: ${messagesCopy.length}`);
    
    // If streaming is requested, handle it specially
    if (fullOptions.streaming && options.streamingCallback) {
      return llmInferenceAdapter.generateChatCompletion(
        messagesCopy,
        fullOptions,
        options.streamingCallback
      );
    }
    
    // Normal non-streaming execution
    return llmInferenceAdapter.generateChatCompletion(
      messagesCopy,
      fullOptions
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Chat execution failed: ${errorMessage}`);
    
    // Provide a fallback response in case of errors
    return {
      message: {
        role: 'assistant',
        content: "I'm sorry, I encountered an error processing your request. Please try again."
      },
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      finishReason: null
    };
  }
}

/**
 * Execute a completion with the LLM
 * 
 * @param prompt The completion prompt
 * @param options Optional completion options with streaming callback
 * @returns Completion result
 */
export async function executeCompletion(
  prompt: string,
  options: ExtendedLLMCompletionOptions = {}
): Promise<LLMCompletionResult> {
  try {
    // Validate input prompt
    if (prompt === undefined || prompt === null) {
      logger.warn('Invalid prompt provided to executeCompletion: null or undefined');
      throw new Error('Invalid input: prompt cannot be null or undefined');
    }
    
    if (typeof prompt !== 'string') {
      logger.warn(`Invalid prompt type provided to executeCompletion: ${typeof prompt}`);
      throw new Error('Invalid input: prompt must be a string');
    }
    
    if (prompt.trim().length === 0) {
      logger.warn('Empty prompt provided to executeCompletion');
      throw new Error('Invalid input: prompt cannot be empty');
    }
    
    // Set default options
    const fullOptions: LLMCompletionOptions = {
      model: options.model || DEFAULT_CHAT_MODEL,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens,
      stopSequences: options.stopSequences,
      topP: options.topP ?? 1.0,
      frequencyPenalty: options.frequencyPenalty ?? 0.0,
      presencePenalty: options.presencePenalty ?? 0.0,
      logitBias: options.logitBias,
      streaming: options.streaming ?? false
    };
    
    logger.debug(`Executing completion with model: ${fullOptions.model}, prompt length: ${prompt.length}`);
    
    // If streaming is requested, handle it specially
    if (fullOptions.streaming && options.streamingCallback) {
      return llmInferenceAdapter.generateCompletion(
        prompt,
        fullOptions,
        options.streamingCallback
      );
    }
    
    // Normal non-streaming execution
    return llmInferenceAdapter.generateCompletion(
      prompt,
      fullOptions
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Completion execution failed: ${errorMessage}`);
    
    // Provide a fallback response in case of errors
    return {
      text: "I'm sorry, I encountered an error processing your request. Please try again.",
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      finishReason: null
    };
  }
}

/**
 * Generate embeddings for text
 * 
 * @param texts Array of texts to embed
 * @param options Optional embedding options
 * @returns Embedding results
 */
export async function generateEmbeddings(
  texts: string[],
  options: Partial<LLMEmbeddingOptions> = {}
): Promise<LLMEmbeddingResult[]> {
  try {
    if (!texts || texts.length === 0) {
      return [];
    }
    
    // Set default options
    const fullOptions: LLMEmbeddingOptions = {
      model: options.model || DEFAULT_EMBEDDING_MODEL,
      dimensions: options.dimensions
    };
    
    logger.debug(`Generating embeddings for ${texts.length} texts with model: ${fullOptions.model}`);
    
    return llmInferenceAdapter.generateEmbeddings(
      texts,
      fullOptions
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Embedding generation failed: ${errorMessage}`);
    
    // Return empty results in case of error
    return texts.map(() => ({
      embedding: [],
      usage: {
        promptTokens: 0,
        totalTokens: 0
      }
    }));
  }
}

/**
 * Get the message content from a chat result
 * 
 * @param result Chat completion result
 * @returns The message content, or empty string if not available
 */
export function getChatResponseContent(result: LLMChatResult): string {
  return result?.message?.content || '';
}

/**
 * Generate a function call prompt with options
 * 
 * Helper to create a prompt and options for structured function calling
 * 
 * @param systemMessage System message providing context
 * @param userQuery The user's query
 * @param functionDefinitions The available functions
 * @returns Object containing messages and options for function calling
 */
export function createFunctionCallPrompt(
  systemMessage: string,
  userQuery: string,
  functionDefinitions: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }>
): { messages: LLMChatMessage[], options: Partial<LLMChatOptions> } {
  if (!functionDefinitions || functionDefinitions.length === 0) {
    logger.warn('Function definitions missing in function call prompt');
  }
  
  const messages = [
    createChatMessage('system', systemMessage),
    createChatMessage('user', userQuery)
  ];
  
  const options: Partial<LLMChatOptions> = {
    functions: functionDefinitions,
    // Lower temperature for more deterministic function selection
    temperature: 0.2
  };
  
  return { messages, options };
}

/**
 * Initialize LLM environment
 * 
 * Call this at application startup to prepare the LLM environment
 */
export async function initializeLLMEnvironment(): Promise<boolean> {
  logger.info('Initializing LLM environment');
  
  try {
    // Warmup call to ensure connection is working
    const testResult = await executeChat([
      createChatMessage('user', 'Hello, this is a test message')
    ], { temperature: 0.1 });
    
    // Only log success after the call completes without error
    logger.info(`LLM environment initialized successfully using ${DEFAULT_CHAT_MODEL}`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to initialize LLM environment: ${errorMessage}`);
    return false;
  }
}

export default {
  createChatMessage,
  executeChat,
  executeCompletion,
  generateEmbeddings,
  getChatResponseContent,
  createFunctionCallPrompt,
  initializeLLMEnvironment
};
/**
 * LLM Inference Helper with Prompt Service Integration
 * 
 * This utility extends the base LLM inference helper with prompt service integration,
 * allowing for dynamic prompt management through the admin panel.
 */

import axios from 'axios';
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
const logger = createLogger('LLMInferenceHelperWithPrompts');

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

// Prompt types
export enum PromptType {
  MATERIAL_SPECIFIC = 'material_specific',
  AGENT = 'agent',
  RAG = 'rag',
  GENERATIVE_ENHANCER = 'generative_enhancer',
  HYBRID_RETRIEVER = 'hybrid_retriever',
  OTHER = 'other'
}

// Prompt data interface
export interface PromptData {
  id: string;
  name: string;
  description?: string;
  promptType: PromptType;
  content: string;
  variables?: string[];
  isActive: boolean;
  location: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/**
 * Fallback system message for agents in case the prompt service is unavailable
 */
export const FALLBACK_SYSTEM_MESSAGE = 
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

// Prompt cache to reduce API calls
const promptCache: Map<string, string> = new Map();

/**
 * Get the API URL for the prompt service
 * @returns The API URL
 */
function getApiUrl(): string {
  const baseUrl = process.env.API_URL || 'http://localhost:3000';
  return `${baseUrl}/api/admin/prompts`;
}

/**
 * Get the API key for the prompt service
 * @returns The API key
 */
function getApiKey(): string {
  return process.env.API_KEY || '';
}

/**
 * Fetch a prompt from the prompt service
 * @param name Prompt name
 * @param type Prompt type
 * @returns Prompt content or null if not found
 */
async function fetchPromptFromService(name: string, type: PromptType): Promise<string | null> {
  // Check cache first
  const cacheKey = `${type}:${name}`;
  if (promptCache.has(cacheKey)) {
    return promptCache.get(cacheKey) || null;
  }
  
  try {
    // Fetch from API
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`
    };
    
    const response = await axios.get(
      `${getApiUrl()}?type=${type}`,
      { headers }
    );
    
    if (response.status !== 200) {
      logger.warn(`Failed to fetch prompts: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = response.data;
    
    if (!data.success) {
      logger.warn(`API returned error: ${data.message}`);
      return null;
    }
    
    const prompts = data.data || [];
    
    // Find the prompt by name
    for (const prompt of prompts) {
      if (prompt.name === name && prompt.promptType === type && prompt.isActive) {
        // Cache the result
        promptCache.set(cacheKey, prompt.content);
        return prompt.content;
      }
    }
    
    logger.warn(`Prompt not found: ${name} (${type})`);
    return null;
  } catch (error) {
    logger.error(`Error fetching prompt from service: ${error}`);
    return null;
  }
}

/**
 * Get the system prompt for agents
 * @returns The system prompt
 */
export async function getSystemPrompt(): Promise<string> {
  try {
    const prompt = await fetchPromptFromService('DEFAULT_SYSTEM_MESSAGE', PromptType.AGENT);
    return prompt || FALLBACK_SYSTEM_MESSAGE;
  } catch (error) {
    logger.error(`Error getting system prompt: ${error}`);
    return FALLBACK_SYSTEM_MESSAGE;
  }
}

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
      const systemPrompt = await getSystemPrompt();
      messagesCopy = [
        createChatMessage('system', systemPrompt),
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
 * Clear the prompt cache
 */
export function clearPromptCache(): void {
  promptCache.clear();
  logger.info('Prompt cache cleared');
}

/**
 * Initialize LLM environment
 * 
 * Call this at application startup to prepare the LLM environment
 */
export async function initializeLLMEnvironment(): Promise<boolean> {
  logger.info('Initializing LLM environment with prompt service');
  
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
  getSystemPrompt,
  clearPromptCache,
  initializeLLMEnvironment
};

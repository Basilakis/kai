/**
 * Base MCP Adapter
 * 
 * This abstract class provides common functionality for MCP adapters,
 * reducing duplication across adapter implementations such as:
 * - imageAnalysisMcpAdapter
 * - llmInferenceMcpAdapter
 * - ocrMcpAdapter
 * - svbrdfMcpAdapter
 * - vectorSearchMcpAdapter
 * 
 * When MCP is enabled, adapters proxy operations to the MCP server.
 * When MCP is disabled, they fall back to local implementations.
 */

import { createLogger } from '../../../utils/logger';
import { 
  isMCPEnabledForComponent, 
  withMCPFallback, 
  callMCPEndpoint 
} from '../../../utils/mcpIntegration';
import { addToBatch, isBatchingEnabled } from '../../../utils/mcpBatchProcessor';
import { ServiceFactory } from '../../serviceFactory';

// Create a logger for the base adapter
const logger = createLogger('BaseMcpAdapter');

/**
 * Valid MCP component types for all operations
 */
export type McpComponentType = 
  | 'vectorSearch' 
  | 'ocr' 
  | 'imageAnalysis' 
  | 'training' 
  | 'agentInference';

/**
 * MCP component types that support batching
 */
export type McpBatchableComponentType = 
  | 'vectorSearch' 
  | 'ocr' 
  | 'imageAnalysis' 
  | 'agentInference';

/**
 * Base class for MCP adapters with common functionality
 */
export abstract class BaseMcpAdapter<LocalServiceType> {
  protected readonly component: McpComponentType;
  protected readonly logger: ReturnType<typeof createLogger>;
  
  /**
   * Create a new BaseMcpAdapter instance
   * 
   * @param component Component name used for MCP configuration and logging
   */
  constructor(component: McpComponentType) {
    this.component = component;
    this.logger = createLogger(`${component}McpAdapter`);
    this.logger.debug(`${component}McpAdapter created`);
  }
  
  /**
   * Get the appropriate local service for fallback operations
   */
  protected abstract getLocalService(): LocalServiceType;
  
  /**
   * Check if MCP is enabled for this component
   */
  protected isMCPEnabled(): boolean {
    return isMCPEnabledForComponent(this.component);
  }
  
  /**
   * Type guard to check if a component supports batching
   */
  protected isBatchableComponent(component: McpComponentType): component is McpBatchableComponentType {
    return (
      component === 'vectorSearch' || 
      component === 'ocr' || 
      component === 'imageAnalysis' || 
      component === 'agentInference'
    );
  }

  /**
   * Check if batching is enabled for this component
   */
  protected isBatchingEnabled(): boolean {
    // First check if this component type supports batching
    if (!this.isBatchableComponent(this.component)) {
      return false;
    }
    
    // Now we know the component type is compatible
    return isBatchingEnabled(this.component);
  }
  
  /**
   * Add an operation to the batch for this component
   * 
   * @param operationName Name of the operation 
   * @param params Parameters for the operation
   * @returns Result from the batched operation
   * @throws Error if component doesn't support batching
   */
  protected async addToBatch<T, R>(operationName: string, params: T): Promise<R> {
    if (!this.isBatchableComponent(this.component)) {
      throw new Error(`Component ${this.component} does not support batching`);
    }
    
    this.logger.debug(`Adding ${operationName} to ${this.component} batch`);
    return await addToBatch<T, R>(this.component, params);
  }
  
  /**
   * Call an MCP endpoint with the given parameters
   * 
   * @param endpoint MCP endpoint
   * @param body Request body
   * @returns Response from the MCP server
   */
  protected async callMCPEndpoint<R>(endpoint: string, body: any): Promise<R> {
    this.logger.debug(`Calling MCP endpoint ${this.component}/${endpoint}`);
    return await callMCPEndpoint<R>(this.component, endpoint, body);
  }
  
  /**
   * Execute an operation with MCP fallback
   * 
   * This method handles the common pattern of trying MCP first and falling back to local implementation
   * 
   * @param operationName Name of the operation for logging
   * @param mcpFunction Function to call when MCP is enabled
   * @param localFunction Function to call when MCP is disabled or fails
   * @param args Arguments to pass to the functions
   * @returns Result from either MCP or local implementation
   */
  protected async withMCPFallback<R, A extends any[]>(
    operationName: string,
    mcpFunction: (...args: A) => Promise<R>,
    localFunction: (...args: A) => Promise<R>,
    ...args: A
  ): Promise<R> {
    this.logger.debug(`Executing ${operationName} with MCP fallback`);
    return withMCPFallback<R, A>(
      this.component,
      mcpFunction,
      localFunction,
      ...args
    );
  }
  
  /**
   * Handle errors consistently
   * 
   * @param error Error to handle
   * @param operationName Name of the operation for logging
   * @throws The original error after logging
   */
  protected handleError(error: unknown, operationName: string): never {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error(`Error in ${operationName}: ${errorMessage}`);
    if (error instanceof Error && error.stack) {
      this.logger.debug(`Stack trace for ${operationName} error: ${error.stack}`);
    }
    throw error;
  }
}
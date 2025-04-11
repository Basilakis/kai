/**
 * RAG System Integration Bridge
 * 
 * This module provides a TypeScript bridge to the Python-based RAG (Retrieval-Augmented Generation)
 * system. It handles communication between the TypeScript backend and the Python components,
 * exposing a clean API that follows the established patterns in the codebase.
 */

import path from 'path';
import { PythonShell } from 'python-shell';
import { EventEmitter } from 'events';
import { logger } from '../../../packages/shared/src/utils/logger';

// Import types from shared package
import { Material } from '../../../packages/shared/src/types/material';

// Define RAG-specific types
export interface RAGQuery {
  query: string;
  filters?: Record<string, any>;
  options?: RAGQueryOptions;
  sessionId?: string;
}

export interface RAGQueryOptions {
  enhancementTypes?: ('explanation' | 'similarity' | 'application' | 'citation')[];
  includeRelationships?: boolean;
  includeProperties?: boolean;
  limit?: number;
  [key: string]: any;
}

export interface RAGResponse {
  query: string;
  materials: MaterialRAGData[];
  enhancements: {
    explanations?: MaterialExplanation[];
    similarities?: MaterialSimilarity[];
    applications?: MaterialApplication[];
  };
  citations: Citation[];
  metadata: {
    requestId: string;
    sessionId?: string;
    timestamp: number;
    processingTime: number;
    componentTimes?: {
      embedding: number;
      retrieval: number;
      assembly: number;
      generation: number;
    };
    fromCache: boolean;
    enhancementTypes: string[];
    materialCount: number;
  };
}

export interface MaterialRAGData extends Partial<Material> {
  id: string;
  name: string;
  materialType?: string;
  similarityScore?: number;
}

export interface MaterialExplanation {
  materialId: string;
  materialName: string;
  explanation: string;
  referencedProperties?: Record<string, any>;
}

export interface MaterialSimilarity {
  material1: {
    id: string;
    name: string;
  };
  material2: {
    id: string;
    name: string;
  };
  comparison: string;
  sharedProperties: string[];
  differences: string[];
  relationship?: {
    type: string;
    description: string;
    strength: number;
  };
}

export interface MaterialApplication {
  materialId: string;
  materialName: string;
  recommendationsText: string;
  specificRecommendations?: string[];
}

export interface Citation {
  id: string;
  source: string;
  materialId?: string;
  materialName?: string;
  material1Id?: string;
  material2Id?: string;
}

export interface RAGStreamChunk {
  event: 'start' | 'status' | 'materials' | 'content' | 'complete' | 'error';
  message?: string;
  chunk?: string;
  materials?: MaterialRAGData[];
  error?: string;
  timestamp?: number;
  response?: RAGResponse;
}

export interface RAGServiceConfig {
  // Service configuration
  enableCache?: boolean;
  cacheTtl?: number;
  maxCacheSize?: number;
  
  // Component configurations
  embedding?: {
    defaultModel?: string;
    denseDimension?: number;
    sparseEnabled?: boolean;
    [key: string]: any;
  };
  retrieval?: {
    maxResults?: number;
    strategy?: 'dense' | 'sparse' | 'hybrid' | 'metadata';
    threshold?: number;
    [key: string]: any;
  };
  assembly?: {
    includeRelationships?: boolean;
    maxKnowledgeItems?: number;
    includeProperties?: boolean;
    [key: string]: any;
  };
  generation?: {
    model?: string;
    temperature?: number;
    enhancementTypes?: string[];
    [key: string]: any;
  };
  
  // Tracking configuration
  trackingEnabled?: boolean;
  metricsEnabled?: boolean;
  
  [key: string]: any;
}

/**
 * RAG System Bridge
 * 
 * Provides a TypeScript interface to the Python RAG system.
 */
export class RAGBridge {
  private pythonPath: string;
  private serviceConfig: RAGServiceConfig;
  private initialized: boolean = false;
  private serviceProcess: PythonShell | null = null;
  private eventEmitter: EventEmitter;
  
  /**
   * Create a new RAG Bridge instance
   * 
   * @param config Configuration for the RAG service
   */
  constructor(config?: RAGServiceConfig) {
    // Set default python path
    this.pythonPath = path.join(__dirname, '..', 'python');
    
    // Initialize with default or provided config
    this.serviceConfig = config || {
      enableCache: true,
      retrieval: {
        maxResults: 10,
        strategy: 'hybrid'
      },
      generation: {
        model: 'gpt-4',
        temperature: 0.7
      }
    };
    
    this.eventEmitter = new EventEmitter();
    logger.info('RAGBridge initialized');
  }
  
  /**
   * Initialize the RAG service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    try {
      logger.info('Initializing RAG service...');
      
      // Ensure RAG system Python modules are ready
      await this.runPythonScript('verify_rag_modules.py', {
        mode: 'verify',
        config: JSON.stringify(this.serviceConfig)
      });
      
      this.initialized = true;
      logger.info('RAG service initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize RAG service: ${error}`);
      throw new Error(`RAG service initialization failed: ${error}`);
    }
  }
  
  /**
   * Execute a RAG query
   * 
   * @param query Query text or RAGQuery object
   * @param filters Optional filters
   * @param options Optional query options
   * @returns Promise with RAG response
   */
  public async query(
    query: string | RAGQuery,
    filters?: Record<string, any>,
    options?: RAGQueryOptions
  ): Promise<RAGResponse> {
    await this.ensureInitialized();
    
    try {
      const queryObj: RAGQuery = typeof query === 'string' 
        ? { query, filters, options }
        : query;
      
      const result = await this.runPythonScript('rag_bridge_handler.py', {
        mode: 'query',
        query: JSON.stringify(queryObj)
      });
      
      // Parse the JSON response
      return JSON.parse(result.join('')) as RAGResponse;
    } catch (error) {
      logger.error(`RAG query failed: ${error}`);
      throw new Error(`RAG query failed: ${error}`);
    }
  }
  
  /**
   * Execute a streaming RAG query
   * 
   * @param query Query text or RAGQuery object
   * @param filters Optional filters
   * @param options Optional query options
   * @returns Event emitter for streaming results
   */
  public streamingQuery(
    query: string | RAGQuery,
    filters?: Record<string, any>,
    options?: RAGQueryOptions
  ): EventEmitter {
    const streamEmitter = new EventEmitter();
    
    // Ensure initialization and set up streaming
    this.ensureInitialized().then(() => {
      try {
        const queryObj: RAGQuery = typeof query === 'string'
          ? { query, filters, options }
          : query;
        
        // Configure Python shell for streaming
        const pyshell = new PythonShell(path.join(this.pythonPath, 'rag_bridge_handler.py'), {
          mode: 'text',
          pythonOptions: ['-u'], // Unbuffered output for real-time streaming
          args: [
            '--mode=streaming',
            `--query=${JSON.stringify(queryObj)}`
          ]
        });
        
        // Handle streaming output
        pyshell.on('message', (message) => {
          try {
            const chunk = JSON.parse(message) as RAGStreamChunk;
            streamEmitter.emit('chunk', chunk);
            
            // Emit specific events based on chunk type
            streamEmitter.emit(chunk.event, chunk);
            
            // Emit completion event when done
            if (chunk.event === 'complete') {
              streamEmitter.emit('end', chunk.response);
              pyshell.end();
              logger.debug('Streaming query completed');
            }
          } catch (e) {
            logger.error(`Error parsing streaming chunk: ${e}`);
            streamEmitter.emit('error', `Error parsing chunk: ${e}`);
          }
        });
        
        // Handle errors
        pyshell.on('error', (err) => {
          logger.error(`Streaming error: ${err}`);
          streamEmitter.emit('error', err);
        });
        
        // Handle script exit
        pyshell.on('close', () => {
          logger.debug('Streaming process closed');
          streamEmitter.emit('close');
        });
        
      } catch (error) {
        logger.error(`Failed to start streaming: ${error}`);
        streamEmitter.emit('error', error);
      }
    }).catch((error) => {
      logger.error(`Initialization error in streaming: ${error}`);
      streamEmitter.emit('error', error);
    });
    
    return streamEmitter;
  }
  
  /**
   * Execute multiple RAG queries in batch
   * 
   * @param queries Array of RAG queries
   * @param sessionId Optional session ID for tracking
   * @param maxConcurrent Maximum number of concurrent requests
   * @returns Promise with array of RAG responses
   */
  public async batchQuery(
    queries: RAGQuery[],
    sessionId?: string,
    maxConcurrent?: number
  ): Promise<RAGResponse[]> {
    await this.ensureInitialized();
    
    try {
      const result = await this.runPythonScript('rag_bridge_handler.py', {
        mode: 'batch',
        queries: JSON.stringify(queries),
        sessionId: sessionId || undefined,
        maxConcurrent: maxConcurrent || undefined
      });
      
      // Parse the JSON response
      return JSON.parse(result.join('')) as RAGResponse[];
    } catch (error) {
      logger.error(`RAG batch query failed: ${error}`);
      throw new Error(`RAG batch query failed: ${error}`);
    }
  }
  
  /**
   * Get statistics about the RAG service usage
   * 
   * @returns Promise with usage statistics
   */
  public async getUsageStatistics(): Promise<Record<string, any>> {
    await this.ensureInitialized();
    
    try {
      const result = await this.runPythonScript('rag_bridge_handler.py', {
        mode: 'stats'
      });
      
      // Parse the JSON response
      return JSON.parse(result.join('')) as Record<string, any>;
    } catch (error) {
      logger.error(`Failed to get RAG statistics: ${error}`);
      throw new Error(`Failed to get RAG statistics: ${error}`);
    }
  }
  
  /**
   * Clear the RAG service cache
   * 
   * @returns Promise with confirmation
   */
  public async clearCache(): Promise<{ status: string }> {
    await this.ensureInitialized();
    
    try {
      const result = await this.runPythonScript('rag_bridge_handler.py', {
        mode: 'clear_cache'
      });
      
      // Parse the JSON response
      return JSON.parse(result.join('')) as { status: string };
    } catch (error) {
      logger.error(`Failed to clear RAG cache: ${error}`);
      throw new Error(`Failed to clear RAG cache: ${error}`);
    }
  }
  
  /**
   * Get health status of the RAG service
   * 
   * @returns Promise with health status
   */
  public async getHealthStatus(): Promise<Record<string, any>> {
    await this.ensureInitialized();
    
    try {
      const result = await this.runPythonScript('rag_bridge_handler.py', {
        mode: 'health'
      });
      
      // Parse the JSON response
      return JSON.parse(result.join('')) as Record<string, any>;
    } catch (error) {
      logger.error(`Failed to get RAG health status: ${error}`);
      throw new Error(`Failed to get RAG health status: ${error}`);
    }
  }
  
  /**
   * Update the RAG service configuration
   * 
   * @param config New configuration
   * @returns Promise with confirmation
   */
  public async updateConfig(config: Partial<RAGServiceConfig>): Promise<{ status: string }> {
    await this.ensureInitialized();
    
    try {
      // Merge the new config with the existing one
      this.serviceConfig = {
        ...this.serviceConfig,
        ...config
      };
      
      const result = await this.runPythonScript('rag_bridge_handler.py', {
        mode: 'update_config',
        config: JSON.stringify(this.serviceConfig)
      });
      
      // Parse the JSON response
      return JSON.parse(result.join('')) as { status: string };
    } catch (error) {
      logger.error(`Failed to update RAG config: ${error}`);
      throw new Error(`Failed to update RAG config: ${error}`);
    }
  }
  
  /**
   * Optimize the RAG service for a specific material
   * 
   * @param materialId Material ID to optimize for
   * @returns Promise with optimization results
   */
  public async optimizeForMaterial(materialId: string): Promise<Record<string, any>> {
    await this.ensureInitialized();
    
    try {
      const result = await this.runPythonScript('rag_bridge_handler.py', {
        mode: 'optimize',
        materialId
      });
      
      // Parse the JSON response
      return JSON.parse(result.join('')) as Record<string, any>;
    } catch (error) {
      logger.error(`Failed to optimize for material: ${error}`);
      throw new Error(`Failed to optimize for material: ${error}`);
    }
  }
  
  /**
   * Ensure the RAG service is initialized
   * @private
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
  
  /**
   * Run a Python script and return the result
   * @private
   * @param scriptName Name of the Python script
   * @param params Parameters to pass to the script
   */
  private async runPythonScript(
    scriptName: string,
    params: Record<string, any>
  ): Promise<string[]> {
    // Build the command-line arguments
    const args = Object.entries(params).map(([key, value]) => {
      if (value === undefined) return null;
      return `--${key}=${value}`;
    }).filter(Boolean) as string[];
    
    return new Promise<string[]>((resolve, reject) => {
      logger.debug(`Running Python script: ${scriptName} with args: ${args.join(' ')}`);
      
      // Run the Python script
      const pyshell = new PythonShell(path.join(this.pythonPath, scriptName), {
        mode: 'text',
        args
      });
      
      const output: string[] = [];
      
      // Collect output
      pyshell.on('message', (message) => {
        output.push(message);
      });
      
      // Handle script completion
      pyshell.on('close', () => {
        resolve(output);
      });
      
      // Handle errors
      pyshell.on('error', (err) => {
        logger.error(`Python script error: ${err}`);
        reject(err);
      });
    });
  }
  
  /**
   * Clean up resources when done
   */
  public async close(): Promise<void> {
    if (this.serviceProcess) {
      this.serviceProcess.end();
      logger.info('RAG service process closed');
      this.serviceProcess = null;
    }
    this.initialized = false;
    logger.info('RAG bridge closed');
  }
}

/**
 * Factory function to create a RAG bridge
 * 
 * @param config Optional configuration
 * @returns Configured RAG bridge
 */
export function createRAGBridge(config?: RAGServiceConfig): RAGBridge {
  return new RAGBridge(config);
}

/**
 * Default singleton instance
 */
export const ragBridge = createRAGBridge();

export default ragBridge;
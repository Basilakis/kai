/**
 * MCP Batch Processor
 * 
 * This utility provides batching capabilities for MCP operations, improving
 * performance by reducing the number of network calls and leveraging
 * hardware acceleration more efficiently for batch processing.
 * 
 * The batch processor collects operations of the same type within a time window
 * and processes them together in a single MCP request.
 */

import { createLogger } from './logger';
import { callMCPEndpoint, isMCPEnabledForComponent } from './mcpIntegration';

// Create a logger for MCP batch processor
const logger = createLogger('MCPBatchProcessor');

// Environment variables for batch configuration
const BATCH_ENABLED = process.env.MCP_BATCH_ENABLED === 'true';
const DEFAULT_BATCH_SIZE = parseInt(process.env.MCP_DEFAULT_BATCH_SIZE || '10', 10);
const DEFAULT_BATCH_WINDOW_MS = parseInt(process.env.MCP_DEFAULT_BATCH_WINDOW_MS || '50', 10);

// Type definitions for batch queue items
interface BatchQueueItem<T, R> {
  data: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
  addedAt: number;
}

// Type for component-specific batch configuration
interface BatchConfig {
  maxBatchSize: number;
  batchWindowMs: number;
  endpoint: string;
}

// Active batch queues for different component types
const batchQueues: Record<string, Array<BatchQueueItem<any, any>>> = {};

// Timeout handles for each component type
const batchTimeouts: Record<string, ReturnType<typeof setTimeout>> = {};

// Component-specific batch configurations
const batchConfigs: Record<string, BatchConfig> = {
  vectorSearch: {
    maxBatchSize: parseInt(process.env.MCP_VECTOR_SEARCH_BATCH_SIZE || DEFAULT_BATCH_SIZE.toString(), 10),
    batchWindowMs: parseInt(process.env.MCP_VECTOR_SEARCH_BATCH_WINDOW_MS || DEFAULT_BATCH_WINDOW_MS.toString(), 10),
    endpoint: 'vector/search_batch'
  },
  imageAnalysis: {
    maxBatchSize: parseInt(process.env.MCP_IMAGE_ANALYSIS_BATCH_SIZE || DEFAULT_BATCH_SIZE.toString(), 10),
    batchWindowMs: parseInt(process.env.MCP_IMAGE_ANALYSIS_BATCH_WINDOW_MS || DEFAULT_BATCH_WINDOW_MS.toString(), 10),
    endpoint: 'image/analyze_batch'
  },
  ocr: {
    maxBatchSize: parseInt(process.env.MCP_OCR_BATCH_SIZE || DEFAULT_BATCH_SIZE.toString(), 10),
    batchWindowMs: parseInt(process.env.MCP_OCR_BATCH_WINDOW_MS || DEFAULT_BATCH_WINDOW_MS.toString(), 10),
    endpoint: 'ocr/process_batch'
  },
  agentInference: {
    maxBatchSize: parseInt(process.env.MCP_AGENT_INFERENCE_BATCH_SIZE || DEFAULT_BATCH_SIZE.toString(), 10),
    batchWindowMs: parseInt(process.env.MCP_AGENT_INFERENCE_BATCH_WINDOW_MS || DEFAULT_BATCH_WINDOW_MS.toString(), 10),
    endpoint: 'llm/inference_batch'
  }
};

/**
 * Initialize the batch queue for a component type if it doesn't exist
 * 
 * @param componentType The type of component
 */
function initializeBatchQueueIfNeeded(componentType: string): void {
  if (!batchQueues[componentType]) {
    batchQueues[componentType] = [];
  }
}

/**
 * Check if batching is enabled for a specific component
 * 
 * @param componentType The type of component
 * @returns True if batching is enabled for the component
 */
export function isBatchingEnabled(componentType: 'vectorSearch' | 'imageAnalysis' | 'ocr' | 'agentInference'): boolean {
  return BATCH_ENABLED && 
         isMCPEnabledForComponent(componentType) && 
         batchConfigs[componentType] !== undefined;
}

// Maximum age (in ms) for items in the queue before they're considered stale
const MAX_ITEM_AGE_MS = parseInt(process.env.MCP_MAX_ITEM_AGE_MS || '60000', 10); // Default: 1 minute

/**
 * Process a batch of operations for a specific component type
 * 
 * @param componentType The type of component
 */
async function processBatch(componentType: string): Promise<void> {
  // Clear the timeout
  if (batchTimeouts[componentType]) {
    clearTimeout(batchTimeouts[componentType]);
    delete batchTimeouts[componentType];
  }

  // Get the queue and config
  const queue = batchQueues[componentType];
  const config = batchConfigs[componentType];

  if (!queue || queue.length === 0 || !config) {
    return;
  }

  // Check for stale items and process them separately (either remove or process)
  const now = Date.now();
  const staleItemIndices: number[] = [];

  // Identify stale items
  for (let i = 0; i < queue.length; i++) {
    if (now - queue[i].addedAt > MAX_ITEM_AGE_MS) {
      staleItemIndices.push(i);
    }
  }

  // Handle stale items if any
  if (staleItemIndices.length > 0) {
    // Extract stale items (from end to beginning to avoid index shifts)
    const staleItems: BatchQueueItem<any, any>[] = [];
    for (let i = staleItemIndices.length - 1; i >= 0; i--) {
      staleItems.unshift(queue.splice(staleItemIndices[i], 1)[0]);
    }
    
    logger.warn(`Found ${staleItems.length} stale items in ${componentType} queue (older than ${MAX_ITEM_AGE_MS}ms)`);
    
    // Process stale items individually to avoid blocking the main batch
    for (const item of staleItems) {
      try {
        // Attempt to process individually
        const result = await callMCPEndpoint(
          componentType as 'vectorSearch' | 'imageAnalysis' | 'ocr' | 'agentInference',
          config.endpoint.replace('_batch', ''), // Use non-batch endpoint
          { single: item.data }
        );
        item.resolve(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Stale item processing failed';
        logger.error(`Failed to process stale ${componentType} item: ${errorMessage}`);
        item.reject(new Error(`Stale item processing failed: ${errorMessage}`));
      }
    }
    
    // If no regular items remain, return
    if (queue.length === 0) {
      return;
    }
  }

  // Determine how many items to process (up to maxBatchSize)
  const itemCount = Math.min(queue.length, config.maxBatchSize);
  
  // Create a copy of the items to process WITHOUT removing them from the queue yet
  const itemsToProcess = queue.slice(0, itemCount);
  const batchData = itemsToProcess.map(item => item.data);

  logger.debug(`Processing batch of ${itemsToProcess.length} ${componentType} operations`);

  try {
    // Call the MCP endpoint with the batch data
    const results = await callMCPEndpoint<any[]>(
      componentType as 'vectorSearch' | 'imageAnalysis' | 'ocr' | 'agentInference',
      config.endpoint,
      { batch: batchData }
    );

    // Ensure we have the right number of results
    if (results.length !== itemsToProcess.length) {
      throw new Error(`Expected ${itemsToProcess.length} results, but got ${results.length}`);
    }

    // Now that we have successful results, we can safely remove items from the queue
    queue.splice(0, itemCount);

    // Resolve each item's promise with its corresponding result
    for (let i = 0; i < itemsToProcess.length; i++) {
      itemsToProcess[i].resolve(results[i]);
    }
  } catch (error) {
    // If the batch operation fails, reject all promises
    const errorMessage = error instanceof Error ? error.message : 'Unknown batch processing error';
    logger.error(`Batch processing failed for ${componentType}: ${errorMessage}`);
    
    // Individual error handling approach: retry each item individually
    for (let i = 0; i < itemsToProcess.length; i++) {
      try {
        // Attempt to process individually as fallback
        const result = await callMCPEndpoint(
          componentType as 'vectorSearch' | 'imageAnalysis' | 'ocr' | 'agentInference',
          config.endpoint.replace('_batch', ''), // Use non-batch endpoint
          { single: itemsToProcess[i].data }
        );
        itemsToProcess[i].resolve(result);
        
        // Remove the successfully processed item from the queue
        const index = queue.indexOf(itemsToProcess[i]);
        if (index !== -1) {
          queue.splice(index, 1);
        }
      } catch (individualError) {
        const individualErrorMessage = individualError instanceof Error ? individualError.message : 'Unknown error';
        logger.error(`Individual processing also failed for ${componentType} item: ${individualErrorMessage}`);
        itemsToProcess[i].reject(new Error(`Batch and individual processing failed: ${individualErrorMessage}`));
        
        // Remove the failed item from the queue to prevent blocking
        const index = queue.indexOf(itemsToProcess[i]);
        if (index !== -1) {
          queue.splice(index, 1);
        }
      }
    }
  }

  // If there are more items in the queue, schedule another batch
  if (queue.length > 0) {
    scheduleNextBatch(componentType);
  }
}

/**
 * Schedule the next batch processing
 * 
 * @param componentType The type of component
 */
function scheduleNextBatch(componentType: string): void {
  if (batchTimeouts[componentType]) {
    // Already scheduled
    return;
  }

  const config = batchConfigs[componentType];
  if (!config) {
    return;
  }

  batchTimeouts[componentType] = setTimeout(() => {
    processBatch(componentType).catch(error => {
      logger.error(`Error in batch processing for ${componentType}: ${error.message}`);
    });
  }, config.batchWindowMs);
}

/**
 * Add an operation to the batch queue
 * 
 * @param componentType The type of component
 * @param data The data for the operation
 * @returns A promise that resolves with the operation result
 */
export function addToBatch<T, R>(
  componentType: 'vectorSearch' | 'imageAnalysis' | 'ocr' | 'agentInference',
  data: T
): Promise<R> {
  if (!isBatchingEnabled(componentType)) {
    return Promise.reject(new Error(`Batching is not enabled for ${componentType}`));
  }

  initializeBatchQueueIfNeeded(componentType);

  // Create a promise that will be resolved when the batch is processed
  return new Promise<R>((resolve, reject) => {
    // Add the item to the queue
    batchQueues[componentType].push({
      data,
      resolve,
      reject,
      addedAt: Date.now()
    });

    // If this is the first item in the queue, schedule batch processing
    if (batchQueues[componentType].length === 1) {
      scheduleNextBatch(componentType);
    } 
    // If we've reached the max batch size, process immediately
    else if (batchQueues[componentType].length >= batchConfigs[componentType].maxBatchSize) {
      processBatch(componentType).catch(error => {
        logger.error(`Error in batch processing for ${componentType}: ${error.message}`);
      });
    }
  });
}

/**
 * Get statistics about the current batch queues
 * 
 * @returns Statistics about the batch queues
 */
export function getBatchStatistics(): Record<string, { queueLength: number, oldestItemAge: number }> {
  const stats: Record<string, { queueLength: number, oldestItemAge: number }> = {};
  
  for (const componentType in batchQueues) {
    const queue = batchQueues[componentType];
    
    if (queue.length > 0) {
      const oldestItem = queue[0];
      const oldestItemAge = Date.now() - oldestItem.addedAt;
      
      stats[componentType] = {
        queueLength: queue.length,
        oldestItemAge
      };
    } else {
      stats[componentType] = {
        queueLength: 0,
        oldestItemAge: 0
      };
    }
  }
  
  return stats;
}

/**
 * Flush all batch queues immediately
 * 
 * Useful when shutting down or for testing
 */
export function flushAllBatchQueues(): Promise<void[]> {
  const promises: Promise<void>[] = [];
  
  for (const componentType in batchQueues) {
    if (batchQueues[componentType].length > 0) {
      promises.push(processBatch(componentType));
    }
    
    if (batchTimeouts[componentType]) {
      clearTimeout(batchTimeouts[componentType]);
      delete batchTimeouts[componentType];
    }
  }
  
  return Promise.all(promises);
}

export default {
  isBatchingEnabled,
  addToBatch,
  getBatchStatistics,
  flushAllBatchQueues
};
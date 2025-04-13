/**
 * MCP Server Integration for ML Package
 * 
 * This module provides integration between the ML package and the MCP server,
 * allowing the ML package to use the MCP server for model management and inference
 * when configured to do so.
 * 
 * When enabled, it proxies ML function calls to the MCP server.
 * When disabled, it falls back to the original ML implementation.
 * 
 * Usage:
 * ```typescript
 * // In ML package index.ts
 * import { isMCPEnabled, createMCPClient } from './mcp-integration';
 * 
 * export async function recognizeMaterial(imagePath, options) {
 *   if (isMCPEnabled()) {
 *     const mcpClient = createMCPClient();
 *     return mcpClient.recognizeMaterial(imagePath, options);
 *   } else {
 *     // Original implementation
 *     return originalRecognizeMaterial(imagePath, options);
 *   }
 * }
 * ```
 */

import { MCPClient, RecognitionOptions, RecognitionResult } from '@kai/mcp-client';

import { env } from '../../shared/src/utils/environment';

// Cache for MCP client instance
let mcpClientInstance: MCPClient | null = null;

const MCP_SERVER_URL = env.ml.mcpServerUrl;
const USE_MCP_SERVER = env.ml.useMcpServer;
const MCP_HEALTH_CHECK_TIMEOUT = env.ml.mcpHealthCheckTimeout;

// Flag to track if we've tried to connect to MCP server
let mcpServerAvailabilityChecked = false;
let mcpServerAvailable = false;

/**
 * Check if MCP integration is enabled
 * 
 * @returns True if MCP integration is enabled and server is available
 */
export function isMCPEnabled(): boolean {
  return USE_MCP_SERVER && (mcpServerAvailable || !mcpServerAvailabilityChecked);
}

/**
 * Create or get the MCP client instance
 * 
 * @returns MCP client instance
 */
export function createMCPClient(): MCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClient(MCP_SERVER_URL);
  }
  return mcpClientInstance;
}

/**
 * Check if the MCP server is available
 * 
 * @returns Promise that resolves to true if server is available
 */
export async function checkMCPServerAvailability(): Promise<boolean> {
  if (!USE_MCP_SERVER) {
    return false;
  }
  
  if (!mcpServerAvailabilityChecked) {
    try {
      const mcpClient = createMCPClient();
      
      // Add timeout to health check
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('MCP server health check timeout')), MCP_HEALTH_CHECK_TIMEOUT);
      });
      
      // Check server health
      const healthCheckPromise = mcpClient.checkHealth().then(() => true);
      
      // Wait for either health check or timeout
      mcpServerAvailable = await Promise.race([healthCheckPromise, timeoutPromise]) as boolean;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`MCP server not available: ${errorMessage}`);
      mcpServerAvailable = false;
    } finally {
      mcpServerAvailabilityChecked = true;
    }
  }
  
  return mcpServerAvailable;
}

/**
 * Reset MCP availability check
 * 
 * Useful for testing or forcing a re-check
 */
export function resetMCPAvailabilityCheck(): void {
  mcpServerAvailabilityChecked = false;
  mcpServerAvailable = false;
}

/**
 * Material recognition through MCP server
 * 
 * @param imagePath Path to the image file
 * @param options Recognition options
 * @returns Recognition result
 */
export async function recognizeMaterialWithMCP(
  imagePath: string,
  options?: RecognitionOptions
): Promise<RecognitionResult> {
  if (!isMCPEnabled()) {
    throw new Error('MCP server integration is not enabled');
  }
  
  // Check server availability if not checked yet
  if (!mcpServerAvailabilityChecked) {
    const available = await checkMCPServerAvailability();
    if (!available) {
      throw new Error('MCP server is not available');
    }
  }
  
  const mcpClient = createMCPClient();
  return mcpClient.recognizeMaterial(imagePath, options);
}

/**
 * Generic proxy function for ML functions
 * 
 * @param mcpFunction Function to call if MCP is enabled
 * @param originalFunction Original function to call if MCP is disabled
 * @param args Arguments for the function
 * @returns Result of the function call
 */
export async function withMCPFallback<T, Args extends any[]>(
  mcpFunction: (...args: Args) => Promise<T>,
  originalFunction: (...args: Args) => Promise<T>,
  ...args: Args
): Promise<T> {
  if (isMCPEnabled()) {
    try {
      // Force availability check on first call
      if (!mcpServerAvailabilityChecked) {
        await checkMCPServerAvailability();
      }
      
      // If server is available, use MCP
      if (mcpServerAvailable) {
        return await mcpFunction(...args);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`MCP function call failed, falling back to original: ${errorMessage}`);
    }
  }
  
  // Fall back to original implementation
  return originalFunction(...args);
}

/**
 * Send agent messages to MCP server if available
 * 
 * @param messageType Type of message
 * @param content Message content
 * @returns True if message was sent
 */
export async function sendAgentMessage(
  messageType: string,
  content: Record<string, any>
): Promise<boolean> {
  if (!isMCPEnabled()) {
    return false;
  }
  
  try {
    const mcpClient = createMCPClient();
    await mcpClient.sendAgentMessage({
      message_type: messageType,
      content,
      timestamp: Date.now() / 1000,
    });
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`Failed to send agent message: ${errorMessage}`);
    return false;
  }
}

/**
 * Get messages from agent queue
 * 
 * @param maxWait Maximum time to wait for messages
 * @returns Agent messages or null if MCP is not enabled
 */
export async function getAgentMessages(
  maxWait: number = 1.0
): Promise<{ messages: any[]; count: number } | null> {
  if (!isMCPEnabled()) {
    return null;
  }
  
  try {
    const mcpClient = createMCPClient();
    return await mcpClient.getAgentMessages(maxWait);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`Failed to get agent messages: ${errorMessage}`);
    return null;
  }
}
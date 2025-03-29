/**
 * MCP (Model Context Protocol) Integration for Agent Components
 * 
 * This module provides integration between agent components and the MCP server,
 * allowing ML-intensive operations to be offloaded to a dedicated server.
 * 
 * When enabled, it proxies function calls to the MCP server.
 * When disabled, it falls back to the original implementation.
 * 
 * Features:
 * - Component-specific MCP enablement
 * - Authentication support
 * - Performance metrics tracking
 * - Health monitoring
 * - Graceful fallbacks
 */

import { createLogger } from './logger';

// Create a logger for MCP integration
const logger = createLogger('MCPIntegration');

// Environment variables for MCP configuration
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:8000';
const USE_MCP_SERVER = process.env.USE_MCP_SERVER === 'true';

// Component-specific MCP configuration
const MCP_ENABLE_VECTOR_SEARCH = process.env.MCP_ENABLE_VECTOR_SEARCH !== 'false' && USE_MCP_SERVER;
const MCP_ENABLE_OCR = process.env.MCP_ENABLE_OCR !== 'false' && USE_MCP_SERVER;
const MCP_ENABLE_IMAGE_ANALYSIS = process.env.MCP_ENABLE_IMAGE_ANALYSIS !== 'false' && USE_MCP_SERVER;
const MCP_ENABLE_TRAINING = process.env.MCP_ENABLE_TRAINING !== 'false' && USE_MCP_SERVER;
const MCP_ENABLE_AGENT_INFERENCE = process.env.MCP_ENABLE_AGENT_INFERENCE !== 'false' && USE_MCP_SERVER;

// Environment variable for MCP server health check timeout
const MCP_HEALTH_CHECK_TIMEOUT = parseInt(process.env.MCP_HEALTH_CHECK_TIMEOUT || '5000', 10);

// Environment variables for authentication
const MCP_AUTH_ENABLED = process.env.MCP_AUTH_ENABLED === 'true';
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || '';
const MCP_AUTH_TYPE = process.env.MCP_AUTH_TYPE || 'Bearer';

// Environment variables for metrics
const MCP_METRICS_ENABLED = process.env.MCP_METRICS_ENABLED === 'true';
const MCP_METRICS_SAMPLE_RATE = parseFloat(process.env.MCP_METRICS_SAMPLE_RATE || '0.1');

// Import type only to avoid circular dependencies
import type { MCPClient as MCPClientType } from '@kai/mcp-client';

/**
 * Authentication configuration for MCP
 */
export interface MCPAuthConfig {
  enabled: boolean;
  token: string;
  type: string;
}

/**
 * Performance metrics for MCP operations
 */
export interface MCPMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalLatency: number;
  averageLatency: number;
  lastRequestTime: number;
  componentMetrics: Record<string, {
    requests: number;
    latency: number;
    errors: number;
  }>;
}

// MCP client interface (simplified)
export interface MCPClient {
  checkHealth(): Promise<{ status: string }>;
  callEndpoint<T>(endpoint: string, data: any): Promise<T>;
}

// Flag to track if we've tried to connect to MCP server
let mcpServerAvailabilityChecked = false;
let mcpServerAvailable = false;

// Cache for MCP client instance
let mcpClientInstance: MCPClient | null = null;

// Performance metrics tracking
const metrics: MCPMetrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalLatency: 0,
  averageLatency: 0,
  lastRequestTime: 0,
  componentMetrics: {}
};

/**
 * Create or get the MCP client instance
 * 
 * @returns MCP client instance
 * @throws Error if client cannot be created
 */
export async function createMCPClient(): Promise<MCPClient> {
  if (!mcpClientInstance) {
    try {
      // Dynamic import to avoid circular dependencies
      const module = await import('@kai/mcp-client');
      const MCPClientClass = module.MCPClient as new (url: string, config?: any) => MCPClientType;
      
      // Create the client with auth configuration if enabled
      const clientConfig: Record<string, any> = {};
      
      if (MCP_AUTH_ENABLED && MCP_AUTH_TOKEN) {
        clientConfig.auth = {
          token: MCP_AUTH_TOKEN,
          type: MCP_AUTH_TYPE
        };
        logger.info('MCP client created with authentication');
      }
      
      if (MCP_METRICS_ENABLED) {
        clientConfig.metrics = {
          enabled: true,
          sampleRate: MCP_METRICS_SAMPLE_RATE
        };
        logger.info(`MCP metrics enabled with sample rate ${MCP_METRICS_SAMPLE_RATE}`);
      }
      
      mcpClientInstance = new MCPClientClass(MCP_SERVER_URL, clientConfig);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to create MCP client: ${errorMessage}`);
      throw new Error(`Failed to initialize MCP client: ${errorMessage}`);
    }
  }
  
  if (!mcpClientInstance) {
    throw new Error('Failed to initialize MCP client');
  }
  
  return mcpClientInstance;
}

/**
 * Get the current authentication configuration
 * 
 * @returns Current authentication configuration
 */
export function getMCPAuthConfig(): MCPAuthConfig {
  return {
    enabled: MCP_AUTH_ENABLED,
    token: MCP_AUTH_TOKEN ? '****' : '', // Don't expose the actual token
    type: MCP_AUTH_TYPE
  };
}

/**
 * Check if MCP integration is enabled globally
 * 
 * @returns True if MCP integration is enabled
 */
export function isMCPEnabled(): boolean {
  return USE_MCP_SERVER && (mcpServerAvailable || !mcpServerAvailabilityChecked);
}

/**
 * Check if MCP integration is enabled for a specific component
 * 
 * @param component The component to check
 * @returns True if MCP is enabled for the component
 */
export function isMCPEnabledForComponent(component: 'vectorSearch' | 'ocr' | 'imageAnalysis' | 'training' | 'agentInference'): boolean {
  if (!isMCPEnabled()) {
    return false;
  }
  
  switch (component) {
    case 'vectorSearch':
      return MCP_ENABLE_VECTOR_SEARCH;
    case 'ocr':
      return MCP_ENABLE_OCR;
    case 'imageAnalysis':
      return MCP_ENABLE_IMAGE_ANALYSIS;
    case 'training':
      return MCP_ENABLE_TRAINING;
    case 'agentInference':
      return MCP_ENABLE_AGENT_INFERENCE;
    default:
      return false;
  }
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
      const mcpClient = await createMCPClient();
      
      // Add timeout to health check
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('MCP server health check timeout')), MCP_HEALTH_CHECK_TIMEOUT);
      });
      
      // Check server health
      const healthCheckPromise = mcpClient.checkHealth().then(() => true);
      
      // Wait for either health check or timeout
      mcpServerAvailable = await Promise.race([healthCheckPromise, timeoutPromise]) as boolean;
      
      if (mcpServerAvailable) {
        logger.info('MCP server is available');
      } else {
        logger.warn('MCP server health check failed');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`MCP server not available: ${errorMessage}`);
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
 * Generic proxy function for component functions
 * 
 * @param mcpFunction Function to call if MCP is enabled
 * @param originalFunction Original function to call if MCP is disabled
 * @param args Arguments for the function
 * @returns Result of the function call
 */
export async function withMCPFallback<T, Args extends any[]>(
  componentType: 'vectorSearch' | 'ocr' | 'imageAnalysis' | 'training' | 'agentInference',
  mcpFunction: (...args: Args) => Promise<T>,
  originalFunction: (...args: Args) => Promise<T>,
  ...args: Args
): Promise<T> {
  if (isMCPEnabledForComponent(componentType)) {
    try {
      // Force availability check on first call
      if (!mcpServerAvailabilityChecked) {
        await checkMCPServerAvailability();
      }
      
      // If server is available, use MCP
      if (mcpServerAvailable) {
        logger.debug(`Using MCP for ${componentType}`);
        return await mcpFunction(...args);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`MCP ${componentType} function call failed, falling back to original: ${errorMessage}`);
    }
  }
  
  // Fall back to original implementation
  logger.debug(`Using original implementation for ${componentType}`);
  return originalFunction(...args);
}

/**
 * Helper function to call MCP endpoints with appropriate error handling
 */
export async function callMCPEndpoint<T>(
  componentType: 'vectorSearch' | 'ocr' | 'imageAnalysis' | 'training' | 'agentInference',
  endpoint: string,
  data: any
): Promise<T> {
  if (!isMCPEnabledForComponent(componentType)) {
    throw new Error(`MCP integration for ${componentType} is not enabled`);
  }
  
  // Check server availability if not checked yet
  if (!mcpServerAvailabilityChecked) {
    const available = await checkMCPServerAvailability();
    if (!available) {
      throw new Error('MCP server is not available');
    }
  }
  
  // Initialize component metrics if needed
  if (MCP_METRICS_ENABLED && !metrics.componentMetrics[componentType]) {
    metrics.componentMetrics[componentType] = {
      requests: 0,
      latency: 0,
      errors: 0
    };
  }
  
  // Track metrics
  const startTime = Date.now();
  metrics.totalRequests++;
  metrics.lastRequestTime = startTime;
  
  if (MCP_METRICS_ENABLED) {
    metrics.componentMetrics[componentType].requests++;
  }
  
  try {
    const mcpClient = await createMCPClient();
    const result = await mcpClient.callEndpoint<T>(endpoint, data);
    
    // Track success metrics
    const endTime = Date.now();
    const latency = endTime - startTime;
    
    metrics.successfulRequests++;
    metrics.totalLatency += latency;
    metrics.averageLatency = metrics.totalLatency / metrics.successfulRequests;
    
    if (MCP_METRICS_ENABLED) {
      metrics.componentMetrics[componentType].latency += latency;
    }
    
    return result;
  } catch (error: unknown) {
    // Track error metrics
    metrics.failedRequests++;
    
    if (MCP_METRICS_ENABLED) {
      metrics.componentMetrics[componentType].errors++;
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`MCP ${componentType} endpoint call failed: ${errorMessage}`);
    throw error;
  }
}

/**
 * Get current MCP performance metrics
 * 
 * @returns Current performance metrics
 */
export function getMCPMetrics(): MCPMetrics {
  return { ...metrics };
}

/**
 * Reset MCP performance metrics
 */
export function resetMCPMetrics(): void {
  Object.keys(metrics.componentMetrics).forEach(component => {
    metrics.componentMetrics[component] = {
      requests: 0,
      latency: 0,
      errors: 0
    };
  });
  
  metrics.totalRequests = 0;
  metrics.successfulRequests = 0;
  metrics.failedRequests = 0;
  metrics.totalLatency = 0;
  metrics.averageLatency = 0;
}

/**
 * Handle initialization of MCP integration
 */
export async function initializeMCPIntegration(): Promise<void> {
  if (USE_MCP_SERVER) {
    logger.info('Initializing MCP integration');
    
    try {
      await checkMCPServerAvailability();
      
      if (mcpServerAvailable) {
        logger.info(`MCP server available at: ${MCP_SERVER_URL}`);
        logger.info(`Vector Search MCP: ${MCP_ENABLE_VECTOR_SEARCH ? 'Enabled' : 'Disabled'}`);
        logger.info(`OCR MCP: ${MCP_ENABLE_OCR ? 'Enabled' : 'Disabled'}`);
        logger.info(`Image Analysis MCP: ${MCP_ENABLE_IMAGE_ANALYSIS ? 'Enabled' : 'Disabled'}`);
        logger.info(`Training MCP: ${MCP_ENABLE_TRAINING ? 'Enabled' : 'Disabled'}`);
        logger.info(`Agent Inference MCP: ${MCP_ENABLE_AGENT_INFERENCE ? 'Enabled' : 'Disabled'}`);
        logger.info(`Authentication: ${MCP_AUTH_ENABLED ? 'Enabled' : 'Disabled'}`);
        logger.info(`Metrics Tracking: ${MCP_METRICS_ENABLED ? 'Enabled' : 'Disabled'}`);
        
        // Initialize metrics for enabled components
        if (MCP_METRICS_ENABLED) {
          if (MCP_ENABLE_VECTOR_SEARCH) {
            metrics.componentMetrics['vectorSearch'] = { requests: 0, latency: 0, errors: 0 };
          }
          if (MCP_ENABLE_OCR) {
            metrics.componentMetrics['ocr'] = { requests: 0, latency: 0, errors: 0 };
          }
          if (MCP_ENABLE_IMAGE_ANALYSIS) {
            metrics.componentMetrics['imageAnalysis'] = { requests: 0, latency: 0, errors: 0 };
          }
          if (MCP_ENABLE_TRAINING) {
            metrics.componentMetrics['training'] = { requests: 0, latency: 0, errors: 0 };
          }
          if (MCP_ENABLE_AGENT_INFERENCE) {
            metrics.componentMetrics['agentInference'] = { requests: 0, latency: 0, errors: 0 };
          }
        }
      } else {
        logger.warn('MCP server is not available, using original implementations');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error initializing MCP integration: ${errorMessage}`);
    }
  } else {
    logger.info('MCP integration is disabled by configuration');
  }
}

export default {
  isMCPEnabled,
  isMCPEnabledForComponent,
  checkMCPServerAvailability,
  resetMCPAvailabilityCheck,
  withMCPFallback,
  callMCPEndpoint,
  initializeMCPIntegration,
  getMCPAuthConfig,
  getMCPMetrics,
  resetMCPMetrics
};
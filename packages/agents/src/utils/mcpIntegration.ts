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

// Type definitions for client configuration to improve type safety
interface MCPClientAuthConfig {
  token: string;
  type: string;
}

interface MCPClientMetricsConfig {
  enabled: boolean;
  sampleRate: number;
}

interface MCPClientConfig {
  auth?: MCPClientAuthConfig;
  metrics?: MCPClientMetricsConfig;
  timeout?: number;
}

/**
 * Create or get the MCP client instance
 * 
 * @returns MCP client instance
 * @throws Error if client cannot be created
 */
export async function createMCPClient(): Promise<MCPClient> {
  // Return cached instance if available
  if (mcpClientInstance) {
    return mcpClientInstance;
  }
  
  try {
    // Dynamic import with more specific error handling
    let MCPClientModule;
    try {
      // Import the module with specific error handling for module loading
      MCPClientModule = await import('@kai/mcp-client');
      
      // Validate that the module has the expected exports
      if (!MCPClientModule.MCPClient) {
        throw new Error('MCPClient class not found in the imported module');
      }
    } catch (importError) {
      const errorMessage = importError instanceof Error ? importError.message : 'Unknown module import error';
      logger.error(`Failed to import MCP client module: ${errorMessage}`);
      throw new Error(`Failed to load MCP client module: ${errorMessage}`);
    }
    
    // Create a properly typed configuration object
    const clientConfig: MCPClientConfig = {
      timeout: MCP_HEALTH_CHECK_TIMEOUT // Add timeout for all client operations
    };
    
    // Add authentication if enabled
    if (MCP_AUTH_ENABLED && MCP_AUTH_TOKEN) {
      clientConfig.auth = {
        token: MCP_AUTH_TOKEN,
        type: MCP_AUTH_TYPE
      };
      logger.info(`MCP client created with ${MCP_AUTH_TYPE} authentication`);
    }
    
    // Add metrics configuration if enabled
    if (MCP_METRICS_ENABLED) {
      clientConfig.metrics = {
        enabled: true,
        sampleRate: MCP_METRICS_SAMPLE_RATE
      };
      logger.info(`MCP metrics enabled with sample rate ${MCP_METRICS_SAMPLE_RATE}`);
    }
    
    // Create the client instance with explicit type checking
    const MCPClientClass = MCPClientModule.MCPClient as unknown as new (url: string, config: MCPClientConfig) => MCPClientType;
    
    // Validate server URL before creating client
    if (!MCP_SERVER_URL) {
      throw new Error('MCP server URL is not configured');
    }
    
    // Create client instance with proper error handling
    try {
      mcpClientInstance = new MCPClientClass(MCP_SERVER_URL, clientConfig);
      logger.info(`MCP client successfully created for server: ${MCP_SERVER_URL}`);

      // Apply authentication headers if enabled AFTER client creation
      if (MCP_AUTH_ENABLED && MCP_AUTH_TOKEN && mcpClientInstance) {
        try {
          // Access the private axios instance using 'any' cast (less safe but avoids modifying client class for now)
          const axiosInstance = (mcpClientInstance as any).client;
          if (axiosInstance && axiosInstance.defaults && axiosInstance.defaults.headers) {
            axiosInstance.defaults.headers.common['Authorization'] = `${MCP_AUTH_TYPE} ${MCP_AUTH_TOKEN}`;
            logger.info(`Applied ${MCP_AUTH_TYPE} authentication header to MCP client`);
          } else {
            logger.warn('Could not access internal axios instance defaults to set auth header.');
          }
        } catch (authError) {
           logger.error(`Failed to apply authentication headers to MCP client: ${authError}`);
           // Decide if this should prevent client usage? For now, log and continue.
        }
      }

    } catch (instantiationError) {
      const errorMessage = instantiationError instanceof Error ? instantiationError.message : 'Unknown instantiation error';
      logger.error(`Failed to instantiate MCP client: ${errorMessage}`);
      throw new Error(`Failed to create MCP client instance: ${errorMessage}`);
    }
    
    // Return the newly created instance
    return mcpClientInstance;
  } catch (error) {
    // Enhanced error handling with more context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to create MCP client: ${errorMessage}`, { 
      serverUrl: MCP_SERVER_URL,
      authEnabled: MCP_AUTH_ENABLED,
      metricsEnabled: MCP_METRICS_ENABLED
    });
    
    // Clear the instance if creation failed
    mcpClientInstance = null;
    
    // Rethrow with more context
    throw new Error(`Failed to initialize MCP client: ${errorMessage}`);
  }
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
      
      // Use AbortController for proper cleanup of the timeout
      const controller = new AbortController();
      const { signal } = controller;
      
      // Set up timeout that aborts the health check if it takes too long
      const timeoutId = setTimeout(() => {
        controller.abort(new Error('MCP server health check timeout'));
      }, MCP_HEALTH_CHECK_TIMEOUT);
      
      try {
        // Wrap the health check in a fetch-like pattern with abort signal handling
        const healthCheckWithTimeout = async () => {
          // Check for abortion before starting
          if (signal.aborted) {
            throw signal.reason || new Error('Operation aborted');
          }
          
          // Define a listener for abort events
          const abortListener = () => {
            throw signal.reason || new Error('Operation aborted');
          };
          
          try {
            // Add the abort listener
            signal.addEventListener('abort', abortListener);
            
            // Check server health
            await mcpClient.checkHealth();
            return true;
          } finally {
            // Clean up the abort listener
            signal.removeEventListener('abort', abortListener);
          }
        };
        
        // Execute the health check with timeout
        mcpServerAvailable = await healthCheckWithTimeout();
        logger.info('MCP server is available');
      } catch (healthError) {
        const errorMessage = healthError instanceof Error ? healthError.message : 'Unknown error';
        logger.warn(`MCP server health check failed: ${errorMessage}`);
        mcpServerAvailable = false;
      } finally {
        // Always clear the timeout to prevent memory leaks
        clearTimeout(timeoutId);
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
 * Error class for MCP fallback scenarios with detailed context
 */
export class MCPFallbackError extends Error {
  readonly componentType: string;
  readonly cause?: unknown;
  readonly context?: Record<string, unknown>;

  constructor(
    componentType: string,
    message: string,
    cause?: unknown,
    context?: Record<string, unknown>
  ) {
    const fullMessage = `MCP ${componentType} fallback error: ${message}`;
    super(fullMessage);
    
    this.name = 'MCPFallbackError';
    this.componentType = componentType;
    this.cause = cause;
    this.context = context;
  }
}

/**
 * Generic proxy function for component functions with improved error handling and type safety
 * 
 * @param componentType The type of component making the operation
 * @param mcpFunction Function to call if MCP is enabled and available
 * @param originalFunction Function to call as fallback if MCP is disabled or unavailable
 * @param args Arguments to pass to the selected function
 * @returns Result of the function call
 * @throws Error if both implementations fail
 */
export async function withMCPFallback<T, Args extends unknown[]>(
  componentType: 'vectorSearch' | 'ocr' | 'imageAnalysis' | 'training' | 'agentInference',
  mcpFunction: (...args: Args) => Promise<T>,
  originalFunction: (...args: Args) => Promise<T>,
  ...args: Args
): Promise<T> {
  // Track fallback reason for logging
  let fallbackReason = 'MCP disabled';
  
  if (isMCPEnabledForComponent(componentType)) {
    try {
      // Force availability check on first call with proper error handling
      if (!mcpServerAvailabilityChecked) {
        try {
          await checkMCPServerAvailability();
        } catch (availabilityError) {
          const errorMessage = availabilityError instanceof Error ? availabilityError.message : 'Unknown error';
          logger.warn(`MCP server availability check failed: ${errorMessage}`);
          fallbackReason = `availability check failed: ${errorMessage}`;
          // Continue to fallback rather than throw here
        }
      }
      
      // If server is available, use MCP with proper timeout and error handling
      if (mcpServerAvailable) {
        logger.debug(`Using MCP for ${componentType} operation`);
        
        try {
          return await mcpFunction(...args);
        } catch (mcpError) {
          // Handle errors from MCP function
          const errorMessage = mcpError instanceof Error ? mcpError.message : 'Unknown error';
          logger.warn(`MCP ${componentType} operation failed: ${errorMessage}`);
          fallbackReason = `operation failed: ${errorMessage}`;
          
          // If the error is a timeout or connection issue, mark server as potentially unavailable
          if (
            mcpError instanceof Error && 
            (
              mcpError.message.includes('timeout') || 
              mcpError.message.includes('connection') ||
              mcpError.message.includes('network')
            )
          ) {
            logger.warn('Connection issue detected, resetting MCP availability check for next operation');
            // Don't reset immediately to avoid thrashing, but allow a recheck on next operation
            setTimeout(() => {
              resetMCPAvailabilityCheck();
            }, 5000);
          }
        }
      } else {
        fallbackReason = 'server unavailable';
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`MCP ${componentType} fallback decision error: ${errorMessage}`);
      fallbackReason = `initialization error: ${errorMessage}`;
    }
  }
  
  // Log the fallback with reason
  logger.debug(`Using original implementation for ${componentType} (reason: ${fallbackReason})`);
  
  // Try the fallback implementation with proper error handling
  try {
    return await originalFunction(...args);
  } catch (fallbackError) {
    // If the fallback also fails, provide a comprehensive error with context
    const fallbackErrorMsg = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
    logger.error(`${componentType} fallback implementation also failed: ${fallbackErrorMsg}`);
    
    // Create context for debugging
    const errorContext = {
      mcpEnabled: isMCPEnabled(),
      componentEnabled: isMCPEnabledForComponent(componentType),
      serverAvailable: mcpServerAvailable,
      fallbackReason,
      argsTypes: args.map(arg => typeof arg)
    };
    
    // Throw a detailed error with the original error as cause
    throw new MCPFallbackError(
      componentType,
      `Both MCP and fallback implementations failed. MCP: ${fallbackReason}, Fallback: ${fallbackErrorMsg}`,
      fallbackError,
      errorContext
    );
  }
}

// Define a custom error class for MCP endpoint errors with better context
class MCPEndpointError extends Error {
  readonly componentType: string;
  readonly endpoint: string;
  readonly cause?: unknown;
  readonly context?: Record<string, unknown>;

  constructor(
    componentType: string,
    endpoint: string,
    message: string,
    cause?: unknown,
    context?: Record<string, unknown>
  ) {
    // Create a detailed error message with component and endpoint
    const fullMessage = `MCP ${componentType} endpoint ${endpoint} error: ${message}`;
    super(fullMessage);
    
    this.name = 'MCPEndpointError';
    this.componentType = componentType;
    this.endpoint = endpoint;
    this.cause = cause;
    this.context = context;
  }
}

/**
 * Helper function to call MCP endpoints with comprehensive error handling and validation
 *
 * @param componentType The type of component calling the endpoint
 * @param endpoint The endpoint to call on the MCP server
 * @param data The data to send to the endpoint
 * @returns Promise that resolves with the endpoint response
 * @throws MCPEndpointError if the operation fails
 */
export async function callMCPEndpoint<T>(
  componentType: 'vectorSearch' | 'ocr' | 'imageAnalysis' | 'training' | 'agentInference',
  endpoint: string,
  data: unknown
): Promise<T> {
  // Validate inputs
  if (!componentType) {
    throw new MCPEndpointError('unknown', 'unknown', 'Component type is required');
  }
  
  if (!endpoint) {
    throw new MCPEndpointError(componentType, 'unknown', 'Endpoint is required');
  }
  
  // Check if MCP is enabled for this component
  if (!isMCPEnabledForComponent(componentType)) {
    throw new MCPEndpointError(
      componentType, 
      endpoint, 
      `MCP integration for ${componentType} is not enabled`,
      undefined,
      { enabled: isMCPEnabled() }
    );
  }
  
  // Check server availability if not checked yet
  if (!mcpServerAvailabilityChecked) {
    try {
      const available = await checkMCPServerAvailability();
      if (!available) {
        throw new MCPEndpointError(
          componentType, 
          endpoint, 
          'MCP server is not available',
          undefined,
          { serverUrl: MCP_SERVER_URL }
        );
      }
    } catch (availabilityError) {
      const errorMessage = availabilityError instanceof Error ? availabilityError.message : 'Unknown error';
      throw new MCPEndpointError(
        componentType, 
        endpoint, 
        'Failed to check MCP server availability',
        availabilityError,
        { serverUrl: MCP_SERVER_URL }
      );
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
  
  // Track request metrics
  const startTime = Date.now();
  metrics.totalRequests++;
  metrics.lastRequestTime = startTime;
  
  if (MCP_METRICS_ENABLED) {
    metrics.componentMetrics[componentType].requests++;
  }
  
  try {
    // Create client and make the request
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
    
    // Log success with appropriate detail level
    logger.debug(`MCP ${componentType} endpoint ${endpoint} call successful (${latency}ms)`);
    
    return result;
  } catch (error: unknown) {
    // Track error metrics
    metrics.failedRequests++;
    
    if (MCP_METRICS_ENABLED) {
      metrics.componentMetrics[componentType].errors++;
    }
    
    // Create a detailed error context for debugging
    const errorContext: Record<string, unknown> = {
      serverUrl: MCP_SERVER_URL,
      dataType: typeof data,
      timestamp: new Date().toISOString()
    };
    
    // Include summary of data for debugging but avoid exposing sensitive info
    if (typeof data === 'object' && data !== null) {
      try {
        const keys = Object.keys(data as Record<string, unknown>);
        errorContext.dataKeys = keys;
        errorContext.dataSize = JSON.stringify(data).length;
      } catch (jsonError) {
        errorContext.dataError = 'Failed to process data for error context';
      }
    }
    
    // Format the error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`MCP ${componentType} endpoint ${endpoint} call failed: ${errorMessage}`, errorContext);
    
    // Throw a detailed error with context
    throw new MCPEndpointError(
      componentType,
      endpoint,
      errorMessage,
      error,
      errorContext
    );
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
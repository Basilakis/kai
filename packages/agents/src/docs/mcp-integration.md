# MCP (Model Context Protocol) Integration

This document provides an overview of the MCP integration in the KAI system, explaining how ML-intensive operations can be moved to a dedicated MCP server for improved performance and resource efficiency.

## Table of Contents

1. [Overview](#overview)
2. [Components Using MCP](#components-using-mcp)
3. [Architecture](#architecture)
4. [Authentication and Security](#authentication-and-security)
5. [Performance Metrics](#performance-metrics)
6. [Batch Processing](#batch-processing)
7. [Configuration](#configuration)
8. [Implementation](#implementation)
9. [Adding New Components to MCP](#adding-new-components-to-mcp)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)
12. [Component Integration Examples](#component-integration-examples)
13. [Future Enhancements](#future-enhancements)

## Overview

The Model Context Protocol (MCP) server provides a centralized system for:

1. **Model Management**: Loading and caching ML models in memory
2. **Optimized Inference**: Leveraging hardware acceleration (GPU/TPU)
3. **Standardized API**: Providing a consistent interface across components
4. **Resource Efficiency**: Reducing duplication of loaded models
5. **Security**: Centralized authentication and authorization
6. **Monitoring**: Comprehensive performance metrics and telemetry

By moving ML-intensive operations to an MCP server, we can significantly improve performance, reduce resource usage, and simplify model management.

## Components Using MCP

The following components have been integrated with MCP:

1. **Vector Search**: Semantic similarity searches using vector embeddings (with full local fallback)
2. **OCR Processing**: Text extraction from documents and images (MCP-only integration)
3. **Image Analysis**: Material recognition, quality assessment, and feature extraction (with full local fallback)

Additional components that could benefit from MCP integration:

1. **Training Pipeline**: Model training and hyperparameter optimization
2. **Agent LLM Inference**: Large language model operations for agents

## Architecture

The MCP integration follows a layered architecture:

```
┌─────────────────────────────────────┐
│             Components              │
│  (Vector Search, OCR, Image, etc.)  │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│           MCP Adapters              │
│ (Provide component-specific APIs)   │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│         MCP Integration             │
│ (Common utilities for MCP access)   │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│           MCP Client                │
│ (Communicates with MCP server)      │
└────────────────┬────────────────────┘
                 │
                 ▼
          ┌─────────────┐
          │ MCP Server  │
          └─────────────┘
```

### Key Components:

1. **MCP Integration Utility**: Provides common functionality for MCP communication
2. **MCP Batch Processor**: Optimizes throughput by batching similar operations
3. **Component Adapters**: Map component-specific operations to MCP endpoints
4. **MCP Client**: Handles the actual communication with the MCP server

### Cross-Package Integration

The KAI system is structured into multiple packages with clear boundaries:

- `packages/agents`: Agent-related functionality
- `packages/server`: Server-side services including OCR processing
- `packages/ml`: ML-specific functionality
- `packages/shared`: Shared utilities and types

When integrating MCP across packages, there are two approaches:

1. **Direct Integration**: Create direct cross-package dependencies (not recommended)
2. **Bridge Pattern**: Create package-specific adapters that communicate via MCP

The current implementation uses the Bridge Pattern approach to maintain package boundaries:

```
┌────────────────────┐      ┌────────────────────┐
│  Agents Package    │      │   Server Package   │
│                    │      │                    │
│ ┌────────────────┐ │      │ ┌────────────────┐ │
│ │    Component   │ │      │ │    Component   │ │
│ └───────┬────────┘ │      │ └────────┬───────┘ │
│         │          │      │          │         │
│ ┌───────▼────────┐ │      │ ┌────────▼───────┐ │
│ │  MCP Adapter   │ │      │ │ Local Service  │ │
│ └───────┬────────┘ │      │ └────────────────┘ │
└─────────┼──────────┘      └────────────────────┘
          │                            ▲
          │                            │
          │         ┌──────────────────┴─┐
          └────────►│    MCP Server      │
                    └────────────────────┘
```

The OCR implementation demonstrates this approach. The OCR service exists in the server package, while the MCP adapter is in the agents package. Instead of creating a direct dependency, both interact through the MCP server.

## Authentication and Security

The MCP integration includes comprehensive authentication support to secure ML operations. Authentication is configured through environment variables and is applied consistently across all MCP requests.

### Configuration

```typescript
// Environment variables for authentication
const MCP_AUTH_ENABLED = process.env.MCP_AUTH_ENABLED === 'true';
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || '';
const MCP_AUTH_TYPE = process.env.MCP_AUTH_TYPE || 'Bearer';
```

When enabled, authentication is applied to the MCP client:

```typescript
// Create the client with authentication configuration
const clientConfig: Record<string, any> = {};

if (MCP_AUTH_ENABLED && MCP_AUTH_TOKEN) {
  clientConfig.auth = {
    token: MCP_AUTH_TOKEN,
    type: MCP_AUTH_TYPE
  };
  logger.info('MCP client created with authentication');
}

mcpClientInstance = new MCPClientClass(MCP_SERVER_URL, clientConfig);
```

### API

The MCP integration utility provides methods to check authentication status:

```typescript
// Get current authentication configuration (token is masked)
const authConfig = getMCPAuthConfig();
console.log(`Auth enabled: ${authConfig.enabled}, type: ${authConfig.type}`);
```

## Performance Metrics

The MCP integration collects detailed performance metrics to help monitor and optimize ML operations. These metrics track:

- Total request count
- Success and failure rates
- Request latency
- Component-specific usage statistics

### Metrics Structure

```typescript
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
```

### Usage

Metrics collection is enabled through environment variables:

```
MCP_METRICS_ENABLED=true
MCP_METRICS_SAMPLE_RATE=0.1  # Sample 10% of requests for detailed metrics
```

Metrics can be retrieved at any time:

```typescript
import { getMCPMetrics } from './utils/mcpIntegration';

// Get current metrics
const metrics = getMCPMetrics();
console.log(`Total requests: ${metrics.totalRequests}`);
console.log(`Average latency: ${metrics.averageLatency}ms`);

// Component-specific metrics
for (const [component, stats] of Object.entries(metrics.componentMetrics)) {
  console.log(`${component}: ${stats.requests} requests, ${stats.errors} errors`);
}
```

## Batch Processing

To optimize performance, the MCP integration includes a sophisticated batch processing system that groups similar operations within a time window. This reduces network overhead and better utilizes hardware acceleration.

### How Batching Works

1. Operations of the same type are collected in a queue
2. When either a time threshold is reached or the queue reaches a maximum size, the batch is processed
3. All operations in the batch are sent as a single request to the MCP server
4. Results are distributed back to the original callers

### Batch Configuration

Batching is configured through environment variables:

```
# Global batch configuration
MCP_BATCH_ENABLED=true
MCP_DEFAULT_BATCH_SIZE=10
MCP_DEFAULT_BATCH_WINDOW_MS=50

# Component-specific batch configuration
MCP_VECTOR_SEARCH_BATCH_SIZE=20
MCP_VECTOR_SEARCH_BATCH_WINDOW_MS=100
```

### Using Batch Processing

Component adapters can leverage batching:

```typescript
import { addToBatch, isBatchingEnabled } from '../../utils/mcpBatchProcessor';

async function searchVectorWithMCP(vector: number[], options: SearchOptions): Promise<SearchResult[]> {
  // Use batching if enabled
  if (isBatchingEnabled('vectorSearch')) {
    return await addToBatch<{vector: number[], options: SearchOptions}, SearchResult[]>(
      'vectorSearch',
      { vector, options }
    );
  }
  
  // Otherwise use direct MCP call
  return callMCPEndpoint<SearchResult[]>(
    'vectorSearch',
    'vector/search',
    { vector, options }
  );
}
```

Batching statistics can be monitored:

```typescript
import { getBatchStatistics } from '../../utils/mcpBatchProcessor';

const stats = getBatchStatistics();
console.log('Batch queue stats:', stats);
```

## Configuration

MCP integration can be configured through environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_SERVER_URL` | URL of the MCP server | `http://localhost:8000` |
| `USE_MCP_SERVER` | Enable/disable MCP integration globally | `false` |
| `MCP_ENABLE_VECTOR_SEARCH` | Enable MCP for vector search | Same as `USE_MCP_SERVER` |
| `MCP_ENABLE_OCR` | Enable MCP for OCR | Same as `USE_MCP_SERVER` |
| `MCP_ENABLE_IMAGE_ANALYSIS` | Enable MCP for image analysis | Same as `USE_MCP_SERVER` |
| `MCP_ENABLE_TRAINING` | Enable MCP for training | Same as `USE_MCP_SERVER` |
| `MCP_ENABLE_AGENT_INFERENCE` | Enable MCP for agent inference | Same as `USE_MCP_SERVER` |
| `MCP_HEALTH_CHECK_TIMEOUT` | Timeout for health checks (ms) | `5000` |
| `MCP_AUTH_ENABLED` | Enable authentication | `false` |
| `MCP_AUTH_TOKEN` | Authentication token | `""` |
| `MCP_AUTH_TYPE` | Authentication type | `"Bearer"` |
| `MCP_METRICS_ENABLED` | Enable metrics collection | `false` |
| `MCP_METRICS_SAMPLE_RATE` | Metrics sample rate (0.0-1.0) | `0.1` |
| `MCP_BATCH_ENABLED` | Enable batch processing | `false` |
| `MCP_DEFAULT_BATCH_SIZE` | Default batch size | `10` |
| `MCP_DEFAULT_BATCH_WINDOW_MS` | Default batch window (ms) | `50` |

Each component can be individually enabled or disabled, allowing for granular control.

## Implementation

### 1. MCP Integration Utility

The `mcpIntegration.ts` file provides common functionality:

```typescript
// Check if MCP is enabled for a component
if (isMCPEnabledForComponent('vectorSearch')) {
  // Use MCP for vector search
}

// Call an MCP endpoint
const result = await callMCPEndpoint<ResultType>('component', 'operation', params);

// Initialize MCP integration
await initializeMCPIntegration();

// Get metrics
const metrics = getMCPMetrics();
```

### 2. Component Adapters

Component adapters provide a clean interface to MCP operations while maintaining compatibility with existing code:

**Vector Search Example:**

```typescript
// Using the vector search adapter
import * as vectorSearchAdapter from '../services/adapters/vectorSearchMcpAdapter';

// Search by vector
const results = await vectorSearchAdapter.searchByVector({
  query: 'ceramic tile',
  limit: 10
});

// Find similar materials
const similarMaterials = await vectorSearchAdapter.findSimilarMaterials({
  materialId: 'mat-001',
  limit: 5
});
```

**Image Analysis Example:**

```typescript
// Using the image analysis adapter
import * as imageAnalysisAdapter from '../services/adapters/imageAnalysisMcpAdapter';

// Analyze an image
const analysisResult = await imageAnalysisAdapter.analyzeImage(
  imageBase64, 
  { 
    detectMaterials: true,
    assessQuality: true,
    extractFeatures: true 
  }
);

// Extract features for similarity search
const features = await imageAnalysisAdapter.extractImageFeatures(imageBase64);

// Assess image quality
const quality = await imageAnalysisAdapter.assessImageQuality(imageBase64);
```

**OCR Example:**

```typescript
// Using the OCR adapter
import * as ocrAdapter from '../services/adapters/ocrMcpAdapter';

// Process a document
const ocrResult = await ocrAdapter.processDocument({
  documentPath: '/path/to/document.pdf',
  languages: ['eng'],
  detectHandwriting: true
});

// Extract text from a region
const regionText = await ocrAdapter.extractTextFromRegion(
  '/path/to/document.pdf',
  [100, 200, 300, 400], // [x, y, width, height]
  1 // page number
);
```

## Adding New Components to MCP

To move a new component to the MCP architecture:

1. **Create an MCP adapter**: Define the component's interface and map it to MCP operations
2. **Update the MCP client types**: Add any new types or methods needed
3. **Update the tool or service**: Modify the existing implementation to use the adapter
4. **Add batch processing support**: Enable batching for appropriate operations

### Integration Patterns

Depending on the package structure, use one of these patterns:

#### 1. Same-Package Integration (Vector Search Example)

When the component and its implementation are in the same package (like vector search):

```typescript
// Complete implementation with local fallback
export async function searchByVector(params: VectorSearchParams): Promise<VectorSearchResult[]> {
  return withMCPFallback(
    'vectorSearch',
    async (p: VectorSearchParams) => {
      // Check if batching is enabled
      if (isBatchingEnabled('vectorSearch')) {
        return await addToBatch<VectorSearchParams, VectorSearchResult[]>(
          'vectorSearch',
          p
        );
      }
      
      // Otherwise use direct MCP call
      return callMCPEndpoint<VectorSearchResult[]>('vectorSearch', 'search', p);
    },
    async (p: VectorSearchParams) => {
      // Local implementation
      const vectorService = getVectorService();
      return vectorService.searchByVector(p);
    },
    params
  );
}
```

#### 2. Cross-Package Integration (OCR Example)

When the component implementation is in a different package (like OCR):

```typescript
// MCP-only implementation in the agents package
export async function processDocument(params: OCRParams): Promise<OCRResult> {
  if (!isMcpEnabledForOCR()) {
    throw new Error('OCR MCP is not enabled');
  }
  
  // Check if batching is enabled
  if (isBatchingEnabled('ocr')) {
    return await addToBatch<OCRParams, OCRResult>('ocr', params);
  }
  
  return callMCPEndpoint<OCRResult>('ocr', 'processDocument', params);
}

// In the server package, create or update the OCR service to also use MCP
// through a similar adapter when appropriate
```

To create a proper bridge for cross-package components, you would need to either:

1. Create an adapter in each package that communicates through the MCP server
2. Create a unified interface in a shared package that both packages can use
3. Use message-based communication between packages (WebSockets, events, etc.)

### Example: Creating a New Adapter

```typescript
// imageAnalysisMcpAdapter.ts
import { createLogger } from '../../utils/logger';
import { 
  isMCPEnabledForComponent, 
  withMCPFallback, 
  callMCPEndpoint 
} from '../../utils/mcpIntegration';
import { addToBatch, isBatchingEnabled } from '../../utils/mcpBatchProcessor';

// Create a logger
const logger = createLogger('ImageAnalysisMcpAdapter');

// Define the component's operations
export async function analyzeImage(
  imageBase64: string, 
  options: AnalysisOptions = {}
): Promise<AnalysisResult> {
  return withMCPFallback<AnalysisResult, [string, AnalysisOptions]>(
    'imageAnalysis',
    async (image: string, opts: AnalysisOptions) => {
      // Check if batching is enabled
      if (isBatchingEnabled('imageAnalysis')) {
        return await addToBatch<{imageBase64: string, options: AnalysisOptions}, AnalysisResult>(
          'imageAnalysis',
          { imageBase64: image, options: opts }
        );
      }
      
      // Otherwise use direct MCP call
      return callMCPEndpoint<AnalysisResult>(
        'imageAnalysis',
        'image/analyze',
        { imageBase64: image, options: opts }
      );
    },
    async (image: string, opts: AnalysisOptions) => {
      // Local implementation
      logger.debug('Using local image analysis implementation');
      // Implementation details...
      return localAnalysisResult;
    },
    imageBase64,
    options
  );
}
```

## Best Practices

1. **Respect Package Boundaries**: Don't create direct cross-package dependencies
2. **Graceful Fallbacks**: Provide fallback mechanisms when MCP is unavailable
3. **Use Batching Appropriately**: Enable batching for operations that benefit from it
4. **Secure Sensitive Operations**: Enable authentication for production deployments
5. **Monitor Performance Metrics**: Regularly check metrics to identify bottlenecks
6. **Component Isolation**: Keep MCP integration within adapters, not in business logic
7. **Type Safety**: Use TypeScript interfaces for all MCP operations

## Troubleshooting

### MCP Server Not Available

If the MCP server is not available:

1. Check if the MCP server is running: `curl http://localhost:8000/health`
2. Verify environment variables are configured correctly
3. Check network connectivity between the client and server
4. Examine server logs for errors

### Authentication Issues

If authentication fails:

1. Verify that the token is correctly configured
2. Check that the authentication type matches what the server expects
3. Ensure that the server has authentication enabled

### Performance Issues

If performance is not improved with MCP:

1. Ensure GPU acceleration is enabled on the MCP server
2. Check batch processing configuration
3. Monitor metrics to identify bottlenecks
4. Verify network latency between client and server

## Component Integration Examples

### Vector Search Integration

The vector search adapter demonstrates same-package integration with full local fallback:

```typescript
// vectorSearchMcpAdapter.ts
export async function searchVector(vector: number[], options: SearchOptions): Promise<SearchResult[]> {
  return withMCPFallback<SearchResult[], [number[], SearchOptions]>(
    'vectorSearch',
    searchVectorWithMCP,  // Uses MCP with potential batching
    searchVectorLocally,  // Local implementation
    vector,
    options
  );
}
```

### OCR Integration

The OCR adapter demonstrates cross-package integration using MCP as a bridge:

1. The actual OCR service exists in `packages/server/src/services/pdf/ocrService.ts`
2. The MCP adapter exists in `packages/agents/src/services/adapters/ocrMcpAdapter.ts`

Instead of creating a direct dependency between them:

1. The server package would deploy the OCR service to the MCP server
2. The agents package creates an adapter that communicates with the OCR service via MCP
3. Both packages maintain their boundaries while sharing functionality

### Image Analysis Integration

The image analysis adapter demonstrates both local fallback and batch processing:

```typescript
// analyzeImageWithMCP function in imageAnalysisMcpAdapter.ts
async function analyzeImageWithMCP(
  imageBase64: string, 
  options: AnalysisOptions = {}
): Promise<AnalysisResult> {
  try {
    // Check if batching is enabled and use it if possible
    if (isBatchingEnabled('imageAnalysis')) {
      return await addToBatch<{imageBase64: string, options: AnalysisOptions}, AnalysisResult>(
        'imageAnalysis',
        { imageBase64, options }
      );
    }
    
    // Otherwise use direct MCP call
    const result = await callMCPEndpoint<AnalysisResult>(
      'imageAnalysis',
      'image/analyze',
      { imageBase64, options }
    );
    
    logger.debug(`Analyzed image with MCP: ${result.materials.length} materials detected`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`MCP image analysis failed: ${errorMessage}`);
    throw error;
  }
}
```

## Future Enhancements

1. **Streaming Inference**: Support for WebSocket-based streaming results
2. **Advanced Batching**: Dynamic batch size adjustment based on load
3. **Model Version Management**: More sophisticated model versioning and rollback
4. **Distributed Inference**: Support for multiple MCP server instances
5. **Enhanced Telemetry**: Detailed performance metrics and monitoring dashboard
6. **Cross-Package Bridges**: Standardized patterns for cross-package integration
7. **Load Balancing**: Intelligent distribution of requests across multiple MCP servers
8. **Dynamic Scaling**: Automatic scaling of MCP server resources based on demand
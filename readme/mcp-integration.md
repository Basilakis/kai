# Model Context Protocol (MCP) Integration

This comprehensive guide covers the Model Context Protocol (MCP) system in the Kai platform, including the server architecture, client SDK, API integrations, and agent communication capabilities.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [MCP Server](#mcp-server)
4. [MCP Client SDK](#mcp-client-sdk)
5. [API Integrations](#api-integrations)
   - [High-Priority APIs](#high-priority-apis)
   - [Medium-Priority APIs](#medium-priority-apis)
6. [Credit System Integration](#credit-system-integration)
7. [Agent Integration](#agent-integration)
8. [Implementation Details](#implementation-details)
9. [Performance Optimization](#performance-optimization)
10. [Troubleshooting](#troubleshooting)
11. [Future Enhancements](#future-enhancements)
12. [Deployment](#deployment)

## Overview

The Model Context Protocol (MCP) system serves as a centralized middleware and service layer that manages machine learning models, handles inference requests, and provides a unified interface for various AI and ML services across the platform. It follows the [Model Context Protocol](https://modelcontextprotocol.io) standard for consistent interface design.

### Why We Need MCP

The traditional approach of loading machine learning models for each inference request has several limitations:

1. **Performance Issues**: Loading models for each request adds significant latency
2. **Resource Inefficiency**: Multiple instances load duplicate copies of the same models
3. **Limited Scaling**: Difficult to scale model serving independently from application logic
4. **Version Management**: No centralized mechanism for model versioning or hot-swapping
5. **Agent Integration**: No standardized way for AI agents to interact with model inference
6. **Credit Tracking**: No unified system for tracking usage and managing credits

### Key Benefits

The MCP system addresses these issues and provides several benefits:

1. **Improved Performance**
   - Models are loaded once and kept in memory
   - Reduced latency for inference requests
   - Efficient resource utilization through batching

2. **Enhanced Model Management**
   - Centralized versioning for models
   - Ability to perform A/B testing between model versions
   - Hot-swapping models without application restarts

3. **Simplified Agent Integration**
   - Standardized protocol for agent-model communication
   - Built-in support for agent feedback loops
   - Contextual information sharing between agents and models

4. **Scalability**
   - Independent scaling of model serving components
   - Better handling of high-volume inference requests
   - Load balancing across multiple model server instances

5. **Unified Credit System**
   - Centralized tracking of API usage
   - Consistent credit policies across services
   - Clear credit requirement communication to users

## Architecture

The MCP implementation uses a hybrid approach with two main components:

### Python-based MCP Server
- Standalone FastAPI microservice
- Direct access to ML libraries (TensorFlow, PyTorch)
- Optimized for model inference with GPU support
- Model caching and version management
- Centralized credit tracking and management

### TypeScript Client SDK
- Clean TypeScript interface for the MCP server
- Type-safe API for model management and inference
- Seamless integration with existing Kai components
- Authentication and credit handling

### Component Adapters
- Specialized adapters for each ML component
- Authentication and metrics support
- Fallback capabilities for reliability
- Batching for improved throughput

### Communication Flow

```
┌────────────────┐     ┌─────────────────┐     ┌────────────────┐
│                │     │                 │     │                │
│  TypeScript    │─────▶ TypeScript MCP  │─────▶ Python MCP     │
│  Application   │◀─────  Client SDK     │◀─────  Server        │
│                │     │                 │     │                │
└────────────────┘     └─────────────────┘     └────────────────┘
                                                       │
                                                       ▼
                                               ┌────────────────┐
                                               │                │
                                               │ ML Models      │
                                               │ (TF/PyTorch)   │
                                               │                │
                                               └────────────────┘
                                                       │
                                                       ▼
                                               ┌────────────────┐
                                               │                │
                                               │ Agent System   │
                                               │                │
                                               └────────────────┘
```

### Integration Patterns

The MCP architecture supports two distinct integration patterns:

#### Same-Package Integration
When component implementation and MCP adapter are in the same package:
- Full local fallback support
- Transparent switching between MCP and local
- Consistent API regardless of implementation

#### Cross-Package Integration
When component implementation and MCP adapter are in different packages:
- Uses MCP as a communication bridge
- Respects package boundaries
- No direct cross-package dependencies

## MCP Server

The Python-based MCP Server is the core of the system, responsible for model management, inference, and service coordination.

### Components That Use MCP

The following ML-intensive components should be moved to MCP server architecture:

1. **Firecrawl** (Already implemented)
   - Web crawling operations
   - HTML content extraction and processing

2. **Vector Search Operations**
   - Semantic similarity operations
   - Embedding model inference
   - Batch processing of search queries
   - GPU-accelerated vector operations

3. **OCR Processing**
   - Document text extraction
   - Layout analysis
   - Handwriting recognition
   - Form field identification
   - Multiple specialized OCR models

4. **Image Analysis & Material Recognition**
   - Feature extraction from images
   - Material classification
   - Property detection
   - Quality assessment
   - Vision model inference

5. **Agent LLM Inference**
   - Large language model operations
   - Token batching
   - Model version management
   - Streaming capabilities

6. **ML Training Pipeline**
   - Transfer learning operations
   - Hyperparameter optimization
   - Distributed training
   - Progress tracking and reporting

### Server API Endpoints

The MCP Server exposes the following REST API endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Get server information |
| `/health` | GET | Health check endpoint |
| `/api/v1/models` | GET | List available models |
| `/api/v1/models/{model_id}` | GET | Get model information |
| `/api/v1/models/{model_id}/context` | GET | Get model context |
| `/api/v1/models/{model_id}/context` | PUT | Update model context |
| `/api/v1/recognize` | POST | Recognize materials in an image |
| `/api/v1/agent/message` | POST | Send a message to the agent |
| `/api/v1/agent/messages` | GET | Get messages from the agent queue |

### Advanced Features

The MCP server implementation includes several advanced capabilities:

#### Authentication and Security
- Token-based authentication
- Automatic token management and renewal
- Environment-based configuration
- Secure logging with token masking

#### Performance Metrics
- Request counts, latency, and errors
- Component-specific metrics collection
- Configurable sampling rates
- Integration with monitoring systems

#### Batch Processing
- Automatic batching of similar operations
- Configurable batch sizes and timing
- Improved hardware utilization
- Optimized for GPU/TPU acceleration

## MCP Client SDK

The TypeScript client SDK provides a type-safe interface for interacting with the MCP server from Node.js applications.

### Installation

> **Note**: Installation instructions for the MCP Client have been moved to the [Deployment Guide](./deployment-guide.md#mcp-client-installation).

### Basic Usage

```typescript
import { MCPClient } from '@kai/mcp-client';

// Create a client instance
const mcpClient = new MCPClient('http://localhost:8000');

// Check server health
const health = await mcpClient.checkHealth();
console.log(`Server status: ${health.status}`);

// List available models
const models = await mcpClient.listModels();
console.log(`Available models: ${models.map(m => m.name).join(', ')}`);

// Material recognition
const result = await mcpClient.recognizeMaterial('path/to/image.jpg', {
  modelType: 'hybrid',
  confidenceThreshold: 0.7,
  maxResults: 10
});

console.log(`Found ${result.matches.length} matching materials`);
console.log(`Top match: ${result.matches[0].materialId} (${result.matches[0].confidence.toFixed(2)})`);
```

### API Reference

#### Client Initialization

```typescript
const mcpClient = new MCPClient(baseUrl: string);
```

#### Server Information

```typescript
// Get server information
const info = await mcpClient.getServerInfo();

// Check server health
const health = await mcpClient.checkHealth();
```

#### Model Management

```typescript
// List available models
const models = await mcpClient.listModels();

// Get specific model information
const modelInfo = await mcpClient.getModelInfo('material-hybrid');

// Get model context
const context = await mcpClient.getModelContext('material-hybrid');

// Update model context
await mcpClient.updateModelContext('material-hybrid', {
  model_id: 'material-hybrid',
  version: '1.0',
  parameters: {
    threshold: 0.6,
    max_results: 10
  }
});
```

#### Inference

```typescript
// Recognize materials in an image file
const result = await mcpClient.recognizeMaterial(
  'path/to/image.jpg',
  {
    modelType: 'hybrid',
    confidenceThreshold: 0.7,
    maxResults: 5,
    includeFeatures: true
  }
);

// Recognize materials from an image buffer
const imageBuffer = fs.readFileSync('path/to/image.jpg');
const result = await mcpClient.recognizeMaterialFromBuffer(
  imageBuffer,
  'image/jpeg',
  {
    modelType: 'hybrid',
    confidenceThreshold: 0.7,
    maxResults: 5
  }
);
```

### Error Handling

The client provides proper error handling for various situations:

```typescript
try {
  const result = await mcpClient.recognizeMaterial('path/to/image.jpg');
  // Process result
} catch (error) {
  if (error.response) {
    // Server responded with an error
    console.error(`Server error: ${error.response.status} - ${error.response.data.message}`);
  } else if (error.request) {
    // Request was made but no response was received
    console.error('No response from server, it might be down');
  } else {
    // Error in setting up the request
    console.error(`Request error: ${error.message}`);
  }
}
```

### Configuration

Configure the MCP client using environment variables:

```
MCP_SERVER_URL=http://localhost:8000  # MCP server URL
USE_MCP_SERVER=true                   # Enable MCP integration
MCP_HEALTH_CHECK_TIMEOUT=5000         # Health check timeout (ms)
```

## API Integrations

The MCP system serves as a centralized gateway for external API calls, providing a unified interface for various services while handling credit tracking, authentication, and error handling.

### High-Priority APIs

#### AI/ML Services
- **Text Generation**: Uses the `llm/completion` endpoint
  - OpenAI and Anthropic integration
  - Prompt management
  - Token optimization
- **Text Embedding**: Uses the `llm/embedding` endpoint
  - Vector generation for semantic search
  - Multi-model support
- **Image Generation**: Uses the `image/generation` endpoint
  - DALL-E and Stable Diffusion support
  - Style control and parameter optimization
- **Image Analysis**: Uses the `recognize` endpoint
  - Material recognition
  - Feature extraction
  - Classification and segmentation

#### 3D Model Generation
- **Text-to-3D**: Uses the `3d/text-to-3d` endpoint
  - Generate 3D models from text descriptions
  - Parameter control for quality vs. speed
- **Image-to-3D**: Uses the `3d/reconstruct` endpoint
  - Photogrammetry and image-based reconstruction
  - Multi-view synthesis
- **Room Layout**: Uses the `3d/room-layout` endpoint
  - Floor plan inference
  - Spatial relationship modeling

#### Vector Database Operations
- **Vector Search**: Uses the `vector/search` endpoint
  - Semantic similarity search
  - Hybrid filtering with metadata
- **Vector Indexing**: Uses the `vector/index` endpoint
  - Index creation and management
  - Optimization for different vector types

### Medium-Priority APIs

#### Content Processing APIs
- **PDF Processing**: Uses the `content/process-pdf` endpoint
  - PDF parsing and text extraction
  - Image extraction and processing
  - Structure recognition
- **OCR Processing**: Uses the `content/ocr` endpoint
  - Text recognition from images
  - Layout analysis
  - Specialized engines for different text types
- **Data Extraction**: Uses the `content/extract` endpoint
  - Structured data extraction
  - Schema inference
  - Table recognition

#### Analytics and Telemetry Services
- **Analytics Event Processing**: Uses the `analytics/event` endpoint
  - Event tracking and storage
  - User activity analysis
- **Analytics Querying**: Uses the `analytics/query` endpoint
  - Data retrieval with filtering
  - Aggregation and time series analysis
- **Performance Monitoring**: Uses the `analytics/performance` endpoint
  - System metrics collection
  - Performance anomaly detection

#### Search Services
- **External Search**: Uses the `search/external` endpoint
  - Integration with third-party search engines
  - Normalization of result formats
- **Specialized Search**: Uses the `search/specialized` endpoint
  - Domain-specific search capabilities
  - Enhanced ranking for specific verticals

## Credit System Integration

The MCP integration includes credit tracking for all API operations:

### Credit Checking

Before making an API call, the system checks if the user has enough credits:

```typescript
// Check if user has enough credits
const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
  userId,
  MCPServiceKey.PDF_PROCESSING,
  5 // Estimate 5 credits for PDF processing
);

if (!hasEnoughCredits) {
  throw new Error('Insufficient credits');
}
```

### Credit Usage Tracking

After a successful API call, the system tracks the credit usage:

```typescript
// Track credit usage
await creditService.useServiceCredits(
  userId,
  MCPServiceKey.PDF_PROCESSING,
  5,
  'PDF processing',
  {
    catalogId,
    fileName: path.basename(filePath),
    pageCount: mcpResult.totalPages
  }
);
```

### Service Keys

Each service has a unique key for credit tracking. Keys follow the format: `category.service`, for example:
- `openai.text-generation`
- `content.pdf-processing`
- `vector.search`

### Credit Costs

Different operations have different credit costs:

| Operation | Credit Cost |
|-----------|-------------|
| Text Generation | 1 credit per 1,000 tokens |
| Text Embedding | 1 credit per 1,000 tokens |
| Image Generation | 1 credit per image |
| Image Analysis | 1 credit per image |
| Text-to-3D | 5 credits per model |
| Image-to-3D | 10 credits per model |
| Room Layout | 3 credits per layout |
| Vector Search | 1 credit per search |
| Vector Indexing | 1 credit per document |
| PDF Processing | 5 credits per PDF |
| OCR Processing | 1 credit per image |
| Analytics Event | 1 credit per event |
| Analytics Query | 1 credit per query |
| Analytics Trends | 2 credits per trends query |
| Analytics Statistics | 2 credits per stats query |

## Agent Integration

The MCP system is designed to work with AI agents by providing:

1. **Message Queue**: A pub/sub system for agent communication
2. **Context Management**: Storage and retrieval of contextual information
3. **Standardized Protocols**: Following the Model Context Protocol for consistent interactions

### Agent Communication

The MCP system facilitates communication with AI agents. This enables:

1. **Contextual Model Inference**: Agents can provide additional context for model inference
2. **Feedback Loops**: Agents can provide feedback on model results to improve future inference
3. **Complex Decision Flows**: Multi-step inference with agent guidance
4. **Explanation Generation**: Agents can explain model decisions in natural language

#### Sending Messages to Agent

```typescript
// Send a message to the agent
await mcpClient.sendAgentMessage({
  message_type: 'inference_context',
  content: {
    user_query: 'Find tiles similar to my kitchen backsplash',
    preferences: ['matte finish', 'neutral colors'],
    previous_interaction_id: '12345'
  },
  timestamp: Date.now() / 1000
});
```

```python
# Python
await agent_queue.put({
  "type": "recognition_event",
  "content": {"materials": ["ceramic-tile", "porcelain-tile"]},
  "timestamp": time.time()
})
```

#### Receiving Messages from Agent

```typescript
// Get messages from the agent
const agentMessages = await mcpClient.getAgentMessages(1.0); // Wait up to 1 second
if (agentMessages && agentMessages.count > 0) {
  console.log(`Received ${agentMessages.count} messages from agent`);
  for (const message of agentMessages.messages) {
    console.log(`Agent message: ${message.message_type}`);
    console.log(message.content);
  }
}
```

### Direct Agent Communication Features

1. **Direct Agent Communication**
   - Agents can directly query model capabilities
   - Agents can provide additional context for model inference
   - Models can request clarification from agents for ambiguous inputs

2. **Knowledge Enhancement**
   - Agents can augment model outputs with additional information
   - Models can provide confidence scores that agents use for decision-making
   - Joint inference between multiple models coordinated by agents

3. **Feedback Loops**
   - Agents capture user feedback for model improvement
   - Models track inference patterns for agent learning
   - Continuous improvement through shared learning

## Implementation Details

### MCP Client Service

The `mcpClientService.ts` file provides a unified interface for all MCP operations:

```typescript
// Example: Generate text using MCP
const result = await mcpClientService.generateText(
  userId,
  prompt,
  {
    model: 'gpt-4',
    maxTokens: 500,
    temperature: 0.7
  }
);
```

### Controller Integration

Controllers use the MCP client service with fallback to direct implementations:

```typescript
// Check if MCP is available
const mcpAvailable = await mcpClientService.isMCPAvailable();

if (mcpAvailable && userId) {
  try {
    // Use MCP for the operation
    const mcpResult = await mcpClientService.generateText(...);
    return mcpResult;
  } catch (mcpError) {
    // Handle insufficient credits error
    if (mcpError.message === 'Insufficient credits') {
      return res.status(402).json({
        error: 'Insufficient credits',
        message: 'You do not have enough credits to perform this action.'
      });
    }
    
    // Fall back to direct implementation for other errors
    logger.warn(`MCP operation failed, falling back: ${mcpError.message}`);
  }
}

// Fall back to direct implementation
const result = await directImplementation(...);
```

### PDF Processing Integration

The PDF processing service has been enhanced to use MCP for PDF parsing, text extraction, and OCR operations:

```typescript
// Check if MCP is available and user ID is provided
const mcpAvailable = await isMCPAvailable();

if (mcpAvailable && userId) {
  try {
    // Check if user has enough credits
    const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
      userId,
      MCPServiceKey.PDF_PROCESSING,
      5 // Estimate 5 credits for PDF processing
    );

    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits');
    }

    // Use MCP for PDF processing
    const mcpResult = await mcpClientService.processPdf(
      userId,
      filePath,
      {
        extractImages: processingOptions.extractImages,
        extractText: processingOptions.extractText,
        associateTextWithImages: processingOptions.associateTextWithImages,
        outputDir: tempDir
      }
    );

    // Track credit usage
    await creditService.useServiceCredits(
      userId,
      MCPServiceKey.PDF_PROCESSING,
      5,
      'PDF processing',
      {
        catalogId,
        fileName: path.basename(filePath),
        pageCount: mcpResult.totalPages
      }
    );

    // Return results
    return {
      catalogId,
      totalPages: mcpResult.totalPages,
      processedPages: mcpResult.processedPages,
      materials: mcpResult.materials || [],
      errors: mcpResult.errors || []
    };
  } catch (mcpError) {
    // Handle errors and fallback to direct implementation
  }
}
```

### Batch Processing

For batch operations, the system checks credit availability for the entire batch before processing:

```typescript
// Check if user has enough credits for all images
const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
  userId,
  MCPServiceKey.OCR_PROCESSING,
  imagePaths.length // 1 credit per image
);

if (!hasEnoughCredits) {
  throw new Error('Insufficient credits');
}

// Process images in batches
for (let i = 0; i < imagePaths.length; i += concurrency) {
  const batch = imagePaths.slice(i, i + concurrency);
  const batchPromises = batch.map(imagePath =>
    mcpClientService.performOcr(userId, imagePath, options)
      .then(mcpResult => {
        // Process result

        // Track credit usage for each image
        return creditService.useServiceCredits(
          userId,
          MCPServiceKey.OCR_PROCESSING,
          1,
          `${MCPServiceKey.OCR_PROCESSING} API usage`,
          {
            endpoint: 'content/ocr',
            imagePath
          }
        );
      })
  );

  await Promise.all(batchPromises);
}
```

### Integration with ML Package

The ML package includes an integration module that transparently uses the MCP server when available:

```typescript
// In packages/ml/src/index.ts
import { recognizeMaterial as originalRecognizeMaterial } from './direct-implementation';
import { withMCPFallback, recognizeMaterialWithMCP } from './mcp-integration';

export async function recognizeMaterial(imagePath, options) {
  return withMCPFallback(
    recognizeMaterialWithMCP,
    originalRecognizeMaterial,
    imagePath,
    options
  );
}
```

## Performance Optimization

The MCP system implements several performance optimizations:

### Scaling the MCP System

The MCP system is designed to scale both horizontally and vertically:

1. **Vertical Scaling**
   - Increase resources for the MCP server
   - Optimize model loading and memory usage
   - Efficient GPU utilization

2. **Horizontal Scaling**
   - Deploy multiple MCP server instances
   - Load balancing across instances
   - Specialized instances for different model types

### Memory Management

1. **Model Caching**: Models are loaded once and kept in memory
2. **Batch Processing**: Requests can be batched for more efficient processing
3. **Async Processing**: Non-blocking I/O for higher throughput
4. **Resource Monitoring**: Monitoring of memory and CPU usage

### Performance Metrics

The system tracks several performance metrics:

1. **Latency**: End-to-end response time for different operations
2. **Throughput**: Requests processed per second
3. **Resource Usage**: CPU, memory, and GPU utilization
4. **Cache Performance**: Hit rate and cache efficiency
5. **Error Rates**: Failed requests and timeout frequency

## Troubleshooting

### Common Issues

#### Connection Errors
- Check if the MCP server is running
- Verify network connectivity and firewall settings
- Check if the port is correctly exposed
- Validate authentication credentials

#### Model Loading Failures
- Ensure model files exist in the model directory
- Check for sufficient memory for loading models
- Verify GPU availability if using GPU-accelerated models
- Check file permissions for model files

#### Credit-Related Errors
- Verify user has sufficient credits
- Check credit tracking configuration
- Ensure credit service is properly configured
- Validate credit cost settings for operations

#### Slow Performance
- Check if GPU is being utilized (if available)
- Monitor memory usage for potential leaks
- Consider increasing server resources
- Review batch size settings for optimization

### Error Handling and Fallbacks

All MCP integrations include robust error handling and fallback mechanisms:

1. **Credit Insufficiency**
   - When a user doesn't have enough credits, the system returns a 402 (Payment Required) error
   - The error includes a clear message about purchasing more credits

2. **MCP Unavailability**
   - When the MCP server is unavailable, the system falls back to direct implementations
   - Logs are generated to track fallback occurrences

3. **Service-Specific Errors**
   - Each service handles specific error cases appropriately
   - Detailed error information is logged for debugging

### Logs

The MCP server logs are written to standard output when running in Docker. You can view them with:

```bash
docker logs kai-mcp-server
```

## Future Enhancements

### Dynamic Credit Calculation
- Calculate credit costs based on actual usage metrics
- Adjust costs based on service provider pricing changes
- Implement credit prediction for complex operations

### Caching and Optimization
- Implement result caching for frequently used operations
- Optimize request batching for better performance
- Add model quantization for improved efficiency

### Additional Services
- Add support for more third-party services
- Implement adapters for different service providers
- Expand to new ML model types and frameworks

### Monitoring and Analytics
- Add detailed logging for all MCP operations
- Implement usage analytics and reporting
- Add predictive maintenance for resource management

### Advanced Features
1. **Distributed Deployment**: Support for multiple MCP servers with load balancing
2. **Model Version Control**: Advanced management of model versions and rollbacks
3. **A/B Testing**: Support for comparing performance between model versions
4. **Advanced Metrics**: Enhanced performance and accuracy monitoring
5. **Enhanced Agent Integration**: Deeper integration with future AI agent capabilities

### Specific Product Enhancements

1. **Additional Content Processing Services**
   - Add support for video processing and analysis
   - Implement document comparison and diff generation
   - Integrate with more specialized OCR engines

2. **Enhanced Analytics**
   - Implement real-time analytics processing
   - Add support for custom analytics pipelines
   - Develop predictive analytics capabilities

3. **Advanced Search Features**
   - Implement multi-modal search (text + image)
   - Add support for conversational search
   - Develop domain-specific search optimizations

## Deployment

For detailed deployment instructions, see the [Deployment and Development Guide](./deployment-and-development.md#mcp-server-setup).
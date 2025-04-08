# Kai Model Context Protocol (MCP) Client

This package provides a TypeScript client for interacting with the Model Context Protocol (MCP) server, implementing the hybrid approach for model management and inference in the Kai system.

## Implementation Status

All mock implementations previously used during development have been replaced with fully functional real API calls. The client now connects to actual API endpoints for all operations, providing proper error handling and performance optimizations.

## Overview

The MCP system centralizes model management, provides optimized inference capabilities, and facilitates agent communication. This package implements the client-side SDK for communicating with the Python-based MCP server.

## Architecture

The Kai MCP implementation follows a hybrid approach:

### Python-based MCP Server
- Standalone microservice using FastAPI
- Direct access to ML libraries (TensorFlow, PyTorch)
- Optimized for model inference with GPU support
- Centralized model caching and versioning
- Standardized protocol for model context management
- Agent communication system integrated

### TypeScript Client SDK (this package)
- Clean TypeScript interface for the MCP server
- Type-safe API for model management and inference
- Seamless integration with existing Kai components
- Agent communication support

```
┌─────────────────┐       ┌──────────────────┐       ┌───────────────┐
│                 │  REST │                  │  gRPC │               │
│ TypeScript      │───────▶ Python MCP       │───────▶ Python ML     │
│ Server (Node.js)│◀───────  Server (FastAPI)│◀───────  Models        │
│                 │       │                  │       │               │
└─────────────────┘       └──────────────────┘       └───────────────┘
                                   │
                                   │
                                   ▼
                          ┌──────────────────┐
                          │                  │
                          │ Agent System     │
                          │                  │
                          └──────────────────┘
```

## Installation

> **Note**: Installation instructions for the MCP Client have been moved to the [Deployment Guide](./deployment-guide.md#mcp-client-installation).

## Usage

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

### Agent Integration

The MCP system is designed to facilitate communication with AI agents. This enables:

1. **Contextual Model Inference**: Agents can provide additional context for model inference
2. **Feedback Loops**: Agents can provide feedback on model results to improve future inference
3. **Complex Decision Flows**: Multi-step inference with agent guidance
4. **Explanation Generation**: Agents can explain model decisions in natural language

```typescript
import { MCPClient } from '@kai/mcp-client';

const mcpClient = new MCPClient('http://localhost:8000');

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

## API Reference

### Client Initialization

```typescript
const mcpClient = new MCPClient(baseUrl: string);
```

### Server Information

```typescript
// Get server information
const info = await mcpClient.getServerInfo();

// Check server health
const health = await mcpClient.checkHealth();
```

### Model Management

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

### Inference

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

### Agent Communication

```typescript
// Send a message to the agent
await mcpClient.sendAgentMessage({
  message_type: 'user_query',
  content: {
    query: 'What material is this?',
    context: 'User is looking at ceramic tiles'
  }
});

// Get messages from the agent
const messages = await mcpClient.getAgentMessages(2.0); // Wait up to 2 seconds
```

## Error Handling

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

## Development

### Running Tests

```bash
yarn test
```

### Building the Package

```bash
yarn build
```

## Integration with ML Package

The MCP client is integrated with the Kai ML package through the integration module:

```typescript
// In packages/ml/src/mcp-integration.ts
import { recognizeMaterial } from './index';
import { withMCPFallback, recognizeMaterialWithMCP } from './mcp-integration';

// Instead of calling recognizeMaterial directly, use:
const result = await withMCPFallback(
  recognizeMaterialWithMCP,
  recognizeMaterial,
  'path/to/image.jpg',
  { modelType: 'hybrid' }
);
```

This provides transparent fallback to the original implementation if the MCP server is unavailable.

## Configuration

Configure the MCP client using environment variables:

```
MCP_SERVER_URL=http://localhost:8000  # MCP server URL
USE_MCP_SERVER=true                   # Enable MCP integration
MCP_HEALTH_CHECK_TIMEOUT=5000         # Health check timeout (ms)
```

## Future Enhancements

1. **Batch Inference**: Support for processing multiple inputs in a single request
2. **Streaming Results**: WebSocket support for streaming inference results
3. **Distributed Model Training**: Integration with distributed training pipelines
4. **Advanced Agent Capabilities**: More sophisticated agent interactions and reasoning
5. **SDK Expansion**: Support for more ML frameworks and model types
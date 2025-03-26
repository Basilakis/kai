# Model Context Protocol (MCP) Server

## Overview

The Model Context Protocol (MCP) Server is a dedicated service that centralizes model management, provides optimized inference capabilities, and facilitates agent communication for the Kai system. This document provides comprehensive information on the MCP server's architecture, installation, configuration, and usage.

## Why MCP?

The traditional approach of loading models for each inference request has several limitations:

1. **Performance Issues**: Loading ML models for each request adds significant latency
2. **Resource Inefficiency**: Multiple instances load duplicate copies of the same models
3. **Limited Scaling**: Difficult to scale model serving independently from application logic
4. **Version Management**: No centralized mechanism for model versioning or hot-swapping
5. **Agent Integration**: No standardized way for agents to interact with model inference

The MCP server addresses these issues by:

1. **Centralizing Model Management**: Models are loaded once and kept in memory
2. **Optimizing Inference**: Leveraging hardware acceleration and batching
3. **Standardizing APIs**: Providing a consistent interface for model interactions
4. **Facilitating Agent Integration**: Built-in support for agent communication

## Hybrid Implementation Architecture

The Kai MCP implementation follows a hybrid approach:

### Python-based MCP Server

- Standalone microservice using FastAPI
- Direct access to ML libraries (TensorFlow, PyTorch)
- Optimized for model inference with GPU support
- Model caching and version management
- Standardized protocol for model context management
- Agent communication system integration

### TypeScript Client SDK

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

### Python MCP Server

1. Install core dependencies:

```bash
cd packages/ml
python -m venv mcp-venv
source mcp-venv/bin/activate  # On Windows: mcp-venv\Scripts\activate
pip install -r requirements.txt
pip install fastapi uvicorn python-multipart
```

2. Install ML framework dependencies based on your needs:

```bash
# For TensorFlow
pip install tensorflow==2.9.1

# For PyTorch
pip install torch torchvision
```

3. Create an `.env.mcp` file:

```
PORT=8000
MODEL_PATH=/path/to/models
MODEL_CACHE_SIZE=5
GPU_ENABLED=true
LOG_LEVEL=info
AGENT_INTEGRATION_ENABLED=true
MAX_BATCH_SIZE=16
```

### TypeScript Client SDK

1. Add TypeScript client dependencies:

```bash
cd packages/mcp-client
yarn install
```

2. Build the package:

```bash
yarn build
```

3. Link to the ML package:

```bash
yarn link
cd ../ml
yarn link @kai/mcp-client
```

## Docker Deployment

Use the provided Dockerfile for easy deployment:

```bash
docker build -t kai-mcp-server -f packages/ml/Dockerfile.mcp .
docker run -p 8000:8000 -v /path/to/models:/app/models kai-mcp-server
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Port to run the server on | 8000 |
| MODEL_PATH | Path to model files | /app/models |
| MODEL_CACHE_SIZE | Number of models to keep in memory | 5 |
| GPU_ENABLED | Enable GPU acceleration | true |
| LOG_LEVEL | Logging level (debug, info, warning, error) | info |
| AGENT_INTEGRATION_ENABLED | Enable agent integration | true |
| MAX_BATCH_SIZE | Maximum batch size for inference | 16 |

### Client SDK Configuration

Configure the MCP client using environment variables:

```
MCP_SERVER_URL=http://localhost:8000  # MCP server URL
USE_MCP_SERVER=true                   # Enable MCP integration
MCP_HEALTH_CHECK_TIMEOUT=5000         # Health check timeout (ms)
```

## Integration with Kai

### ML Package Integration

The ML package includes an integration module that provides a seamless fallback mechanism:

```typescript
// In packages/ml/src/index.ts
import { recognizeMaterial as originalRecognizeMaterial } from './recognition';
import { withMCPFallback, recognizeMaterialWithMCP } from './mcp-integration';

// Provide a unified interface with fallback
export const recognizeMaterial = async (imagePath, options) => {
  return withMCPFallback(
    recognizeMaterialWithMCP,
    originalRecognizeMaterial,
    imagePath,
    options
  );
};
```

This approach allows the system to:
1. Try to use the MCP server if enabled
2. Automatically fall back to the original implementation if the MCP server is unavailable
3. Maintain the same API for consumers

### API Reference

#### Model Management

```typescript
// List all available models
const models = await mcpClient.listModels();

// Get model information
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
// Material recognition with file path
const result = await mcpClient.recognizeMaterial(
  'path/to/image.jpg',
  {
    modelType: 'hybrid',
    confidenceThreshold: 0.7,
    maxResults: 5
  }
);

// Material recognition with buffer
const imageBuffer = fs.readFileSync('path/to/image.jpg');
const result = await mcpClient.recognizeMaterialFromBuffer(
  imageBuffer,
  'image/jpeg',
  { modelType: 'hybrid' }
);
```

## Agent Integration

The MCP server is designed to facilitate communication with AI agents:

### Sending Messages to Agent

```typescript
// Send a message to the agent
await mcpClient.sendAgentMessage({
  message_type: 'user_query',
  content: {
    query: 'What material is this?',
    context: 'User is looking at ceramic tiles'
  }
});
```

### Receiving Messages from Agent

```typescript
// Get messages from the agent
const messages = await mcpClient.getAgentMessages(2.0); // Wait up to 2 seconds
if (messages && messages.count > 0) {
  console.log(`Received ${messages.count} messages from agent`);
  for (const message of messages.messages) {
    console.log(`Agent message: ${message.message_type}`);
    // Process message...
  }
}
```

### Agent Integration Use Cases

1. **Contextual Model Inference**: Agents provide additional context for model inference
2. **Feedback Loops**: Agents provide feedback on model results to improve future inference
3. **Complex Decision Flows**: Multi-step inference with agent guidance
4. **Explanation Generation**: Agents explain model decisions in natural language

## Error Handling

The client SDK provides proper error handling:

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

## Troubleshooting

### Connection Issues

If the MCP client cannot connect to the server:

1. Check that the MCP server is running: `curl http://localhost:8000/health`
2. Verify the MCP_SERVER_URL environment variable is correct
3. Check for firewall or network issues between client and server

### Performance Issues

If inference is slow:

1. Verify GPU acceleration is enabled if hardware is available
2. Check model loading time with the `/api/v1/models/{model_id}/load_time` endpoint
3. Consider increasing the MODEL_CACHE_SIZE if models are being unloaded too frequently
4. Check batch size configuration for optimal performance

## Future Enhancements

1. **Batch Inference**: Support for processing multiple inputs in a single request
2. **Streaming Results**: WebSocket support for streaming inference results
3. **Distributed Model Training**: Integration with distributed training pipelines
4. **Advanced Agent Capabilities**: More sophisticated agent interactions and reasoning
5. **SDK Expansion**: Support for more ML frameworks and model types

## Conclusion

The MCP server provides a robust, scalable solution for model serving in the Kai system. By centralizing model management and providing a standardized API, it improves performance, simplifies development, and enables advanced agent integration.
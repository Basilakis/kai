# Model Context Protocol (MCP) Server

The Model Context Protocol (MCP) Server is a centralized service that manages machine learning models, their contexts, and provides optimized inference capabilities for the Kai system. This document explains its purpose, architecture, and how to configure and use it.

## Overview

### What is the MCP Server?

The MCP Server is a dedicated Python service that:

1. **Centralizes Model Management**: Loads and caches ML models in memory for faster inference
2. **Standardizes API Access**: Provides a consistent interface regardless of underlying model framework
3. **Optimizes Performance**: Implements batching, caching, and other optimizations for ML inference
4. **Supports Agent Integration**: Includes APIs designed for interaction with AI agents
5. **Implements the Model Context Protocol**: Follows standardized protocols for model context handling

### Why use an MCP Server?

- **Improved Performance**: Models stay loaded in memory, eliminating load time between requests
- **Resource Efficiency**: Multiple services can use the same model instances
- **Simplified Model Updates**: Models can be updated without restarting the main application
- **Framework Abstraction**: Hides the complexity of different ML frameworks (TensorFlow, PyTorch)
- **Future Agent Integration**: Designed to work seamlessly with AI agents

## Architecture

The MCP implementation uses a hybrid approach with two main components:

### Python Server (Backend)

The Python-based MCP Server handles the heavy lifting:

- Written in Python using FastAPI
- Loads models directly using TensorFlow/PyTorch/OpenCV
- Manages model contexts and caching
- Exposes REST API endpoints
- Includes agent communication channels
- Designed for Docker deployment

### TypeScript Client (Frontend)

The TypeScript client SDK integrates with the Node.js application:

- Written in TypeScript
- Provides type-safe interfaces for the MCP Server
- Handles automatic fallback to existing implementation
- Includes connection health monitoring
- Proxies requests to the MCP Server

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
```

## Installation & Configuration

> **Note**: Installation and configuration instructions for the MCP Server have been moved to the [Deployment Guide](./deployment-guide.md#mcp-server-installation).

## Usage

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

### TypeScript Client SDK

The client SDK provides a simple interface for interacting with the MCP Server:

```typescript
import { MCPClient } from '@kai/mcp-client';

// Create client instance
const client = new MCPClient('http://localhost:8000');

// Recognize materials in an image
const result = await client.recognizeMaterial('/path/to/image.jpg', {
  modelType: 'hybrid',
  confidenceThreshold: 0.7,
  maxResults: 5,
  includeFeatures: true
});

// Get available models
const models = await client.listModels();

// Send a message to the agent
await client.sendAgentMessage({
  message_type: 'recognition_completed',
  content: { materialId: 'tile-123', confidence: 0.95 }
});
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

## Agent Integration

The MCP Server is designed to work with AI agents by providing:

1. **Message Queue**: A pub/sub system for agent communication
2. **Context Management**: Storage and retrieval of contextual information
3. **Standardized Protocols**: Following the Model Context Protocol for consistent interactions

### Sending Messages to Agent

```typescript
// TypeScript
await mcpClient.sendAgentMessage({
  message_type: 'recognition_event',
  content: { materials: ['ceramic-tile', 'porcelain-tile'] }
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

### Receiving Messages from Agent

```typescript
// TypeScript
const messages = await mcpClient.getAgentMessages(1.0);
for (const message of messages.messages) {
  // Process message
  console.log(`Agent message: ${message.type}`);
}
```

## Performance Optimization

The MCP Server implements several performance optimizations:

1. **Model Caching**: Models are loaded once and kept in memory
2. **Batch Processing**: Requests can be batched for more efficient processing
3. **Async Processing**: Non-blocking I/O for higher throughput
4. **Resource Monitoring**: Monitoring of memory and CPU usage

## Troubleshooting

### Common Issues

1. **Connection Errors**
   - Check if the MCP server is running
   - Verify network connectivity and firewall settings
   - Check if the port is correctly exposed

2. **Model Loading Failures**
   - Ensure model files exist in the model directory
   - Check for sufficient memory for loading models
   - Verify GPU availability if using GPU-accelerated models

3. **Slow Performance**
   - Check if GPU is being utilized (if available)
   - Monitor memory usage for potential leaks
   - Consider increasing server resources

### Logs

The MCP server logs are written to standard output when running in Docker. You can view them with:

```bash
docker logs kai-mcp-server
```

## Future Enhancements

1. **Distributed Deployment**: Support for multiple MCP servers with load balancing
2. **Model Version Control**: Advanced management of model versions and rollbacks
3. **A/B Testing**: Support for comparing performance between model versions
4. **Advanced Metrics**: Enhanced performance and accuracy monitoring
5. **Enhanced Agent Integration**: Deeper integration with future AI agent capabilities
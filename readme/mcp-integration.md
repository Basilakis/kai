# MCP Integration for High-Priority APIs

This document describes the integration of high-priority APIs with the Model Control Panel (MCP) middleware, including AI/ML services, 3D model generation, and vector database operations.

## Overview

The MCP (Model Control Panel) middleware serves as a centralized gateway for external API calls, providing a unified interface for various services while handling credit tracking, authentication, and error handling.

### High-Priority APIs Integrated with MCP

1. **AI/ML Services**
   - Text Generation (OpenAI, Anthropic)
   - Text Embedding Generation
   - Image Generation (DALL-E, Stable Diffusion)
   - Image Analysis and Recognition

2. **3D Model Generation**
   - Text-to-3D Model Generation
   - Image-to-3D Model Reconstruction
   - Room Layout Generation

3. **Vector Database Operations**
   - Vector Search
   - Vector Embedding Generation
   - Vector Document Indexing

## Architecture

The MCP integration follows a client-server architecture:

1. **MCP Client** (`@kai/mcp-client`)
   - TypeScript client for communicating with the MCP server
   - Handles request formatting and response parsing
   - Provides a unified interface for all MCP operations

2. **MCP Client Service** (`mcpClientService.ts`)
   - Wraps the MCP client with credit tracking functionality
   - Provides service-specific methods for different API operations
   - Handles error cases and fallbacks to direct implementations

3. **Controller Integration**
   - Controllers use the MCP client service for their operations
   - Fallback to direct implementations when MCP is unavailable
   - Handle credit-related errors appropriately

## Credit System Integration

The MCP integration includes credit tracking for all API operations:

1. **Credit Checking**
   - Before making an API call, the system checks if the user has enough credits
   - If not, it returns a 402 (Payment Required) error

2. **Credit Usage Tracking**
   - After a successful API call, the system tracks the credit usage
   - Different operations have different credit costs

3. **Service Keys**
   - Each service has a unique key for credit tracking
   - Keys follow the format: `provider.service` (e.g., `openai.text-generation`)

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

## Service-Specific Details

### AI/ML Services

- **Text Generation**: Uses the `llm/completion` endpoint
- **Text Embedding**: Uses the `llm/embedding` endpoint
- **Image Generation**: Uses the `image/generation` endpoint
- **Image Analysis**: Uses the `recognize` endpoint

### 3D Model Generation

- **Text-to-3D**: Uses the `3d/text-to-3d` endpoint
- **Image-to-3D**: Uses the `3d/reconstruct` endpoint
- **Room Layout**: Uses the `3d/room-layout` endpoint

### Vector Database Operations

- **Vector Search**: Uses the `vector/search` endpoint
- **Vector Indexing**: Uses the `vector/index` endpoint

## Credit Costs

Different operations have different credit costs:

- Text Generation: 1 credit per 1,000 tokens
- Text Embedding: 1 credit per 1,000 tokens
- Image Generation: 1 credit per image
- Image Analysis: 1 credit per image
- Text-to-3D: 5 credits per model
- Image-to-3D: 10 credits per model
- Room Layout: 3 credits per layout
- Vector Search: 1 credit per search
- Vector Indexing: 1 credit per document

## Future Enhancements

1. **Dynamic Credit Calculation**
   - Calculate credit costs based on actual usage metrics
   - Adjust costs based on service provider pricing changes

2. **Caching and Optimization**
   - Implement caching for frequently used operations
   - Optimize request batching for better performance

3. **Additional Services**
   - Add support for more third-party services
   - Implement adapters for different service providers

4. **Monitoring and Analytics**
   - Add detailed logging for all MCP operations
   - Implement usage analytics and reporting

# CrewAI Integration for KAI Platform

This document provides a comprehensive guide to the CrewAI integration in the KAI platform, covering architecture, installation, environment setup, implementation details, and usage examples.

> **Note**: Installation instructions are available in the [Deployment Guide](./deployment-guide.md#crewai-integration-installation).

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
   - [Core Components](#core-components)
   - [Directory Structure](#directory-structure)
   - [MCP Integration Structure](#mcp-integration-structure)
3. [Agent Types](#agent-types)
   - [Frontend Agents](#frontend-agents)
   - [Backend Agents](#backend-agents)
4. [Environment Setup](#environment-setup)
   - [Environment Variables](#environment-variables)
   - [API Keys and Service URLs](#api-keys-and-service-urls)
   - [Authentication Configuration](#authentication-configuration)
5. [Implementation Status](#implementation-status)
6. [Setup and Usage](#setup-and-usage)
   - [Prerequisites](#prerequisites)
   - [Example Usage](#example-usage)
7. [MCP Integration for Agents](#mcp-integration-for-agents)
   - [Benefits of MCP for Agents](#benefits-of-mcp-for-agents)
   - [MCP-Enabled Agent Factory](#mcp-enabled-agent-factory)
   - [LLM Inference Adapter](#llm-inference-adapter)
   - [Batch Processing and Request Optimization](#batch-processing-and-request-optimization)
8. [Agent Tools](#agent-tools)
   - [Material Search Tool](#material-search-tool)
   - [Image Analysis Tool](#image-analysis-tool)
   - [Vector Search Tool](#vector-search-tool)
   - [MCP-Enabled Tools](#mcp-enabled-tools-with-api-integration)
9. [Integration with Existing KAI Components](#integration-with-existing-kai-components)
   - [Frontend Integration](#frontend-integration)
   - [Backend Integration](#backend-integration)
   - [MCP Integration](#mcp-integration)
10. [Implementation Roadmap](#implementation-roadmap)
11. [Next Development Steps](#next-development-steps)
12. [Known Issues](#known-issues)
13. [Verification and Testing](#verification-and-testing)
14. [Troubleshooting](#troubleshooting)
15. [Technical Considerations](#technical-considerations)
16. [Related Documentation](#related-documentation)

## Overview

The CrewAI integration adds intelligent agent capabilities to the KAI platform, enabling:

1. **User-facing intelligence**: Agents that assist users during material recognition, provide detailed information about materials, and help organize projects
2. **System-level intelligence**: Agents that monitor the knowledge base, analyze system metrics, and optimize platform operations
3. **MCP-powered inference**: Optimized language model operations through the Model Context Protocol server architecture

## Architecture

### Core Components

The integration is structured around several key components:

- **Agent System**: Centralized management of agent initialization, configuration, and lifecycle
- **Agent Types**: Specialized agents for different roles and capabilities
- **Agent Tools**: Functions that allow agents to interact with KAI systems
- **Utilities**: Common functionality for logging, error handling, and data processing
- **MCP Integration**: Adapters that enable agents to leverage the MCP server architecture
- **Unified Type System**: Consolidated TypeScript definitions for consistent agent development
- **Enhanced Material Experts**: Advanced material analysis capabilities with inheritance-based architecture

### Directory Structure

```
packages/
└── agents/
    ├── package.json        # Package configuration and dependencies
    ├── tsconfig.json       # TypeScript configuration
    ├── setup.sh            # Setup script for dependencies and missing files
    ├── src/
    │   ├── index.ts        # Main exports
    │   ├── core/           # Core system implementation
    │   │   ├── agentSystem.ts  # Agent initialization and management
    │   │   └── types.ts    # Type definitions and interfaces
    │   ├── frontend/       # User-facing agents
    │   │   ├── recognitionAssistant.ts  # Image recognition enhancement
    │   │   ├── materialExpert.ts        # Material information provider
    │   │   └── projectAssistant.ts      # Project planning assistant
    │   ├── backend/        # System-level agents
    │   │   ├── knowledgeBaseAgent.ts    # Knowledge base management
    │   │   ├── analyticsAgent.ts        # System metrics analysis
    │   │   └── operationsAgent.ts       # System operations monitoring
    │   ├── tools/          # Agent interaction capabilities
    │   │   ├── materialSearch.ts        # Material database searches
    │   │   ├── imageAnalysis.ts         # Image property extraction
    │   │   ├── vectorSearch.ts          # Semantic similarity search
    │   │   └── index.ts                 # Tool exports
    │   └── utils/          # Common utilities
    │       ├── logger.ts                # Logging system
    │       └── index.ts                 # Utility exports
    └── logs/               # Agent operation logs
```

### MCP Integration Structure

```
packages/
└── agents/
    ├── src/
    │   ├── core/
    │   │   └── mcpAgentFactory.ts       # MCP-enabled agent creation
    │   ├── services/
    │   │   └── adapters/
    │   │       ├── llmInferenceMcpAdapter.ts    # LLM operations adapter
    │   │       ├── vectorSearchMcpAdapter.ts    # Vector search adapter
    │   │       ├── imageAnalysisMcpAdapter.ts   # Image analysis adapter
    │   │       └── ocrMcpAdapter.ts             # OCR adapter
    │   ├── utils/
    │   │   ├── mcpIntegration.ts        # MCP connection utilities
    │   │   ├── mcpBatchProcessor.ts     # Request batching system
    │   │   └── llmInferenceHelper.ts    # LLM inference utilities
    └── docs/
        └── mcp-integration.md           # MCP integration documentation
```

## Agent Types

### Frontend Agents

1. **Recognition Assistant**
   - **Purpose**: Enhance the material recognition workflow
   - **Capabilities**:
     - Pre-upload guidance for optimal image capture
     - Enhanced analysis of recognition results 
     - Detailed explanations of material properties
     - Alternative matching suggestions
   - **Integration Points**:
     - Image upload component
     - Recognition results display
     - Material detail views

2. **Material Expert**
   - **Purpose**: Provide in-depth material knowledge
   - **Capabilities**:
     - Detailed material specifications
     - Comparative analysis with similar materials
     - Installation and maintenance recommendations
     - Technical compliance information
   - **Integration Points**:
     - Material detail pages
     - Comparison views
     - Search and filtering interfaces

3. **Project Assistant**
   - **Purpose**: Help users plan and organize material projects
   - **Capabilities**:
     - Material selection guidance
     - Quantity estimation and calculations
     - Compatibility checking between materials
     - Timeline and phasing suggestions
   - **Integration Points**:
     - Project planning interfaces
     - Material selection workflows
     - Cart and ordering systems

### Backend Agents

1. **Knowledge Base Agent**
   - **Purpose**: Maintain and enhance the knowledge base
   - **Capabilities**:
     - Data quality assessment
     - Relationship detection between materials
     - Metadata optimization
     - Search index enhancement
   - **Integration Points**:
     - Knowledge base management interfaces
     - Admin dashboards
     - Metadata management systems

2. **Analytics Agent**
   - **Purpose**: Analyze system data for insights
   - **Capabilities**:
     - Usage pattern detection
     - Anomaly identification
     - User behavior analysis
     - Trend forecasting
   - **Integration Points**:
     - Analytics dashboards
     - Reporting systems
     - Admin interfaces

3. **Operations Agent**
   - **Purpose**: Monitor and optimize system operations
   - **Capabilities**:
     - Proactive issue detection
     - Performance optimization recommendations
     - Resource allocation suggestions
     - Automated maintenance tasks
   - **Integration Points**:
     - System monitoring dashboards
     - Operations interfaces
     - Notification systems

## Environment Setup

### Environment Variables

All CrewAI integration environment variables should be added to the main application's `.env` file. Do not create a separate environment file for the agent system.

Here's a complete list of the required and optional environment variables:

```
# === CrewAI Agent System ===

# OpenAI API Configuration (required)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_DEFAULT_MODEL=gpt-4
OPENAI_TEMPERATURE=0.7

# Redis Configuration (for agent state persistence)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Logging Configuration
LOG_LEVEL=info
LOG_FILE_PATH=logs/agent.log

# KAI Service URLs
KAI_API_URL=http://localhost:3000/api
KAI_VECTOR_DB_URL=http://localhost:5000/api/vector
KAI_ML_SERVICE_URL=http://localhost:7000/api/ml

# Authentication
KAI_API_KEY=your_kai_api_key_here
KAI_AUTH_TOKEN=your_auth_token_here

# Agent Behavior Settings
AGENT_VERBOSE_MODE=false
AGENT_MEMORY_ENABLED=true
AGENT_MAX_ITERATIONS=10
AGENT_DEFAULT_TIMEOUT=30000

# MCP Configuration
MCP_SERVER_URL=http://localhost:8000
MCP_AUTH_TOKEN=your_mcp_auth_token
MCP_ENABLED_agentInference=true
MCP_BATCHING_ENABLED_agentInference=true
```

### API Keys and Service URLs

#### OpenAI API

The CrewAI integration requires an OpenAI API key for agent operations. To get an API key:

1. Create an account at [OpenAI's platform](https://platform.openai.com/)
2. Navigate to API Keys section
3. Generate a new key and add it to your `.env` file as `OPENAI_API_KEY`

#### KAI Service URLs

The integration connects to several KAI services. The default URLs are configured for local development, but you should adjust them based on your deployment environment:

```
# Local Development
KAI_API_URL=http://localhost:3000/api
KAI_VECTOR_DB_URL=http://localhost:5000/api/vector
KAI_ML_SERVICE_URL=http://localhost:7000/api/ml

# Staging Environment Example
KAI_API_URL=https://staging-api.kai-platform.com/api
KAI_VECTOR_DB_URL=https://staging-vector.kai-platform.com/api/vector
KAI_ML_SERVICE_URL=https://staging-ml.kai-platform.com/api/ml

# Production Environment Example
KAI_API_URL=https://api.kai-platform.com/api
KAI_VECTOR_DB_URL=https://vector.kai-platform.com/api/vector
KAI_ML_SERVICE_URL=https://ml.kai-platform.com/api/ml
```

### Authentication Configuration

The integration uses the KAI authentication system for accessing various services. There are two ways to authenticate:

#### 1. API Key Authentication (Recommended for server environments)

Set the `KAI_API_KEY` environment variable to authenticate using an API key:

```
KAI_API_KEY=your_kai_api_key_here
```

#### 2. Token Authentication (Used in browser environments)

The system will automatically use token-based authentication in browser environments. If you've implemented a custom authentication flow, you can manually set:

```
KAI_AUTH_TOKEN=your_auth_token_here
```

## Implementation Status

The integration of crewAI agents into the KAI platform includes:

1.  **Core Framework:**
    *   An `agents` package with core types, interfaces, and configuration (`agentSystem.ts`).
    *   Agent system management using environment variables for configuration (API keys, service URLs).
    *   Optional Redis integration for agent memory persistence.
    *   Logging and error handling utilities.

2.  **MCP Integration (LLM):**
    *   Implemented via adapters (`llmInferenceMcpAdapter.ts`) and helpers (`llmInferenceHelper.ts`).
    *   Supports chat, completion, and embedding operations.
    *   Automatically routes requests to the MCP server when enabled (`isMCPEnabledForComponent`).
    *   Supports batching (`mcpBatchProcessor.ts`) and streaming (via WebSockets).
    *   Includes fallback to a local `LLMService` implementation if MCP is disabled or fails.
    *   Connects to real KAI backend services (configured via environment variables).

3.  **Agent Types & Factory:**
    *   Defined frontend agents (`RecognitionAssistant`, `MaterialExpert`, `ProjectAssistant`) and backend agents (`KnowledgeBaseAgent`, `AnalyticsAgent`, `OperationsAgent`).
    *   `mcpAgentFactory.ts` creates MCP-enabled frontend agents, leveraging the LLM adapter. Backend agent MCP usage needs further review.
    *   `createEnhancedMaterialExpert` is used for `MaterialExpert`.
    *   `createImageCapableMaterialExpert` adds image analysis via `imageAnalysisMcpAdapter`.

4.  **Frontend Components:**
    *   UI components for agent interaction exist (AgentChat, panels).
    *   Further integration work (WebSockets, state persistence) may be needed.

5.  **Tools & Adapters:**
    *   Basic agent tools (`materialSearch`, `imageAnalysis`, `vectorSearch`) exist.
    *   Adapters (`llmInferenceMcpAdapter`, `imageAnalysisMcpAdapter`, etc.) handle communication with MCP or local services.
    *   Completeness and robustness of individual agent/tool implementations require ongoing review.

## Setup and Usage

### Prerequisites
- Node.js 16+
- Yarn package manager
- OpenAI API key (or other supported LLM provider)
- MCP server (optional, for optimized performance)

### Example Usage

#### Initializing the Agent System with Service Connections

```typescript
import { initializeAgentSystem, connectToServices } from '@kai/agents';
import { env } from '@kai/agents/utils/environment'; // Assuming env is exported

// Initialize core system (uses env vars for keys, redis, etc.)
await initializeAgentSystem(); 

// Configure connections to KAI services (uses env vars by default)
await connectToServices(); 

// --- OR Initialize with explicit config ---
/*
await initializeAgentSystem({
  apiKey: process.env.OPENAI_API_KEY,
  redis: env.redis.url ? { host: new URL(env.redis.url).hostname, port: parseInt(new URL(env.redis.url).port || '6379'), password: env.redis.password } : undefined,
  logLevel: 'debug'
});

await connectToServices({
  apiUrl: env.services.kaiApiUrl,
  vectorDbUrl: env.services.vectorDbUrl,
  mlServiceUrl: env.services.mlServiceUrl,
  apiKey: env.services.apiKey,
  enableMockFallback: env.services.enableMockFallback
});
*/
```

#### Creating a Recognition Assistant

```typescript
import { createAgent, AgentType } from '@kai/agents';

const agent = await createAgent({
  id: 'recognition-assistant-1',
  type: AgentType.RECOGNITION_ASSISTANT,
  name: 'Recognition Helper',
  description: 'Assists users with material recognition',
});

// Process an uploaded image
const insights = await agent.instance.processImage(imageUrl, {
  originalFileName: file.name,
  fileSize: file.size,
  uploadedBy: user.id,
});
```

#### Creating an MCP-enabled agent with real service connections

```typescript
import { createMCPEnabledAgent, AgentType } from '@kai/agents/core/mcpAgentFactory';
import { AgentConfig } from '@kai/agents'; // Assuming AgentConfig is exported

// Configuration for the agent
const agentConfig: AgentConfig = {
  id: 'mcp-material-expert-1',
  type: AgentType.MATERIAL_EXPERT,
  name: 'MCP Material Expert',
  description: 'Provides detailed material information using MCP',
  // Agent-specific tools can be added here if needed
  // tools: [customTool] 
};

// Model settings, potentially overriding defaults
const modelSettings = {
  provider: 'openai',
  name: 'gpt-4-turbo', // Use desired model
  temperature: 0.5,
  enableBatching: true, // Enable batching via MCP if desired
  // maxTokens: 2048 
};

// Create the agent
const mcpAgent = await createMCPEnabledAgent(agentConfig, modelSettings);

// Use the agent (it will use MCP for LLM ops if enabled)
const materialDetails = await mcpAgent.processUserInput('Tell me about Carrara marble.');
console.log(materialDetails);

// Example using image analysis capability (if created via createImageCapableMaterialExpert)
// const imageAnalysis = await mcpAgent.analyzeImage(imageBase64String);
// console.log(imageAnalysis);
```

## MCP Integration for Agents

The agent system integrates with the Model Context Protocol (MCP) server architecture to optimize language model operations and resource utilization.

### Benefits of MCP for Agents

1. **Performance Optimization**
   - Reduced latency by eliminating model loading overhead
   - Improved throughput through token batching
   - More efficient GPU/TPU utilization for inference

2. **Resource Efficiency**
   - Multiple agents share the same model instances
   - Lower memory footprint
   - More efficient scaling of agent capabilities

3. **Enhanced Capabilities**
   - Streaming responses for real-time agent interactions
   - Centralized model version management
   - Seamless model upgrades without restarts

### MCP-Enabled Agent Factory

The `mcpAgentFactory.ts` provides enhanced agent creation with MCP integration that connects directly to your API and MCP server:

```typescript
import { createMCPEnabledAgent } from '@kai/agents/core/mcpAgentFactory';

// Create an MCP-enabled agent that uses real services
const agent = await createMCPEnabledAgent({
  id: 'material-expert-1',
  name: 'Material Expert',
  description: 'Provides detailed information about materials',
  modelSettings: {
    provider: 'openai',
    model: 'gpt-4-turbo',
    temperature: 0.7
  },
  tools: [materialSearchTool, vectorSearchTool]
});

// Agent uses MCP server for LLM operations when available
// Falls back to local implementation if MCP server is unavailable
const response = await agent.execute(userQuery);
```

For image analysis capabilities:

```typescript
import { createImageCapableMaterialExpert } from '@kai/agents/core/mcpAgentFactory';

// Create a material expert with image analysis capabilities via MCP
const imageCapableAgent = await createImageCapableMaterialExpert({
  id: 'image-material-expert-1',
  name: 'Image Material Expert',
  description: 'Analyzes material images and provides detailed information',
  modelSettings: {
    provider: 'openai',
    model: 'gpt-4-vision',
    temperature: 0.5
  }
});

// Agent can process images and provide detailed analysis
const imageAnalysis = await imageCapableAgent.analyzeImage(imageUrl);
```

### LLM Inference Adapter

The `llmInferenceMcpAdapter.ts` handles all language model operations through MCP with direct connections to your API and MCP server:

- **Chat completions** - For conversational agent interactions with direct API connections
- **Text completions** - For structured text generation through your ML API endpoints
- **Embeddings** - For semantic representation of text using your vector models
- **Streaming responses** - For real-time interactions using WebSocket connections to your API

Each of these operations:
1. Checks if MCP is enabled for the component
2. If enabled, routes requests through the MCP server
3. If disabled or if MCP is unavailable, falls back to direct API calls
4. Provides comprehensive error handling and logging

### Batch Processing and Request Optimization

The MCP integration optimizes performance by batching similar operations to reduce API call overhead:

```typescript
// These operations will be automatically batched if they occur within
// the configured time window (default: 50ms)
const [resultA, resultB, resultC] = await Promise.all([
  agent.generateEmbedding(textA),
  agent.generateEmbedding(textB),
  agent.generateEmbedding(textC)
]);
```

The batch processor:
1. Collects similar requests within a configurable time window
2. Combines them into a single MCP server call
3. Routes the combined request to the appropriate service
4. Distributes the results back to the original callers
5. Provides detailed performance metrics for monitoring and optimization

## Agent Tools

### Material Search Tool
Enables agents to search the KAI material database using text queries, filtering, and metadata.

```typescript
const results = await agent.invoke('search_materials', {
  query: 'white marble',
  filters: {
    material_type: 'tile',
    color: 'white',
    finish: 'polished'
  },
  limit: 10
});
```

### Image Analysis Tool
Allows agents to analyze images to extract properties, characteristics, and assess image quality.

```typescript
const analysis = await agent.invoke('analyze_image', {
  imageUrl: 'https://example.com/material.jpg',
  mode: 'full',
  detail_level: 'detailed'
});
```

### Vector Search Tool
Enables semantic similarity searches using vector embeddings rather than keyword matching.

```typescript
const similarMaterials = await agent.invoke('vector_search', {
  mode: 'text',
  query: 'luxury italian marble with gold veining',
  limit: 5,
  threshold: 0.75
});
```

### MCP-Enabled Tools with API Integration

These tools leverage the MCP architecture and connect directly to your API services:

```typescript
// Vector search using MCP
const similarMaterials = await agent.invoke('vector_search', {
  mode: 'text',
  query: 'luxury italian marble with gold veining',
  useMCP: true,  // Explicitly use MCP for this operation
  limit: 5,
  threshold: 0.75
});

// Image analysis using MCP with direct API connections
const analysis = await agent.invoke('analyze_image', {
  imageUrl: 'https://example.com/material.jpg',
  useMCP: true,  // Explicitly use MCP for this operation
  mode: 'full',
  detail_level: 'detailed',
  extractColors: true,    // Use actual API parameters
  extractPatterns: true   // that match your ML service
});
```

The tools use the following connections:
- **Vector Search**: Connects to your Supabase vector database service
- **Image Analysis**: Integrates with your ML image processing service
- **LLM Inference**: Uses your API endpoints for LLM operations
- **OCR Processing**: Connects to your document processing service

## Integration with Existing KAI Components

### Frontend Integration

The frontend integration connects agents with the user interface:

1. **Material Recognition Flow**
   - Enhanced file upload with agent-assisted guidance
   - Intelligent analysis of recognition results
   - Interactive Q&A about recognized materials

2. **Material Browsing**
   - Agent-assisted search and filtering
   - Comparative analysis of similar materials
   - Personalized recommendations based on history and preferences

3. **Project Planning**
   - Material selection assistance
   - Quantity and cost estimation
   - Compatibility checking and suggestions

### Backend Integration

The backend integration enables system-level intelligence:

1. **Knowledge Base Management**
   - Automated quality assurance and improvement
   - Intelligent indexing and relationship mapping
   - Anomaly detection and correction

2. **System Monitoring**
   - Performance analysis and optimization
   - Usage pattern detection
   - Proactive issue identification

3. **Admin Interface**
   - Natural language querying for complex operations
   - Insight generation and reporting
   - Automated task handling and delegation

### MCP Integration

The MCP integration enhances both frontend and backend components:

1. **Frontend Optimization**
   - Faster response times for agent interactions
   - Streaming responses for a more interactive experience
   - Lower resource usage during agent operations

2. **Backend Efficiency**
   - Centralized management of ML models
   - Shared model instances across multiple requests
   - Better scalability for high-volume agent operations

3. **Cross-Component Communication**
   - MCP server as a bridge between packages
   - Standardized protocol for model operations
   - Consistent versioning across the system

## Implementation Roadmap

### Phase 1: Foundation (Completed)
- Basic package structure and configuration
- Core agent system architecture
- Agent type definitions and interfaces
- Initial tool implementations
- Base agent implementations (RecognitionAssistant, KnowledgeBaseAgent)

### Phase 2: Frontend Integration (Months 1-2)
- Frontend interface components for agent interaction
- Integration with existing recognition workflow
- User feedback collection and adaptation
- Comprehensive testing and refinement

### Phase 3: Backend Integration (Months 3-4)
- Admin interface enhancements for agent interaction
- System monitoring and analytics dashboards
- Integration with existing knowledge base operations
- Automated workflows and processes

### Phase 4: Advanced Capabilities (Months 5-6)
- Multi-agent collaboration for complex tasks
- Adaptive learning based on user feedback
- Performance optimization and scaling
- Additional specialized agents and tools

### Phase 5: MCP Migration (Months 7-8) - Completed
- MCP integration for LLM operations ✓
- Performance measurement and optimization ✓
- Batch processing implementation ✓
- Advanced security and monitoring ✓
- Real service connections established ✓
- Mock implementations removed ✓

## Next Development Steps

While the core MCP integration for LLM is in place, further work includes:

1.  **Complete Agent/Tool Logic:** Flesh out the specific implementations within agent classes and tools, replacing any remaining placeholders with robust logic and error handling.
2.  **Streaming Fallback:** Implement streaming support in the local `LLMService` fallback path or clearly document the limitation.
3.  **Backend Agent MCP Usage:** Review and potentially implement MCP integration for backend agents if required.
4.  **Enhance Frontend Integration:** Improve real-time communication (WebSockets), state management, and UI feedback for agent interactions.
5.  **Testing:** Develop comprehensive unit, integration, and potentially end-to-end tests for agents, tools, and MCP interactions.
6.  **Configuration & Deployment:** Finalize environment variable documentation, create deployment configurations, implement monitoring, and plan for scaling.

## Known Issues

1.  **Local Streaming Fallback:** The local `LLMService` used when MCP is unavailable does not currently support streaming responses.
2.  **Placeholder Implementations:** Some specific agent behaviors or tool functionalities might still be placeholders requiring full implementation.
3.  **Error Handling Granularity:** Error handling in some tools or specific agent logic might need refinement beyond basic try/catch blocks.

## Verification and Testing

After setting up the environment variables, you can verify your configuration using the provided verification script:

```bash
# Navigate to the agents package
cd packages/agents

# Run the verification script
yarn verify
# or
npm run verify
```

This script will:
- Validate all required environment variables
- Check connections to OpenAI API and KAI services
- Report any issues or missing configurations

You can also test the integration with actual services using:

```bash
# Run integration tests
yarn test:integration
# or
npm run test:integration
```

## Troubleshooting

### Common Issues

#### OpenAI API Authentication Failures

If you see errors like "Authentication failed with OpenAI":

1. Verify your `OPENAI_API_KEY` is correctly set
2. Ensure your OpenAI account has billing information if required
3. Check that you're using a supported model name in `OPENAI_DEFAULT_MODEL`

#### Service Connection Issues

If you encounter errors connecting to KAI services:

1. Verify all service URLs are correctly set
2. Ensure the services are running (for local development)
3. Check network connectivity and firewall settings
4. Verify your authentication credentials are valid

#### Token Refresh Failures

If authentication tokens aren't refreshing properly:

1. Check that your authentication configuration is correct
2. Ensure the auth service is available
3. Verify user permissions for the required operations

### Fallback Mechanisms

The integration includes fallback mechanisms that use mock implementations when services are unavailable. This is useful during development or when certain services aren't yet deployed.

To control fallback behavior, you can use:

```
# Enable mock fallbacks (default: true in development, false in production)
ENABLE_MOCK_FALLBACK=true
```

## Technical Considerations

### Performance and Scaling
- Agent operations can be resource-intensive, especially for complex reasoning tasks
- Consider implementing:
  - Caching for common agent responses
  - Rate limiting for API-dependent operations
  - Asynchronous processing for non-interactive tasks
  - Horizontal scaling for high-volume deployments
  - MCP integration for optimized model operations

### Security
- Agents operate with least privilege principle
- All agent operations are logged for audit purposes
- User data is handled according to existing platform policies
- Input validation is implemented for all agent inputs
- Output filtering ensures appropriate agent responses
- MCP authentication is handled securely with automatic token rotation

### Error Handling
- Agents implement graceful degradation on API failures
- Fallback mechanisms ensure continuity of service
- Comprehensive logging aids in debugging and issue resolution
- Monitoring systems alert administrators to repeated errors
- MCP health checks prevent requests to unavailable services

## Related Documentation
- [Material Recognition](./material-recognition.md)
- [Knowledge Base](./knowledge-base.md)
- [PDF Processing](./pdf-processing.md)
- [Queue System](./queue-system.md)
- [MCP Server](./mcp-server.md)
- [MCP Integration Documentation](../packages/agents/src/docs/mcp-integration.md)
- [CrewAI Documentation](https://docs.crewai.com/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Redis Documentation](https://redis.io/docs)
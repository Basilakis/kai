# crewAI Integration for KAI Platform

This document outlines the integration of crewAI agents into the KAI platform to enhance both frontend user experience and backend system operations.

## Overview

The crewAI integration adds intelligent agent capabilities to the KAI platform, enabling:

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

## Setup and Usage

### Prerequisites
- Node.js 16+
- Yarn package manager
- OpenAI API key (or other supported LLM provider)
- MCP server (optional, for optimized performance)

### Installation

> **Note**: Installation instructions for CrewAI have been moved to the [Deployment Guide](./deployment-guide.md#crewai-integration-installation).

### Example Usage with Real API Services

Initialize the agent system with connections to your actual services:

```typescript
import { initializeAgentSystem } from '@kai/agents';

await initializeAgentSystem({
  apiKey: process.env.OPENAI_API_KEY,
  defaultModel: {
    provider: 'openai',
    name: 'gpt-4',
    temperature: 0.7,
  },
  logLevel: 'info',
  mcpOptions: {
    enabled: true,
    serverUrl: process.env.MCP_SERVER_URL || 'http://localhost:8000',
    authToken: process.env.MCP_AUTH_TOKEN,
    healthCheckTimeout: 5000
  },
  apiServices: {
    // Configure connections to your actual API services
    mlApiUrl: process.env.ML_API_URL || 'http://localhost:3001/api',
    vectorServiceUrl: process.env.VECTOR_SERVICE_URL,
    imageProcessingUrl: process.env.IMAGE_PROCESSING_URL,
    // Add additional service connections as needed
  }
});
```

Create a Recognition Assistant:

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

Create an MCP-enabled agent that connects to your services:

```typescript
import { createMCPEnabledAgent } from '@kai/agents/core/mcpAgentFactory';

// Create an MCP-enabled Material Expert with real service connections
const mcpAgent = await createMCPEnabledAgent({
  id: 'mcp-material-expert-1',
  type: AgentType.MATERIAL_EXPERT,
  name: 'MCP Material Expert',
  description: 'Provides detailed material information using MCP',
  mcpOptions: {
    // Override global MCP settings if needed
    serverUrl: 'http://specialized-mcp-server:8000',
    batchingEnabled: true,
    batchWindow: 100 // ms
  }
});

// The agent will use MCP for all LLM operations with real service connections
// and transparent fallback to direct API calls if MCP is unavailable
const materialDetails = await mcpAgent.getDetailedInformation(materialId);

// Execute operations that use your actual services
const materialComparison = await mcpAgent.compareWithSimilar(materialId, {
  similarityThreshold: 0.8,
  maxResults: 5,
  includeDetails: ['specifications', 'applications', 'pricing']
});
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
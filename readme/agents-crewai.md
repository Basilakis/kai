# crewAI Integration for KAI Platform

This document outlines the integration of crewAI agents into the KAI platform to enhance both frontend user experience and backend system operations.

## Overview

The crewAI integration adds intelligent agent capabilities to the KAI platform, enabling:

1. **User-facing intelligence**: Agents that assist users during material recognition, provide detailed information about materials, and help organize projects
2. **System-level intelligence**: Agents that monitor the knowledge base, analyze system metrics, and optimize platform operations

## Architecture

### Core Components

The integration is structured around several key components:

- **Agent System**: Centralized management of agent initialization, configuration, and lifecycle
- **Agent Types**: Specialized agents for different roles and capabilities
- **Agent Tools**: Functions that allow agents to interact with KAI systems
- **Utilities**: Common functionality for logging, error handling, and data processing

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

## Setup and Usage

### Prerequisites
- Node.js 16+
- Yarn package manager
- OpenAI API key (or other supported LLM provider)

### Installation

1. Install dependencies:
```bash
cd packages/agents
./setup.sh
yarn install
```

2. Configure environment variables:
```
OPENAI_API_KEY=your_api_key_here
NODE_ENV=development
```

### Example Usage

Initialize the agent system:

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

## Technical Considerations

### Performance and Scaling
- Agent operations can be resource-intensive, especially for complex reasoning tasks
- Consider implementing:
  - Caching for common agent responses
  - Rate limiting for API-dependent operations
  - Asynchronous processing for non-interactive tasks
  - Horizontal scaling for high-volume deployments

### Security
- Agents operate with least privilege principle
- All agent operations are logged for audit purposes
- User data is handled according to existing platform policies
- Input validation is implemented for all agent inputs
- Output filtering ensures appropriate agent responses

### Error Handling
- Agents implement graceful degradation on API failures
- Fallback mechanisms ensure continuity of service
- Comprehensive logging aids in debugging and issue resolution
- Monitoring systems alert administrators to repeated errors

## Related Documentation
- [Material Recognition](./material-recognition.md)
- [Knowledge Base](./knowledge-base.md)
- [PDF Processing](./pdf-processing.md)
- [Queue System](./queue-system.md)
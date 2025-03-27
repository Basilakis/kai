# KAI crewAI Integration

This package provides intelligent agent capabilities for the KAI platform using [crewAI](https://github.com/crewai/crewai). The integration enables both frontend user-facing agents and backend system agents to enhance the platform experience.

## Architecture Overview

### Core Components

- **Agent System**: Centralized system for managing agent initialization, configuration, and lifecycle
- **Agent Types**: Type definitions and interfaces for different agent roles and capabilities
- **Tools**: Specialized functions that agents can use to interact with KAI systems
- **Utilities**: Common utilities for logging, error handling, and data processing

### Frontend Agents

Frontend agents provide intelligent assistance directly to users:

1. **Recognition Assistant**: Enhances the image upload and recognition workflow by:
   - Providing guidance for optimal image capture
   - Analyzing recognition results with detailed insights
   - Suggesting potential matches and alternatives
   - Explaining material properties and applications

2. **Material Expert** (to be implemented): Provides in-depth knowledge about materials:
   - Detailed information about material properties and applications
   - Comparative analysis between similar materials
   - Installation recommendations and best practices
   - Technical specifications and compliance information

3. **Project Assistant** (to be implemented): Helps users organize and plan material projects:
   - Material selection guidance based on project requirements
   - Quantity estimation and cost calculations
   - Material compatibility and combination suggestions
   - Project timeline and phasing recommendations

### Backend Agents

Backend agents operate on system operations and data:

1. **Knowledge Base Agent**: Monitors and enhances the knowledge base:
   - Data quality assessment and improvement recommendations
   - Relationship detection between materials
   - Metadata optimization suggestions
   - Search index performance monitoring

2. **Analytics Agent** (to be implemented): Analyzes system and user behavior:
   - Usage pattern recognition and insights
   - Anomaly detection in usage metrics
   - User behavior analysis and recommendations
   - Trend identification and forecasting

3. **Operations Agent** (to be implemented): Assists in system operations:
   - Proactive system monitoring and issue detection
   - Performance optimization recommendations
   - Resource allocation suggestions
   - Automated maintenance and cleanup tasks

### Agent Tools

Tools are specialized functions that agents can use to interact with the KAI platform:

1. **Material Search**: Find materials in the KAI database using text-based search
2. **Image Analysis**: Analyze images to extract properties and assess quality
3. **Vector Search**: Perform semantic similarity searches using vector embeddings

Additional tools (to be implemented):
- PDF Analysis
- Metadata Extraction
- Relationship Discovery
- Bulk Operations

## Integration Points

### Frontend Integration

The frontend integration connects agents with the user interface:

1. **Material Recognition Flow**:
   - Enhanced file upload with agent-assisted guidance
   - Intelligent analysis of recognition results
   - Interactive Q&A about recognized materials

2. **Material Browsing**:
   - Agent-assisted search and filtering
   - Comparative analysis of similar materials
   - Personalized recommendations based on history and preferences

3. **Project Planning**:
   - Material selection assistance
   - Quantity and cost estimation
   - Compatibility checking and suggestions

### Backend Integration

The backend integration enables system-level intelligence:

1. **Knowledge Base Management**:
   - Automated quality assurance and improvement
   - Intelligent indexing and relationship mapping
   - Anomaly detection and correction

2. **System Monitoring**:
   - Performance analysis and optimization
   - Usage pattern detection
   - Proactive issue identification

3. **Admin Interface**:
   - Natural language querying for complex operations
   - Insight generation and reporting
   - Automated task handling and delegation

## Implementation Process

The implementation of the crewAI integration follows these phases:

### Phase 1: Foundation (Current)

- ✅ Basic package structure and configuration
- ✅ Core agent system architecture
- ✅ Agent type definitions and interfaces
- ✅ Initial tool implementations
- ✅ Base agent implementations (RecognitionAssistant, KnowledgeBaseAgent)

### Phase 2: Frontend Integration

- Frontend interface components for agent interaction
- Integration with existing recognition workflow
- User feedback collection and adaptation
- Comprehensive testing and refinement

### Phase 3: Backend Integration

- Admin interface enhancements for agent interaction
- System monitoring and analytics dashboards
- Integration with existing knowledge base operations
- Automated workflows and processes

### Phase 4: Advanced Capabilities

- Multi-agent collaboration for complex tasks
- Adaptive learning based on user feedback
- Performance optimization and scaling
- Additional specialized agents and tools

## Usage Examples

### Initializing the Agent System

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

### Creating a Recognition Assistant

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

### Using the Knowledge Base Agent

```typescript
import { createAgent, AgentType } from '@kai/agents';

const agent = await createAgent({
  id: 'kb-agent-1',
  type: AgentType.KNOWLEDGE_BASE_AGENT,
  name: 'KB Manager',
  description: 'Manages and enhances the knowledge base',
});

// Analyze quality issues
const qualityIssues = await agent.instance.analyzeQualityIssues({
  materialType: 'tile',
  severity: 'high',
  limit: 10,
});

// Answer a natural language query
const answer = await agent.instance.answerQuery(
  'What are the most common relationships between marble tiles and what other materials are they typically paired with?'
);
```

## Next Steps

To complete the integration:

1. Install required dependencies:
   ```
   yarn add crewai crewai-tools langchain redis winston
   yarn add -D @types/node
   ```

2. Implement the remaining agent types:
   - MaterialExpert
   - ProjectAssistant
   - AnalyticsAgent
   - OperationsAgent

3. Develop frontend components for agent interaction:
   - Chat interface
   - Agent feedback mechanism
   - Agent configuration panel

4. Create backend integration points:
   - Admin dashboard widgets
   - Monitoring and analytics views
   - Natural language query interface

5. Implement comprehensive testing:
   - Unit tests for agent behaviors
   - Integration tests with KAI systems
   - User acceptance testing

## Contributing

When contributing to the agents package:

1. Follow the existing architecture and patterns
2. Add comprehensive documentation for new agents and tools
3. Implement proper error handling and logging
4. Include tests for new functionality
5. Consider performance implications, especially for user-facing agents
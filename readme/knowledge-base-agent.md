# Knowledge Base Agent

This document provides detailed information about the Knowledge Base Agent, a specialized crewAI agent designed to monitor and enhance the knowledge base within the KAI platform.

## Overview

The Knowledge Base Agent serves as an intelligent monitor and curator of the KAI material knowledge base. It continuously analyzes materials, identifies relationships, suggests metadata improvements, and ensures data quality. This agent operates in the background, responding to system events and providing insights to maintain a high-quality, well-organized knowledge repository.

## Key Capabilities

The Knowledge Base Agent offers multiple specialized functions:

1. **Data Quality Assurance**
   - Analyze materials for completeness and accuracy
   - Identify inconsistencies and data gaps
   - Monitor metadata quality and suggest improvements
   - Check for duplicate or redundant entries

2. **Relationship Management**
   - Identify connections between related materials
   - Suggest new relationships based on similarity analysis
   - Maintain consistency across material hierarchies
   - Ensure proper categorization and classification

3. **Event Processing**
   - React to material additions, updates, and deletions
   - Process search index updates and optimizations
   - Analyze changes and their impact on the knowledge base
   - Suggest adjustments based on system events

4. **Knowledge Base Insights**
   - Generate statistics about knowledge base composition
   - Identify trends in material data
   - Highlight areas for expansion or improvement
   - Provide analytics on knowledge base usage and coverage

5. **Query Answering**
   - Respond to natural language questions about the knowledge base
   - Provide administrative insights and recommendations
   - Answer questions about content organization and structure
   - Suggest optimizations for knowledge base management

## Architecture

The Knowledge Base Agent integrates with the broader KAI platform through several key components:

### Component Structure

```
packages/
├── agents/
│   ├── src/
│   │   ├── backend/
│   │   │   └── knowledgeBaseAgent.ts     # Agent implementation
│   │   ├── services/
│   │   │   └── serviceFactory.ts         # Service creation system
│   │   ├── tools/
│   │   │   ├── materialSearch.ts         # Material search tool
│   │   │   ├── vectorSearch.ts           # Vector search tool
│   │   │   └── index.ts                  # Tool exports
│   │   └── core/
│   │       └── types.ts                  # Agent type definitions
└── server/
    └── src/
        └── controllers/
            └── knowledgeBase.controller.ts  # Backend integration point
```

### Architectural Layers

1. **Agent Layer** (`knowledgeBaseAgent.ts`)
   - Implements the agent's core capabilities
   - Defines specialized methods for knowledge base management
   - Processes system events related to the knowledge base
   - Handles quality analysis and insights generation

2. **Service Layer** (via ServiceFactory)
   - Provides access to material database and search systems
   - Handles API communication with error management
   - Formats requests and responses appropriately
   - Acts as a bridge to backend knowledge base services

3. **Tool Layer** (materialSearch, vectorSearch)
   - Implements specialized tools for the agent to use
   - Enables text-based material database queries
   - Provides vector-based similarity searches
   - Formats results for agent consumption

4. **Controller Layer** (`knowledgeBase.controller.ts`)
   - Integrates the agent with the server's knowledge base endpoints
   - Routes system events to the agent for processing
   - Provides administrative interfaces for agent insights
   - Manages agent sessions and state

## Implementation Details

### Agent Implementation

The Knowledge Base Agent is a SystemAgent type that implements several specialized methods for knowledge base management:

```typescript
export class KnowledgeBaseAgent implements SystemAgent {
  // Standard SystemAgent properties
  public id: string;
  public type: AgentType;
  public name: string;
  public description: string;
  public agent: Agent;
  public config: AgentConfig;

  // SystemAgent methods
  public getAgent(): Agent;
  public async runTask(taskDescription: string, context?: Record<string, any>): Promise<any>;
  public async processEvent(eventType: string, eventData: any): Promise<void>;

  // Knowledge Base specific methods
  public async analyzeQualityIssues(options?: { 
    materialType?: string;
    severity?: 'low' | 'medium' | 'high';
    limit?: number;
  }): Promise<any>;
  public async generateInsights(): Promise<any>;
  public async answerQuery(query: string): Promise<string>;

  // Event handler methods
  private async handleMaterialAdded(data: any): Promise<void>;
  private async handleMaterialUpdated(data: any): Promise<void>;
  private async handleMaterialDeleted(data: any): Promise<void>;
  private async handleSearchIndexUpdated(data: any): Promise<void>;
}
```

### Event Processing

The Knowledge Base Agent processes several types of system events:

```typescript
// Process events based on type
switch (eventType) {
  case 'material_added':
    await this.handleMaterialAdded(eventData);
    break;
    
  case 'material_updated':
    await this.handleMaterialUpdated(eventData);
    break;
    
  case 'material_deleted':
    await this.handleMaterialDeleted(eventData);
    break;
    
  case 'search_index_updated':
    await this.handleSearchIndexUpdated(eventData);
    break;
    
  default:
    logger.warn(`Unknown event type: ${eventType}`);
}
```

### Agent Tools

The Knowledge Base Agent leverages specialized tools to perform its tasks:

```typescript
// Tool for searching materials in the database
const materialSearchTool = await createMaterialSearchTool();

// Tool for performing vector-based similarity searches
const vectorSearchTool = await createVectorSearchTool();

// Create a Knowledge Base Agent with tools
const tools: Tool[] = [
  materialSearchTool,
  vectorSearchTool,
  // Additional tools would be added here in a real implementation
];
```

### Agent Description

The Knowledge Base Agent is defined with the following characteristics:

```typescript
const agent = new Agent({
  name: 'Knowledge Base Expert',
  role: 'Knowledge Base Expert',
  goal: 'Maintain and enhance the quality and value of the material knowledge base',
  backstory: 'You are an AI assistant specialized in knowledge management and material science. You help ensure the KAI knowledge base contains high-quality, well-structured information about materials.',
  verbose: true,
  allowDelegation: false,
  tools,
  llm: {
    model: modelSettings.name,
    temperature: modelSettings.temperature,
  },
});
```

## Setup Instructions

### Prerequisites

- Functioning KAI platform with knowledge base and material database
- CrewAI integration set up according to [CrewAI installation guide](./agents-crewai-installation.md)
- Event handling system for knowledge base operations

### Installation

The Knowledge Base Agent is included in the standard crewAI integration package:

```bash
# Navigate to the agents directory
cd packages/agents

# Install dependencies if not already done
yarn install
```

### Configuration

Configure the agent in your application initialization:

```typescript
import { createKnowledgeBaseAgent } from '@kai/agents';

// Create a Knowledge Base Agent instance
const knowledgeBaseAgent = await createKnowledgeBaseAgent(
  {
    id: 'knowledge-base-agent-1',
    // Additional configuration options
  },
  {
    provider: 'openai',
    name: 'gpt-4',
    temperature: 0.2
  }
);
```

## Usage Examples

### Processing System Events

```typescript
import { createKnowledgeBaseAgent } from '@kai/agents';

// Create the Knowledge Base Agent
const knowledgeBaseAgent = await createKnowledgeBaseAgent(
  { id: 'knowledge-base-agent-1' },
  { provider: 'openai', name: 'gpt-4', temperature: 0.2 }
);

// Process a material added event
await knowledgeBaseAgent.processEvent('material_added', {
  id: 'mat-123',
  name: 'Travertine Limestone',
  type: 'natural_stone',
  properties: {
    color: 'beige',
    finish: 'honed',
    composition: 'calcium carbonate'
  },
  metadata: {
    origin: 'Italy',
    applications: ['flooring', 'countertops', 'wall cladding']
  }
});

// Process a material updated event
await knowledgeBaseAgent.processEvent('material_updated', {
  id: 'mat-456',
  current: {
    // Current state of the material
  },
  previous: {
    // Previous state of the material
  },
  changedFields: ['properties.durability', 'metadata.applications']
});
```

### Analyzing Knowledge Base Quality

```typescript
import { createKnowledgeBaseAgent } from '@kai/agents';

// Create the Knowledge Base Agent
const knowledgeBaseAgent = await createKnowledgeBaseAgent(
  { id: 'knowledge-base-agent-1' },
  { provider: 'openai', name: 'gpt-4', temperature: 0.2 }
);

// Analyze quality issues in the knowledge base
const qualityIssues = await knowledgeBaseAgent.analyzeQualityIssues({
  materialType: 'ceramic_tile',
  severity: 'medium',
  limit: 10
});

console.log('Quality issues:', qualityIssues);

// Generate insights about the knowledge base
const insights = await knowledgeBaseAgent.generateInsights();
console.log('Knowledge base insights:', insights);

// Answer a query about the knowledge base
const answer = await knowledgeBaseAgent.answerQuery(
  'What categories of materials are underrepresented in our knowledge base?'
);
console.log('Answer:', answer);
```

### Running Custom Tasks

```typescript
import { createKnowledgeBaseAgent } from '@kai/agents';

// Create the Knowledge Base Agent
const knowledgeBaseAgent = await createKnowledgeBaseAgent(
  { id: 'knowledge-base-agent-1' },
  { provider: 'openai', name: 'gpt-4', temperature: 0.2 }
);

// Run a custom task with the agent
const result = await knowledgeBaseAgent.runTask(
  'Analyze the consistency of metadata fields across all porcelain tile materials',
  {
    materialType: 'porcelain_tile',
    metadataFields: ['color', 'finish', 'size', 'water_absorption']
  }
);

console.log('Custom task result:', result);
```

## Advanced Configuration

### Custom Knowledge Base Tools

Create custom tools to enhance the Knowledge Base Agent's capabilities:

```typescript
import { Tool } from 'crewai';

// Create a specialized knowledge graph analysis tool
const createKnowledgeGraphTool = async (): Promise<Tool> => {
  return new Tool({
    name: 'knowledge_graph_analysis',
    description: 'Analyze the knowledge graph structure and identify optimization opportunities',
    func: async (args) => {
      const { scope, depth } = JSON.parse(args);
      
      // Implement knowledge graph analysis
      const analysis = await analyzeKnowledgeGraph(scope, depth);
      
      return JSON.stringify({
        nodeCount: analysis.nodes,
        edgeCount: analysis.edges,
        clusterCoefficient: analysis.clustering,
        centralNodes: analysis.centralEntities,
        disconnectedComponents: analysis.disconnectedComponents,
        recommendedLinks: analysis.suggestedConnections
      });
    }
  });
};

// Add it to the agent
const knowledgeBaseAgent = await createKnowledgeBaseAgent(
  { 
    id: 'advanced-kb-agent-1',
    additionalTools: [await createKnowledgeGraphTool()]
  },
  { provider: 'openai', name: 'gpt-4', temperature: 0.2 }
);
```

### Integration with External Knowledge Sources

Connect the Knowledge Base Agent to external knowledge repositories:

```typescript
import { Tool } from 'crewai';

// Create a tool for accessing external material databases
const createExternalKnowledgeTool = async (): Promise<Tool> => {
  return new Tool({
    name: 'external_knowledge_access',
    description: 'Access external material knowledge bases and standards databases',
    func: async (args) => {
      const { source, query, limit } = JSON.parse(args);
      
      // Implement external knowledge access
      const results = await queryExternalKnowledge(source, query, limit);
      
      return JSON.stringify({
        source: source,
        query: query,
        results: results.map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          properties: item.properties,
          url: item.sourceUrl
        }))
      });
    }
  });
};

// Add it to the agent
const knowledgeBaseAgent = await createKnowledgeBaseAgent(
  { 
    id: 'integrated-kb-agent-1',
    additionalTools: [await createExternalKnowledgeTool()]
  },
  { provider: 'openai', name: 'gpt-4', temperature: 0.2 }
);
```

## Performance Considerations

### Knowledge Processing Optimization

1. **Batch Processing**
   - Group similar events for bulk processing
   - Implement priority queues for event processing
   - Schedule intensive analyses during off-peak times

2. **Caching Strategy**
   - Cache frequently accessed knowledge structures
   - Implement incremental analyses for large knowledge bases
   - Store previous analysis results for comparison

3. **Resource Management**
   - Limit the scope of analysis for real-time responses
   - Implement depth controls for knowledge graph traversal
   - Use sampling techniques for large material collections

## Security Considerations

1. **Data Access Control**
   - Enforce appropriate permissions for knowledge base operations
   - Implement audit logs for agent-initiated changes
   - Restrict sensitive material information access

2. **Information Integrity**
   - Verify suggested changes against validation rules
   - Implement approval workflows for structural modifications
   - Maintain versioning for all knowledge base modifications

3. **Agent Boundaries**
   - Restrict the agent to knowledge base operations
   - Validate inputs to prevent injection attacks
   - Limit write access to critical knowledge structures

## Related Documentation

- [Knowledge Base](./knowledge-base.md) - Core knowledge base architecture
- [Database and Vector DB](./database-vector-db.md) - Storage system details
- [CrewAI Integration](./agents-crewai.md) - Overall agent system architecture
- [CrewAI Implementation](./agents-crewai-implementation.md) - Implementation details
- [Agent Installation](./agents-crewai-installation.md) - Setup instructions
# Project Assistant

This document provides detailed information about the Project Assistant, a specialized crewAI agent designed to help with material project planning and organization within the KAI platform.

## Overview

The Project Assistant agent helps users organize materials into cohesive projects, calculate quantities, estimate costs, and plan material applications. It serves as a project planning specialist that transforms material selections into actionable project plans with practical implementation guidance.

## Key Capabilities

The Project Assistant offers multiple specialized functions:

1. **Project Organization**
   - Help users organize selected materials into coherent projects
   - Create logical groupings based on rooms or application areas
   - Suggest complementary materials to complete a project
   - Maintain consistency across material selections

2. **Quantity Calculation**
   - Calculate required material quantities based on dimensions
   - Account for waste factors and installation patterns
   - Provide accurate material ordering guidance
   - Help optimize material usage to minimize waste

3. **Cost Estimation**
   - Provide estimated cost ranges for selected materials
   - Calculate total project material costs
   - Suggest budget alternatives when appropriate
   - Help users understand price-quality tradeoffs

4. **Application Planning**
   - Provide guidance on material application techniques
   - Create step-by-step installation sequences
   - Suggest required tools and accessories
   - Outline preparation requirements for surfaces

5. **Timeline Management**
   - Help estimate project duration based on scope
   - Create logical installation sequencing
   - Identify potential schedule dependencies
   - Suggest efficient project workflows

## Architecture

The Project Assistant integrates with the broader KAI platform through several key components:

### Component Structure

```
packages/
├── agents/
│   ├── src/
│   │   ├── frontend/
│   │   │   └── projectAssistant.ts       # Agent implementation
│   │   ├── services/
│   │   │   └── serviceFactory.ts         # Service creation system
│   │   ├── tools/
│   │   │   ├── materialSearch.ts         # Material search tool
│   │   │   ├── vectorSearch.ts           # Vector search tool
│   │   │   └── index.ts                  # Tool exports
│   │   └── core/
│   │       └── types.ts                  # Agent type definitions
└── client/
    └── src/
        └── components/
            └── agents/
                ├── ProjectAssistantPanel.tsx  # Client-side interface
                └── AgentDashboard.tsx         # Agent integration in UI
```

### Architectural Layers

1. **Agent Layer** (`projectAssistant.ts`)
   - Implements the agent's core capabilities
   - Defines specialized methods for project planning tasks
   - Processes user queries about project organization and planning
   - Manages context for comprehensive project planning

2. **Service Layer** (via ServiceFactory)
   - Provides access to material database and pricing information
   - Handles API communication with error management
   - Formats requests and responses appropriately
   - Acts as a bridge to backend material services

3. **Tool Layer** (materialSearch, vectorSearch)
   - Implements specialized tools for the agent to use
   - Enables text-based material database queries
   - Provides vector-based similarity searches
   - Formats results for agent consumption

4. **UI Layer** (`ProjectAssistantPanel.tsx`)
   - Presents the agent's capabilities in the user interface
   - Provides chat interface for project planning queries
   - Displays project organization with material groupings
   - Facilitates material quantity and cost calculations

## Implementation Details

### Agent Implementation

The Project Assistant is a UserFacingAgent type that implements specialized methods for project planning tasks:

```typescript
export class ProjectAssistant implements UserFacingAgent {
  // Standard UserFacingAgent properties
  public id: string;
  public type: AgentType;
  public name: string;
  public description: string;
  public agent: Agent;
  public config: AgentConfig;

  // Project-specific methods
  public async processUserInput(message: string): Promise<string>;
}
```

### Agent Tools

The Project Assistant leverages specialized tools to perform its tasks:

```typescript
// Tool for searching materials in the database
const materialSearchTool = await createMaterialSearchTool();

// Tool for performing vector-based similarity searches
const vectorSearchTool = await createVectorSearchTool();

// Create a Project Assistant with tools
const tools = [
  materialSearchTool,
  vectorSearchTool
];

// Additional tools can be added from the configuration
if (config.additionalTools) {
  tools.push(...config.additionalTools);
}
```

### Agent Description

The Project Assistant is defined with the following characteristics:

```typescript
const agent = new Agent({
  name: 'Project Assistant',
  role: 'Project planning specialist who helps organize materials and estimate quantities',
  goal: 'Help users plan and organize their materials into cohesive projects with accurate quantities and costs',
  backstory: 'With expertise in project management and material application, I can help you organize materials, calculate quantities, and plan material applications for optimal results.',
  verbose: config.verbose || false,
  llm: modelSettings,
  tools
});
```

### Client-Side Integration

The Project Assistant is integrated into the client interface through a specialized panel that provides:

1. **Chat Interface** - For asking questions about project planning
2. **Material Grouping** - For organizing materials into logical project sections
3. **Quantity Calculator** - For determining required material amounts
4. **Cost Estimator** - For projecting total material costs
5. **Application Guide** - For step-by-step material application instructions

## Setup Instructions

### Prerequisites

- Functioning KAI platform with material database
- CrewAI integration set up according to [CrewAI installation guide](./agents-crewai-installation.md)
- Vector search capabilities for material similarity

### Installation

The Project Assistant is included in the standard crewAI integration package:

```bash
# Navigate to the agents directory
cd packages/agents

# Install dependencies if not already done
yarn install
```

### Configuration

Configure the agent in your application initialization:

```typescript
import { createProjectAssistant } from '@kai/agents';

// Create a Project Assistant instance
const projectAssistant = await createProjectAssistant(
  {
    id: 'project-assistant-1',
    name: 'Project Assistant',
    description: 'Expert in project planning and material organization',
    verbose: true,
    // Additional configuration options
  },
  {
    model: 'gpt-4',
    temperature: 0.3
  }
);
```

## Usage Examples

### Client-Side Integration

```tsx
import React from 'react';
import { ProjectAssistantPanel } from '../components/agents/ProjectAssistantPanel';

const ProjectAssistantPage: React.FC = () => {
  return (
    <div className="project-assistant-page">
      <h1>Project Assistant</h1>
      <ProjectAssistantPanel />
    </div>
  );
};

export default ProjectAssistantPage;
```

### Processing User Queries

```typescript
import { createProjectAssistant } from '@kai/agents';

// Create the Project Assistant
const projectAssistant = await createProjectAssistant(
  { id: 'project-assistant-1' },
  { model: 'gpt-4', temperature: 0.3 }
);

// Ask questions about project planning
const query1 = 'How much porcelain tile do I need for a 15x20 foot kitchen with 8-inch tiles?';
const response1 = await projectAssistant.processUserInput(query1);
console.log(response1);

const query2 = 'I\'m working on a bathroom renovation with marble floor and porcelain wall tiles. What other materials should I consider?';
const response2 = await projectAssistant.processUserInput(query2);
console.log(response2);

const query3 = 'What\'s the typical installation sequence for a kitchen backsplash project?';
const response3 = await projectAssistant.processUserInput(query3);
console.log(response3);
```

## Advanced Configuration

### Custom Project Calculator Tool

Create custom tools to enhance the Project Assistant's capabilities:

```typescript
import { Tool } from 'crewai';

// Create a specialized project calculator tool
const createProjectCalculatorTool = async (): Promise<Tool> => {
  return new Tool({
    name: 'project_calculator',
    description: 'Calculate material quantities, costs, and timelines for projects',
    func: async (args) => {
      const { project, dimensions, materialIds } = JSON.parse(args);
      
      // Implement project calculations
      const calculations = await calculateProjectRequirements(
        project,
        dimensions,
        materialIds
      );
      
      return JSON.stringify({
        quantities: calculations.quantities,
        costs: calculations.costs,
        timeline: calculations.timeline,
        labor: calculations.laborEstimate
      });
    }
  });
};

// Add it to the agent
const projectAssistant = await createProjectAssistant(
  { 
    id: 'advanced-project-assistant-1',
    additionalTools: [await createProjectCalculatorTool()]
  },
  { model: 'gpt-4', temperature: 0.3 }
);
```

### Integration with Professional Standards

Connect the Project Assistant to industry standards databases:

```typescript
import { Tool } from 'crewai';

// Create a tool for accessing industry installation standards
const createInstallationStandardsTool = async (): Promise<Tool> => {
  return new Tool({
    name: 'installation_standards',
    description: 'Access industry standards for material installation methods',
    func: async (args) => {
      const { materialType, installationType } = JSON.parse(args);
      
      // Implement standards retrieval
      const standards = await getIndustryStandards(materialType, installationType);
      
      return JSON.stringify({
        standardName: standards.name,
        organization: standards.issuingBody,
        requirements: standards.requirements,
        bestPractices: standards.bestPractices,
        certificationNeeded: standards.requiresCertification
      });
    }
  });
};

// Add it to the agent
const projectAssistant = await createProjectAssistant(
  { 
    id: 'professional-project-assistant-1',
    additionalTools: [await createInstallationStandardsTool()]
  },
  { model: 'gpt-4', temperature: 0.3 }
);
```

## Performance Considerations

### Calculation Optimization

1. **Caching Strategy**
   - Cache common calculation formulas and results
   - Implement TTL-based cache invalidation for price updates
   - Pre-compute standard room layouts for quick estimates

2. **Query Optimization**
   - Use indexed material properties for faster lookup
   - Batch related calculations for efficiency
   - Optimize algorithm selection based on query complexity

3. **Response Construction**
   - Use standardized templates for common project plans
   - Progressive loading for detailed project information
   - Reuse calculation results across related queries

## Security Considerations

1. **Data Access Control**
   - Enforce appropriate permissions for pricing information
   - Implement proper user authentication for saved projects
   - Limit access to proprietary application techniques

2. **Information Accuracy**
   - Verify material installation requirements against reliable sources
   - Provide disclaimers for cost and timeline estimates
   - Implement fact-checking mechanisms for technical recommendations

3. **Agent Boundaries**
   - Restrict the agent to project planning operations
   - Validate inputs to prevent injection attacks
   - Avoid providing professional advice that requires certification

## Related Documentation

- [Material Expert](./material-expert.md) - Companion agent for material information
- [Knowledge Base](./knowledge-base.md) - Material database structure and management
- [CrewAI Integration](./agents-crewai.md) - Overall agent system architecture
- [CrewAI Implementation](./agents-crewai-implementation.md) - Implementation details
- [Agent Installation](./agents-crewai-installation.md) - Setup instructions
# Material Expert

This document provides detailed information about the Material Expert, a specialized crewAI agent that serves as a knowledge source for construction materials within the KAI platform.

## Overview

The Material Expert agent provides comprehensive information about construction materials, their properties, applications, compatibility, and best practices. It leverages the KAI platform's material database to offer detailed insights and recommendations, helping users make informed decisions about material selection and usage.

## Key Capabilities

The Material Expert offers multiple specialized functions:

1. **Material Property Information**
   - Provide detailed specifications about material properties
   - Explain technical characteristics (hardness, porosity, etc.)
   - Describe appearance characteristics and visual properties
   - Detail manufacturing processes and composition

2. **Application Guidance**
   - Recommend optimal materials for specific applications
   - Explain suitability factors for different environments
   - Provide installation requirements and considerations
   - Offer maintenance guidelines and best practices

3. **Compatibility Analysis**
   - Assess compatibility between different materials
   - Explain potential interaction issues or benefits
   - Recommend complementary materials for projects
   - Identify potential chemical or physical incompatibilities

4. **Comparison Services**
   - Compare multiple materials side-by-side
   - Highlight key differences and similarities
   - Assess cost-benefit tradeoffs between options
   - Provide objective assessments of relative advantages

5. **Problem-Solving Support**
   - Diagnose material-related issues or failures
   - Suggest solutions to common material problems
   - Provide remediation approaches for material defects
   - Offer preventative maintenance advice

## Architecture

The Material Expert integrates with the broader KAI platform through several key components:

### Component Structure

```
packages/
├── agents/
│   ├── src/
│   │   ├── frontend/
│   │   │   └── materialExpert.ts         # Agent implementation
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
                ├── MaterialExpertPanel.tsx # Client-side interface
                └── AgentDashboard.tsx      # Agent integration in UI
```

### Architectural Layers

1. **Agent Layer** (`materialExpert.ts`)
   - Implements the agent's core capabilities
   - Defines specialized methods for material information tasks
   - Processes user queries about materials
   - Manages context for detailed material information

2. **Service Layer** (via ServiceFactory)
   - Provides access to material database
   - Handles API communication with error management
   - Formats requests and responses appropriately
   - Acts as a bridge to backend material services

3. **Tool Layer** (materialSearch, vectorSearch)
   - Implements specialized tools for the agent to use
   - Enables text-based material database queries
   - Provides vector-based similarity searches
   - Formats results for agent consumption

4. **UI Layer** (`MaterialExpertPanel.tsx`)
   - Presents the agent's capabilities in the user interface
   - Provides chat interface for material queries
   - Displays material information with rich formatting
   - Supports comparison views for multiple materials

## Implementation Details

### Agent Implementation

The Material Expert is a UserFacingAgent type that implements specialized methods for material information tasks:

```typescript
export class MaterialExpert implements UserFacingAgent {
  // Standard UserFacingAgent properties
  public id: string;
  public type: AgentType;
  public name: string;
  public description: string;
  public agent: Agent;
  public config: AgentConfig;

  // Material-specific methods
  public async processUserInput(message: string): Promise<string>;
}
```

### Agent Tools

The Material Expert leverages specialized tools to perform its tasks:

```typescript
// Tool for searching materials in the database
const materialSearchTool = await createMaterialSearchTool();

// Tool for performing vector-based similarity searches
const vectorSearchTool = await createVectorSearchTool();

// Create a Material Expert with tools
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

The Material Expert is defined with the following characteristics:

```typescript
const agent = new Agent({
  name: 'Material Expert',
  role: 'Construction material specialist with deep knowledge of materials and their properties',
  goal: 'Provide accurate and detailed information about construction materials to help users make informed decisions',
  backstory: 'With years of experience in material science and construction, I can identify materials, explain their properties, and recommend the best options for specific applications.',
  verbose: config.verbose || false,
  llm: modelSettings,
  tools
});
```

### Client-Side Integration

The Material Expert is integrated into the client interface through a specialized panel that provides:

1. **Chat Interface** - For asking questions about materials
2. **Material Display** - For viewing detailed information about materials
3. **Comparison View** - For comparing multiple materials side-by-side
4. **Related Materials** - For discovering similar or complementary materials

## Setup Instructions

### Prerequisites

- Functioning KAI platform with material database
- CrewAI integration set up according to [CrewAI installation guide](./agents-crewai-installation.md)
- Vector search capabilities for material similarity

### Installation

The Material Expert is included in the standard crewAI integration package:

```bash
# Navigate to the agents directory
cd packages/agents

# Install dependencies if not already done
yarn install
```

### Configuration

Configure the agent in your application initialization:

```typescript
import { createMaterialExpert } from '@kai/agents';

// Create a Material Expert instance
const materialExpert = await createMaterialExpert(
  {
    id: 'material-expert-1',
    name: 'Material Expert',
    description: 'Expert in construction materials and their properties',
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
import { MaterialExpertPanel } from '../components/agents/MaterialExpertPanel';

const MaterialExpertPage: React.FC = () => {
  return (
    <div className="material-expert-page">
      <h1>Material Expert</h1>
      <MaterialExpertPanel />
    </div>
  );
};

export default MaterialExpertPage;
```

### Processing User Queries

```typescript
import { createMaterialExpert } from '@kai/agents';

// Create the Material Expert
const materialExpert = await createMaterialExpert(
  { id: 'material-expert-1' },
  { model: 'gpt-4', temperature: 0.3 }
);

// Ask questions about materials
const query1 = 'What are the key differences between ceramic and porcelain tiles?';
const response1 = await materialExpert.processUserInput(query1);
console.log(response1);

const query2 = 'What material would you recommend for a bathroom floor that needs to be water-resistant and durable?';
const response2 = await materialExpert.processUserInput(query2);
console.log(response2);

const query3 = 'Are concrete countertops compatible with epoxy sealants?';
const response3 = await materialExpert.processUserInput(query3);
console.log(response3);
```

## Advanced Configuration

### Custom Material Analysis Tools

Create custom tools to enhance the Material Expert's capabilities:

```typescript
import { Tool } from 'crewai';

// Create a specialized material analysis tool for environmental impact
const createEnvironmentalImpactTool = async (): Promise<Tool> => {
  return new Tool({
    name: 'environmental_impact_analysis',
    description: 'Analyze the environmental impact of materials based on lifecycle assessment data',
    func: async (args) => {
      const { materialId } = JSON.parse(args);
      
      // Implement environmental impact analysis
      const impactData = await analyzeMaterialEnvironmentalImpact(materialId);
      
      return JSON.stringify({
        carbonFootprint: impactData.carbonFootprint,
        energyConsumption: impactData.energyConsumption,
        waterUsage: impactData.waterUsage,
        recycleability: impactData.recycleability,
        sustainabilityScore: impactData.overallScore
      });
    }
  });
};

// Add it to the agent
const materialExpert = await createMaterialExpert(
  { 
    id: 'eco-material-expert-1',
    additionalTools: [await createEnvironmentalImpactTool()]
  },
  { model: 'gpt-4', temperature: 0.3 }
);
```

### Integration with Material Testing Data

Connect the Material Expert to material testing databases:

```typescript
import { Tool } from 'crewai';

// Create a tool for accessing material testing data
const createMaterialTestingTool = async (): Promise<Tool> => {
  return new Tool({
    name: 'material_testing_data',
    description: 'Access technical testing data for materials including stress tests, durability metrics, etc.',
    func: async (args) => {
      const { materialId, testType } = JSON.parse(args);
      
      // Implement testing data retrieval
      const testingData = await getMaterialTestResults(materialId, testType);
      
      return JSON.stringify(testingData);
    }
  });
};

// Add it to the agent
const materialExpert = await createMaterialExpert(
  { 
    id: 'technical-material-expert-1',
    additionalTools: [await createMaterialTestingTool()]
  },
  { model: 'gpt-4', temperature: 0.3 }
);
```

## Performance Considerations

### Knowledge Base Optimization

1. **Caching Strategy**
   - Cache frequently requested material information
   - Implement TTL-based cache invalidation for freshness
   - Pre-compute common material comparisons

2. **Query Optimization**
   - Use indexed material properties for faster lookups
   - Implement faceted search for filtered queries
   - Optimize vector searches with approximate nearest neighbors

3. **Response Construction**
   - Build responses with templated sections where appropriate
   - Use progressive loading for detailed material information
   - Structure responses for optimal client-side rendering

## Security Considerations

1. **Data Access Control**
   - Enforce appropriate permissions for proprietary material data
   - Implement proper user authentication for premium material information
   - Limit access to sensitive supplier or pricing information

2. **Information Accuracy**
   - Verify material information against reliable sources
   - Provide provenance for technical material specifications
   - Implement fact-checking mechanisms for critical properties

3. **Agent Boundaries**
   - Restrict the agent to material-related operations
   - Validate inputs to prevent injection attacks
   - Avoid providing professional advice that requires certification

## Related Documentation

- [Material Recognition](./material-recognition.md) - Core recognition system architecture
- [Knowledge Base](./knowledge-base.md) - Material database structure and management
- [CrewAI Integration](./agents-crewai.md) - Overall agent system architecture
- [CrewAI Implementation](./agents-crewai-implementation.md) - Implementation details
- [Agent Installation](./agents-crewai-installation.md) - Setup instructions